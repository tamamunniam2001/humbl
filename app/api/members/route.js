import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly, canUseKasir, pageAccessOnly } from '@/lib/auth'
import { sendFonnte } from '@/lib/fonnte'
import { phoneCandidates } from '@/lib/wa-bot'
import { renderTemplate } from '@/lib/wa-templates'

const pad = n => String(n).padStart(2, '0')

// Cutoff sama persis dengan analisis/route.js:
// month = 0-indexed (0=Jan..11=Des)
// range: 20 bulan-ini s/d 19 bulan-depan
function getCutoff(year, month) {
  const prevMonth = month === 0 ? 12 : month
  const prevYear = month === 0 ? year - 1 : year
  const currMonth = month + 1
  return {
    gte: new Date(`${prevYear}-${pad(prevMonth)}-20T00:00:00+07:00`),
    lte: new Date(`${year}-${pad(currMonth)}-19T23:59:59.999+07:00`),
  }
}

// Normalisasi nomor telepon: buang spasi/tanda hubung agar konsisten.
function normPhone(v) {
  return String(v || '').replace(/[\s\-().]/g, '')
}

function validate(name, phoneRaw) {
  const nameTrim = String(name || '').trim()
  const phone = normPhone(phoneRaw)
  if (!nameTrim) return { message: 'Nama member wajib diisi' }
  if (!phone) return { message: 'Nomor telepon wajib diisi' }
  if (!/^\+?[0-9]{8,15}$/.test(phone))
    return { message: 'Nomor telepon tidak valid (8–15 digit)' }
  return { name: nameTrim, phone }
}

// GET /api/members — daftar member + agregat pembelian.
// Semua role login boleh membaca (kasir memakainya untuk autocomplete nama
// pelanggan di layar checkout; halaman daftar member memakainya untuk monitor).
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const activeOnly = searchParams.get('active') === '1'
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')

  // month param = 0-indexed (sama dengan analisis/route.js)
  let cutoff = null
  if (yearParam !== null && monthParam !== null) {
    cutoff = getCutoff(Number(yearParam), Number(monthParam))
  }

  const where = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    } : {}),
  }

  const members = await prisma.member.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, phone: true, isActive: true, createdAt: true, welcomeSentAt: true,
      useCustomDiscount: true, customDiscountType: true, customDiscountValue: true, customDiscountMax: true,
      _count: {
        select: { transactions: { where: { status: 'COMPLETED', deletedAt: null } } },
      },
    },
  })

  // Agregat ALL-TIME (selalu dihitung untuk kolom total keseluruhan)
  let aggAllMap = new Map()
  // Agregat PERIODE (hanya bila filter bulan aktif)
  let aggPeriodMap = new Map()

  if (members.length) {
    const ids = members.map(m => m.id)
    const baseWhere = { memberId: { in: ids }, status: 'COMPLETED', deletedAt: null }

    const [aggAll, aggPeriod] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['memberId'],
        where: baseWhere,
        _sum: { total: true, discountAmount: true, voucherDiscount: true },
        _max: { createdAt: true },
        _count: { id: true },
      }),
      cutoff ? prisma.transaction.groupBy({
        by: ['memberId'],
        where: { ...baseWhere, createdAt: { gte: cutoff.gte, lte: cutoff.lte } },
        _sum: { total: true, discountAmount: true, voucherDiscount: true },
        _max: { createdAt: true },
        _count: { id: true },
      }) : Promise.resolve([]),
    ])

    aggAllMap = new Map(aggAll.map(g => [g.memberId, g]))
    aggPeriodMap = new Map(aggPeriod.map(g => [g.memberId, g]))
  }

  return NextResponse.json(members.map(m => {
    const all = aggAllMap.get(m.id)
    const period = cutoff ? (aggPeriodMap.get(m.id) ?? null) : null
    const src = cutoff ? period : all
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      isActive: m.isActive,
      createdAt: m.createdAt,
      purchaseCount: src?._count?.id ?? 0,
      totalSpent: src?._sum?.total ?? 0,
      totalDiscount: (src?._sum?.discountAmount ?? 0) + (src?._sum?.voucherDiscount ?? 0),
      lastPurchase: src?._max?.createdAt ?? null,
      allTimePurchaseCount: all?._count?.id ?? 0,
      allTimeTotalSpent: all?._sum?.total ?? 0,
      welcomeSentAt: m.welcomeSentAt ?? null,
      useCustomDiscount: m.useCustomDiscount,
      customDiscountType: m.customDiscountType,
      customDiscountValue: m.customDiscountValue,
      customDiscountMax: m.customDiscountMax,
    }
  }), { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/members — tambah member baru (admin, kasir, atau custom role dengan akses /member-settings)
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const canAdd = user.role === 'ADMIN' || canUseKasir(user) ||
    (Array.isArray(user.allowedPaths) && user.allowedPaths.includes('/member-settings'))
  if (!canAdd) return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })

  const body = await req.json()
  const v = validate(body.name, body.phone)
  if (v.message) return NextResponse.json({ message: v.message }, { status: 400 })

  let member
  try {
    member = await prisma.member.create({
      data: { name: v.name, phone: v.phone, isActive: body.isActive !== false },
    })
  } catch (e) {
    if (e.code === 'P2002')
      return NextResponse.json({ message: 'Nomor telepon sudah terdaftar' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan member' }, { status: 500 })
  }

  // Kirim pesan selamat datang — di-await agar tidak dipotong serverless runtime
  if (process.env.FONNTE_TOKEN && member.phone) {
    try {
      const tpl = await prisma.messageTemplate.findFirst({
        where: { isWelcome: true, isActive: true, inputType: 'NONE' },
      })
      if (tpl) {
        const target = phoneCandidates(member.phone).find(c => c.startsWith('62'))
        if (target) {
          const message = renderTemplate(tpl.body, { memberName: member.name })
          if (message) {
            await sendFonnte({ target, message })
            await prisma.member.update({ where: { id: member.id }, data: { welcomeSentAt: new Date() } })
          }
        }
      }
    } catch { /* gagal kirim WA tidak boleh blokir pendaftaran member */ }
  }

  return NextResponse.json(member, { status: 201 })
}

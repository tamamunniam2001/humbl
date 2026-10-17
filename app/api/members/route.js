import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly, canUseKasir, pageAccessOnly } from '@/lib/auth'
import { sendFonnte } from '@/lib/fonnte'
import { phoneCandidates } from '@/lib/wa-bot'
import { renderTemplate } from '@/lib/wa-templates'

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
      // Jumlah transaksi lunas per member (Prisma hanya mendukung _count berfilter
      // di level relasi; total & terakhir belanja dihitung terpisah via groupBy).
      _count: {
        select: { transactions: { where: { status: 'COMPLETED', deletedAt: null } } },
      },
    },
  })

  // Agregat total belanja + pembelian terakhir per member (groupBy top-level)
  let aggMap = new Map()
  if (members.length) {
    const agg = await prisma.transaction.groupBy({
      by: ['memberId'],
      where: {
        memberId: { in: members.map(m => m.id) },
        status: 'COMPLETED',
        deletedAt: null,
      },
      _sum: { total: true },
      _max: { createdAt: true },
    })
    aggMap = new Map(agg.map(g => [g.memberId, g]))
  }

  return NextResponse.json(members.map(m => {
    const a = aggMap.get(m.id)
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      isActive: m.isActive,
      createdAt: m.createdAt,
      purchaseCount: m._count.transactions,
      totalSpent: a?._sum.total || 0,
      lastPurchase: a?._max.createdAt || null,
      welcomeSentAt: m.welcomeSentAt || null,
    }
  }))
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

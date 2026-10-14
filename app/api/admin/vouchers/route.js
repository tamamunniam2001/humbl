import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// GET /api/admin/vouchers — daftar semua voucher (admin)
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(vouchers)
}

// POST /api/admin/vouchers — buat voucher baru (admin)
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const body = await req.json()
  const code = String(body.code || '').trim().toUpperCase()
  const type = body.type === 'NOMINAL' ? 'NOMINAL' : 'PERCENT'
  const value = Math.max(0, Math.round(Number(body.value) || 0))
  const minSpend = Math.max(0, Math.round(Number(body.minSpend) || 0))
  const maxDiscount = Math.max(0, Math.round(Number(body.maxDiscount) || 0))
  const quota = Math.max(0, Math.round(Number(body.quota) || 0))

  if (!code) return NextResponse.json({ message: 'Kode voucher wajib diisi' }, { status: 400 })
  if (value <= 0) return NextResponse.json({ message: 'Nilai potongan harus lebih dari 0' }, { status: 400 })
  if (type === 'PERCENT' && value > 100) return NextResponse.json({ message: 'Potongan persen maksimal 100' }, { status: 400 })

  const parseDate = (v) => {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }

  try {
    const voucher = await prisma.voucher.create({
      data: {
        code,
        description: String(body.description || '').trim(),
        type,
        value,
        minSpend,
        maxDiscount: type === 'PERCENT' ? maxDiscount : 0,
        quota,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json(voucher, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Kode voucher sudah digunakan' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan voucher' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// PATCH /api/admin/vouchers/[id] — ubah voucher (admin)
export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const existing = await prisma.voucher.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ message: 'Voucher tidak ditemukan' }, { status: 404 })

  const type = body.type === 'NOMINAL' ? 'NOMINAL' : (body.type === 'PERCENT' ? 'PERCENT' : existing.type)
  const value = body.value != null ? Math.max(0, Math.round(Number(body.value) || 0)) : existing.value
  const minSpend = body.minSpend != null ? Math.max(0, Math.round(Number(body.minSpend) || 0)) : existing.minSpend
  const maxDiscount = body.maxDiscount != null ? Math.max(0, Math.round(Number(body.maxDiscount) || 0)) : existing.maxDiscount
  const quota = body.quota != null ? Math.max(0, Math.round(Number(body.quota) || 0)) : existing.quota

  if (value <= 0) return NextResponse.json({ message: 'Nilai potongan harus lebih dari 0' }, { status: 400 })
  if (type === 'PERCENT' && value > 100) return NextResponse.json({ message: 'Potongan persen maksimal 100' }, { status: 400 })

  const parseDate = (v) => {
    if (v === undefined) return undefined
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }

  const data = {
    description: body.description != null ? String(body.description).trim() : existing.description,
    type, value, minSpend,
    maxDiscount: type === 'PERCENT' ? maxDiscount : 0,
    quota,
    isActive: body.isActive != null ? !!body.isActive : existing.isActive,
  }
  if (body.startDate !== undefined) data.startDate = parseDate(body.startDate)
  if (body.endDate !== undefined) data.endDate = parseDate(body.endDate)
  if (body.code != null) {
    const code = String(body.code).trim().toUpperCase()
    if (!code) return NextResponse.json({ message: 'Kode voucher wajib diisi' }, { status: 400 })
    data.code = code
  }

  try {
    const voucher = await prisma.voucher.update({ where: { id }, data })
    return NextResponse.json(voucher)
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Kode voucher sudah digunakan' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal memperbarui voucher' }, { status: 500 })
  }
}

// DELETE /api/admin/vouchers/[id] — hapus voucher (admin)
export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  try {
    await prisma.voucher.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ message: 'Voucher tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ message: 'Gagal menghapus voucher' }, { status: 500 })
  }
}

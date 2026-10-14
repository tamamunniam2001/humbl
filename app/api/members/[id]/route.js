import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

function normPhone(v) {
  return String(v || '').replace(/[\s\-().]/g, '')
}

// PATCH /api/members/[id] — ubah nama/telepon/status member (admin)
export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const member = await prisma.member.findUnique({ where: { id } })
  if (!member) return NextResponse.json({ message: 'Member tidak ditemukan' }, { status: 404 })

  const data = {}
  if ('name' in body) {
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ message: 'Nama member wajib diisi' }, { status: 400 })
    data.name = name
  }
  if ('phone' in body) {
    const phone = normPhone(body.phone)
    if (!/^\+?[0-9]{8,15}$/.test(phone))
      return NextResponse.json({ message: 'Nomor telepon tidak valid (8–15 digit)' }, { status: 400 })
    data.phone = phone
  }
  if ('isActive' in body) data.isActive = body.isActive !== false

  try {
    const updated = await prisma.member.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    if (e.code === 'P2002')
      return NextResponse.json({ message: 'Nomor telepon sudah terdaftar' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan member' }, { status: 500 })
  }
}

// DELETE /api/members/[id] — hapus member (admin).
// Relasi Transaction.memberId memakai onDelete: SetNull, sehingga riwayat
// transaksi (termasuk snapshot customerName) tetap aman.
export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  const member = await prisma.member.findUnique({ where: { id } })
  if (!member) return NextResponse.json({ message: 'Member tidak ditemukan' }, { status: 404 })

  try {
    await prisma.member.delete({ where: { id } })
    return NextResponse.json({ message: 'Member dihapus' })
  } catch {
    return NextResponse.json({ message: 'Gagal menghapus member' }, { status: 500 })
  }
}

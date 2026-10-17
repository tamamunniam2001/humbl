import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly, pageAccessOnly } from '@/lib/auth'

// PATCH /api/admin/message-templates/[id] — ubah template pesan
export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/wa-message-settings')
  if (denied) return denied

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const existing = await prisma.messageTemplate.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ message: 'Template tidak ditemukan' }, { status: 404 })

  const data = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ message: 'Nama template wajib diisi' }, { status: 400 })
    data.name = name
  }
  if (body.body !== undefined) {
    const text = String(body.body).trim()
    if (!text) return NextResponse.json({ message: 'Isi pesan wajib diisi' }, { status: 400 })
    data.body = text
  }
  if (body.inputType !== undefined)
    data.inputType = body.inputType === 'VOUCHER_CODE' ? 'VOUCHER_CODE' : 'NONE'
  if (body.isActive !== undefined) data.isActive = !!body.isActive

  try {
    const template = await prisma.messageTemplate.update({ where: { id }, data })
    return NextResponse.json(template)
  } catch (e) {
    if (e.code === 'P2002')
      return NextResponse.json({ message: 'Nama template sudah dipakai' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal memperbarui template' }, { status: 500 })
  }
}

// DELETE /api/admin/message-templates/[id] — hapus template pesan
export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/wa-message-settings')
  if (denied) return denied

  const { id } = await params
  try {
    await prisma.messageTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ message: 'Template tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ message: 'Gagal menghapus template' }, { status: 500 })
  }
}
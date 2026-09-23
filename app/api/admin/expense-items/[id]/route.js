import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

const requireJson = req => {
  const method = req.method
  if (method === 'DELETE' && !req.headers.get('content-length')) return null
  return req.headers.get('content-type')?.includes('application/json')
    ? null : NextResponse.json({ message: 'Invalid content type' }, { status: 415 })
}

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const ct = requireJson(req)
  if (ct) return ct
  const { id } = await params
  const { code, name, category, satuan, satuanOpname, konversi, minimalStok } = await req.json()
  try {
    const item = await prisma.expenseItem.update({ where: { id }, data: { code: code || null, name, category: category || '', satuan: satuan || '', satuanOpname: satuanOpname || '', konversi: konversi !== '' && konversi != null ? Number(konversi) : null, minimalStok: minimalStok !== '' && minimalStok != null ? Number(minimalStok) : null } })
    return NextResponse.json(item)
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Kode sudah digunakan' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const ct = requireJson(req)
  if (ct) return ct
  const { id } = await params
  // Kosongkan code dulu agar constraint unique tidak menghalangi pemakaian ulang kode
  await prisma.expenseItem.update({ where: { id }, data: { isActive: false, code: null } })
  return NextResponse.json({ message: 'Item dihapus' })
}

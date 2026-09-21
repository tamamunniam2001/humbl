import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { name, allowedPaths } = await req.json()
  try {
    const role = await prisma.customRole.update({ where: { id }, data: { name: name.trim(), allowedPaths: allowedPaths || [] } })
    return NextResponse.json(role)
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Nama role sudah ada' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  // Lepas semua user dari role ini dulu
  await prisma.user.updateMany({ where: { customRoleId: id }, data: { customRoleId: null } })
  await prisma.customRole.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

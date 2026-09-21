import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  if (user.id === id) return NextResponse.json({ message: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { name, email, role, isActive, password, customRoleId } = await req.json()
  const data = { name, email, role, isActive, customRoleId: customRoleId !== undefined ? (customRoleId || null) : undefined }
  if (password) data.password = await bcrypt.hash(password, 10)
  return NextResponse.json(await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, isActive: true, customRoleId: true } }))
}

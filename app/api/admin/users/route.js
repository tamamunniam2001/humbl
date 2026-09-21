import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  return NextResponse.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, customRoleId: true, customRole: { select: { id: true, name: true } } } }))
}

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { name, email, password, role, customRoleId } = await req.json()
  const hashed = await bcrypt.hash(password, 10)
  const newUser = await prisma.user.create({ data: { name, email, password: hashed, role, customRoleId: customRoleId || null } })
  return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, { status: 201 })
}

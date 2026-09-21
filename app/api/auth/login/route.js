import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

export async function POST(req) {
  const { email, password } = await req.json()
  const user = await prisma.user.findUnique({ where: { email }, include: { customRole: true } })
  if (!user || !user.isActive) return NextResponse.json({ message: 'Email atau password salah' }, { status: 401 })
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return NextResponse.json({ message: 'Email atau password salah' }, { status: 401 })
  const allowedPaths = user.customRole?.allowedPaths || null
  const tokenPayload = { id: user.id, role: user.role, name: user.name, customRole: user.customRole?.name || null }
  if (allowedPaths) tokenPayload.allowedPaths = allowedPaths
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '12h' })
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, customRole: user.customRole?.name || null, allowedPaths } })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const roles = await prisma.customRole.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  })
  return NextResponse.json(roles)
}

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { name, allowedPaths } = await req.json()
  if (!name?.trim()) return NextResponse.json({ message: 'Nama role wajib diisi' }, { status: 400 })
  try {
    const role = await prisma.customRole.create({ data: { name: name.trim(), allowedPaths: allowedPaths || [] } })
    return NextResponse.json(role, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Nama role sudah ada' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan' }, { status: 500 })
  }
}

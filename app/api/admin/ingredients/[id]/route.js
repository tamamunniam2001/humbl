import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { name, unit, code, price, packSize } = await req.json()
  return NextResponse.json(await prisma.ingredient.update({
    where: { id },
    data: {
      name, unit, code: code || null,
      price: price ? Number(price) : null,
      packSize: packSize ? Number(packSize) : null,
    }
  }))
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  await prisma.ingredient.delete({ where: { id } })
  return NextResponse.json({ message: 'Bahan baku dihapus' })
}

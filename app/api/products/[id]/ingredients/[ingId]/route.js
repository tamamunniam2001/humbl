import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { ingId } = await params
  await prisma.productIngredient.delete({ where: { id: ingId } })
  return NextResponse.json({ message: 'Bahan dihapus' })
}

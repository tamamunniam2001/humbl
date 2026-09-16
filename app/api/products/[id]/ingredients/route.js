import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const items = await prisma.productIngredient.findMany({
    where: { productId: id },
    include: { ingredient: true },
    orderBy: { ingredient: { name: 'asc' } },
  })
  return NextResponse.json(items)
}

export async function POST(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { ingredientId, qty } = await req.json()
  try {
    const item = await prisma.productIngredient.create({
      data: { productId: id, ingredientId, qty: Number(qty) },
      include: { ingredient: true },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Bahan sudah ditambahkan' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menambah bahan' }, { status: 500 })
  }
}

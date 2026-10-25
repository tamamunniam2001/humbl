import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const transactionWhere = { status: 'COMPLETED' }
  if (from && to) transactionWhere.createdAt = { gte: new Date(`${from}T00:00:00.000+07:00`), lte: new Date(`${to}T23:59:59.999+07:00`) }
  const orderItems = await prisma.orderItem.findMany({
    where: { transaction: transactionWhere },
    include: { product: { include: { ingredients: { include: { ingredient: true } } } } },
  })
  const usageMap = {}
  for (const oi of orderItems) {
    for (const pi of oi.product.ingredients) {
      if (!usageMap[pi.ingredientId]) usageMap[pi.ingredientId] = { ingredientId: pi.ingredientId, name: pi.ingredient.name, unit: pi.ingredient.unit, packSize: pi.ingredient.packSize ?? 0, totalUsed: 0 }
      usageMap[pi.ingredientId].totalUsed += pi.qty * oi.qty
    }
  }
  return NextResponse.json(Object.values(usageMap).sort((a, b) => b.totalUsed - a.totalUsed))
}

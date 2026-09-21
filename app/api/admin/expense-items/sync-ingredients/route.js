import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const [ingredients, existingItems] = await Promise.all([
    prisma.ingredient.findMany({ where: { isComposite: false }, orderBy: { name: 'asc' } }),
    prisma.expenseItem.findMany({ select: { name: true } }),
  ])

  const existingNames = new Set(existingItems.map(i => i.name.toLowerCase()))
  let created = 0, skipped = 0

  for (const ing of ingredients) {
    if (existingNames.has(ing.name.toLowerCase())) { skipped++; continue }
    await prisma.expenseItem.create({
      data: {
        code: ing.code || null,
        name: ing.name,
        category: 'Persediaan',
        satuan: ing.unit || '',
      },
    })
    created++
  }

  return NextResponse.json({ created, skipped, total: ingredients.length })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

const includeComponents = {
  components: {
    include: { ingredient: true },
    orderBy: { ingredient: { name: 'asc' } },
  },
}

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { name, unit, code, price, packSize, isComposite, components } = await req.json()

  if (isComposite) {
    const compData = components || []
    let calcPrice = null
    if (compData.length > 0) {
      const ids = compData.map(c => c.ingredientId)
      const ings = await prisma.ingredient.findMany({ where: { id: { in: ids } } })
      calcPrice = compData.reduce((sum, c) => {
        const ing = ings.find(i => i.id === c.ingredientId)
        if (!ing?.price || !ing?.packSize) return sum
        return sum + (ing.price / ing.packSize) * Number(c.qty)
      }, 0)
    }
    // Hapus komponen lama, buat ulang
    await prisma.ingredientComponent.deleteMany({ where: { compositeId: id } })
    const result = await prisma.ingredient.update({
      where: { id },
      data: {
        name, unit, code: code || null,
        price: calcPrice,
        packSize: packSize ? Number(packSize) : 1,
        isComposite: true,
        components: compData.length > 0 ? {
          create: compData.map(c => ({ ingredientId: c.ingredientId, qty: Number(c.qty) }))
        } : undefined,
      },
      include: includeComponents,
    })
    return NextResponse.json(result)
  }

  return NextResponse.json(await prisma.ingredient.update({
    where: { id },
    data: {
      name, unit, code: code || null,
      price: price ? Number(price) : null,
      packSize: packSize ? Number(packSize) : null,
      isComposite: false,
    },
    include: includeComponents,
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

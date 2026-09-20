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
  const page = Number(searchParams.get('page') || 1)
  const year = Number(searchParams.get('year') || new Date().getFullYear())
  const limit = 50

  // Mode by kategori
  if (searchParams.get('bykategori') === '1') {
    const katWhere = { transaction: { status: 'COMPLETED', deletedAt: null } }
    if (from && to) katWhere.transaction.createdAt = {
      gte: new Date(`${from}T00:00:00+07:00`),
      lte: new Date(`${to}T23:59:59.999+07:00`),
    }
    const items = await prisma.orderItem.findMany({
      where: katWhere,
      select: { subtotal: true, qty: true, category: true, product: { select: { category: { select: { name: true } } } } },
    })
    const map = {}
    for (const item of items) {
      const kat = item.product?.category?.name || item.category || '-'
      if (!map[kat]) map[kat] = { category: kat, total: 0, qty: 0 }
      map[kat].total += item.subtotal
      map[kat].qty += item.qty
    }
    const byKategori = Object.values(map).sort((a, b) => b.total - a.total)
    return NextResponse.json({ byKategori })
  }

  // Mode monthly summary
  if (searchParams.get('monthly') === '1') {
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31, 23, 59, 59, 999)
    const items = await prisma.orderItem.findMany({
      where: { transaction: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: start, lte: end } } },
      select: { subtotal: true, qty: true, transaction: { select: { createdAt: true } } },
    })
    // Group by bulan
    const monthly = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, total: 0, qty: 0 }))
    for (const item of items) {
      const m = new Date(item.transaction.createdAt).getMonth()
      monthly[m].total += item.subtotal
      monthly[m].qty += item.qty
    }
    return NextResponse.json({ monthly, year })
  }

  const nullOnly = searchParams.get('nullOnly') === '1'
  const categoryFilter = searchParams.get('category') || ''
  const txWhere = { status: 'COMPLETED', deletedAt: null }
  if (from && to) txWhere.createdAt = {
    gte: new Date(`${from}T00:00:00+07:00`),
    lte: new Date(`${to}T23:59:59.999+07:00`),
  }
  const itemWhere = {
    transaction: txWhere,
    ...(nullOnly ? { OR: [{ name: null }, { name: '' }] } : {}),
    ...(categoryFilter ? { OR: [
      { product: { category: { name: categoryFilter } } },
      { category: categoryFilter },
    ] } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: itemWhere,
      include: {
        product: { select: { code: true, name: true, category: { select: { name: true } } } },
        transaction: { select: { createdAt: true } },
      },
      orderBy: { transaction: { createdAt: 'desc' } },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.orderItem.count({ where: itemWhere }),
  ])

  return NextResponse.json({
    rows: rows.map(r => {
      const isNameNull = !r.name || r.name === ''
      return {
        id: r.id,
        transactionId: r.transactionId,
        date: r.transaction.createdAt,
        code: r.product?.code || r.code || '-',
        category: r.product?.category?.name || r.category || '-',
        name: r.product?.name || r.name || 'Item Manual',
        isNameNull, // flag untuk frontend
        qty: r.qty,
        total: r.subtotal,
      }
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
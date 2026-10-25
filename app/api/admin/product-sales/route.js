import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// Distribusikan Transaction.total (sudah termasuk diskon & pajak) ke masing-masing
// item secara proporsional berdasarkan subtotal item vs total subtotal transaksi.
// Kini Transaction.discountAmount tersimpan di DB sehingga hasDiscount lebih akurat.
// Jika transaksi tidak punya diskon/pajak, hasilnya sama persis dengan subtotal asli.
function effectiveTotal(itemSubtotal, txTotal, txSubtotalSum) {
  if (!txSubtotalSum || txSubtotalSum === 0) return itemSubtotal
  if (txSubtotalSum === txTotal) return itemSubtotal   // tidak ada diskon/pajak
  // Pakai angka desimal agar sum semua item = txTotal
  return itemSubtotal * txTotal / txSubtotalSum
}

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

  // ── Mode by kategori ──
  if (searchParams.get('bykategori') === '1') {
    const katWhere = { transaction: { status: 'COMPLETED', deletedAt: null } }
    if (from && to) katWhere.transaction.createdAt = {
      gte: new Date(`${from}T00:00:00+07:00`),
      lte: new Date(`${to}T23:59:59.999+07:00`),
    }
    const items = await prisma.orderItem.findMany({
      where: katWhere,
      select: {
        subtotal: true, qty: true, category: true,
        product: { select: { category: { select: { name: true } } } },
        transaction: { select: { total: true, items: { select: { subtotal: true } } } },
      },
    })
    const map = {}
    for (const item of items) {
      const kat = item.product?.category?.name || (item.category && item.category.trim()) || 'Lainnya'
      const txSubtotalSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
      const eff = effectiveTotal(item.subtotal, item.transaction.total, txSubtotalSum)
      if (!map[kat]) map[kat] = { category: kat, total: 0, qty: 0 }
      map[kat].total += eff
      map[kat].qty += item.qty
    }
    const byKategori = Object.values(map).sort((a, b) => b.total - a.total)
    return NextResponse.json({ byKategori })
  }

  // ── Mode monthly summary (Cut-Off Tanggal 20) ──
  if (searchParams.get('monthly') === '1') {
    const pad = n => String(n).padStart(2, '0')
    const start = new Date(`${year - 1}-12-20T00:00:00.000+07:00`)
    const end = new Date(`${year}-12-19T23:59:59.999+07:00`)
    const items = await prisma.orderItem.findMany({
      where: { transaction: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: start, lte: end } } },
      select: {
        subtotal: true, qty: true,
        transaction: { select: { createdAt: true, total: true, items: { select: { subtotal: true } } } },
      },
    })
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const prevM = m === 0 ? 12 : m
      const prevY = m === 0 ? year - 1 : year
      const currM = m + 1
      const startT = new Date(`${prevY}-${pad(prevM)}-20T00:00:00+07:00`).getTime()
      const endT = new Date(`${year}-${pad(currM)}-19T23:59:59.999+07:00`).getTime()

      let total = 0
      let qty = 0
      for (const item of items) {
        const t = new Date(item.transaction.createdAt).getTime()
        if (t >= startT && t <= endT) {
          const txSubtotalSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
          const eff = effectiveTotal(item.subtotal, item.transaction.total, txSubtotalSum)
          total += eff
          qty += item.qty
        }
      }
      return { month: m + 1, total, qty }
    })
    return NextResponse.json({ monthly, year })
  }

  // ── Mode daftar detail ──
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
    ...(categoryFilter ? { OR: categoryFilter === 'Lainnya'
      ? [
          { productId: null, OR: [{ category: null }, { category: '' }] },
          { product: { categoryId: null } },
        ]
      : [
          { product: { category: { name: { equals: categoryFilter, mode: 'insensitive' } } } },
          { category: { equals: categoryFilter, mode: 'insensitive' } },
        ]
    } : {}),
  }

  const [rows, total, aggregate] = await Promise.all([
    prisma.orderItem.findMany({
      where: itemWhere,
      include: {
        product: { select: { code: true, name: true, category: { select: { name: true } } } },
        transaction: { select: { createdAt: true, total: true, items: { select: { subtotal: true } } } },
      },
      orderBy: { transaction: { createdAt: 'desc' } },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.orderItem.count({ where: itemWhere }),
    prisma.orderItem.findMany({
      where: itemWhere,
      select: { subtotal: true, qty: true, transaction: { select: { total: true, items: { select: { subtotal: true } } } } },
    }),
  ])

  let allRevenue = 0, allQty = 0
  for (const r of aggregate) {
    const txSum = r.transaction.items.reduce((s, i) => s + i.subtotal, 0)
    allRevenue += effectiveTotal(r.subtotal, r.transaction.total, txSum)
    allQty += r.qty
  }

  return NextResponse.json({
    rows: rows.map(r => {
      const isNameNull = !r.name || r.name === ''
      const txSubtotalSum = r.transaction.items.reduce((s, i) => s + i.subtotal, 0)
      const eff = effectiveTotal(r.subtotal, r.transaction.total, txSubtotalSum)
      const hasDiscount = txSubtotalSum !== r.transaction.total
      return {
        id: r.id,
        transactionId: r.transactionId,
        date: r.transaction.createdAt,
        code: r.product?.code || r.code || '-',
        category: r.product?.category?.name || (r.category && r.category.trim()) || 'Lainnya',
        name: r.product?.name || r.name || 'Item Manual',
        isNameNull,
        qty: r.qty,
        price: r.price,
        subtotal: r.subtotal,
        total: eff,
        hasDiscount,
      }
    }),
    total,
    allRevenue: Math.round(allRevenue),
    allQty,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

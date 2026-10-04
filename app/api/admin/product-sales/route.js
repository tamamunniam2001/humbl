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
      const kat = item.product?.category?.name || item.category || '-'
      const txSubtotalSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
      const eff = effectiveTotal(item.subtotal, item.transaction.total, txSubtotalSum)
      if (!map[kat]) map[kat] = { category: kat, total: 0, qty: 0 }
      map[kat].total += eff
      map[kat].qty += item.qty
    }
    const byKategori = Object.values(map).sort((a, b) => b.total - a.total)
    return NextResponse.json({ byKategori })
  }

  // ── Mode monthly summary ──
  if (searchParams.get('monthly') === '1') {
    const start = new Date(`${year}-01-01T00:00:00.000+07:00`)
    const end = new Date(`${year}-12-31T23:59:59.999+07:00`)
    const items = await prisma.orderItem.findMany({
      where: { transaction: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: start, lte: end } } },
      select: {
        subtotal: true, qty: true,
        transaction: { select: { createdAt: true, total: true, items: { select: { subtotal: true } } } },
      },
    })
    const monthly = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, total: 0, qty: 0 }))
    for (const item of items) {
      const m = new Date(item.transaction.createdAt).getMonth()
      const txSubtotalSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
      const eff = effectiveTotal(item.subtotal, item.transaction.total, txSubtotalSum)
      monthly[m].total += eff
      monthly[m].qty += item.qty
    }
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
        // Sertakan transaction.total dan semua subtotal item di transaksi yang sama
        // agar diskon bisa didistribusikan secara proporsional ke tiap item.
        transaction: { select: { createdAt: true, total: true, items: { select: { subtotal: true } } } },
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
      const txSubtotalSum = r.transaction.items.reduce((s, i) => s + i.subtotal, 0)
      const eff = effectiveTotal(r.subtotal, r.transaction.total, txSubtotalSum)
      // hasDiscount = true jika transaksi ini ada diskon/pajak yang mengubah total
      const hasDiscount = txSubtotalSum !== r.transaction.total
      return {
        id: r.id,
        transactionId: r.transactionId,
        date: r.transaction.createdAt,
        code: r.product?.code || r.code || '-',
        category: r.product?.category?.name || r.category || '-',
        name: r.product?.name || r.name || 'Item Manual',
        isNameNull,
        qty: r.qty,
        price: r.price,
        subtotal: r.subtotal,       // harga asli sebelum diskon (price × qty)
        total: eff,                 // harga efektif setelah diskon/pajak proporsional
        hasDiscount,                // flag untuk frontend agar bisa tampilkan keterangan
      }
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

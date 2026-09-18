import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

function isSameOrigin(req) {
  const host = req.headers.get('host')
  if (!host) return false
  const origin = req.headers.get('origin')
  if (origin) {
    try { return new URL(origin).host === host } catch { return false }
  }
  const referer = req.headers.get('referer')
  if (referer) {
    try { return new URL(referer).host === host } catch { return false }
  }
  return req.headers.get('x-requested-with') === 'XMLHttpRequest'
}

export async function GET(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') || 1)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const slim = searchParams.get('slim')
  const where = {}
  if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) }
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      ...(slim ? {
        select: {
          id: true, invoiceNo: true, customerName: true, note: true, total: true,
          payment: true, change: true, payMethod: true, status: true, servedAt: true, createdAt: true,
          cashier: { select: { name: true } },
          items: { select: { id: true, qty: true, price: true, subtotal: true, productId: true, name: true, category: true, product: { select: { name: true, imageUrl: true, category: { select: { name: true } } } } } },
        }
      } : {
        include: { cashier: { select: { name: true } }, items: { include: { product: true } } }
      }),
      orderBy: { createdAt: 'desc' }, take: 20, skip: (page - 1) * 20,
    }),
    prisma.transaction.count({ where }),
  ])
  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / 20) })
}

export async function POST(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  try {
    const { items, payment, payMethod, payLater, customerName, note } = await req.json()
    if (!items?.length) return NextResponse.json({ message: 'Items tidak boleh kosong' }, { status: 400 })
    if (!payMethod) return NextResponse.json({ message: 'payMethod wajib diisi' }, { status: 400 })

    const productIds = items.filter(i => i.productId).map(i => i.productId)

    const orderItems = items.map((item) => {
      const price = item.price || 0
      const name = (item.name || '').trim() || 'Item Manual'
      return {
        productId: item.productId || null,
        name,
        code: item.code || '',
        category: item.category || '',
        qty: item.qty, price, subtotal: price * item.qty,
      }
    })
    const total = orderItems.reduce((s, i) => s + i.subtotal, 0)
    const actualPayment = payLater ? 0 : (payment || 0)
    const invoiceNo = `BK-${Date.now()}`

    // Buat transaksi tanpa nested select berat — hanya ambil id & invoiceNo dulu
    const transaction = await prisma.transaction.create({
      data: {
        invoiceNo, total, payment: actualPayment,
        change: actualPayment > 0 ? actualPayment - total : 0,
        payMethod, cashierId: user.id,
        status: payLater ? 'PENDING' : 'COMPLETED',
        customerName: customerName || '',
        note: note || '',
        items: { create: orderItems },
      },
      select: { id: true, invoiceNo: true, total: true, change: true, payment: true, payMethod: true, status: true, servedAt: true, createdAt: true, customerName: true, note: true },
    })

    // Decrement stock + fetch cashier name secara paralel, tidak blocking response
    const cashierPromise = prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
    if (productIds.length) {
      Promise.all(productIds.map(id => {
        const item = items.find(i => i.productId === id)
        return prisma.product.update({ where: { id }, data: { stock: { decrement: item.qty } } })
      })).catch(console.error)
    }

    const cashier = await cashierPromise
    // Bangun items dari data yang sudah ada di memory (tidak perlu query ulang)
    const responseItems = orderItems.map((i, idx) => ({
      id: `tmp_${idx}`, qty: i.qty, price: i.price, subtotal: i.subtotal,
      productId: i.productId || null,
      name: i.name,
      category: i.category || '',
      product: { name: i.name, imageUrl: null, category: i.category ? { name: i.category } : null },
    }))

    return NextResponse.json({ ...transaction, cashier, items: responseItems }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan transaksi' }, { status: 500 })
  }
}

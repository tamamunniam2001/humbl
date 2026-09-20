import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

function isCsrfSafe(req) {
  if (req.headers.get('x-requested-with') !== 'XMLHttpRequest') return false
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
  return true
}

export async function GET(req, { params }) {
  if (!isCsrfSafe(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { cashier: { select: { name: true } }, items: { include: { product: true } } },
  })
  if (!transaction) return NextResponse.json({ message: 'Transaksi tidak ditemukan' }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function PATCH(req, { params }) {
  if (!isCsrfSafe(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const body = await req.json()

  // Restore dari sampah
  if (body.restore) {
    if (user.role !== 'ADMIN') return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
    const tx = await prisma.transaction.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true, invoiceNo: true, deletedAt: true },
    })
    return NextResponse.json(tx)
  }

  const data = {}
  const isAdminEdit = ('items' in body) || ('customerName' in body) || ('note' in body)
  if (isAdminEdit && user.role !== 'ADMIN')
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  if ('servedAt' in body) data.servedAt = body.servedAt ? new Date(body.servedAt) : null
  if ('payment' in body) {
    data.payment = body.payment
    data.change = body.payment - body.total
    data.payMethod = body.payMethod
    data.status = 'COMPLETED'
  }
  if ('customerName' in body) data.customerName = body.customerName
  if ('note' in body) data.note = body.note
  if ('items' in body) {
    const newItems = body.items.map(i => ({
      productId: i.productId || null,
      name: i.name || '',
      code: i.code || '',
      category: i.category || '',
      qty: i.qty,
      price: i.price,
      subtotal: i.price * i.qty,
    }))
    data.total = newItems.reduce((s, i) => s + i.subtotal, 0)
    data.items = { deleteMany: {}, create: newItems }
  }
  const transaction = await prisma.transaction.update({
    where: { id },
    data,
    select: {
      id: true, servedAt: true, status: true, payment: true, change: true, payMethod: true,
      invoiceNo: true, total: true, createdAt: true, customerName: true, note: true,
      cashier: { select: { name: true } },
      items: { include: { product: { select: { name: true, imageUrl: true } } } },
    },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(req, { params }) {
  if (!isCsrfSafe(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  if (user.role !== 'ADMIN')
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const permanent = searchParams.get('permanent') === '1'

  const tx = await prisma.transaction.findUnique({
    where: { id },
    select: { status: true, deletedAt: true, items: { select: { productId: true, qty: true } } },
  })
  if (!tx) return NextResponse.json({ message: 'Transaksi tidak ditemukan' }, { status: 404 })

  if (permanent) {
    // Hapus permanen — kembalikan stock jika COMPLETED
    if (tx.status === 'COMPLETED') {
      const productItems = tx.items.filter(i => i.productId)
      if (productItems.length) {
        await Promise.all(productItems.map(i =>
          prisma.product.update({ where: { id: i.productId }, data: { stock: { increment: i.qty } } })
        ))
      }
    }
    await prisma.orderItem.deleteMany({ where: { transactionId: id } })
    await prisma.transaction.delete({ where: { id } })
    return NextResponse.json({ success: true, permanent: true })
  }

  // Soft-delete
  await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ success: true, permanent: false })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { nextShiftForTime, shiftAnchorTime, wibDayRange } from '@/lib/wib'

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

  // Pindahkan open bill (belum bayar) ke shift berikutnya.
  // Dipakai saat pelanggan masih menunda pembayaran sampai pergantian shift,
  // agar saat dibayar nanti masuk ke laporan shift tujuan, bukan shift lama
  // yang sudah tutup.
  if (body.moveToNextShift) {
    const target = await prisma.transaction.findUnique({
      where: { id },
      select: { createdAt: true, status: true, deletedAt: true, invoiceNo: true },
    })
    if (!target) return NextResponse.json({ message: 'Transaksi tidak ditemukan' }, { status: 404 })
    if (target.deletedAt) return NextResponse.json({ message: 'Pesanan sudah dihapus' }, { status: 403 })
    if (target.status !== 'PENDING')
      return NextResponse.json({ message: 'Hanya pesanan yang belum dibayar (open bill) yang bisa dipindahkan' }, { status: 400 })

    const nextShift = nextShiftForTime(target.createdAt)
    if (!nextShift)
      return NextResponse.json({ message: 'Pesanan sudah berada di shift terakhir hari ini' }, { status: 400 })

    // Shift tujuan harus belum closing, kalau sudah tutup jangan dipindahkan
    const anchor = shiftAnchorTime(target.createdAt, nextShift)
    const dayRange = wibDayRange(anchor)
    const dayReports = await prisma.dailyReport.findMany({
      where: { date: { gte: dayRange.gte, lte: dayRange.lte } },
      select: { shift: true, date: true, createdAt: true },
    })
    if (dayReports.some(r => r.shift === nextShift))
      return NextResponse.json({ message: `${nextShift.replace('SHIFT_', 'Shift ')} sudah closing, tidak bisa dipindahkan ke sana` }, { status: 400 })

    const updated = await prisma.transaction.update({
      where: { id },
      data: { createdAt: anchor, originalCreatedAt: target.createdAt },
      select: { id: true, invoiceNo: true, createdAt: true, originalCreatedAt: true, status: true, total: true },
    })
    return NextResponse.json({ ...updated, movedToShift: nextShift })
  }

  const data = {}
  const isOrderEdit = ('items' in body) || ('customerName' in body) || ('note' in body)
  if (isOrderEdit && user.role !== 'ADMIN') {
    // Kasir boleh mengedit pesanan, namun hanya pesanan hari ini (WIB).
    // Pembayaran yang sudah lunas tetap terlindungi agar angka laporan tidak berubah diam-diam.
    const target = await prisma.transaction.findUnique({
      where: { id },
      select: { createdAt: true, status: true, deletedAt: true },
    })
    if (!target) return NextResponse.json({ message: 'Transaksi tidak ditemukan' }, { status: 404 })
    if (target.deletedAt) return NextResponse.json({ message: 'Pesanan sudah dihapus' }, { status: 403 })
    if (target.status === 'COMPLETED')
      return NextResponse.json({ message: 'Pesanan sudah lunas dan tidak dapat diubah. Hubungi admin.' }, { status: 403 })

    const today = wibDayRange(new Date())
    if (target.createdAt < today.gte || target.createdAt > today.lte)
      return NextResponse.json({ message: 'Kasir hanya dapat mengedit pesanan hari ini' }, { status: 403 })
  }
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

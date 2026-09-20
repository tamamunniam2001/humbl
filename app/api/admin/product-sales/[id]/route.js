import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { name, category, code, qty, total } = await req.json()
  const item = await prisma.orderItem.update({
    where: { id },
    data: {
      name: name ?? undefined,
      category: category ?? undefined,
      code: code ?? undefined,
      qty: qty != null ? Number(qty) : undefined,
      subtotal: total != null ? Number(total) : undefined,
      price: qty != null && total != null ? Math.round(Number(total) / Number(qty)) : undefined,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params

  const item = await prisma.orderItem.findUnique({
    where: { id },
    select: { transactionId: true, qty: true, productId: true },
  })
  if (!item) return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 404 })

  const { transactionId } = item

  // Cek status transaksi untuk kembalikan stock jika perlu
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { status: true } })

  // Hapus hanya item ini
  await prisma.orderItem.delete({ where: { id } })

  // Kembalikan stock jika transaksi COMPLETED dan item punya productId
  if (tx?.status === 'COMPLETED' && item.productId) {
    await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } })
  }

  // Cek apakah transaksi masih punya item lain
  const remaining = await prisma.orderItem.count({ where: { transactionId } })
  if (remaining === 0) {
    // Jika tidak ada item tersisa, hapus transaksinya juga
    await prisma.transaction.delete({ where: { id: transactionId } })
    return NextResponse.json({ message: 'Item dan transaksi dihapus' })
  }

  // Update total transaksi sesuai sisa item
  const remaining_items = await prisma.orderItem.findMany({ where: { transactionId }, select: { subtotal: true } })
  const newTotal = remaining_items.reduce((s, i) => s + i.subtotal, 0)
  await prisma.transaction.update({ where: { id: transactionId }, data: { total: newTotal } })

  return NextResponse.json({ message: 'Item dihapus' })
}

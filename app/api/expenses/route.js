import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { items, catatan, date } = await req.json()
  if (!items?.length) return NextResponse.json({ message: 'Items tidak boleh kosong' }, { status: 400 })
  const invalidQtyItem = items.find(i => !(Number(i.qty) > 0))
  if (invalidQtyItem) return NextResponse.json({ message: `Qty untuk ${invalidQtyItem.name || 'item'} harus diisi dengan angka lebih dari 0` }, { status: 400 })

  const details = items.map(i => ({
    expenseItemId: i.expenseItemId || null,
    name: i.name,
    category: i.category || '',
    keterangan: i.keterangan || '',
    satuan: i.satuan || '',
    harga: Number(i.harga),
    isi: Number(i.isi) > 0 ? Number(i.isi) : null,
    qty: Number(i.qty),
    subtotal: Number(i.harga) * Number(i.qty),
  }))
  const total = details.reduce((s, d) => s + d.subtotal, 0)

  const expense = await prisma.expense.create({
    data: {
      total, catatan: catatan || '', cashierId: user.id,
      ...(date ? { date: new Date(date) } : {}),
      items: { create: details },
    },
    include: { items: true, cashier: { select: { name: true } } },
  })
  return NextResponse.json(expense, { status: 201 })
}

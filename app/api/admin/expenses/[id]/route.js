import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function DELETE(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  await prisma.expenseDetail.deleteMany({ where: { expenseId: id } })
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const body = await req.json()
  const { items, catatan, date } = body
  if (!items?.length) return NextResponse.json({ message: 'Items kosong' }, { status: 400 })

  const details = items.map(i => ({
    expenseItemId: i.expenseItemId || null,
    name: String(i.name || '').trim(),
    category: i.category || '',
    keterangan: i.keterangan || '',
    satuan: i.satuan || '',
    harga: Number(i.harga) || 0,
    isi: Number(i.isi) > 0 ? Number(i.isi) : null,
    qty: Number(i.qty) || 1,
    subtotal: (Number(i.harga) || 0) * (Number(i.qty) || 1),
  }))
  const total = details.reduce((s, d) => s + d.subtotal, 0)

  try {
    await prisma.expenseDetail.deleteMany({ where: { expenseId: id } })
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        total,
        catatan: catatan || '',
        ...(date ? { date: new Date(`${date}T00:00:00+07:00`) } : {}),
        items: { create: details },
      },
      include: { items: true, cashier: { select: { name: true } } },
    })
    return NextResponse.json(expense)
  } catch (e) {
    console.error('PATCH expense error:', e)
    return NextResponse.json({ message: e.message || 'Gagal menyimpan' }, { status: 500 })
  }
}

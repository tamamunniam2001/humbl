import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { parseExpenseCsv } from '@/lib/expense-csv'

// POST /api/expenses/import — dipakai halaman Pengeluaran.
// Import CSV langsung membuat Expense per tanggal (masuk Rekap Pengeluaran).
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file) return NextResponse.json({ message: 'File tidak ditemukan' }, { status: 400 })

  const text = await file.text()

  // Pre-load all expense items for code lookup
  const expenseItems = await prisma.expenseItem.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true, satuan: true },
  })

  // Parse & kelompokkan baris CSV per tanggal
  const parsed = parseExpenseCsv(text, expenseItems)
  if (!parsed) return NextResponse.json({ message: 'File kosong atau tidak valid' }, { status: 400 })

  const { byDate, errors } = parsed
  let skipped = parsed.skipped
  let created = 0

  // Create one Expense per date
  for (const [dateKey, items] of Object.entries(byDate)) {
    const details = items.map(i => ({
      expenseItemId: i.expenseItemId,
      name: i.name, category: i.category, keterangan: i.keterangan, satuan: i.satuan,
      harga: i.harga, isi: i.isi ?? null, qty: i.qty, subtotal: i.harga * i.qty,
    }))
    const total = details.reduce((s, d) => s + d.subtotal, 0)
    try {
      await prisma.expense.create({
        data: {
          date: new Date(dateKey + 'T00:00:00'), total, catatan: 'Import CSV', cashierId: user.id,
          items: { create: details },
        },
      })
      created += items.length
    } catch (e) {
      errors.push(`Tanggal ${dateKey}: ${e.message}`)
      skipped += items.length
    }
  }

  return NextResponse.json({ created, skipped, total: created + skipped, errors, debug: Object.keys(byDate) }, { status: 201 })
}

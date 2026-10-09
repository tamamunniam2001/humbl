import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { parseExpenseCsv } from '@/lib/expense-csv'

// POST /api/operational/belanja/import — dipakai halaman Belanja Operasional.
// Import CSV TIDAK langsung masuk Rekap Pengeluaran: hasilnya dibuat sebagai
// pengajuan belanja ber-status PENDING (satu pengajuan per tanggal) dan hanya
// menjadi Expense + potong saldo operasional setelah di-ACC admin.
export async function POST(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file) return NextResponse.json({ message: 'File tidak ditemukan' }, { status: 400 })

  const text = await file.text()

  // Pre-load all expense items untuk pencocokan kode & nama
  const expenseItems = await prisma.expenseItem.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true, satuan: true },
  })

  // matchByName: baris tanpa kode tetap terhubung ke ExpenseItem bila namanya cocok,
  // sehingga kategori item ikut terbawa saat pengajuan di-ACC.
  const parsed = parseExpenseCsv(text, expenseItems, { matchByName: true })
  if (!parsed) return NextResponse.json({ message: 'File kosong atau tidak valid' }, { status: 400 })

  const { byDate, errors } = parsed
  let skipped = parsed.skipped
  let created = 0
  let pengajuan = 0

  // Satu pengajuan PENDING per tanggal
  for (const [dateKey, items] of Object.entries(byDate)) {
    const total = items.reduce((s, i) => s + i.harga * i.qty, 0)
    try {
      await prisma.operationalBelanja.create({
        data: {
          roleKey: 'operasional',
          requesterId: user.id || null,
          requesterName: user.name || user.email || 'Operasional',
          tanggal: new Date(dateKey + 'T00:00:00'),
          keterangan: 'Import CSV',
          total,
          status: 'PENDING',
          items: {
            create: items.map(i => ({
              itemId: i.expenseItemId || null,
              itemName: i.name,
              harga: i.harga,
              isi: i.isi ?? null,
              qty: i.qty,
              satuan: i.satuan || '',
              keterangan: i.keterangan || '',
              subtotal: i.harga * i.qty,
              isManual: !i.expenseItemId,
            })),
          },
        },
      })
      created += items.length
      pengajuan += 1
    } catch (e) {
      errors.push(`Tanggal ${dateKey}: ${e.message}`)
      skipped += items.length
    }
  }

  return NextResponse.json({
    created, skipped, total: created + skipped, errors, debug: Object.keys(byDate),
    // Ditampilkan di UI: hasil import menjadi pengajuan, bukan pengeluaran final
    pending: true, pengajuan,
  }, { status: 201 })
}

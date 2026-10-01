import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { wibDayRange, shiftForTransaction } from '@/lib/wib'

// Ringkasan penjualan satu shift dihitung di server memakai aturan atribusi yang
// sama persis dengan detail laporan, supaya angka saat closing tidak lagi
// berbeda dari yang muncul di laporan harian.
//
// Karena jam shift saling tumpang tindih, sebuah transaksi dihitung pada shift
// pertama yang closing-nya belum terjadi sebelum transaksi dibuat. Dengan begitu
// tidak ada transaksi yang terhitung di dua shift atau hilang dari semua shift.
// Transaksi yang pernah dipindahkan ke shift berikutnya dikecualikan dari aturan
// itu: waktunya dicocokkan ke anchor awal shift tujuan lewat shiftForTransaction.
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const shift = searchParams.get('shift')
  const date = searchParams.get('date')
  if (!shift) return NextResponse.json({ message: 'Parameter shift wajib diisi' }, { status: 400 })

  const dayRange = wibDayRange(date || new Date())
  const [reports, transactions] = await Promise.all([
    prisma.dailyReport.findMany({
      where: { date: { gte: dayRange.gte, lte: dayRange.lte } },
      select: { shift: true, date: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: dayRange.gte, lte: dayRange.lte } },
      // originalCreatedAt wajib ikut diambil: shiftForTransaction memakainya
      // untuk mengenali transaksi yang dipindahkan ke shift lain.
      select: { id: true, invoiceNo: true, total: true, payMethod: true, createdAt: true, originalCreatedAt: true, customerName: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const owned = transactions.filter(tx => shiftForTransaction(tx, reports) === shift)
  const sum = method => owned.filter(tx => tx.payMethod === method).reduce((s, tx) => s + tx.total, 0)

  return NextResponse.json({
    shift,
    count: owned.length,
    penjualan: owned.reduce((s, tx) => s + tx.total, 0),
    cash: sum('CASH'),
    qris: sum('QRIS'),
    transfer: sum('TRANSFER') + sum('NONTUNAI'),
    transactions: owned,
  })
}
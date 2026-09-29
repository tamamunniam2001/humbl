import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { wibDayRange, wibShiftForTransaction } from '@/lib/wib'

export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  const report = await prisma.dailyReport.findUnique({ where: { id }, select: { date: true, createdAt: true, shift: true } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })

  const dayRange = wibDayRange(report.date)
  const reports = await prisma.dailyReport.findMany({
    where: { date: { gte: dayRange.gte, lte: dayRange.lte } },
    // createdAt wajib ikut diambil: wibShiftForTransaction memakai
    // closedAt || createdAt || date sebagai waktu closing sebuah shift. Kalau
    // createdAt tidak di-select, aturan ini diam-diam jatuh ke `date`, sehingga
    // transaksi bisa masuk ke shift yang berbeda dari angka penjualan yang
    // tersimpan saat closing (shift-summary memakai createdAt).
    select: { shift: true, date: true, createdAt: true },
  })

  const transactions = await prisma.transaction.findMany({
    where: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: dayRange.gte, lte: dayRange.lte } },
    select: {
      id: true, invoiceNo: true, total: true, payMethod: true, createdAt: true,
      customerName: true,
      items: { select: { name: true, qty: true, price: true, subtotal: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(transactions.filter(tx => wibShiftForTransaction(tx.createdAt, reports) === report.shift))
}

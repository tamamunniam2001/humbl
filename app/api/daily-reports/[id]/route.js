import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, include: { cashier: { select: { name: true } } } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  return NextResponse.json(report)
}

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, select: { cashierId: true } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  const { kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName, kasAkhirDisetor, shift } = await req.json()
  const updated = await prisma.dailyReport.update({
    where: { id },
    data: { kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName: closerName ?? undefined, kasAkhirDisetor: kasAkhirDisetor ?? undefined, shift: shift ?? undefined },
    include: { cashier: { select: { name: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, select: { cashierId: true, date: true, shift: true } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })

  // Range satu hari penuh berdasarkan tanggal laporan (WIB = UTC+7)
  const reportDate = new Date(report.date)
  // Ambil tanggal lokal WIB dari report.date
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(reportDate.getTime() + wibOffset)
  const wibDateStr = wibDate.toISOString().slice(0, 10) // YYYY-MM-DD
  // Konversi kembali ke UTC: hari WIB mulai jam 00:00 WIB = 17:00 UTC hari sebelumnya
  const dayStart = new Date(`${wibDateStr}T00:00:00+07:00`)
  const dayEnd = new Date(`${wibDateStr}T23:59:59.999+07:00`)

  // Cek apakah ada shift lain pada hari yang sama yang TIDAK dihapus
  const siblingsCount = await prisma.dailyReport.count({
    where: { id: { not: id }, date: { gte: dayStart, lte: dayEnd } },
  })

  // Jika masih ada laporan shift lain di hari yang sama, jangan hapus transaksi
  // (transaksi hari itu masih dipakai shift lain)
  // Jika ini laporan terakhir/satu-satunya di hari itu, hapus semua transaksi hari itu
  if (siblingsCount === 0) {
    const transactions = await prisma.transaction.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: dayStart, lte: dayEnd } },
      select: { id: true, items: { select: { productId: true, qty: true } } },
    })

    if (transactions.length) {
      // Kembalikan stock produk
      const stockUpdates = {}
      for (const tx of transactions) {
        for (const item of tx.items) {
          if (item.productId) stockUpdates[item.productId] = (stockUpdates[item.productId] || 0) + item.qty
        }
      }
      const txIds = transactions.map(t => t.id)
      await Promise.all([
        ...Object.entries(stockUpdates).map(([productId, qty]) =>
          prisma.product.update({ where: { id: productId }, data: { stock: { increment: qty } } })
        ),
        prisma.orderItem.deleteMany({ where: { transactionId: { in: txIds } } }),
      ])
      await prisma.transaction.deleteMany({ where: { id: { in: txIds } } })
    }
  }

  await prisma.dailyReport.delete({ where: { id } })
  return NextResponse.json({ message: 'Laporan dihapus' })
}

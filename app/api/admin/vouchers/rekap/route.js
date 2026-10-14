import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

// GET /api/admin/vouchers/rekap — ringkasan pemakaian voucher (untuk laporan).
// Query opsional: from & to (YYYY-MM-DD, rentang hari WIB) untuk membatasi periode.
// Mengembalikan total diskon voucher, jumlah transaksi bersamaan rincian per kode.
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where = { voucherDiscount: { gt: 0 }, deletedAt: null }
  if (from || to) {
    const range = {}
    if (from) range.gte = new Date(`${from}T00:00:00`)
    if (to) range.lte = new Date(`${to}T23:59:59.999`)
    where.createdAt = range
  }

  const txs = await prisma.transaction.findMany({
    where,
    select: {
      id: true, invoiceNo: true, voucherCode: true, voucherDiscount: true,
      total: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const totalDiscount = txs.reduce((s, t) => s + (t.voucherDiscount || 0), 0)

  // Rincian per kode voucher
  const byCode = {}
  txs.forEach(t => {
    const code = t.voucherCode || '(tanpa kode)'
    if (!byCode[code]) byCode[code] = { code, count: 0, discount: 0 }
    byCode[code].count += 1
    byCode[code].discount += t.voucherDiscount || 0
  })

  return NextResponse.json({
    totalDiscount,
    totalTransactions: txs.length,
    byCode: Object.values(byCode).sort((a, b) => b.discount - a.discount),
  })
}

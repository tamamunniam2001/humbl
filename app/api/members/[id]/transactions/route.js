import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { getMonthlyCutoffRange } from '@/lib/wib'

// GET /api/members/[id]/transactions — riwayat pembelian satu member
// Query params: year, month (opsional, filter cutoff 20-19)
export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  let cutoff = null
  if (yearParam && monthParam) {
    cutoff = getMonthlyCutoffRange(Number(yearParam), Number(monthParam))
  }

  const member = await prisma.member.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
  })
  if (!member) return NextResponse.json({ message: 'Member tidak ditemukan' }, { status: 404 })

  const txWhere = {
    memberId: id, status: 'COMPLETED', deletedAt: null,
    ...(cutoff ? { createdAt: { gte: cutoff.gte, lte: cutoff.lte } } : {}),
  }

  const transactions = await prisma.transaction.findMany({
    where: txWhere,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, invoiceNo: true, total: true, payMethod: true, createdAt: true,
      customerName: true, note: true,
      discount: true, discountAmount: true, tax: true, taxAmount: true,
      voucherCode: true, voucherDiscount: true,
      cashier: { select: { name: true } },
      items: { select: { name: true, qty: true, price: true, subtotal: true } },
    },
  })

  const totalSpent = transactions.reduce((s, t) => s + (t.total || 0), 0)
  const totalDiscount = transactions.reduce((s, t) => s + (t.discountAmount || 0) + (t.voucherDiscount || 0), 0)

  return NextResponse.json({ member, transactions, totalSpent, totalDiscount })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const pad = n => String(n).padStart(2, '0')
function getCutoff(year, month) {
  const prevMonth = month === 0 ? 12 : month
  const prevYear = month === 0 ? year - 1 : year
  const currMonth = month + 1
  return {
    gte: new Date(`${prevYear}-${pad(prevMonth)}-20T00:00:00+07:00`),
    lte: new Date(`${year}-${pad(currMonth)}-19T23:59:59.999+07:00`),
  }
}

// GET /api/members/[id]/transactions
// Query params: year, month (0-indexed, opsional)
export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  let cutoff = null
  if (yearParam !== null && monthParam !== null) {
    cutoff = getCutoff(Number(yearParam), Number(monthParam))
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
      voucherCode: true, voucherDiscount: true, memberDiscount: true,
      cashier: { select: { name: true } },
      items: { select: { name: true, qty: true, price: true, subtotal: true } },
    },
  })

  const totalSpent = transactions.reduce((s, t) => s + (t.total || 0), 0)
  const totalDiscount = transactions.reduce((s, t) => s + (t.discountAmount || 0) + (t.voucherDiscount || 0) + (t.memberDiscount || 0), 0)

  return NextResponse.json({ member, transactions, totalSpent, totalDiscount })
}

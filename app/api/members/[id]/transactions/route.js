import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

// GET /api/members/[id]/transactions — riwayat pembelian satu member
// (dipakai popup detail di halaman Daftar Member).
export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  const member = await prisma.member.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
  })
  if (!member) return NextResponse.json({ message: 'Member tidak ditemukan' }, { status: 404 })

  const transactions = await prisma.transaction.findMany({
    where: { memberId: id, status: 'COMPLETED', deletedAt: null },
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

  return NextResponse.json({ member, transactions, totalSpent })
}

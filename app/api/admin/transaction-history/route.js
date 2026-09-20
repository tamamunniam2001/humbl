import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

function isSameOrigin(req) {
  const host = req.headers.get('host')
  if (!host) return false
  const origin = req.headers.get('origin')
  if (origin) { try { return new URL(origin).host === host } catch { return false } }
  const referer = req.headers.get('referer')
  if (referer) { try { return new URL(referer).host === host } catch { return false } }
  return req.headers.get('x-requested-with') === 'XMLHttpRequest'
}

export async function GET(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Number(searchParams.get('page') || 1)
  const limit = 30 // hari per halaman

  const where = { status: { not: 'CANCELLED' } }
  if (from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(from) }
  if (to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(to + 'T23:59:59.999Z') }

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      invoiceNo: true,
      customerName: true,
      note: true,
      total: true,
      payment: true,
      change: true,
      payMethod: true,
      status: true,
      createdAt: true,
      cashier: { select: { name: true } },
      items: {
        select: {
          id: true, qty: true, price: true, subtotal: true,
          name: true, category: true, code: true,
          product: { select: { name: true, imageUrl: true } },
        }
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by date (YYYY-MM-DD in local timezone)
  const grouped = {}
  for (const tx of transactions) {
    const dateKey = new Date(tx.createdAt).toLocaleDateString('en-CA') // YYYY-MM-DD
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(tx)
  }

  // Sort dates descending
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const totalDays = sortedDates.length
  const pagedDates = sortedDates.slice((page - 1) * limit, page * limit)

  const days = pagedDates.map(date => {
    const txs = grouped[date]
    const totalRevenue = txs.reduce((s, t) => s + t.total, 0)
    const cash = txs.filter(t => t.payMethod === 'CASH').reduce((s, t) => s + t.total, 0)
    const qris = txs.filter(t => t.payMethod === 'QRIS').reduce((s, t) => s + t.total, 0)
    const transfer = txs.filter(t => t.payMethod === 'TRANSFER' || t.payMethod === 'NONTUNAI').reduce((s, t) => s + t.total, 0)
    return { date, totalRevenue, cash, qris, transfer, count: txs.length, transactions: txs }
  })

  return NextResponse.json({ days, totalDays, page, totalPages: Math.ceil(totalDays / limit) })
}

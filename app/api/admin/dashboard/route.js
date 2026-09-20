import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const now = new Date()
  const TZ_OFFSET = 7 * 60 * 60 * 1000 // WIB UTC+7
  const toWIB = (d) => new Date(new Date(d).getTime() + TZ_OFFSET)

  // Semua range pakai UTC tapi geser -7 jam agar mencakup data WIB penuh
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  today.setTime(today.getTime() - TZ_OFFSET)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  thisMonthStart.setTime(thisMonthStart.getTime() - TZ_OFFSET)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  thisMonthEnd.setTime(thisMonthEnd.getTime() - TZ_OFFSET)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  lastMonth.setTime(lastMonth.getTime() - TZ_OFFSET)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  lastMonthEnd.setTime(lastMonthEnd.getTime() - TZ_OFFSET)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  yearStart.setTime(yearStart.getTime() - TZ_OFFSET)

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

  const [
    todayTx, monthTx, lastMonthTx,
    totalProducts, totalEmployees,
    recentTx, topProducts,
    payMethodToday, absensiToday,
    monthlyTxRaw, monthlyExpRaw,
    yearlyTxRaw, yearlyExpRaw,
  ] = await Promise.all([
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: thisMonthStart }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: lastMonth, lte: lastMonthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.transaction.findMany({ where: { status: 'COMPLETED', deletedAt: null }, take: 5, orderBy: { createdAt: 'desc' }, include: { cashier: { select: { name: true } } } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { transaction: { status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5 }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.attendance.findMany({ where: { date: { gte: today, lt: tomorrow } }, include: { employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd }, status: 'COMPLETED', deletedAt: null } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    prisma.expense.findMany({ where: { date: { gte: thisMonthStart, lte: thisMonthEnd } }, select: { total: true, date: true } }),
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: yearStart }, status: 'COMPLETED', deletedAt: null } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    prisma.expense.findMany({ where: { date: { gte: yearStart } }, select: { total: true, date: true } }),
  ])

  const daysInMonth = thisMonthEnd.getDate()
  const dailyChart = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const rev = monthlyTxRaw.filter(t => toWIB(t.transaction.createdAt).getUTCDate() === d).reduce((s, t) => s + t.subtotal, 0)
    const exp = monthlyExpRaw.filter(e => toWIB(e.date).getUTCDate() === d).reduce((s, e) => s + e.total, 0)
    return { label: `${d}`, revenue: rev, expense: exp }
  })

  const monthlyChart = Array.from({ length: 12 }, (_, m) => {
    const rev = yearlyTxRaw.filter(t => toWIB(t.transaction.createdAt).getUTCMonth() === m).reduce((s, t) => s + t.subtotal, 0)
    const exp = yearlyExpRaw.filter(e => toWIB(e.date).getUTCMonth() === m).reduce((s, e) => s + e.total, 0)
    return { month: MONTHS[m], revenue: rev, expense: exp }
  })

  const productIds = topProducts.filter(p => p.productId).map(p => p.productId)
  const productNames = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : []

  const monthRevenue = monthTx._sum.subtotal || 0
  const lastMonthRevenue = lastMonthTx._sum.subtotal || 0
  const monthTrend = lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null
  const payMethods = { CASH: 0, QRIS: 0, TRANSFER: 0, NONTUNAI: 0 }
  payMethodToday.forEach(p => { payMethods[p.payMethod] = p._sum.total || 0 })

  return NextResponse.json({
    today: { revenue: todayTx._sum.subtotal || 0, transactions: todayTx._count },
    month: { revenue: monthRevenue, transactions: monthTx._count, trend: monthTrend },
    totalProducts, totalEmployees,
    recentTransactions: recentTx,
    topProducts: topProducts.map(p => ({ name: productNames.find(n => n.id === p.productId)?.name || 'Item Manual', qty: p._sum.qty || 0, revenue: p._sum.subtotal || 0 })),
    payMethods,
    absensiToday: absensiToday.map(a => ({ id: a.id, type: a.type, name: a.employee?.name || '-', kasAwal: a.kasAwal, time: a.date })),
    dailyChart,
    monthlyChart,
    currentMonthIndex: now.getMonth(),
    currentMonth: MONTHS[now.getMonth()],
    currentYear: now.getFullYear(),
    months: MONTHS,
  })
}

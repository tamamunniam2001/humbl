import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const now = new Date()
  const TZ_OFFSET = 7 * 60 * 60 * 1000 // WIB UTC+7
  const toWIB = (d) => new Date(new Date(d).getTime() + TZ_OFFSET)
  const pad = (n) => String(n).padStart(2, '0')

  // Hari ini WIB
  const wibNow = toWIB(now)
  const wibDay = wibNow.getUTCDate()
  const wibMonth = wibNow.getUTCMonth() + 1 // 1..12
  const wibYear = wibNow.getUTCFullYear()

  const todayKey = `${wibYear}-${pad(wibMonth)}-${pad(wibDay)}`
  const today = new Date(`${todayKey}T00:00:00.000+07:00`)
  const tomorrow = new Date(`${todayKey}T23:59:59.999+07:00`)

  // Cut-off bulanan per tanggal 20: misal Oktober -> 20 September s/d 20 Oktober
  // Jika tanggal hari ini > 20, periode aktif adalah bulan berikutnya
  let currCutoffMonth = wibMonth
  let currCutoffYear = wibYear
  if (wibDay > 20) {
    if (wibMonth === 12) {
      currCutoffMonth = 1
      currCutoffYear = wibYear + 1
    } else {
      currCutoffMonth = wibMonth + 1
    }
  }

  // Bulan Ini (Cut-off tgl 20)
  const thisPrevM = currCutoffMonth === 1 ? 12 : currCutoffMonth - 1
  const thisPrevY = currCutoffMonth === 1 ? currCutoffYear - 1 : currCutoffYear
  const thisMonthStart = new Date(`${thisPrevY}-${pad(thisPrevM)}-20T00:00:00.000+07:00`)
  const thisMonthEnd = new Date(`${currCutoffYear}-${pad(currCutoffMonth)}-19T23:59:59.999+07:00`)

  // Bulan Lalu (Cut-off tgl 20 sebelumnya)
  const lastEndM = thisPrevM
  const lastEndY = thisPrevY
  const lastStartM = lastEndM === 1 ? 12 : lastEndM - 1
  const lastStartY = lastEndM === 1 ? lastEndY - 1 : lastEndY
  const lastMonthStart = new Date(`${lastStartY}-${pad(lastStartM)}-20T00:00:00.000+07:00`)
  const lastMonthEnd = new Date(`${lastEndY}-${pad(lastEndM)}-19T23:59:59.999+07:00`)

  // Tahun cut-off: 20 Desember tahun lalu s/d 20 Desember tahun ini
  const yearStart = new Date(`${currCutoffYear - 1}-12-20T00:00:00.000+07:00`)
  const yearEnd = new Date(`${currCutoffYear}-12-19T23:59:59.999+07:00`)

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

  const [
    todayTx, monthTx, lastMonthTx,
    totalProducts, totalEmployees,
    recentTx, topProducts,
    payMethodToday, absensiToday,
    monthlyTxRaw, monthlyExpRaw,
    yearlyTxRaw, yearlyExpRaw,
  ] = await Promise.all([
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: today, lte: tomorrow }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.orderItem.aggregate({ where: { transaction: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true }, _count: true }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.transaction.findMany({ where: { status: 'COMPLETED', deletedAt: null }, take: 5, orderBy: { createdAt: 'desc' }, include: { cashier: { select: { name: true } } } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { transaction: { status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5 }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: today, lte: tomorrow }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.attendance.findMany({ where: { date: { gte: today, lte: tomorrow } }, include: { employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd }, status: 'COMPLETED', deletedAt: null } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    prisma.expense.findMany({ where: { date: { gte: thisMonthStart, lte: thisMonthEnd } }, select: { total: true, date: true } }),
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    prisma.expense.findMany({ where: { date: { gte: yearStart, lte: yearEnd } }, select: { total: true, date: true } }),
  ])

  // Bangun dailyChart dari thisMonthStart (tgl 20 bulan lalu) s/d thisMonthEnd (tgl 20 bulan ini)
  const daysList = []
  const curDay = new Date(thisMonthStart)
  while (curDay <= thisMonthEnd) {
    const w = toWIB(curDay)
    const key = `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`
    daysList.push({ key, label: `${w.getUTCDate()}/${w.getUTCMonth() + 1}`, d: w.getUTCDate() })
    curDay.setTime(curDay.getTime() + 24 * 60 * 60 * 1000)
  }

  const dailyChart = daysList.map(({ key, label }) => {
    const rev = monthlyTxRaw.filter(t => {
      const w = toWIB(t.transaction.createdAt)
      return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}` === key
    }).reduce((s, t) => s + t.subtotal, 0)

    const exp = monthlyExpRaw.filter(e => {
      const w = toWIB(e.date)
      return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}` === key
    }).reduce((s, e) => s + e.total, 0)

    return { label, revenue: rev, expense: exp }
  })

  // Bangun monthlyChart (12 bulan cut-off: Jan s/d Des)
  const monthlyChart = Array.from({ length: 12 }, (_, m) => {
    const prevM = m === 0 ? 12 : m
    const prevY = m === 0 ? currCutoffYear - 1 : currCutoffYear
    const currM = m + 1
    const startT = new Date(`${prevY}-${pad(prevM)}-20T00:00:00.000+07:00`).getTime()
    const endT = new Date(`${currCutoffYear}-${pad(currM)}-19T23:59:59.999+07:00`).getTime()

    const rev = yearlyTxRaw.filter(t => {
      const time = new Date(t.transaction.createdAt).getTime()
      return time >= startT && time <= endT
    }).reduce((s, t) => s + t.subtotal, 0)

    const exp = yearlyExpRaw.filter(e => {
      const time = new Date(e.date).getTime()
      return time >= startT && time <= endT
    }).reduce((s, e) => s + e.total, 0)

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
    currentMonthIndex: currCutoffMonth - 1,
    currentMonth: MONTHS[currCutoffMonth - 1],
    currentYear: currCutoffYear,
    months: MONTHS,
    cutoff: {
      from: `${thisPrevY}-${pad(thisPrevM)}-20`,
      to: `${currCutoffYear}-${pad(currCutoffMonth)}-20`,
    },
  })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const pad = n => String(n).padStart(2, '0')

function getCutoff(year, month) {
  // month = 0-11; periode: 20 bulan sebelumnya s/d 20 bulan ini
  const prevMonth = month === 0 ? 12 : month
  const prevYear = month === 0 ? year - 1 : year
  const currMonth = month + 1
  return {
    start: new Date(`${prevYear}-${pad(prevMonth)}-20T00:00:00+07:00`),
    end: new Date(`${year}-${pad(currMonth)}-19T23:59:59.999+07:00`),
  }
}

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const wibDay = wibNow.getUTCDate()
  const wibMonth = wibNow.getUTCMonth()
  const wibYear = wibNow.getUTCFullYear()

  let activeMonth = wibMonth
  let activeYear = wibYear
  if (wibDay > 20) {
    if (wibMonth === 11) { activeMonth = 0; activeYear = wibYear + 1 }
    else activeMonth = wibMonth + 1
  }

  const reqMonth = searchParams.get('month') !== null ? Number(searchParams.get('month')) : activeMonth
  const reqYear = searchParams.get('year') !== null ? Number(searchParams.get('year')) : activeYear

  const { start: monthStart, end: monthEnd } = getCutoff(reqYear, reqMonth)
  const prevMonthIdx = reqMonth === 0 ? 11 : reqMonth - 1
  const prevMonthYear = reqMonth === 0 ? reqYear - 1 : reqYear
  const { start: prevStart, end: prevEnd } = getCutoff(prevMonthYear, prevMonthIdx)

  const yearStart = new Date(`${reqYear - 1}-12-20T00:00:00+07:00`)
  const yearEnd = new Date(`${reqYear}-12-19T23:59:59.999+07:00`)

  const todayStr = `${wibYear}-${pad(wibMonth + 1)}-${pad(wibDay)}`
  const todayStart = new Date(`${todayStr}T00:00:00+07:00`)
  const todayEnd = new Date(`${todayStr}T23:59:59.999+07:00`)

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

  const [
    txMonth, txPrev, txYear, txToday,
    expMonth, expPrev, expYear, expToday,
    topProductsMonth, topProductsYear,
    allTxMonth,
    expCatMonth, expCatYear,
    payMethodMonth, payMethodYear,
    salesCatMonth, salesCatYear,
    allTxYear, allExpYear,
    absensiMonth,
    wasteMonth,
    kasData,
    voucherMonth,
    memberTxMonth,
    kasirMonth,
    ingredientPurchases,
    ingredientUsageItems,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true, discountAmount: true, voucherDiscount: true, memberDiscount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: prevStart, lte: prevEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),

    prisma.expense.aggregate({ where: { date: { gte: monthStart, lte: monthEnd } }, _sum: { total: true }, _count: true }),
    prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { date: { gte: yearStart, lte: yearEnd } }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { date: { gte: todayStart, lte: todayEnd } }, _sum: { total: true } }),

    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 10 }),
    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 10 }),

    prisma.transaction.findMany({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, select: { total: true, createdAt: true, payMethod: true }, orderBy: { createdAt: 'asc' } }),

    prisma.expenseDetail.groupBy({ by: ['category'], where: { expense: { date: { gte: monthStart, lte: monthEnd } } }, _sum: { subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    prisma.expenseDetail.groupBy({ by: ['category'], where: { expense: { date: { gte: yearStart, lte: yearEnd } } }, _sum: { subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } } }),

    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),

    prisma.orderItem.groupBy({ by: ['category'], where: { transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true, qty: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    prisma.orderItem.groupBy({ by: ['category'], where: { transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true, qty: true }, orderBy: { _sum: { subtotal: 'desc' } } }),

    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    prisma.expense.findMany({ where: { date: { gte: yearStart, lte: yearEnd } }, select: { total: true, date: true } }),

    prisma.attendance.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, include: { employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),

    prisma.wasteNote.aggregate({ where: { tanggal: { gte: monthStart, lte: monthEnd } }, _sum: { total: true }, _count: true }),

    prisma.monthlyKas.findMany({ where: { year: reqYear } }),

    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null, voucherId: { not: null } }, _sum: { voucherDiscount: true }, _count: true }),

    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null, memberId: { not: null } }, _sum: { total: true }, _count: true }),

    prisma.transaction.groupBy({ by: ['cashierId'], where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true, orderBy: { _sum: { total: 'desc' } }, take: 5 }),

    prisma.expenseDetail.findMany({
      where: { expense: { date: { gte: monthStart, lte: monthEnd } }, expenseItem: { category: 'Persediaan' } },
      select: { name: true, qty: true, isi: true, satuan: true, subtotal: true, expenseItem: { select: { name: true } } },
    }),

    prisma.orderItem.findMany({
      where: { transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null } },
      select: { qty: true, product: { select: { ingredients: { select: { qty: true, ingredient: { select: { name: true, unit: true, packSize: true, price: true } } } } } } },
    }),
  ])

  const kasirIds = kasirMonth.map(k => k.cashierId)
  const kasirUsers = kasirIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: kasirIds } }, select: { id: true, name: true } })
    : []

  // Daily chart
  const dailyMap = {}
  allTxMonth.forEach(t => {
    const wib = new Date(new Date(t.createdAt).getTime() + 7 * 60 * 60 * 1000)
    const key = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, count: 0 }
    dailyMap[key].revenue += t.total
    dailyMap[key].count += 1
  })

  const dailyChart = []
  const cur = new Date(monthStart)
  while (cur <= monthEnd) {
    const wib = new Date(cur.getTime() + 7 * 60 * 60 * 1000)
    const key = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`
    dailyChart.push({ key, label: `${wib.getUTCDate()}/${wib.getUTCMonth() + 1}`, revenue: dailyMap[key]?.revenue || 0, count: dailyMap[key]?.count || 0 })
    cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000)
  }

  // Monthly chart
  const monthlyChart = Array.from({ length: 12 }, (_, m) => {
    const { start: s, end: e } = getCutoff(reqYear, m)
    const rev = allTxYear.filter(t => { const time = new Date(t.transaction.createdAt).getTime(); return time >= s.getTime() && time <= e.getTime() }).reduce((sum, t) => sum + t.subtotal, 0)
    const exp = allExpYear.filter(t => { const time = new Date(t.date).getTime(); return time >= s.getTime() && time <= e.getTime() }).reduce((sum, t) => sum + t.total, 0)
    return { month: MONTHS[m], revenue: rev, expense: exp, laba: rev - exp }
  })

  const totalRevMonth = txMonth._sum.total || 0
  const totalRevPrev = txPrev._sum.total || 0
  const totalExpMonth = expMonth._sum.total || 0
  const totalExpPrev = expPrev._sum.total || 0
  const labaMonth = totalRevMonth - totalExpMonth
  const labaPrev = totalRevPrev - totalExpPrev
  const totalRevYear = txYear._sum.total || 0
  const totalExpYear = expYear._sum.total || 0
  const labaYear = totalRevYear - totalExpYear

  const daysWithSales = Object.values(dailyMap).filter(d => d.revenue > 0).length
  const kasAwal = kasData.find(k => k.month === reqMonth)?.kasAwal || 0

  // Absensi per karyawan
  const absensiSummary = {}
  absensiMonth.forEach(a => {
    const name = a.employee?.name || '-'
    if (!absensiSummary[name]) absensiSummary[name] = { OPENING: 0, CLOSING_1: 0, CLOSING_2: 0, CLOSING_3: 0 }
    absensiSummary[name][a.type] = (absensiSummary[name][a.type] || 0) + 1
  })

  // Agregasi bahan baku: pembelian
  const buyMap = {}
  for (const d of ingredientPurchases) {
    const name = (d.expenseItem?.name || d.name || '').trim()
    if (!name) continue
    if (!buyMap[name]) buyMap[name] = { name, totalBought: 0, totalSpent: 0 }
    const units = d.isi && d.isi > 0 ? d.qty * d.isi : d.qty
    buyMap[name].totalBought += units
    buyMap[name].totalSpent += d.subtotal
  }

  // Agregasi bahan baku: pemakaian
  const useMap = {}
  for (const oi of ingredientUsageItems) {
    if (!oi.product?.ingredients?.length) continue
    for (const pi of oi.product.ingredients) {
      if (!pi.ingredient) continue
      const name = pi.ingredient.name.trim()
      if (!useMap[name]) useMap[name] = { name, unit: pi.ingredient.unit, packSize: pi.ingredient.packSize ?? 0, pricePerUnit: pi.ingredient.packSize > 0 ? (pi.ingredient.price || 0) / pi.ingredient.packSize : 0, totalUsed: 0 }
      useMap[name].totalUsed += pi.qty * oi.qty
    }
  }

  // Gabungkan
  const allNames = new Set([...Object.keys(buyMap), ...Object.keys(useMap)])
  const ingredientAnalysis = Array.from(allNames).map(name => {
    const b = buyMap[name] || { totalBought: 0, totalSpent: 0 }
    const u = useMap[name] || { unit: '', packSize: 0, pricePerUnit: 0, totalUsed: 0 }
    const selisih = b.totalBought - u.totalUsed
    return {
      name,
      unit: u.unit,
      totalBought: b.totalBought,
      totalSpent: b.totalSpent,
      totalUsed: u.totalUsed,
      selisih,
      estimasiNilaiSelisih: selisih * u.pricePerUnit,
    }
  }).sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih))

  return NextResponse.json({
    period: {
      month: reqMonth, year: reqYear, monthName: MONTHS[reqMonth],
      cutoffFrom: monthStart.toISOString().slice(0, 10),
      cutoffTo: monthEnd.toISOString().slice(0, 10),
      activeMonth, activeYear,
    },
    kpi: {
      revenue: { month: totalRevMonth, prev: totalRevPrev, year: totalRevYear, today: txToday._sum.total || 0, growth: totalRevPrev > 0 ? ((totalRevMonth - totalRevPrev) / totalRevPrev * 100) : null },
      expense: { month: totalExpMonth, prev: totalExpPrev, year: totalExpYear, today: expToday._sum.total || 0, growth: totalExpPrev > 0 ? ((totalExpMonth - totalExpPrev) / totalExpPrev * 100) : null },
      laba: { month: labaMonth, prev: labaPrev, year: labaYear, growth: labaPrev !== 0 ? ((labaMonth - labaPrev) / Math.abs(labaPrev) * 100) : null },
      transactions: { month: txMonth._count, prev: txPrev._count, year: txYear._count, today: txToday._count },
      avgDailySales: daysWithSales > 0 ? totalRevMonth / daysWithSales : 0,
      avgTxValue: txMonth._count > 0 ? totalRevMonth / txMonth._count : 0,
      netMarginMonth: totalRevMonth > 0 ? (labaMonth / totalRevMonth * 100) : 0,
      netMarginYear: totalRevYear > 0 ? (labaYear / totalRevYear * 100) : 0,
      daysWithSales,
      discountTotal: txMonth._sum.discountAmount || 0,
      voucherDiscount: txMonth._sum.voucherDiscount || 0,
      memberDiscount: txMonth._sum.memberDiscount || 0,
    },
    kas: { kasAwal, kasAkhir: kasAwal + totalRevMonth - totalExpMonth, totalRevMonth, totalExpMonth },
    dailyChart,
    monthlyChart,
    topProductsMonth: topProductsMonth.map(p => ({ name: p.name, qty: p._sum.qty || 0, revenue: p._sum.subtotal || 0 })),
    topProductsYear: topProductsYear.map(p => ({ name: p.name, qty: p._sum.qty || 0, revenue: p._sum.subtotal || 0 })),
    expCatMonth: expCatMonth.map(c => ({ category: c.category || 'Lainnya', total: c._sum.subtotal || 0 })),
    expCatYear: expCatYear.map(c => ({ category: c.category || 'Lainnya', total: c._sum.subtotal || 0 })),
    payMethodMonth: payMethodMonth.map(p => ({ method: p.payMethod, total: p._sum.total || 0, count: p._count })),
    payMethodYear: payMethodYear.map(p => ({ method: p.payMethod, total: p._sum.total || 0, count: p._count })),
    salesCatMonth: salesCatMonth.map(c => ({ category: c.category || 'Lainnya', total: c._sum.subtotal || 0, qty: c._sum.qty || 0 })),
    salesCatYear: salesCatYear.map(c => ({ category: c.category || 'Lainnya', total: c._sum.subtotal || 0, qty: c._sum.qty || 0 })),
    absensiSummary,
    waste: { total: wasteMonth._sum.total || 0, count: wasteMonth._count },
    voucher: { discount: voucherMonth._sum.voucherDiscount || 0, count: voucherMonth._count },
    memberTx: { total: memberTxMonth._sum.total || 0, count: memberTxMonth._count },
    kasirPerformance: kasirMonth.map(k => ({ name: kasirUsers.find(u => u.id === k.cashierId)?.name || '-', total: k._sum.total || 0, count: k._count })),
    ingredientAnalysis,
    months: MONTHS,
  })
}

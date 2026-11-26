import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const pad = n => String(n).padStart(2, '0')

function getCutoff(year, month) {
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
    expDetailMonth,
    payMethodMonth, payMethodYear,
    salesCatMonth, salesCatYear,
    monthlyChartRaw, _unusedAllExpYear,
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

    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 10 }),

    prisma.transaction.findMany({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, select: { total: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),

    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: monthStart, lte: monthEnd } } }, select: { category: true, subtotal: true, expenseItem: { select: { category: true } } } }),
    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: yearStart, lte: yearEnd } } }, select: { category: true, subtotal: true, expenseItem: { select: { category: true } } } }),

    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: monthStart, lte: monthEnd } } }, select: { name: true, qty: true, satuan: true, subtotal: true, category: true, expenseItem: { select: { category: true } }, expense: { select: { date: true } } }, orderBy: { expense: { date: 'asc' } } }),

    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true }),

    prisma.orderItem.groupBy({ by: ['category'], where: { transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true, qty: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    prisma.orderItem.groupBy({ by: ['category'], where: { transaction: { createdAt: { gte: yearStart, lte: yearEnd }, status: 'COMPLETED', deletedAt: null } }, _sum: { subtotal: true, qty: true }, orderBy: { _sum: { subtotal: 'desc' } } }),

    // monthly chart: aggregate per bulan langsung dari Prisma
    Promise.all(Array.from({ length: 12 }, (_, m) => {
      const { start: s, end: e } = getCutoff(reqYear, m)
      return Promise.all([
        prisma.transaction.aggregate({ where: { createdAt: { gte: s, lte: e }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true } }),
        prisma.expense.aggregate({ where: { date: { gte: s, lte: e } }, _sum: { total: true } }),
      ]).then(([tx, exp]) => ({ month: MONTHS[m], revenue: tx._sum.total || 0, expense: exp._sum.total || 0, laba: (tx._sum.total || 0) - (exp._sum.total || 0) }))
    })),
    Promise.resolve([]), // placeholder allExpYear (tidak dipakai lagi)

    prisma.attendance.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, include: { employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),

    prisma.wasteNote.aggregate({ where: { tanggal: { gte: monthStart, lte: monthEnd } }, _sum: { total: true }, _count: true }),

    prisma.monthlyKas.findMany({ where: { OR: [{ year: reqYear }, { year: prevMonthYear }] } }),

    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null, voucherId: { not: null } }, _sum: { voucherDiscount: true }, _count: true }),

    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null, memberId: { not: null } }, _sum: { total: true }, _count: true }),

    prisma.transaction.groupBy({ by: ['cashierId'], where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, _sum: { total: true }, _count: true, orderBy: { _sum: { total: 'desc' } }, take: 5 }),

    prisma.expenseDetail.findMany({
      where: {
        expense: { date: { gte: monthStart, lte: monthEnd } },
        OR: [
          { category: 'Persediaan' },
          { category: '', expenseItem: { category: 'Persediaan' } },
        ],
      },
      select: { name: true, qty: true, isi: true, satuan: true, subtotal: true, expenseItem: { select: { name: true } } },
    }),

    prisma.orderItem.findMany({
      where: { transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', deletedAt: null }, productId: { not: null } },
      select: { qty: true, product: { select: { ingredients: { select: { qty: true, ingredient: { select: { name: true, unit: true, packSize: true, price: true } } } } } } },
    }),

    // Neraca
    prisma.transaction.aggregate({ where: { status: 'PENDING', deletedAt: null }, _sum: { total: true }, _count: true }),
    prisma.operationalSaldoLedger.findFirst({ where: { roleKey: 'operasional' }, orderBy: { createdAt: 'desc' }, select: { balanceAfter: true } }),
    prisma.inventoryItem.findMany({ select: { name: true, qty: true, satuan: true, category: true } }),
    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: yearStart, lte: yearEnd } }, category: 'Persediaan' }, select: { name: true, qty: true, isi: true, harga: true, subtotal: true } }),
    prisma.monthlyKas.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 }),
  ])

  const kasirIds = kasirMonth.map(k => k.cashierId)
  const kasirUsers = kasirIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: kasirIds } }, select: { id: true, name: true } })
    : []

  // Daily chart — pakai transaction.total agar konsisten dengan dashboard
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

  // Monthly chart sudah dihitung langsung dari Prisma per bulan
  const monthlyChart = monthlyChartRaw

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

  // Kas awal: pakai record manual jika ada, fallback ke kasAkhir bulan lalu
  const kasAwalRecord = kasData.find(k => k.year === reqYear && k.month === reqMonth)
  let kasAwal
  if (kasAwalRecord != null) {
    kasAwal = kasAwalRecord.kasAwal
  } else {
    const prevKasRecord = kasData.find(k => k.year === prevMonthYear && k.month === prevMonthIdx)
    const prevKasAwal = prevKasRecord?.kasAwal ?? 0
    const prevRevTotal = txPrev._sum.total || 0
    const prevExpTotal = expPrev._sum.total || 0
    kasAwal = prevKasAwal + prevRevTotal - prevExpTotal
  }

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
    const name = ((d.category === 'Persediaan' ? d.name : d.expenseItem?.name || d.name) || '').trim()
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
      const pricePerUnit = (pi.ingredient.packSize > 0 && pi.ingredient.price)
        ? pi.ingredient.price / pi.ingredient.packSize : 0
      if (!useMap[name]) useMap[name] = { name, unit: pi.ingredient.unit, pricePerUnit, totalUsed: 0 }
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

  // Merge kategori null → 'Lainnya'
  // Konsisten dengan rekap pengeluaran: category di detail diutamakan,
  // fallback ke expenseItem.category, fallback ke 'Lainnya'
  const resolveCategory = (d) => {
    const cat = (d.category && d.category.trim()) ? d.category.trim()
      : (d.expenseItem?.category && d.expenseItem.category.trim()) ? d.expenseItem.category.trim()
      : 'Lainnya'
    return cat
  }

  // Aggregate kategori dari raw detail rows (bukan groupBy) agar fallback expenseItem.category ikut
  const mergeCatRaw = (rows) => {
    const acc = {}
    rows.forEach(d => {
      const k = resolveCategory(d)
      acc[k] = (acc[k] || 0) + (d.subtotal || 0)
    })
    return Object.entries(acc).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
  }

  const mergeCat = mergeCatRaw // alias untuk kompatibilitas

  // Detail pengeluaran: untuk Persediaan, ringkas per nama item
  const detailRaw = expDetailMonth.map(d => ({
    name: d.name, qty: d.qty, satuan: d.satuan, subtotal: d.subtotal,
    category: resolveCategory(d), date: d.expense.date,
  }))

  const persediaanMap = {}
  const nonPersediaan = []
  for (const d of detailRaw) {
    if (d.category === 'Persediaan') {
      const key = d.name?.trim() || '-'
      if (!persediaanMap[key]) persediaanMap[key] = { name: key, qty: 0, satuan: d.satuan, subtotal: 0, category: 'Persediaan', count: 0 }
      persediaanMap[key].qty += d.qty || 0
      persediaanMap[key].subtotal += d.subtotal || 0
      persediaanMap[key].count += 1
    } else {
      nonPersediaan.push(d)
    }
  }
  const persediaanList = Object.values(persediaanMap).sort((a, b) => b.subtotal - a.subtotal)

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
    expCatMonth: mergeCat(expCatMonth),
    expCatYear: mergeCat(expCatYear),
    expenseDetails: { persediaan: persediaanList, lainnya: nonPersediaan },
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

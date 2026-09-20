import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const now = new Date()

  const mode = searchParams.get('mode') || 'month'
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : now.getFullYear()

  // Untuk bulan: jika tidak ada parameter, default ke bulan sekarang WIB
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const defaultMonth = wibNow.getUTCMonth()
  const month = searchParams.get('month') !== null && searchParams.get('month') !== ''
    ? Number(searchParams.get('month'))
    : defaultMonth

  // Range dalam WIB menggunakan ISO string +07:00 — tidak ada ambiguitas timezone
  const pad = n => String(n).padStart(2, '0')
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()

  const rangeStart = mode === 'year'
    ? new Date(`${year}-01-01T00:00:00+07:00`)
    : new Date(`${year}-${pad(month + 1)}-01T00:00:00+07:00`)

  const rangeEnd = mode === 'year'
    ? new Date(`${year}-12-31T23:59:59.999+07:00`)
    : new Date(`${year}-${pad(month + 1)}-${pad(lastDayOfMonth)}T23:59:59.999+07:00`)

  const [salesRaw, expRaw, kasData] = await Promise.all([
    prisma.orderItem.findMany({
      where: { transaction: { status: 'COMPLETED', deletedAt: null, createdAt: { gte: rangeStart, lte: rangeEnd } } },
      select: {
        category: true, subtotal: true,
        transaction: { select: { createdAt: true } },
        product: { select: { category: { select: { name: true } } } },
      },
    }),
    prisma.expenseDetail.findMany({
      where: { expense: { date: { gte: rangeStart, lte: rangeEnd } } },
      select: {
        category: true, subtotal: true,
        expense: { select: { date: true } },
        expenseItem: { select: { category: true } },
      },
    }),
    prisma.monthlyKas.findMany({ where: { year } }),
  ])

  // Konversi UTC ke WIB — kembalikan month (0-11) dan date (1-31)
  function toWIB(d) {
    const wib = new Date(new Date(d).getTime() + 7 * 60 * 60 * 1000)
    return { month: wib.getUTCMonth(), date: wib.getUTCDate() }
  }

  // Kolom: untuk year = bulan (key: 0-11), untuk month = minggu (key: 1-4)
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const cols = mode === 'year'
    ? Array.from({ length: 12 }, (_, i) => ({ key: i, label: MONTHS[i] }))
    : [{ key: 1, label: 'Mg1' }, { key: 2, label: 'Mg2' }, { key: 3, label: 'Mg3' }, { key: 4, label: 'Mg4' }]

  function getColKey(rawDate) {
    const { month: m, date: d } = toWIB(rawDate)
    if (mode === 'year') return m
    return Math.min(Math.ceil(d / 7), 4)
  }

  // Build tabel — key selalu number agar konsisten dengan frontend
  function buildTable(items, getCat) {
    const map = {}
    items.forEach(item => {
      const cat = getCat(item) || 'Lainnya'
      const col = getColKey(item._date) // number
      if (!map[cat]) map[cat] = {}
      map[cat][col] = (map[cat][col] || 0) + item.subtotal
    })
    return Object.entries(map)
      .map(([cat, colMap]) => ({
        cat,
        cols: colMap, // key = number
        total: Object.values(colMap).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total)
  }

  const salesItems = salesRaw.map(i => ({ ...i, _date: i.transaction.createdAt }))
  const expItems = expRaw.map(i => ({ ...i, _date: i.expense.date }))

  const salesTable = buildTable(salesItems, i => i.product?.category?.name || i.category)
  const expTable = buildTable(expItems, i => i.expenseItem?.category || i.category)

  // Total per kolom — key tetap number
  function colTotals(table) {
    const totals = {}
    table.forEach(({ cols: colMap }) => {
      Object.entries(colMap).forEach(([k, v]) => {
        const numKey = Number(k)
        totals[numKey] = (totals[numKey] || 0) + v
      })
    })
    return totals
  }

  const kasAwal = mode === 'year'
    ? kasData.reduce((s, k) => s + k.kasAwal, 0)
    : (kasData.find(k => k.month === month)?.kasAwal || 0)

  return NextResponse.json({
    cols,
    salesTable,
    expTable,
    salesTotals: colTotals(salesTable),
    expTotals: colTotals(expTable),
    kasAwal,
    mode,
    month,
    year,
  })
}

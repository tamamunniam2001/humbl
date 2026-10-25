import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, canAccessPage } from '@/lib/auth'

// ── Rekap Waste ──
// Ringkasan & tren catatan waste untuk satu periode:
//  - mode "bulan" → 12 bulan dalam satu tahun (Cut-off tgl 20)
//  - mode "hari"  → seluruh tanggal dalam satu bulan cut-off (20 bulan lalu s/d 20 bulan ini)
// Nilai dihitung dari snapshot harga yang tersimpan di WasteNote.total/item,
// jadi angka historis tidak berubah walau harga Bahan Baku naik.
const PAGE_PATH = '/waste/rekap'

const CATEGORIES = ['RND', 'BUSUK', 'TIDAK_TERPAKAI', 'DIPAKAI_SENDIRI', 'SALAH_BUAT', 'LAINNYA']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const TZ_OFFSET = 7 * 60 * 60 * 1000 // WIB = UTC+7

const toWIB = (d) => new Date(new Date(d).getTime() + TZ_OFFSET)
const bulat = (n) => Math.round((Number(n) || 0) * 100) / 100
const pad = (n) => String(n).padStart(2, '0')
const awalHariWIB = (ymd) => new Date(`${ymd}T00:00:00+07:00`)
const akhirHariWIB = (ymd) => new Date(`${ymd}T23:59:59.999+07:00`)

function clampInt(raw, min, max, fallback) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return fallback
  const n = Math.trunc(Number(raw))
  if (!isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Rentang tanggal (WIB) untuk mode & periode terpilih per tanggal 20
function rangeOf(mode, year, month) {
  if (mode === 'hari') {
    // Cut-off per tanggal 20: misal Okt (month=10) -> 20 Sep s/d 20 Okt
    const prevM = month === 1 ? 12 : month - 1
    const prevY = month === 1 ? year - 1 : year
    return { from: `${prevY}-${pad(prevM)}-20`, to: `${year}-${pad(month)}-20` }
  }
  // mode === 'bulan': 12 bulan (20 Des tahun lalu s/d 20 Des tahun ini)
  return { from: `${year - 1}-12-20`, to: `${year}-12-20` }
}

// Periode pembanding: tahun sebelumnya (mode bulan) / bulan sebelumnya (mode hari)
function rangeSebelumnya(mode, year, month) {
  if (mode === 'hari') return rangeOf('hari', month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
  return rangeOf('bulan', year - 1, 1)
}

const whereTanggal = (range, category) => {
  const w = { tanggal: { gte: awalHariWIB(range.from), lte: akhirHariWIB(range.to) } }
  if (category) w.category = category
  return w
}

function labelPeriode(mode, year, month) {
  if (mode === 'hari') {
    const prevM = month === 1 ? 12 : month - 1
    return `${MONTHS[month - 1]} ${year} (20 ${MONTHS[prevM - 1]} - 20 ${MONTHS[month - 1]})`
  }
  return `Tahun ${year} (Cut-Off 20 Des - 20 Des)`
}

// Deret per bucket (bulan/tanggal) + nilai per kategori untuk grafik bertumpuk
function buildSeries(mode, year, month, notes, range) {
  if (mode === 'hari') {
    // Generate setiap tanggal dari range.from s/d range.to
    const startDate = new Date(`${range.from}T00:00:00+07:00`)
    const endDate = new Date(`${range.to}T23:59:59.999+07:00`)
    const days = []
    const cur = new Date(startDate)
    while (cur <= endDate) {
      const wKey = new Date(cur.getTime() + TZ_OFFSET)
      const dayStr = `${wKey.getUTCFullYear()}-${pad(wKey.getUTCMonth() + 1)}-${pad(wKey.getUTCDate())}`
      days.push({
        dateStr: dayStr,
        label: `${pad(wKey.getUTCDate())}/${pad(wKey.getUTCMonth() + 1)}`,
        d: wKey.getUTCDate(),
      })
      cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000)
    }

    const buckets = days.map((dObj, idx) => ({
      nomor: idx + 1,
      label: dObj.label,
      key: dObj.dateStr,
      total: 0,
      count: 0,
      kategori: Object.fromEntries(CATEGORIES.map(c => [c, 0])),
    }))

    notes.forEach(n => {
      const w = toWIB(n.tanggal)
      const nStr = `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`
      const b = buckets.find(item => item.key === nStr)
      if (!b) return
      const nilai = Number(n.total) || 0
      b.total += nilai
      b.count += 1
      if (b.kategori[n.category] !== undefined) b.kategori[n.category] += nilai
    })

    return buckets.map(b => ({
      ...b,
      total: bulat(b.total),
      ...Object.fromEntries(CATEGORIES.map(c => [c, bulat(b.kategori[c])])),
    }))
  }

  // mode === 'bulan': 12 bulan (Jan..Des)
  const buckets = Array.from({ length: 12 }, (_, m) => {
    const prevM = m === 0 ? 12 : m
    const prevY = m === 0 ? year - 1 : year
    const currM = m + 1
    return {
      nomor: m + 1,
      label: MONTHS[m],
      key: `${year}-${pad(currM)}`,
      startTime: new Date(`${prevY}-${pad(prevM)}-20T00:00:00+07:00`).getTime(),
      endTime: new Date(`${year}-${pad(currM)}-20T23:59:59.999+07:00`).getTime(),
      total: 0,
      count: 0,
      kategori: Object.fromEntries(CATEGORIES.map(c => [c, 0])),
    }
  })

  notes.forEach(n => {
    const t = new Date(n.tanggal).getTime()
    const b = buckets.find(item => t >= item.startTime && t <= item.endTime)
    if (!b) return
    const nilai = Number(n.total) || 0
    b.total += nilai
    b.count += 1
    if (b.kategori[n.category] !== undefined) b.kategori[n.category] += nilai
  })

  return buckets.map(b => ({
    label: b.label,
    key: b.key,
    total: bulat(b.total),
    count: b.count,
    ...Object.fromEntries(CATEGORIES.map(c => [c, bulat(b.kategori[c])])),
  }))
}

// GET /admin/waste/rekap?mode=bulan|hari&year=&month=&category=
export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = canAccessPage(user, PAGE_PATH)
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const nowWIB = toWIB(new Date())
  const tahunIni = nowWIB.getUTCFullYear()
  const wDay = nowWIB.getUTCDate()
  const wMonth = nowWIB.getUTCMonth() + 1
  const bulanIni = wDay > 20 ? (wMonth === 12 ? 1 : wMonth + 1) : wMonth

  const mode = searchParams.get('mode') === 'hari' ? 'hari' : 'bulan'
  const year = clampInt(searchParams.get('year'), 2000, 2100, tahunIni)
  const month = clampInt(searchParams.get('month'), 1, 12, bulanIni)
  const kategori = searchParams.get('category')
  const category = CATEGORIES.includes(kategori) ? kategori : null

  const range = rangeOf(mode, year, month)
  const rangePrev = rangeSebelumnya(mode, year, month)
  const wherePeriode = whereTanggal(range, category)
  const wherePrev = whereTanggal(rangePrev, category)

  const [notes, prevAgg, itemCount, itemCountPrev, topItems, byUser] = await Promise.all([
    prisma.wasteNote.findMany({
      where: wherePeriode,
      select: { tanggal: true, total: true, category: true },
    }),
    prisma.wasteNote.aggregate({ where: wherePrev, _sum: { total: true }, _count: { _all: true } }),
    prisma.wasteNoteItem.count({ where: { wasteNote: wherePeriode } }),
    prisma.wasteNoteItem.count({ where: { wasteNote: wherePrev } }),
    prisma.wasteNoteItem.groupBy({
      by: ['ingredientName', 'unit'],
      where: { wasteNote: wherePeriode },
      _sum: { qty: true, subtotal: true },
      _count: { _all: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 12,
    }),
    prisma.wasteNote.groupBy({
      by: ['createdByName'],
      where: wherePeriode,
      _sum: { total: true },
      _count: { _all: true },
    }),
  ])

  const total = bulat(notes.reduce((s, n) => s + (Number(n.total) || 0), 0))
  const count = notes.length
  const prevTotal = bulat(prevAgg._sum.total)

  // Rekap per kategori
  const perKategori = Object.fromEntries(CATEGORIES.map(c => [c, { total: 0, count: 0 }]))
  notes.forEach(n => {
    const k = perKategori[n.category]
    if (!k) return
    k.total += Number(n.total) || 0
    k.count += 1
  })
  const byCategory = CATEGORIES
    .map(c => ({
      category: c,
      total: bulat(perKategori[c].total),
      count: perKategori[c].count,
      pct: total > 0 ? Math.round((perKategori[c].total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const byUserSorted = byUser
    .map(u => ({
      name: u.createdByName || 'Tanpa Nama',
      total: bulat(u._sum.total),
      count: u._count._all,
      pct: total > 0 ? Math.round(((Number(u._sum.total) || 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const topIngredients = topItems.map(i => ({
    name: i.ingredientName,
    unit: i.unit || '',
    qty: bulat(i._sum.qty),
    total: bulat(i._sum.subtotal),
    count: i._count._all,
    pct: total > 0 ? Math.round(((Number(i._sum.subtotal) || 0) / total) * 1000) / 10 : 0,
  }))

  const series = buildSeries(mode, year, month, notes, range)

  return NextResponse.json({
    mode,
    year,
    month,
    category,
    from: range.from,
    to: range.to,
    prevFrom: rangePrev.from,
    prevTo: rangePrev.to,
    periodLabel: labelPeriode(mode, year, month),
    prevLabel: labelPeriode(mode, Number(rangePrev.from.slice(0, 4)), Number(rangePrev.from.slice(5, 7))),
    summary: {
      total,
      count,
      itemCount,
      itemCountPrev,
      diffTotal: bulat(total - prevTotal),
      diffPct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null,
      topCategory: byCategory[0] || null,
    },
    byCategory,
    byUser: byUserSorted,
    topIngredients,
    series,
  })
}

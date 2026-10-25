import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

async function openai(messages) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY tidak ditemukan')

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: 'gpt-4o', messages, temperature: 0.7, max_tokens: 4096 }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('OpenAI error:', err)
    throw new Error('OpenAI error: ' + err)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

const fmt = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

async function buildFullContext() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const pad = n => String(n).padStart(2, '0')

  // Cut-off bulanan per tanggal 20: mis. Okt -> 20 Sep s/d 20 Okt
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const wibDay = wibNow.getUTCDate()
  const wibMonth = wibNow.getUTCMonth() + 1
  const wibYear = wibNow.getUTCFullYear()

  let currCutoffMonth = wibMonth
  let currCutoffYear = wibYear
  if (wibDay > 20) {
    if (wibMonth === 12) {
      currCutoffMonth = 1
      currCutoffYear += 1
    } else {
      currCutoffMonth += 1
    }
  }

  const thisPrevM = currCutoffMonth === 1 ? 12 : currCutoffMonth - 1
  const thisPrevY = currCutoffMonth === 1 ? currCutoffYear - 1 : currCutoffYear
  const monthStart = new Date(`${thisPrevY}-${pad(thisPrevM)}-20T00:00:00.000+07:00`)
  const monthEnd = new Date(`${currCutoffYear}-${pad(currCutoffMonth)}-20T23:59:59.999+07:00`)

  const lastEndM = thisPrevM
  const lastEndY = thisPrevY
  const lastStartM = lastEndM === 1 ? 12 : lastEndM - 1
  const lastStartY = lastEndM === 1 ? lastEndY - 1 : lastEndY
  const lastMonthStart = new Date(`${lastStartY}-${pad(lastStartM)}-20T00:00:00.000+07:00`)
  const lastMonthEnd = new Date(`${lastEndY}-${pad(lastEndM)}-20T23:59:59.999+07:00`)

  const yearStart = new Date(`${currCutoffYear - 1}-12-20T00:00:00.000+07:00`)
  const last7 = new Date(today); last7.setDate(today.getDate() - 6)
  const last30 = new Date(today); last30.setDate(today.getDate() - 29)

  const [
    todayTx, monthTx, lastMonthTx, yearTx,
    todayExp, monthExp, lastMonthExp, yearExp,
    topProductsMonth, topProductsYear, topProductsToday,
    allProducts, allIngredients,
    monthExpDetails, yearExpDetails,
    recentTransactions, last7DaysTx, last30DaysTx,
    dailyReports, employees, users,
    payMethodMonth, payMethodToday, payMethodYear,
    absensiMonth, absensiAll,
    monthExpByCategory, yearExpByCategory,
    allTransactionsMonth, inventoryItems,
  ] = await Promise.all([
    // Transaksi agregat
    prisma.transaction.aggregate({ where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: yearStart }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    // Pengeluaran agregat
    prisma.expense.aggregate({ where: { date: { gte: today, lt: tomorrow } }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { date: { gte: monthStart, lte: monthEnd } }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { date: { gte: yearStart } }, _sum: { total: true } }),
    // Produk terlaris
    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED' } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 20 }),
    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: yearStart }, status: 'COMPLETED' } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 20 }),
    prisma.orderItem.groupBy({ by: ['name'], where: { name: { not: null }, transaction: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' } }, _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 10 }),
    // Master data
    prisma.product.findMany({ where: { isActive: true }, select: { name: true, price: true, stock: true, category: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.ingredient.findMany({ orderBy: { name: 'asc' } }),
    // Pengeluaran detail
    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: monthStart, lte: monthEnd } } }, select: { name: true, category: true, harga: true, qty: true, subtotal: true, expenseItem: { select: { category: true } } }, orderBy: { subtotal: 'desc' } }),
    prisma.expenseDetail.findMany({ where: { expense: { date: { gte: yearStart } } }, select: { name: true, category: true, subtotal: true, expenseItem: { select: { category: true } } } }),
    // Transaksi terakhir
    prisma.transaction.findMany({ where: { status: 'COMPLETED' }, take: 20, orderBy: { createdAt: 'desc' }, select: { invoiceNo: true, total: true, createdAt: true, payMethod: true, customerName: true, cashier: { select: { name: true } }, items: { select: { name: true, qty: true, price: true, subtotal: true } } } }),
    // Tren harian
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: last7 }, status: 'COMPLETED' } }, select: { subtotal: true, qty: true, transaction: { select: { createdAt: true } } } }),
    prisma.orderItem.findMany({ where: { transaction: { createdAt: { gte: last30 }, status: 'COMPLETED' } }, select: { subtotal: true, transaction: { select: { createdAt: true } } } }),
    // Laporan harian
    prisma.dailyReport.findMany({ take: 30, orderBy: { date: 'desc' }, include: { cashier: { select: { name: true } } } }),
    // SDM
    prisma.employee.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { name: true, role: true } }),
    // Metode bayar
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    prisma.transaction.groupBy({ by: ['payMethod'], where: { createdAt: { gte: yearStart }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    // Absensi
    prisma.attendance.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, include: { employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    prisma.attendance.findMany({ where: { date: { gte: yearStart } }, select: { type: true, date: true, employee: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    // Pengeluaran per kategori
    prisma.expenseDetail.groupBy({ by: ['category'], where: { expense: { date: { gte: monthStart, lte: monthEnd } } }, _sum: { subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    prisma.expenseDetail.groupBy({ by: ['category'], where: { expense: { date: { gte: yearStart } } }, _sum: { subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } } }),
    // Semua transaksi bulan ini (untuk analisis per hari)
    prisma.transaction.findMany({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED' }, select: { total: true, createdAt: true, payMethod: true }, orderBy: { createdAt: 'asc' } }),
    // Inventaris
    prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }),
  ])

  // Kalkulasi turunan
  const labaHariIni = (todayTx._sum.total || 0) - (todayExp._sum.total || 0)
  const labaBulanIni = (monthTx._sum.total || 0) - (monthExp._sum.total || 0)
  const labaBulanLalu = (lastMonthTx._sum.total || 0) - (lastMonthExp._sum.total || 0)
  const labaTahunIni = (yearTx._sum.total || 0) - (yearExp._sum.total || 0)

  const trendPenjualan = lastMonthTx._sum.total > 0
    ? (((monthTx._sum.total || 0) - lastMonthTx._sum.total) / lastMonthTx._sum.total * 100).toFixed(1) + '%' : 'N/A'
  const trendPengeluaran = lastMonthExp._sum.total > 0
    ? (((monthExp._sum.total || 0) - lastMonthExp._sum.total) / lastMonthExp._sum.total * 100).toFixed(1) + '%' : 'N/A'

  // Tren 7 hari
  const last7Map = {}
  last7DaysTx.forEach(t => {
    const d = new Date(t.transaction.createdAt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    last7Map[d] = (last7Map[d] || 0) + t.subtotal
  })

  // Tren 30 hari
  const last30Map = {}
  last30DaysTx.forEach(t => {
    const d = new Date(t.transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    last30Map[d] = (last30Map[d] || 0) + t.subtotal
  })

  // Penjualan per hari dalam bulan ini
  const dailySalesMonth = {}
  allTransactionsMonth.forEach(t => {
    const d = new Date(t.createdAt).getDate()
    dailySalesMonth[d] = (dailySalesMonth[d] || 0) + t.total
  })

  // Pengeluaran tahun per kategori
  const yearExpCatMap = {}
  yearExpDetails.forEach(d => {
    const cat = d.category || d.expenseItem?.category || 'Tanpa Kategori'
    yearExpCatMap[cat] = (yearExpCatMap[cat] || 0) + d.subtotal
  })

  // Rata-rata transaksi per hari bulan ini
  const daysWithSales = Object.keys(dailySalesMonth).length
  const avgDailySales = daysWithSales > 0 ? (monthTx._sum.total || 0) / daysWithSales : 0

  // Jam tersibuk (dari transaksi bulan ini)
  const hourMap = {}
  allTransactionsMonth.forEach(t => {
    const h = new Date(t.createdAt).getHours()
    hourMap[h] = (hourMap[h] || 0) + 1
  })
  const busiestHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]

  const bulanIniStr = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })
  const bulanLaluStr = new Date(year, month - 1, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })

  let ctx = `=== DATA LENGKAP KEDAI KOPI "BUMI KOPI" ===\n`
  ctx += `Tanggal & waktu sekarang: ${fmtDate(now)}, ${now.toLocaleTimeString('id-ID')}\n\n`

  ctx += `--- RINGKASAN HARI INI ---\n`
  ctx += `Penjualan: ${fmt(todayTx._sum.total || 0)} (${todayTx._count} transaksi)\n`
  ctx += `Pengeluaran: ${fmt(todayExp._sum.total || 0)}\n`
  ctx += `Laba bersih: ${fmt(labaHariIni)}\n`
  ctx += `Metode bayar: ${payMethodToday.map(p => `${p.payMethod} ${fmt(p._sum.total || 0)} (${p._count}x)`).join(', ') || '-'}\n`
  ctx += `Produk terjual hari ini: ${topProductsToday.map(p => `${p.name} ${p._sum.qty}x`).join(', ') || '-'}\n\n`

  ctx += `--- BULAN INI (${bulanIniStr}) ---\n`
  ctx += `Total Penjualan: ${fmt(monthTx._sum.total || 0)} (${monthTx._count} transaksi) | Trend: ${trendPenjualan}\n`
  ctx += `Total Pengeluaran: ${fmt(monthExp._sum.total || 0)} | Trend: ${trendPengeluaran}\n`
  ctx += `Laba Bersih: ${fmt(labaBulanIni)}\n`
  ctx += `Rata-rata penjualan/hari: ${fmt(Math.round(avgDailySales))}\n`
  ctx += `Jam tersibuk: ${busiestHour ? `${busiestHour[0]}:00 (${busiestHour[1]} transaksi)` : '-'}\n`
  ctx += `Metode bayar: ${payMethodMonth.map(p => `${p.payMethod} ${fmt(p._sum.total || 0)} (${p._count}x)`).join(', ') || '-'}\n\n`

  ctx += `--- BULAN LALU (${bulanLaluStr}) ---\n`
  ctx += `Penjualan: ${fmt(lastMonthTx._sum.total || 0)} (${lastMonthTx._count} transaksi)\n`
  ctx += `Pengeluaran: ${fmt(lastMonthExp._sum.total || 0)}\n`
  ctx += `Laba Bersih: ${fmt(labaBulanLalu)}\n\n`

  ctx += `--- TAHUN INI (${year}) ---\n`
  ctx += `Total Penjualan: ${fmt(yearTx._sum.total || 0)} (${yearTx._count} transaksi)\n`
  ctx += `Total Pengeluaran: ${fmt(yearExp._sum.total || 0)}\n`
  ctx += `Laba Bersih: ${fmt(labaTahunIni)}\n`
  ctx += `Metode bayar: ${payMethodYear.map(p => `${p.payMethod} ${fmt(p._sum.total || 0)} (${p._count}x)`).join(', ') || '-'}\n\n`

  ctx += `--- PENJUALAN 7 HARI TERAKHIR ---\n`
  ctx += Object.entries(last7Map).map(([d, v]) => `${d}: ${fmt(v)}`).join('\n') + '\n\n'

  ctx += `--- PENJUALAN 30 HARI TERAKHIR (per hari) ---\n`
  ctx += Object.entries(last30Map).map(([d, v]) => `${d}: ${fmt(v)}`).join(' | ') + '\n\n'

  ctx += `--- PENJUALAN PER HARI BULAN INI ---\n`
  ctx += Object.entries(dailySalesMonth).map(([d, v]) => `Tgl ${d}: ${fmt(v)}`).join(' | ') + '\n\n'

  ctx += `--- PRODUK TERLARIS BULAN INI (TOP 20) ---\n`
  ctx += topProductsMonth.map((p, i) => `${i + 1}. ${p.name} — ${p._sum.qty}x terjual, ${fmt(p._sum.subtotal)}`).join('\n') + '\n\n'

  ctx += `--- PRODUK TERLARIS TAHUN INI (TOP 20) ---\n`
  ctx += topProductsYear.map((p, i) => `${i + 1}. ${p.name} — ${p._sum.qty}x terjual, ${fmt(p._sum.subtotal)}`).join('\n') + '\n\n'

  ctx += `--- PENGELUARAN BULAN INI PER KATEGORI ---\n`
  ctx += monthExpByCategory.map(c => `${c.category || 'Tanpa Kategori'}: ${fmt(c._sum.subtotal || 0)}`).join('\n') + '\n\n'

  ctx += `--- DETAIL PENGELUARAN BULAN INI (SEMUA) ---\n`
  ctx += monthExpDetails.map(d => `- ${d.name} (${d.category || d.expenseItem?.category || 'Tanpa Kategori'}): ${fmt(d.subtotal)} (${d.qty}x ${fmt(d.harga)})`).join('\n') + '\n\n'

  ctx += `--- PENGELUARAN TAHUN INI PER KATEGORI ---\n`
  ctx += Object.entries(yearExpCatMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n') + '\n\n'

  ctx += `--- 20 TRANSAKSI TERAKHIR ---\n`
  ctx += recentTransactions.map(t =>
    `${fmtDate(t.createdAt)} | ${t.invoiceNo} | ${t.customerName || 'Tanpa Nama'} | ${fmt(t.total)} | ${t.payMethod} | Kasir: ${t.cashier?.name || '-'}\n` +
    `  Items: ${t.items.map(i => `${i.name} ${i.qty}x ${fmt(i.price)}`).join(', ')}`
  ).join('\n') + '\n\n'

  ctx += `--- LAPORAN HARIAN 30 TERAKHIR ---\n`
  ctx += dailyReports.map(r => {
    const exp = Array.isArray(r.pengeluaran) ? r.pengeluaran.reduce((s, p) => s + (p.nominal || 0), 0) : 0
    return `${fmtDate(r.date)} | Kasir: ${r.cashier?.name || '-'} | Penjualan: ${fmt(r.penjualan)} | Pengeluaran: ${fmt(exp)} | Laba: ${fmt(r.penjualan - exp)} | Kas Awal: ${fmt(r.kasAwal)} | Disetor: ${fmt(r.uangDisetor)} | QRIS: ${fmt(r.qris)} | Transfer: ${fmt(r.transfer)}`
  }).join('\n') + '\n\n'

  ctx += `--- DAFTAR PRODUK AKTIF (${allProducts.length} produk) ---\n`
  ctx += allProducts.map(p => `${p.name} | Kategori: ${p.category?.name || '-'} | Harga: ${fmt(p.price)} | Stok: ${p.stock}`).join('\n') + '\n\n'

  ctx += `--- INVENTARIS (${inventoryItems.length} item) ---\n`
  ctx += inventoryItems.map(i => `${i.name} | ${i.qty} ${i.satuan || ''} | Kategori: ${i.category || '-'}${i.note ? ` | Catatan: ${i.note}` : ''}`).join('\n') + '\n\n'

  ctx += `--- BAHAN BAKU (${allIngredients.length} bahan) ---\n`
  ctx += allIngredients.map(i => `${i.name} (${i.unit})${i.code ? ` [${i.code}]` : ''}`).join(', ') + '\n\n'

  ctx += `--- KARYAWAN AKTIF ---\n`
  ctx += employees.map(e => e.name).join(', ') + '\n\n'

  ctx += `--- PENGGUNA SISTEM ---\n`
  ctx += users.map(u => `${u.name} (${u.role})`).join(', ') + '\n\n'

  ctx += `--- ABSENSI BULAN INI ---\n`
  const absensiOpening = absensiMonth.filter(a => a.type === 'OPENING')
  const absensiClosing = absensiMonth.filter(a => a.type === 'CLOSING')
  ctx += `Opening: ${absensiOpening.length}x | Closing: ${absensiClosing.length}x\n`
  ctx += absensiMonth.map(a => `${fmtDate(a.date)} | ${a.type} | ${a.employee?.name || '-'}`).join('\n') + '\n\n'

  ctx += `--- ABSENSI TAHUN INI (RINGKASAN PER KARYAWAN) ---\n`
  const absensiPerKaryawan = {}
  absensiAll.forEach(a => {
    const name = a.employee?.name || '-'
    if (!absensiPerKaryawan[name]) absensiPerKaryawan[name] = { OPENING: 0, CLOSING: 0 }
    absensiPerKaryawan[name][a.type]++
  })
  ctx += Object.entries(absensiPerKaryawan).map(([name, v]) => `${name}: Opening ${v.OPENING}x, Closing ${v.CLOSING}x`).join('\n') + '\n'

  return ctx
}

export async function POST(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ message: 'OPENAI_API_KEY belum dikonfigurasi' }, { status: 500 })

  const { mode, payload } = await req.json()

  if (mode === 'chat') {
    const { messages: chatHistory, question } = payload
    if (!question?.trim()) return NextResponse.json({ message: 'Pertanyaan tidak boleh kosong' }, { status: 400 })

    const fullContext = await buildFullContext()

    const systemPrompt =
      `Kamu adalah asisten AI bernama "Bumi AI" untuk kedai kopi "Bumi Kopi". ` +
      `Kamu memiliki akses penuh ke SEMUA data operasional kedai secara real-time — transaksi, produk, pengeluaran, laporan harian, karyawan, inventaris, dan absensi. ` +
      `Jawab dengan akurat berdasarkan data yang diberikan. ` +
      `Gunakan Bahasa Indonesia yang ramah, natural, dan profesional. ` +
      `Jika diminta analisis, berikan insight yang mendalam dan actionable. ` +
      `Jika diminta perbandingan atau perhitungan, tampilkan angkanya dengan jelas. ` +
      `Jika diminta rekomendasi, berikan saran konkret yang bisa langsung diterapkan. ` +
      `Format jawaban dengan rapi — gunakan bullet point, angka, atau tabel teks jika membantu kejelasan.\n\n` +
      fullContext

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory || []).slice(-20),
      { role: 'user', content: question },
    ]

    try {
      const result = await openai(messages)
      return NextResponse.json({ result })
    } catch (e) {
      console.error('Chat error:', e.message)
      return NextResponse.json({ message: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Mode tidak valid' }, { status: 400 })
}

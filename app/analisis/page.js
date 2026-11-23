'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const MONTHS_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtK = n => fmt(n)
const pct = n => (n === null || n === undefined) ? null : Number(n).toFixed(1)
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#84CC16','#EC4899','#14B8A6']

// ── PDF Generator ──
async function generatePDF(data, month, year, mode) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const L = 14, R = W - 14
  const fmtN = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
  const fmtNum = n => Number(n || 0).toLocaleString('id-ID')
  const isMonthly = mode === 'monthly'
  const periodLabel = isMonthly
    ? `${MONTHS_FULL[month]} ${year}`
    : `Tahun ${year}`

  const { kpi, kas, monthlyChart, topProductsMonth, topProductsYear,
    expCatMonth, expCatYear, payMethodMonth, payMethodYear,
    salesCatMonth, ingredientAnalysis, waste, voucher, memberTx,
    kasirPerformance, expenseDetails, period } = data

  let y = 0

  // ── helpers ──
  function newPage() {
    doc.addPage()
    y = 0
    drawPageHeader()
  }

  function checkY(need = 20) {
    if (y + need > H - 16) newPage()
  }

  function drawPageHeader() {
    doc.setFillColor(15, 23, 41)
    doc.rect(0, 0, W, 10, 'F')
    doc.setFontSize(7)
    doc.setTextColor(136, 150, 179)
    doc.text('LAPORAN ANALISIS BISNIS — HAMBL', L, 6.5)
    doc.text(periodLabel, R, 6.5, { align: 'right' })
    y = 16
  }

  function sectionTitle(title) {
    checkY(14)
    doc.setFillColor(99, 102, 241)
    doc.rect(L, y, 3, 6, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 41)
    doc.text(title, L + 6, y + 4.5)
    y += 10
  }

  function kpiRow(items) {
    checkY(22)
    const colW = (R - L) / items.length
    items.forEach((item, i) => {
      const x = L + i * colW
      doc.setFillColor(248, 250, 255)
      doc.setDrawColor(226, 232, 248)
      doc.roundedRect(x, y, colW - 3, 18, 2, 2, 'FD')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(136, 150, 179)
      doc.text(item.label.toUpperCase(), x + 4, y + 5)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(item.color || '#0F1729')
      doc.text(String(item.value), x + 4, y + 12)
      if (item.sub) {
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(176, 188, 204)
        doc.text(item.sub, x + 4, y + 16.5)
      }
    })
    y += 22
  }

  function tableHeader(cols) {
    doc.setFillColor(241, 245, 249)
    doc.rect(L, y, R - L, 7, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(136, 150, 179)
    cols.forEach(col => {
      doc.text(col.label, col.align === 'right' ? col.x + col.w - 1 : col.x + 2, y + 4.8, { align: col.align || 'left' })
    })
    y += 7
  }

  function tableRow(cols, values, rowIdx) {
    const rowH = 7
    checkY(rowH + 2)
    if (rowIdx % 2 === 1) {
      doc.setFillColor(250, 251, 255)
      doc.rect(L, y, R - L, rowH, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    cols.forEach((col, ci) => {
      const val = String(values[ci] ?? '')
      if (col.align === 'right') {
        doc.text(val, col.x + col.w - 1, y + 5, { align: 'right' })
      } else {
        const maxW = col.w - 3
        const truncated = doc.getTextWidth(val) > maxW
          ? val.slice(0, Math.floor(val.length * maxW / doc.getTextWidth(val)) - 1) + '…'
          : val
        doc.text(truncated, col.x + 2, y + 5)
      }
    })
    doc.setDrawColor(241, 245, 249)
    doc.line(L, y + rowH, R, y + rowH)
    y += rowH
  }

  function barMini(label, value, maxVal, color, total) {
    checkY(9)
    const pct = maxVal > 0 ? value / maxVal : 0
    const barW = (R - L - 60) * pct
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.text(label, L, y + 4)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(L + 55, y + 1, R - L - 60, 4, 1, 1, 'F')
    const rgb = hexToRgb(color)
    if (rgb) doc.setFillColor(rgb.r, rgb.g, rgb.b)
    if (barW > 0) doc.roundedRect(L + 55, y + 1, barW, 4, 1, 1, 'F')
    doc.setFontSize(7)
    doc.setTextColor(136, 150, 179)
    const pctStr = total > 0 ? `${(value / total * 100).toFixed(1)}%` : ''
    doc.text(`${fmtN(value)}  ${pctStr}`, R, y + 4.5, { align: 'right' })
    y += 9
  }

  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null
  }

  function divider() {
    checkY(6)
    doc.setDrawColor(226, 232, 248)
    doc.line(L, y, R, y)
    y += 5
  }

  // ══════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════
  doc.setFillColor(15, 23, 41)
  doc.rect(0, 0, W, H, 'F')

  // accent bar
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, 6, H, 'F')

  // logo area
  doc.setFillColor(30, 42, 59)
  doc.roundedRect(L + 6, 40, 60, 20, 4, 4, 'F')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(99, 102, 241)
  doc.text('HAMBL', L + 10, 53)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Laporan Analisis Bisnis', L + 6, 82)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(136, 150, 179)
  doc.text(isMonthly ? 'Laporan Bulanan' : 'Laporan Tahunan', L + 6, 92)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(99, 102, 241)
  doc.text(periodLabel, L + 6, 106)

  // KPI highlight on cover
  const coverKpis = [
    { label: 'Total Penjualan', value: fmtN(isMonthly ? kpi.revenue.month : kpi.revenue.year) },
    { label: 'Total Pengeluaran', value: fmtN(isMonthly ? kpi.expense.month : kpi.expense.year) },
    { label: 'Laba Bersih', value: fmtN(isMonthly ? kpi.laba.month : kpi.laba.year) },
    { label: 'Total Transaksi', value: fmtNum(isMonthly ? kpi.transactions.month : kpi.transactions.year) },
  ]
  coverKpis.forEach((k, i) => {
    const cx = L + 6 + (i % 2) * 88
    const cy = 122 + Math.floor(i / 2) * 28
    doc.setFillColor(30, 42, 59)
    doc.roundedRect(cx, cy, 82, 22, 3, 3, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(136, 150, 179)
    doc.text(k.label.toUpperCase(), cx + 4, cy + 7)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(k.value, cx + 4, cy + 16)
  })

  // footer cover
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  doc.text(`Digenerate: ${new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}`, L + 6, H - 16)
  doc.text('CONFIDENTIAL — Hanya untuk internal', R, H - 16, { align: 'right' })

  // ══════════════════════════════════════════
  // PAGE 2 — KPI & KAS
  // ══════════════════════════════════════════
  doc.addPage()
  drawPageHeader()

  sectionTitle('Ringkasan Kinerja Utama (KPI)')
  kpiRow([
    { label: 'Total Penjualan', value: fmtN(isMonthly ? kpi.revenue.month : kpi.revenue.year), sub: isMonthly ? `vs ${fmtN(kpi.revenue.prev)} bln lalu` : '', color: '#6366F1' },
    { label: 'Total Pengeluaran', value: fmtN(isMonthly ? kpi.expense.month : kpi.expense.year), sub: isMonthly ? `vs ${fmtN(kpi.expense.prev)} bln lalu` : '', color: '#EF4444' },
    { label: 'Laba Bersih', value: fmtN(isMonthly ? kpi.laba.month : kpi.laba.year), sub: `Net margin ${isMonthly ? kpi.netMarginMonth?.toFixed(1) : kpi.netMarginYear?.toFixed(1)}%`, color: (isMonthly ? kpi.laba.month : kpi.laba.year) >= 0 ? '#10B981' : '#EF4444' },
    { label: 'Total Transaksi', value: fmtNum(isMonthly ? kpi.transactions.month : kpi.transactions.year), sub: `Avg ${fmtN(kpi.avgTxValue)}/tx`, color: '#F59E0B' },
  ])
  kpiRow([
    { label: 'Rata-rata/Hari', value: fmtN(Math.round(kpi.avgDailySales)), sub: `${kpi.daysWithSales} hari aktif`, color: '#8B5CF6' },
    { label: 'Kas Akhir Bulan', value: fmtN(kas.kasAkhir), sub: `Kas awal ${fmtN(kas.kasAwal)}`, color: kas.kasAkhir >= 0 ? '#10B981' : '#EF4444' },
    { label: 'Transaksi Member', value: fmtNum(memberTx.count), sub: fmtN(memberTx.total), color: '#06B6D4' },
    { label: 'Waste Bulan Ini', value: fmtN(waste.total), sub: `${waste.count} catatan`, color: '#F97316' },
  ])

  divider()
  sectionTitle('Ringkasan Kas')
  const kasRows = [
    ['Kas Awal Bulan', fmtN(kas.kasAwal)],
    ['Total Penjualan (Cash)', fmtN(kas.totalRevMonth)],
    ['Total Pengeluaran', fmtN(kas.totalExpMonth)],
    ['Kas Akhir Bulan', fmtN(kas.kasAkhir)],
  ]
  const kasCols = [
    { label: 'Keterangan', x: L, w: 100 },
    { label: 'Nominal', x: L + 100, w: R - L - 100, align: 'right' },
  ]
  tableHeader(kasCols)
  kasRows.forEach((row, i) => {
    const isBold = i === 3
    if (isBold) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129)
    }
    tableRow(kasCols, row, i)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
  })

  divider()
  sectionTitle('Diskon & Promosi')
  kpiRow([
    { label: 'Total Diskon Manual', value: fmtN(kpi.discountTotal), color: '#F59E0B' },
    { label: 'Diskon Voucher', value: fmtN(kpi.voucherDiscount), sub: `${voucher.count} transaksi`, color: '#8B5CF6' },
    { label: 'Diskon Member', value: fmtN(kpi.memberDiscount), sub: `${memberTx.count} transaksi`, color: '#06B6D4' },
  ])

  // ══════════════════════════════════════════
  // PAGE 3 — PENJUALAN
  // ══════════════════════════════════════════
  newPage()
  sectionTitle('Metode Pembayaran')
  const pmData = isMonthly ? payMethodMonth : payMethodYear
  const pmTotal = pmData.reduce((s, p) => s + p.total, 0)
  const pmColors = { CASH: '#10B981', QRIS: '#6366F1', TRANSFER: '#F59E0B', NONTUNAI: '#8B5CF6' }
  pmData.forEach(p => barMini(p.method, p.total, pmTotal, pmColors[p.method] || '#6366F1', pmTotal))

  divider()
  sectionTitle('Penjualan per Kategori Produk')
  const scData = isMonthly ? salesCatMonth : data.salesCatYear
  const scTotal = scData.reduce((s, c) => s + c.total, 0)
  const scColors = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#84CC16']
  scData.slice(0, 8).forEach((c, i) => barMini(c.category || 'Lainnya', c.total, scTotal, scColors[i % scColors.length], scTotal))

  divider()
  sectionTitle(`Top Produk Terlaris — ${isMonthly ? period.monthName + ' ' + year : 'Tahun ' + year}`)
  const prodData = isMonthly ? topProductsMonth : topProductsYear
  const prodCols = [
    { label: '#', x: L, w: 10 },
    { label: 'Produk', x: L + 10, w: 75 },
    { label: 'Qty', x: L + 85, w: 22, align: 'right' },
    { label: 'Pendapatan', x: L + 107, w: 48, align: 'right' },
    { label: 'Kontribusi', x: L + 155, w: R - L - 155, align: 'right' },
  ]
  tableHeader(prodCols)
  prodData.slice(0, 15).forEach((p, i) => {
    const contrib = (isMonthly ? kpi.revenue.month : kpi.revenue.year) > 0
      ? (p.revenue / (isMonthly ? kpi.revenue.month : kpi.revenue.year) * 100).toFixed(1) + '%'
      : '0%'
    tableRow(prodCols, [i + 1, p.name, fmtNum(p.qty), fmtN(p.revenue), contrib], i)
  })
  if (prodData.length === 0) {
    doc.setFontSize(9); doc.setTextColor(176, 188, 204)
    doc.text('Belum ada data produk', L, y + 6); y += 12
  }

  // ══════════════════════════════════════════
  // PAGE 4 — PENGELUARAN
  // ══════════════════════════════════════════
  newPage()
  sectionTitle('Pengeluaran per Kategori')
  const ecData = isMonthly ? expCatMonth : expCatYear
  const ecTotal = ecData.reduce((s, c) => s + c.total, 0)
  ecData.forEach((c, i) => barMini(c.category || 'Lainnya', c.total, ecTotal, scColors[i % scColors.length], ecTotal))

  divider()
  sectionTitle('Detail Pengeluaran')
  const allDetails = [...(expenseDetails.persediaan || []), ...(expenseDetails.lainnya || [])]
  const detCols = [
    { label: 'Item', x: L, w: 65 },
    { label: 'Qty', x: L + 65, w: 22, align: 'right' },
    { label: 'Satuan', x: L + 87, w: 22 },
    { label: 'Kategori', x: L + 109, w: 35 },
    { label: 'Total', x: L + 144, w: R - L - 144, align: 'right' },
  ]
  tableHeader(detCols)
  allDetails.forEach((d, i) => {
    const qtyStr = d.count > 1 ? `${d.qty ?? '-'} (${d.count}x)` : String(d.qty ?? '-')
    tableRow(detCols, [d.name || '-', qtyStr, d.satuan || '-', d.category || '-', fmtN(d.subtotal)], i)
  })
  if (allDetails.length === 0) {
    doc.setFontSize(9); doc.setTextColor(176, 188, 204)
    doc.text('Tidak ada data pengeluaran', L, y + 6); y += 12
  }
  // Total row
  checkY(10)
  doc.setFillColor(241, 245, 249)
  doc.rect(L, y, R - L, 8, 'F')
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 41)
  doc.text('TOTAL', L + 2, y + 5.5)
  doc.setTextColor(239, 68, 68)
  doc.text(fmtN(allDetails.reduce((s, d) => s + (d.subtotal || 0), 0)), R - 1, y + 5.5, { align: 'right' })
  y += 12

  // ══════════════════════════════════════════
  // PAGE 5 — BAHAN BAKU
  // ══════════════════════════════════════════
  newPage()
  sectionTitle('Analisis Bahan Baku')
  const totalBeli = ingredientAnalysis.reduce((s, r) => s + r.totalSpent, 0)
  const surplus = ingredientAnalysis.filter(r => r.selisih > 0).length
  const defisit = ingredientAnalysis.filter(r => r.selisih < 0).length
  kpiRow([
    { label: 'Total Pembelian Bahan', value: fmtN(totalBeli), color: '#6366F1' },
    { label: 'Surplus (Sisa Stok)', value: `${surplus} bahan`, color: '#F59E0B' },
    { label: 'Defisit (Kurang Beli)', value: `${defisit} bahan`, color: '#EF4444' },
  ])

  const ingCols = [
    { label: 'Bahan Baku', x: L, w: 50 },
    { label: 'Satuan', x: L + 50, w: 18 },
    { label: 'Dibeli', x: L + 68, w: 28, align: 'right' },
    { label: 'Dipakai', x: L + 96, w: 28, align: 'right' },
    { label: 'Selisih', x: L + 124, w: 28, align: 'right' },
    { label: 'Est. Nilai', x: L + 152, w: R - L - 152, align: 'right' },
  ]
  tableHeader(ingCols)
  ingredientAnalysis.forEach((r, i) => {
    const selisihStr = (r.selisih > 0 ? '+' : '') + r.selisih.toLocaleString('id-ID', { maximumFractionDigits: 2 })
    const nilaiStr = r.estimasiNilaiSelisih !== 0 ? fmtN(Math.abs(r.estimasiNilaiSelisih)) : '-'
    tableRow(ingCols, [
      r.name,
      r.unit || '-',
      r.totalBought > 0 ? r.totalBought.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-',
      r.totalUsed > 0 ? r.totalUsed.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-',
      selisihStr,
      nilaiStr,
    ], i)
  })
  if (ingredientAnalysis.length === 0) {
    doc.setFontSize(9); doc.setTextColor(176, 188, 204)
    doc.text('Belum ada data bahan baku', L, y + 6); y += 12
  }

  // ══════════════════════════════════════════
  // PAGE 6 — OPERASIONAL
  // ══════════════════════════════════════════
  newPage()
  sectionTitle('Performa Kasir')
  const kpCols = [
    { label: '#', x: L, w: 10 },
    { label: 'Nama Kasir', x: L + 10, w: 80 },
    { label: 'Transaksi', x: L + 90, w: 35, align: 'right' },
    { label: 'Total Penjualan', x: L + 125, w: R - L - 125, align: 'right' },
  ]
  tableHeader(kpCols)
  kasirPerformance.forEach((k, i) => tableRow(kpCols, [i + 1, k.name, fmtNum(k.count), fmtN(k.total)], i))
  if (kasirPerformance.length === 0) {
    doc.setFontSize(9); doc.setTextColor(176, 188, 204)
    doc.text('Belum ada data kasir', L, y + 6); y += 12
  }

  divider()
  sectionTitle('Perbandingan Bulanan — Penjualan vs Pengeluaran')
  const mcCols = [
    { label: 'Bulan', x: L, w: 30 },
    { label: 'Penjualan', x: L + 30, w: 50, align: 'right' },
    { label: 'Pengeluaran', x: L + 80, w: 50, align: 'right' },
    { label: 'Laba', x: L + 130, w: R - L - 130, align: 'right' },
  ]
  tableHeader(mcCols)
  monthlyChart.forEach((m, i) => tableRow(mcCols, [m.month, fmtN(m.revenue), fmtN(m.expense), fmtN(m.laba)], i))

  // ── page numbers ──
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    if (p === 1) continue // cover no footer
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(136, 150, 179)
    doc.text(`Halaman ${p} dari ${totalPages}`, W / 2, H - 6, { align: 'center' })
    doc.setDrawColor(226, 232, 248)
    doc.line(L, H - 10, R, H - 10)
  }

  const filename = `Laporan_Analisis_${isMonthly ? MONTHS_FULL[month] : 'Tahunan'}_${year}.pdf`
  doc.save(filename)
}

function GrowthBadge({ value }) {
  if (value === null || value === undefined) return null
  const up = value >= 0
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', background: up ? '#ECFDF5' : '#FEF2F2', color: up ? '#10B981' : '#EF4444' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, sub, growth, color='#6366F1' }) {
  return (
    <div style={{ background:'#fff', borderRadius:'16px', padding:'20px', border:'1px solid #E2E8F8', boxShadow:'0 2px 12px rgba(15,23,41,0.05)', display:'flex', flexDirection:'column', gap:'8px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ fontSize:'11px', fontWeight:'600', color:'#8896B3', textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</div>
        <GrowthBadge value={growth} />
      </div>
      <div style={{ fontSize:'20px', fontWeight:'800', color, lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:'11px', color:'#B0BCCC' }}>{sub}</div>}
    </div>
  )
}

function Card({ title, sub, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:'20px', border:'1px solid #E2E8F8', boxShadow:'0 2px 16px rgba(15,23,41,0.05)', overflow:'hidden', marginBottom:'20px' }}>
      <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ fontSize:'14px', fontWeight:'700', color:'#0F1729' }}>{title}</div>
        {sub && <div style={{ fontSize:'11px', color:'#8896B3', marginTop:'2px' }}>{sub}</div>}
      </div>
      <div style={{ padding:'18px 22px' }}>{children}</div>
    </div>
  )
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0F1729', borderRadius:'10px', padding:'10px 14px', minWidth:'160px' }}>
      <p style={{ fontSize:'11px', color:'#8896B3', marginBottom:'6px', fontWeight:'600' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom: i < payload.length-1 ? '4px' : 0 }}>
          <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:p.color }} />
          <span style={{ fontSize:'11px', color:'#CBD5E1' }}>{p.name}:</span>
          <span style={{ fontSize:'11px', fontWeight:'700', color:'#fff' }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function AIPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const SUGG = [
    'Analisis performa bulan ini secara menyeluruh',
    'Produk mana yang paling menguntungkan?',
    'Bagaimana efisiensi pengeluaran bulan ini?',
    'Berikan rekomendasi untuk meningkatkan laba',
    'Bandingkan performa bulan ini vs bulan lalu',
  ]

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:q }])
    setLoading(true)
    try {
      const res = await api.post('/ai', { mode:'chat', payload:{ messages, question:q } })
      setMessages(prev => [...prev, { role:'assistant', content:res.data.result }])
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content: e.response?.data?.message || 'Gagal mendapat respons.' }])
    } finally { setLoading(false) }
  }

  function renderMd(text) {
    const html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<div style="font-weight:700;color:#0F1729;margin:10px 0 4px;font-size:13px">$1</div>')
      .replace(/^[-] (.+)$/gm, '<div style="display:flex;gap:7px;margin:2px 0"><span style="color:#6366F1;margin-top:7px;width:5px;height:5px;border-radius:50%;background:#6366F1;display:inline-block;flex-shrink:0"></span><span>$1</span></div>')
      .replace(/\n/g, '<br/>')
    return <div style={{ fontSize:'13px', lineHeight:'1.75', color:'#374151' }} dangerouslySetInnerHTML={{ __html: html }} />
  }

  const handleSugg = useCallback((s) => () => send(s), [loading, input])

  return (
    <div style={{ background:'#fff', borderRadius:'20px', border:'1px solid #E2E8F8', overflow:'hidden', display:'flex', flexDirection:'column', height:'520px' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
        <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'#EFF4FF', color:'#6366F1', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:'700', color:'#0F1729' }}>AI Analyst</div>
          <div style={{ fontSize:'11px', color:'#8896B3' }}>Tanya tentang data analisis ini</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#ECFDF5', padding:'4px 10px', borderRadius:'20px', border:'1px solid #A7F3D0' }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#10B981' }} />
          <span style={{ fontSize:'11px', fontWeight:'600', color:'#10B981' }}>GPT-4o</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{ padding:'4px 10px', borderRadius:'7px', border:'1px solid #E2E8F8', background:'#F8FAFF', color:'#8896B3', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>Hapus</button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        {messages.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', paddingTop:'8px' }}>
            <div style={{ fontSize:'12px', color:'#8896B3', marginBottom:'4px', fontWeight:'600' }}>Pertanyaan cepat:</div>
            {SUGG.map((s, i) => (
              <button key={i} onClick={handleSugg(s)} style={{ padding:'9px 13px', borderRadius:'9px', border:'1px solid #E2E8F8', background:'#F8FAFF', color:'#374151', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>{s}</button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', marginBottom:'14px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {msg.role === 'assistant' && (
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#EFF4FF', color:'#6366F1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
            )}
            <div style={{ maxWidth:'80%', padding:'10px 13px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? '#6366F1' : '#F8FAFF', color: msg.role === 'user' ? '#fff' : '#374151', fontSize:'13px', border: msg.role === 'assistant' ? '1px solid #E2E8F8' : 'none', lineHeight:'1.6' }}>
              {msg.role === 'user' ? msg.content : renderMd(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:'8px', alignItems:'flex-start', marginBottom:'14px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#EFF4FF', color:'#6366F1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ padding:'10px 13px', borderRadius:'12px 12px 12px 4px', background:'#F8FAFF', border:'1px solid #E2E8F8', display:'flex', gap:'5px', alignItems:'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#8896B3', animation:'bounce 1.2s ease-in-out infinite', animationDelay:`${i*0.18}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding:'10px 14px 12px', borderTop:'1px solid #F1F5F9', flexShrink:0 }}>
        <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', background:'#F8FAFF', border:'1.5px solid #E2E8F8', borderRadius:'12px', padding:'8px 8px 8px 13px' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Tanya tentang data analisis..." rows={1} disabled={loading}
            style={{ flex:1, border:'none', background:'transparent', outline:'none', fontSize:'12px', color:'#0F1729', fontFamily:'inherit', resize:'none', lineHeight:'1.5' }} />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{ width:'32px', height:'32px', borderRadius:'9px', border:'none', background: loading || !input.trim() ? '#E2E8F8' : '#6366F1', color: loading || !input.trim() ? '#8896B3' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  )
}

export default function AnalisisPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(null)
  const [year, setYear] = useState(null)
  const [tab, setTab] = useState('overview')
  const [sortBy, setSortBy] = useState('revenue')
  const [expCatFilter, setExpCatFilter] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfDropdown, setPdfDropdown] = useState(false)
  const pdfRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (pdfRef.current && !pdfRef.current.contains(e.target)) setPdfDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleDownloadPDF(mode) {
    setPdfDropdown(false)
    setPdfLoading(true)
    try { await generatePDF(data, month, year, mode) }
    catch (e) { alert('Gagal generate PDF: ' + e.message) }
    finally { setPdfLoading(false) }
  }

  const load = useCallback((m, y) => {
    setLoading(true)
    api.get(`/admin/analisis?month=${m}&year=${y}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const curYear = new Date().getFullYear()
  const yearOptions = [curYear - 2, curYear - 1, curYear]

  useEffect(() => {
    api.get('/admin/dashboard').then(r => {
      const m = r.data.currentMonthIndex
      const y = r.data.currentYear
      setMonth(m); setYear(y); load(m, y)
    }).catch(console.error)
  }, [])

  if (!data || month === null) return (
    <div className="page"><Sidebar />
      <main className="main">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#8896B3', fontSize:'13px' }}>Memuat data analisis...</div>
      </main>
    </div>
  )

  const { kpi, kas, dailyChart, monthlyChart, topProductsMonth, topProductsYear,
    expCatMonth, expCatYear, payMethodMonth, payMethodYear,
    salesCatMonth, salesCatYear, absensiSummary, waste, voucher, memberTx,
    kasirPerformance, ingredientAnalysis, expenseDetails, period } = data

  const prevMonthName = MONTHS[month === 0 ? 11 : month - 1]
  const periodLabel = `20 ${prevMonthName} – 19 ${period.monthName} ${year}`
  const sortedProducts = [...topProductsMonth].sort((a, b) => sortBy === 'qty' ? b.qty - a.qty : b.revenue - a.revenue)

  const TABS = [
    { key:'overview', label:'Overview' },
    { key:'penjualan', label:'Penjualan' },
    { key:'pengeluaran', label:'Pengeluaran' },
    { key:'produk', label:'Produk' },
    { key:'bahan', label:'Bahan Baku' },
    { key:'operasional', label:'Operasional' },
    { key:'ai', label:'✦ AI Analyst' },
  ]

  return (
    <div className="page"><Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Analisis</div>
            <div className="topbar-sub">{periodLabel}</div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <div style={{ display:'flex', gap:'4px', background:'#F1F5F9', borderRadius:'9px', padding:'3px' }}>
              {yearOptions.map(y => (
                <button key={y} onClick={() => { setYear(y); load(month, y) }}
                  style={{ padding:'4px 12px', borderRadius:'7px', border:'none', background: year===y ? '#fff' : 'transparent', color: year===y ? '#6366F1' : '#8896B3', fontSize:'12px', fontWeight: year===y ? '700' : '500', cursor:'pointer', fontFamily:'inherit', boxShadow: year===y ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition:'all 0.15s' }}>
                  {y}
                </button>
              ))}
            </div>
            <select value={month} onChange={e => { const m = Number(e.target.value); setMonth(m); load(m, year) }}
              style={{ padding:'6px 28px 6px 10px', borderRadius:'9px', border:'1.5px solid #E2E8F8', background:'#F8FAFF', color:'#374151', fontSize:'12px', fontWeight:'600', fontFamily:'inherit', cursor:'pointer', outline:'none', WebkitAppearance:'none', appearance:'none' }}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
            </select>
            {loading && <span style={{ fontSize:'11px', color:'#8896B3' }}>Memuat...</span>}
            <div ref={pdfRef} style={{ position:'relative' }}>
              <button
                onClick={() => setPdfDropdown(v => !v)}
                disabled={pdfLoading}
                style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 14px', borderRadius:'9px', border:'1.5px solid #6366F1', background: pdfLoading ? '#F1F5F9' : '#6366F1', color:'#fff', fontSize:'12px', fontWeight:'700', cursor: pdfLoading ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: pdfLoading ? 0.7 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {pdfLoading ? 'Generating...' : 'Download PDF'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {pdfDropdown && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'#fff', border:'1.5px solid #E2E8F8', borderRadius:'12px', boxShadow:'0 8px 24px rgba(15,23,41,0.12)', zIndex:100, minWidth:'180px', overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px 6px', fontSize:'10px', fontWeight:'700', color:'#8896B3', letterSpacing:'0.4px', textTransform:'uppercase' }}>Pilih Periode</div>
                  <button onClick={() => handleDownloadPDF('monthly')}
                    style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'10px 14px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}
                    onMouseEnter={e => e.currentTarget.style.background='#F8FAFF'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#EFF4FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:'#0F1729' }}>Laporan Bulanan</div>
                      <div style={{ fontSize:'10px', color:'#8896B3' }}>{MONTHS_FULL[month]} {year}</div>
                    </div>
                  </button>
                  <button onClick={() => handleDownloadPDF('yearly')}
                    style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'10px 14px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left', borderTop:'1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background='#F8FAFF'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h8M8 18h5"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:'#0F1729' }}>Laporan Tahunan</div>
                      <div style={{ fontSize:'10px', color:'#8896B3' }}>Tahun {year}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content">
          <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'#F1F5F9', borderRadius:'12px', padding:'4px', overflowX:'auto' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding:'7px 16px', borderRadius:'9px', border:'none', background: tab===t.key ? '#fff' : 'transparent', color: tab===t.key ? '#6366F1' : '#8896B3', fontSize:'12px', fontWeight: tab===t.key ? '700' : '500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', boxShadow: tab===t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition:'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'20px' }}>
                <KpiCard label="Total Penjualan" value={fmt(kpi.revenue.month)} sub={`vs ${fmt(kpi.revenue.prev)} bulan lalu`} growth={kpi.revenue.growth} color="#6366F1" />
                <KpiCard label="Total Pengeluaran" value={fmt(kpi.expense.month)} sub={`vs ${fmt(kpi.expense.prev)} bulan lalu`} growth={kpi.expense.growth} color="#EF4444" />
                <KpiCard label="Laba Bersih" value={fmt(kpi.laba.month)} sub={`Net margin ${pct(kpi.netMarginMonth)}%`} growth={kpi.laba.growth} color={kpi.laba.month >= 0 ? '#10B981' : '#EF4444'} />
                <KpiCard label="Total Transaksi" value={kpi.transactions.month.toLocaleString('id-ID')} sub={`Rata-rata ${fmt(kpi.avgTxValue)}/transaksi`} growth={kpi.transactions.prev > 0 ? ((kpi.transactions.month - kpi.transactions.prev) / kpi.transactions.prev * 100) : null} color="#F59E0B" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'20px' }}>
                <KpiCard label="Rata-rata/Hari" value={fmt(Math.round(kpi.avgDailySales))} sub={`${kpi.daysWithSales} hari aktif`} color="#8B5CF6" />
                <KpiCard label="Kas Akhir Bulan" value={fmt(kas.kasAkhir)} sub={`Kas awal ${fmt(kas.kasAwal)}`} color={kas.kasAkhir >= 0 ? '#10B981' : '#EF4444'} />
                <KpiCard label="Transaksi Member" value={memberTx.count.toLocaleString('id-ID')} sub={fmt(memberTx.total)} color="#06B6D4" />
                <KpiCard label="Waste Bulan Ini" value={fmt(waste.total)} sub={`${waste.count} catatan`} color="#F97316" />
              </div>
              <Card title="Tren Penjualan Harian" sub={periodLabel}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyChart} margin={{ top:5, right:5, bottom:0, left:10 }}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="revenue" name="Penjualan" stroke="#6366F1" strokeWidth={2.5} fill="url(#g1)" dot={false} activeDot={{ r:4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Perbandingan Bulanan" sub={`Penjualan vs Pengeluaran — ${year}`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top:5, right:5, bottom:0, left:10 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize:'11px' }} />
                    <Bar dataKey="revenue" name="Penjualan" fill="#6366F1" radius={[5,5,0,0]} maxBarSize={24} />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#F97316" radius={[5,5,0,0]} maxBarSize={24} />
                    <Bar dataKey="laba" name="Laba" fill="#10B981" radius={[5,5,0,0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
                <Card title="Metode Pembayaran" sub="Bulan ini">
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {payMethodMonth.map((p, i) => {
                      const v = kpi.revenue.month > 0 ? (p.total / kpi.revenue.month * 100) : 0
                      const c = { CASH:'#10B981', QRIS:'#6366F1', TRANSFER:'#F59E0B', NONTUNAI:'#8B5CF6' }
                      return (
                        <div key={i}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>{p.method}</span>
                            <span style={{ fontSize:'12px', color:'#8896B3' }}>{fmt(p.total)} ({v.toFixed(1)}%)</span>
                          </div>
                          <div style={{ height:'6px', borderRadius:'3px', background:'#F1F5F9' }}>
                            <div style={{ height:'100%', width:`${v}%`, background: c[p.method]||'#6366F1', borderRadius:'3px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
                <Card title="Ringkasan Kas" sub={`Periode ${periodLabel}`}>
                  {[
                    { label:'Kas Awal Bulan', value:kas.kasAwal, color:'#10B981' },
                    { label:'Total Penjualan', value:kas.totalRevMonth, color:'#6366F1' },
                    { label:'Total Pengeluaran', value:kas.totalExpMonth, color:'#EF4444' },
                    { label:'Kas Akhir Bulan', value:kas.kasAkhir, color: kas.kasAkhir >= 0 ? '#10B981' : '#EF4444', bold:true },
                  ].map((row, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom: i < 3 ? '1px solid #F1F5F9' : 'none' }}>
                      <span style={{ fontSize:'12px', color:'#374151', fontWeight: row.bold ? '700' : '500' }}>{row.label}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:row.color }}>{fmt(row.value)}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          {tab === 'penjualan' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                <KpiCard label="Total Penjualan" value={fmt(kpi.revenue.month)} sub={`${kpi.transactions.month} transaksi`} growth={kpi.revenue.growth} color="#6366F1" />
                <KpiCard label="Rata-rata/Hari" value={fmt(Math.round(kpi.avgDailySales))} sub={`${kpi.daysWithSales} hari aktif`} color="#8B5CF6" />
                <KpiCard label="Rata-rata/Transaksi" value={fmt(Math.round(kpi.avgTxValue))} sub={`Net margin ${pct(kpi.netMarginMonth)}%`} color="#10B981" />
              </div>
              <Card title="Tren Penjualan Harian" sub={periodLabel}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyChart} margin={{ top:5, right:5, bottom:0, left:10 }}>
                    <defs>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="revenue" name="Penjualan" stroke="#6366F1" strokeWidth={2.5} fill="url(#g2)" dot={{ r:3, fill:'#6366F1', stroke:'#fff', strokeWidth:1.5 }} activeDot={{ r:5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
                <Card title="Penjualan per Kategori" sub="Bulan ini">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={salesCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {salesCatMonth.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Metode Pembayaran" sub="Bulan ini">
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {payMethodMonth.map((p, i) => {
                      const v = kpi.revenue.month > 0 ? (p.total / kpi.revenue.month * 100) : 0
                      const c = { CASH:'#10B981', QRIS:'#6366F1', TRANSFER:'#F59E0B', NONTUNAI:'#8B5CF6' }
                      return (
                        <div key={i}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>{p.method}</span>
                            <span style={{ fontSize:'12px', color:'#8896B3' }}>{fmt(p.total)} · {p.count}x · {v.toFixed(1)}%</span>
                          </div>
                          <div style={{ height:'6px', borderRadius:'3px', background:'#F1F5F9' }}>
                            <div style={{ height:'100%', width:`${v}%`, background: c[p.method]||'#6366F1', borderRadius:'3px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
              <Card title="Perbandingan Bulanan — Penjualan" sub={`Tahun ${year}`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top:5, right:5, bottom:0, left:10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="revenue" name="Penjualan" fill="#6366F1" radius={[5,5,0,0]} maxBarSize={28} />
                    <Bar dataKey="laba" name="Laba" fill="#10B981" radius={[5,5,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                <KpiCard label="Total Diskon" value={fmt(kpi.discountTotal)} sub="Diskon manual" color="#F59E0B" />
                <KpiCard label="Diskon Voucher" value={fmt(kpi.voucherDiscount)} sub={`${voucher.count} transaksi pakai voucher`} color="#8B5CF6" />
                <KpiCard label="Diskon Member" value={fmt(kpi.memberDiscount)} sub={`${memberTx.count} transaksi member`} color="#06B6D4" />
              </div>
              <Card title="Ranking Produk" sub={`Semua produk terjual — ${periodLabel}`}>
                <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
                  <span style={{ fontSize:'11px', color:'#8896B3', alignSelf:'center', marginRight:'4px' }}>Urutkan:</span>
                  {[{key:'revenue',label:'Nominal'},{key:'qty',label:'Qty'}].map(opt => (
                    <button key={opt.key} onClick={() => setSortBy(opt.key)}
                      style={{ padding:'4px 12px', borderRadius:'7px', border:`1.5px solid ${sortBy===opt.key ? '#6366F1' : '#E2E8F8'}`, background: sortBy===opt.key ? '#6366F1' : '#F8FAFF', color: sortBy===opt.key ? '#fff' : '#8896B3', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr>
                        {['#','Produk','Qty Terjual','Pendapatan','Kontribusi',''].map((h, i) => (
                          <th key={i} style={{ padding:'8px 12px', textAlign: i >= 2 && i < 5 ? 'right' : 'left', fontWeight:'700', color:'#8896B3', borderBottom:'1px solid #F1F5F9', fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.map((p, i) => {
                        const contrib = kpi.revenue.month > 0 ? (p.revenue / kpi.revenue.month * 100) : 0
                        const rankColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#CBD5E1'
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF', borderBottom:'1px solid #F8FAFF' }}>
                            <td style={{ padding:'9px 12px', width:'36px' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'22px', height:'22px', borderRadius:'6px', background: i < 3 ? rankColor + '22' : '#F1F5F9', color: i < 3 ? rankColor : '#94A3B8', fontSize:'11px', fontWeight:'800' }}>{i + 1}</span>
                            </td>
                            <td style={{ padding:'9px 12px', fontWeight:'600', color:'#0F1729', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</td>
                            <td style={{ padding:'9px 12px', textAlign:'right', color: sortBy==='qty' ? '#6366F1' : '#374151', fontWeight: sortBy==='qty' ? '700' : '600' }}>{p.qty.toLocaleString('id-ID')}</td>
                            <td style={{ padding:'9px 12px', textAlign:'right', fontWeight: sortBy==='revenue' ? '700' : '600', color: sortBy==='revenue' ? '#6366F1' : '#374151' }}>{fmt(p.revenue)}</td>
                            <td style={{ padding:'9px 12px', textAlign:'right', color:'#8896B3', fontSize:'11px', whiteSpace:'nowrap' }}>{contrib.toFixed(1)}%</td>
                            <td style={{ padding:'9px 12px', width:'120px' }}>
                              <div style={{ height:'5px', borderRadius:'3px', background:'#F1F5F9' }}>
                                <div style={{ height:'100%', width:`${sortBy==='qty' ? (sortedProducts[0]?.qty > 0 ? p.qty/sortedProducts[0].qty*100 : 0) : contrib}%`, background: i < 3 ? rankColor : '#6366F1', borderRadius:'3px', transition:'width 0.3s' }} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {sortedProducts.length === 0 && (
                        <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'#CBD5E1' }}>Belum ada data penjualan produk</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {tab === 'pengeluaran' && (() => {
            const cats = expCatMonth.map(c => c.category)
            const activeFilter = expCatFilter && cats.includes(expCatFilter) ? expCatFilter : null
            const detailRows = activeFilter === 'Persediaan'
              ? expenseDetails.persediaan
              : activeFilter
                ? expenseDetails.lainnya.filter(d => d.category === activeFilter)
                : [...expenseDetails.persediaan, ...expenseDetails.lainnya]
            return (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                  <KpiCard label="Total Pengeluaran" value={fmt(kpi.expense.month)} growth={kpi.expense.growth} color="#EF4444" />
                  <KpiCard label="Bulan Lalu" value={fmt(kpi.expense.prev)} color="#F97316" />
                  <KpiCard label="Tahun Ini" value={fmt(kpi.expense.year)} sub={`Net margin tahunan ${pct(kpi.netMarginYear)}%`} color="#8B5CF6" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
                  <Card title="Pengeluaran per Kategori" sub="Bulan ini">
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {expCatMonth.map((c, i) => {
                        const v = kpi.expense.month > 0 ? (c.total / kpi.expense.month * 100) : 0
                        return (
                          <div key={i}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                              <span style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>{c.category || 'Lainnya'}</span>
                              <span style={{ fontSize:'12px', color:'#8896B3' }}>{fmt(c.total)} ({v.toFixed(1)}%)</span>
                            </div>
                            <div style={{ height:'6px', borderRadius:'3px', background:'#F1F5F9' }}>
                              <div style={{ height:'100%', width:`${v}%`, background: COLORS[i % COLORS.length], borderRadius:'3px' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                  <Card title="Distribusi Pengeluaran" sub="Bulan ini">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={expCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                          {expCatMonth.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize:'11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <Card title="Perbandingan Pengeluaran Bulanan" sub={`Tahun ${year}`}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyChart} margin={{ top:5, right:5, bottom:0, left:10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="expense" name="Pengeluaran" fill="#F97316" radius={[5,5,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Detail Pengeluaran" sub={`Filter per kategori — ${periodLabel}`}>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
                    <button onClick={() => setExpCatFilter(null)}
                      style={{ padding:'4px 12px', borderRadius:'7px', border:`1.5px solid ${!activeFilter ? '#6366F1' : '#E2E8F8'}`, background: !activeFilter ? '#6366F1' : '#F8FAFF', color: !activeFilter ? '#fff' : '#8896B3', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                      Semua
                    </button>
                    {cats.map((cat, i) => (
                      <button key={i} onClick={() => setExpCatFilter(cat === activeFilter ? null : cat)}
                        style={{ padding:'4px 12px', borderRadius:'7px', border:`1.5px solid ${activeFilter===cat ? COLORS[i%COLORS.length] : '#E2E8F8'}`, background: activeFilter===cat ? COLORS[i%COLORS.length] : '#F8FAFF', color: activeFilter===cat ? '#fff' : '#8896B3', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead>
                        <tr>
                          {['Item', activeFilter==='Persediaan' || !activeFilter ? 'Qty / Frekuensi' : 'Qty', 'Satuan', 'Kategori', 'Total'].map((h, i) => (
                            <th key={i} style={{ padding:'8px 12px', textAlign: i===4 ? 'right' : 'left', fontWeight:'700', color:'#8896B3', borderBottom:'1px solid #F1F5F9', fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((d, i) => (
                          <tr key={i} style={{ background: i%2===0 ? '#fff' : '#FAFBFF', borderBottom:'1px solid #F8FAFF' }}>
                            <td style={{ padding:'9px 12px', fontWeight:'600', color:'#0F1729' }}>{d.name || '-'}</td>
                            <td style={{ padding:'9px 12px', color:'#374151' }}>
                              {d.count > 1 ? `${d.qty?.toLocaleString('id-ID') ?? '-'} (${d.count}x)` : (d.qty?.toLocaleString('id-ID') ?? '-')}
                            </td>
                            <td style={{ padding:'9px 12px', color:'#8896B3' }}>{d.satuan || '-'}</td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ padding:'2px 8px', borderRadius:'20px', fontSize:'10px', fontWeight:'700', background: d.category==='Persediaan' ? '#EFF4FF' : '#F1F5F9', color: d.category==='Persediaan' ? '#6366F1' : '#8896B3' }}>{d.category}</span>
                            </td>
                            <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:'700', color:'#EF4444' }}>{fmt(d.subtotal)}</td>
                          </tr>
                        ))}
                        {detailRows.length === 0 && (
                          <tr><td colSpan={5} style={{ padding:'32px', textAlign:'center', color:'#CBD5E1' }}>Tidak ada data pengeluaran</td></tr>
                        )}
                      </tbody>
                      {detailRows.length > 0 && (
                        <tfoot>
                          <tr style={{ borderTop:'2px solid #E2E8F8' }}>
                            <td colSpan={4} style={{ padding:'9px 12px', fontWeight:'700', color:'#374151', fontSize:'12px' }}>Total</td>
                            <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:'800', color:'#EF4444', fontSize:'13px' }}>{fmt(detailRows.reduce((s, d) => s + (d.subtotal || 0), 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </Card>
              </>
            )
          })()}

          {tab === 'produk' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
                <Card title="Top 10 Produk Terlaris" sub={`Bulan ini — ${periodLabel}`}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {topProductsMonth.map((p, i) => {
                      const max = topProductsMonth[0]?.revenue || 1
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ width:'20px', fontSize:'11px', fontWeight:'700', color: i < 3 ? '#F59E0B' : '#8896B3', textAlign:'right', flexShrink:0 }}>#{i+1}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                              <span style={{ fontSize:'12px', fontWeight:'600', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'11px', color:'#8896B3', flexShrink:0, marginLeft:'8px' }}>{p.qty}x · {fmtK(p.revenue)}</span>
                            </div>
                            <div style={{ height:'5px', borderRadius:'3px', background:'#F1F5F9' }}>
                              <div style={{ height:'100%', width:`${p.revenue/max*100}%`, background: i < 3 ? '#F59E0B' : '#6366F1', borderRadius:'3px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
                <Card title="Top 10 Produk Terlaris" sub={`Tahun ${year}`}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {topProductsYear.map((p, i) => {
                      const max = topProductsYear[0]?.revenue || 1
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ width:'20px', fontSize:'11px', fontWeight:'700', color: i < 3 ? '#F59E0B' : '#8896B3', textAlign:'right', flexShrink:0 }}>#{i+1}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                              <span style={{ fontSize:'12px', fontWeight:'600', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'11px', color:'#8896B3', flexShrink:0, marginLeft:'8px' }}>{p.qty}x · {fmtK(p.revenue)}</span>
                            </div>
                            <div style={{ height:'5px', borderRadius:'3px', background:'#F1F5F9' }}>
                              <div style={{ height:'100%', width:`${p.revenue/max*100}%`, background: i < 3 ? '#10B981' : '#6366F1', borderRadius:'3px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
                <Card title="Penjualan per Kategori Produk" sub="Bulan ini">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={salesCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => percent > 0.05 ? `${category} ${(percent*100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                        {salesCatMonth.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Penjualan per Kategori Produk" sub={`Tahun ${year}`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesCatYear.slice(0,8)} layout="vertical" margin={{ top:0, right:20, bottom:0, left:90 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize:10, fill:'#8896B3' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} width={85} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="total" name="Penjualan" fill="#6366F1" radius={[0,5,5,0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </>
          )}

          {tab === 'operasional' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                <KpiCard label="Waste Bulan Ini" value={fmt(waste.total)} sub={`${waste.count} catatan`} color="#F97316" />
                <KpiCard label="Transaksi Member" value={memberTx.count.toLocaleString('id-ID')} sub={fmt(memberTx.total)} color="#06B6D4" />
                <KpiCard label="Voucher Digunakan" value={voucher.count.toLocaleString('id-ID')} sub={`Hemat ${fmt(voucher.discount)}`} color="#8B5CF6" />
              </div>
              <Card title="Performa Kasir" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {kasirPerformance.map((k, i) => {
                    const max = kasirPerformance[0]?.total || 1
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'28px', height:'28px', borderRadius:'8px', background: i===0 ? '#FEF3C7' : '#F1F5F9', color: i===0 ? '#F59E0B' : '#8896B3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', flexShrink:0 }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>{k.name}</span>
                            <span style={{ fontSize:'12px', color:'#8896B3' }}>{k.count} transaksi · {fmtK(k.total)}</span>
                          </div>
                          <div style={{ height:'6px', borderRadius:'3px', background:'#F1F5F9' }}>
                            <div style={{ height:'100%', width:`${k.total/max*100}%`, background: i===0 ? '#F59E0B' : '#6366F1', borderRadius:'3px' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <Card title="Rekap Absensi Karyawan" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr>
                        {['Karyawan','Opening','Closing 1','Closing 2','Closing 3','Total'].map((h, i) => (
                          <th key={i} style={{ padding:'8px 12px', textAlign: i===0 ? 'left' : 'center', fontWeight:'700', color:'#8896B3', borderBottom:'1px solid #F1F5F9', fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(absensiSummary).map(([name, v], i) => {
                        const total = (v.OPENING||0)+(v.CLOSING_1||0)+(v.CLOSING_2||0)+(v.CLOSING_3||0)
                        return (
                          <tr key={i} style={{ background: i%2===0 ? '#fff' : '#FAFBFF' }}>
                            <td style={{ padding:'9px 12px', fontWeight:'600', color:'#374151' }}>{name}</td>
                            {[v.OPENING||0, v.CLOSING_1||0, v.CLOSING_2||0, v.CLOSING_3||0].map((val, j) => (
                              <td key={j} style={{ padding:'9px 12px', textAlign:'center', color: val>0 ? '#6366F1' : '#CBD5E1', fontWeight: val>0 ? '700' : '400' }}>{val>0 ? val : '-'}</td>
                            ))}
                            <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:'800', color:'#0F1729' }}>{total}</td>
                          </tr>
                        )
                      })}
                      {Object.keys(absensiSummary).length === 0 && (
                        <tr><td colSpan={6} style={{ padding:'20px', textAlign:'center', color:'#CBD5E1' }}>Belum ada data absensi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Metode Pembayaran Tahunan" sub={`Tahun ${year}`}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                  {payMethodYear.map((p, i) => {
                    const tot = payMethodYear.reduce((s, x) => s+x.total, 0)
                    const v = tot > 0 ? (p.total/tot*100) : 0
                    const c = { CASH:'#10B981', QRIS:'#6366F1', TRANSFER:'#F59E0B', NONTUNAI:'#8B5CF6' }
                    return (
                      <div key={i} style={{ background:'#F8FAFF', borderRadius:'12px', padding:'14px 16px', border:'1px solid #E2E8F8' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:'700', color: c[p.method]||'#6366F1' }}>{p.method}</span>
                          <span style={{ fontSize:'11px', color:'#8896B3' }}>{v.toFixed(1)}%</span>
                        </div>
                        <div style={{ fontSize:'16px', fontWeight:'800', color:'#0F1729', marginBottom:'2px' }}>{fmtK(p.total)}</div>
                        <div style={{ fontSize:'11px', color:'#8896B3' }}>{p.count} transaksi</div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </>
          )}

          {tab === 'bahan' && (() => {
            const totalBeli = ingredientAnalysis.reduce((s, r) => s + r.totalSpent, 0)
            const totalSelisihNilai = ingredientAnalysis.reduce((s, r) => s + (r.estimasiNilaiSelisih > 0 ? r.estimasiNilaiSelisih : 0), 0)
            const surplus = ingredientAnalysis.filter(r => r.selisih > 0).length
            const defisit = ingredientAnalysis.filter(r => r.selisih < 0).length
            return (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'20px' }}>
                  <KpiCard label="Total Pembelian Bahan" value={fmt(totalBeli)} sub={`${ingredientAnalysis.filter(r=>r.totalBought>0).length} jenis bahan dibeli`} color="#6366F1" />
                  <KpiCard label="Total Bahan Dipakai" value={`${ingredientAnalysis.filter(r=>r.totalUsed>0).length} jenis`} sub="Dari resep produk terjual" color="#10B981" />
                  <KpiCard label="Surplus (Sisa Stok)" value={`${surplus} bahan`} sub={fmt(totalSelisihNilai) + ' est. nilai'} color="#F59E0B" />
                  <KpiCard label="Defisit (Kurang Beli)" value={`${defisit} bahan`} sub="Pemakaian melebihi pembelian" color="#EF4444" />
                </div>
                <Card title="Analisis Selisih Bahan Baku" sub={`Dibeli vs Dipakai — ${periodLabel}`}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead>
                        <tr>
                          {['Bahan Baku','Satuan','Dibeli','Dipakai','Selisih','Est. Nilai Selisih','Status'].map((h,i) => (
                            <th key={i} style={{ padding:'8px 12px', textAlign: i>=2 ? 'right' : 'left', fontWeight:'700', color:'#8896B3', borderBottom:'1px solid #F1F5F9', fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ingredientAnalysis.map((r, i) => {
                          const isDefisit = r.selisih < 0
                          const isSurplus = r.selisih > 0
                          return (
                            <tr key={i} style={{ background: i%2===0 ? '#fff' : '#FAFBFF' }}>
                              <td style={{ padding:'9px 12px', fontWeight:'600', color:'#0F1729' }}>{r.name}</td>
                              <td style={{ padding:'9px 12px', color:'#8896B3' }}>{r.unit || '-'}</td>
                              <td style={{ padding:'9px 12px', textAlign:'right', color:'#6366F1', fontWeight:'600' }}>{r.totalBought > 0 ? r.totalBought.toLocaleString('id-ID', { maximumFractionDigits:2 }) : '-'}</td>
                              <td style={{ padding:'9px 12px', textAlign:'right', color:'#10B981', fontWeight:'600' }}>{r.totalUsed > 0 ? r.totalUsed.toLocaleString('id-ID', { maximumFractionDigits:2 }) : '-'}</td>
                              <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:'700', color: isDefisit ? '#EF4444' : isSurplus ? '#F59E0B' : '#8896B3' }}>
                                {r.selisih > 0 ? '+' : ''}{r.selisih.toLocaleString('id-ID', { maximumFractionDigits:2 })}
                              </td>
                              <td style={{ padding:'9px 12px', textAlign:'right', color: isDefisit ? '#EF4444' : isSurplus ? '#F59E0B' : '#8896B3', fontSize:'11px' }}>
                                {r.estimasiNilaiSelisih !== 0 ? fmt(Math.abs(r.estimasiNilaiSelisih)) : '-'}
                              </td>
                              <td style={{ padding:'9px 12px' }}>
                                <span style={{ padding:'3px 8px', borderRadius:'20px', fontSize:'10px', fontWeight:'700',
                                  background: isDefisit ? '#FEF2F2' : isSurplus ? '#FFFBEB' : '#F1F5F9',
                                  color: isDefisit ? '#EF4444' : isSurplus ? '#F59E0B' : '#8896B3' }}>
                                  {isDefisit ? 'Defisit' : isSurplus ? 'Surplus' : 'Pas'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                        {ingredientAnalysis.length === 0 && (
                          <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#CBD5E1' }}>Belum ada data bahan baku pada periode ini</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )
          })()}

          {tab === 'ai' && <AIPanel />}

        </div>
      </main>
    </div>
  )
}


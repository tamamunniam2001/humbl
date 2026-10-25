'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const DualTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F1729', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', minWidth: '220px' }}>
      <p style={{ fontSize: '11px', color: '#8896B3', marginBottom: '8px', fontWeight: '600' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < payload.length - 1 ? '5px' : 0 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{p.name}:</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tabel Rekap ──
function RekapTable({ catData, filterMonth, filterMode, onChangeMonth, onChangeMode, year, currentMonthIndex }) {
  const [editKas, setEditKas] = useState(false)
  const [kasInput, setKasInput] = useState('')
  const [savingKas, setSavingKas] = useState(false)

  if (!catData) return (
    <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.06)', textAlign: 'center', color: '#8896B3', fontSize: '13px' }}>
      Memuat rekap...
    </div>
  )

  const { cols, salesTable, expTable, salesTotals, expTotals, kasAwal = 0 } = catData

  // Total per kolom
  const grandSalesTotal = Object.values(salesTotals).reduce((s, v) => s + v, 0)
  const grandExpTotal = Object.values(expTotals).reduce((s, v) => s + v, 0)
  const grandLaba = grandSalesTotal - grandExpTotal
  const kasAkhir = kasAwal + grandSalesTotal - grandExpTotal

  const colLabels = cols.map(c => c.label)
  const colKeys = cols.map(c => c.key)

  const thBase = { padding: '9px 12px', fontSize: '12px', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap', border: '1px solid #E2E8F8' }
  const tdBase = { padding: '8px 12px', fontSize: '12px', textAlign: 'right', border: '1px solid #F1F5F9', whiteSpace: 'nowrap' }
  const tdCat = { padding: '8px 12px', fontSize: '12px', fontWeight: '500', color: '#374151', border: '1px solid #F1F5F9', whiteSpace: 'nowrap' }

  function cellVal(cols, key) {
    const v = cols[key] || 0
    return v > 0 ? <span style={{ color: '#2563EB', fontWeight: '600' }}>{fmt(v)}</span> : <span style={{ color: '#CBD5E1' }}>-</span>
  }

  function labaCell(sales, exp) {
    const laba = (sales || 0) - (exp || 0)
    if (laba === 0) return <span style={{ color: '#CBD5E1' }}>-</span>
    return <span style={{ color: laba >= 0 ? '#10B981' : '#EF4444', fontWeight: '700' }}>{fmt(laba)}</span>
  }

  async function saveKas() {
    setSavingKas(true)
    try {
      await api.put('/admin/monthly-kas', { year, month: filterMonth, kasAwal: Number(kasInput.replace(/\D/g, '')) })
      catData.kasAwal = Number(kasInput.replace(/\D/g, ''))
      setEditKas(false)
    } catch { alert('Gagal menyimpan') }
    finally { setSavingKas(false) }
  }

  const prevMonthIdx = filterMonth === 0 ? 11 : filterMonth - 1
  const periodLabel = filterMode === 'year'
    ? `Tahun ${year} (Cut-Off 20 Des - 19 Des)`
    : `${MONTHS[filterMonth]} ${year} (20 ${MONTHS[prevMonthIdx]} - 19 ${MONTHS[filterMonth]})`

  function downloadCSV() {
    const fmtNum = n => Number(n || 0)
    const rows = []
    const header = ['Kategori', ...colLabels, 'Total']
    rows.push(header)

    rows.push(['--- PEMASUKAN ---', ...colKeys.map(() => ''), ''])
    salesTable.forEach(row => {
      rows.push([row.cat, ...colKeys.map(k => fmtNum(row.cols[k] || 0)), fmtNum(row.total)])
    })
    rows.push(['TOTAL PEMASUKAN', ...colKeys.map(k => fmtNum(salesTotals[k] || 0)), fmtNum(grandSalesTotal)])

    rows.push(['', ...colKeys.map(() => ''), ''])
    rows.push(['--- PENGELUARAN ---', ...colKeys.map(() => ''), ''])
    expTable.forEach(row => {
      rows.push([row.cat, ...colKeys.map(k => fmtNum(row.cols[k] || 0)), fmtNum(row.total)])
    })
    rows.push(['TOTAL PENGELUARAN', ...colKeys.map(k => fmtNum(expTotals[k] || 0)), fmtNum(grandExpTotal)])

    rows.push(['', ...colKeys.map(() => ''), ''])
    rows.push(['LABA BERSIH', ...colKeys.map(k => fmtNum((salesTotals[k] || 0) - (expTotals[k] || 0))), fmtNum(grandLaba)])
    rows.push(['', ...colKeys.map(() => ''), ''])
    rows.push(['Kas Awal Bulan', ...colKeys.map(() => ''), fmtNum(kasAwal)])
    rows.push(['Total Penjualan', ...colKeys.map(() => ''), fmtNum(grandSalesTotal)])
    rows.push(['Total Pengeluaran', ...colKeys.map(() => ''), fmtNum(grandExpTotal)])
    rows.push(['KAS AKHIR BULAN', ...colKeys.map(() => ''), fmtNum(kasAkhir)])
    rows.push(['Net Margin %', ...colKeys.map(k => {
      const s = salesTotals[k] || 0; const e = expTotals[k] || 0
      return s > 0 ? `${Math.round(((s - e) / s) * 100)}%` : '-'
    }), grandSalesTotal > 0 ? `${Math.round(((grandSalesTotal - grandExpTotal) / grandSalesTotal) * 100)}%` : '-'])

    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rekap-${periodLabel.replace(/\s/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.06)', overflow: 'hidden' }}>
      {/* Header kontrol */}
      <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0F1729' }}>Rekap Penjualan & Pengeluaran</h2>
          <p style={{ fontSize: '12px', color: '#8896B3', marginTop: '3px' }}>{periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={downloadCSV}
            style={{ padding: '6px 12px', borderRadius: '9px', border: '1.5px solid #E2E8F8', background: '#F8FAFF', color: '#4A7CC7', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <select
            value={filterMode === 'year' ? '' : filterMonth}
            onChange={e => { onChangeMode('month'); onChangeMonth(Number(e.target.value)) }}
            style={{
              padding: '6px 28px 6px 10px', borderRadius: '9px',
              border: '1.5px solid', borderColor: filterMode !== 'year' ? '#6366F1' : '#E2E8F8',
              background: filterMode !== 'year' ? '#F0F0FF' : '#F8FAFF',
              color: filterMode !== 'year' ? '#6366F1' : '#8896B3',
              fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
              cursor: 'pointer', outline: 'none',
              WebkitAppearance: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236366F1' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <button
            onClick={() => onChangeMode(filterMode === 'year' ? 'month' : 'year')}
            style={{
              padding: '6px 14px', borderRadius: '9px', border: '1.5px solid',
              borderColor: filterMode === 'year' ? '#6366F1' : '#E2E8F8',
              background: filterMode === 'year' ? '#6366F1' : '#F8FAFF',
              color: filterMode === 'year' ? '#fff' : '#8896B3',
              fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{year}</button>
        </div>
      </div>

      {/* Tabel */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left', background: '#4A7CC7', color: '#fff', width: '160px' }}>KATEGORI</th>
              {colLabels.map((l, i) => (
                <th key={i} style={{ ...thBase, background: '#1E2A3B', color: '#E2E8F8' }}>{l}</th>
              ))}
              <th style={{ ...thBase, background: '#1E2A3B', color: '#F59E0B' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* ── PEMASUKAN ── */}
            <tr>
              <td colSpan={colKeys.length + 2} style={{ padding: '8px 12px', fontWeight: '800', fontSize: '12px', background: '#EFF4FF', color: '#2563EB', border: '1px solid #E2E8F8', letterSpacing: '0.3px' }}>
                PEMASUKAN (MASUK)
              </td>
            </tr>
            {salesTable.length === 0 ? (
              <tr><td colSpan={colKeys.length + 2} style={{ ...tdBase, textAlign: 'center', color: '#CBD5E1', padding: '20px' }}>Belum ada data</td></tr>
            ) : salesTable.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                <td style={{ ...tdCat, color: '#4A7CC7' }}>{row.cat}</td>
                {colKeys.map(k => <td key={k} style={tdBase}>{cellVal(row.cols, k)}</td>)}
                <td style={{ ...tdBase, fontWeight: '700', color: '#2563EB', background: '#F8FAFF' }}>{row.total > 0 ? fmt(row.total) : <span style={{ color: '#CBD5E1' }}>-</span>}</td>
              </tr>
            ))}
            {/* Total Pemasukan */}
            <tr style={{ background: '#EFF4FF' }}>
              <td style={{ ...tdCat, fontWeight: '800', color: '#1E2A3B' }}>TOTAL PEMASUKAN</td>
              {colKeys.map(k => (
                <td key={k} style={{ ...tdBase, fontWeight: '800', color: '#2563EB' }}>
                  {salesTotals[k] > 0 ? fmt(salesTotals[k]) : <span style={{ color: '#CBD5E1' }}>-</span>}
                </td>
              ))}
              <td style={{ ...tdBase, fontWeight: '800', color: '#2563EB', background: '#DBEAFE' }}>{fmt(grandSalesTotal)}</td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan={colKeys.length + 2} style={{ height: '6px', background: '#F8FAFF', border: 'none' }} /></tr>

            {/* ── PENGELUARAN ── */}
            <tr>
              <td colSpan={colKeys.length + 2} style={{ padding: '8px 12px', fontWeight: '800', fontSize: '12px', background: '#FEF2F2', color: '#EF4444', border: '1px solid #E2E8F8', letterSpacing: '0.3px' }}>
                PENGELUARAN (KELUAR)
              </td>
            </tr>
            {expTable.length === 0 ? (
              <tr><td colSpan={colKeys.length + 2} style={{ ...tdBase, textAlign: 'center', color: '#CBD5E1', padding: '20px' }}>Belum ada data</td></tr>
            ) : expTable.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FFFBFB' }}>
                <td style={{ ...tdCat, color: '#EF4444' }}>{row.cat}</td>
                {colKeys.map(k => <td key={k} style={tdBase}>{cellVal(row.cols, k)}</td>)}
                <td style={{ ...tdBase, fontWeight: '700', color: '#EF4444', background: '#FFF8F8' }}>{row.total > 0 ? fmt(row.total) : <span style={{ color: '#CBD5E1' }}>-</span>}</td>
              </tr>
            ))}
            {/* Total Pengeluaran */}
            <tr style={{ background: '#FEF2F2' }}>
              <td style={{ ...tdCat, fontWeight: '800', color: '#1E2A3B' }}>TOTAL PENGELUARAN</td>
              {colKeys.map(k => (
                <td key={k} style={{ ...tdBase, fontWeight: '800', color: '#EF4444' }}>
                  {expTotals[k] > 0 ? fmt(expTotals[k]) : <span style={{ color: '#CBD5E1' }}>-</span>}
                </td>
              ))}
              <td style={{ ...tdBase, fontWeight: '800', color: '#EF4444', background: '#FEE2E2' }}>{fmt(grandExpTotal)}</td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan={colKeys.length + 2} style={{ height: '6px', background: '#F8FAFF', border: 'none' }} /></tr>

            {/* ── LABA BERSIH ── */}
            <tr style={{ background: grandLaba >= 0 ? '#ECFDF5' : '#FEF2F2' }}>
              <td style={{ ...tdCat, fontWeight: '800', color: '#0F1729', fontSize: '13px' }}>LABA BERSIH</td>
              {colKeys.map(k => (
                <td key={k} style={{ ...tdBase, fontWeight: '800' }}>
                  {labaCell(salesTotals[k], expTotals[k])}
                </td>
              ))}
              <td style={{ ...tdBase, fontWeight: '800', fontSize: '13px', background: grandLaba >= 0 ? '#D1FAE5' : '#FEE2E2', color: grandLaba >= 0 ? '#10B981' : '#EF4444' }}>
                {fmt(grandLaba)}
              </td>
            </tr>
            {/* ── KAS BULANAN ── */}
            <tr><td colSpan={colKeys.length + 2} style={{ height: '6px', background: '#F8FAFF', border: 'none' }} /></tr>
            <tr style={{ background: '#F0FDF4' }}>
              <td style={{ ...tdCat, fontWeight: '700', color: '#0F1729' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Kas Awal Bulan
                  {filterMode !== 'year' && (
                    editKas ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={kasInput}
                          onChange={e => setKasInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveKas(); if (e.key === 'Escape') setEditKas(false) }}
                          style={{ width: '120px', padding: '3px 8px', borderRadius: '6px', border: '1.5px solid #6366F1', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
                          placeholder="0"
                        />
                        <button onClick={saveKas} disabled={savingKas} style={{ padding: '3px 8px', borderRadius: '6px', background: '#6366F1', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {savingKas ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setEditKas(false)} style={{ padding: '3px 6px', borderRadius: '6px', background: '#F1F5F9', color: '#8896B3', border: 'none', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setKasInput(String(kasAwal)); setEditKas(true) }} style={{ padding: '2px 8px', borderRadius: '6px', background: '#EFF4FF', color: '#6366F1', border: '1px solid #C7D4F0', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    )
                  )}
                </div>
              </td>
              {colKeys.map(k => <td key={k} style={tdBase} />)}
              <td style={{ ...tdBase, fontWeight: '700', color: '#10B981', background: '#ECFDF5' }}>{kasAwal > 0 ? fmt(kasAwal) : <span style={{ color: '#CBD5E1' }}>-</span>}</td>
            </tr>
            <tr style={{ background: '#F0FDF4' }}>
              <td style={{ ...tdCat, fontWeight: '700', color: '#0F1729' }}>Total Penjualan</td>
              {colKeys.map(k => <td key={k} style={tdBase} />)}
              <td style={{ ...tdBase, fontWeight: '700', color: '#2563EB', background: '#EFF4FF' }}>{grandSalesTotal > 0 ? fmt(grandSalesTotal) : <span style={{ color: '#CBD5E1' }}>-</span>}</td>
            </tr>
            <tr style={{ background: '#FEF2F2' }}>
              <td style={{ ...tdCat, fontWeight: '700', color: '#0F1729' }}>Total Pengeluaran</td>
              {colKeys.map(k => <td key={k} style={tdBase} />)}
              <td style={{ ...tdBase, fontWeight: '700', color: '#EF4444', background: '#FEE2E2' }}>{grandExpTotal > 0 ? fmt(grandExpTotal) : <span style={{ color: '#CBD5E1' }}>-</span>}</td>
            </tr>
            <tr style={{ background: kasAkhir >= 0 ? '#ECFDF5' : '#FEF2F2', borderTop: '2px solid #E2E8F8' }}>
              <td style={{ ...tdCat, fontWeight: '800', color: '#0F1729', fontSize: '13px' }}>KAS AKHIR BULAN</td>
              {colKeys.map(k => <td key={k} style={tdBase} />)}
              <td style={{ ...tdBase, fontWeight: '800', fontSize: '13px', background: kasAkhir >= 0 ? '#D1FAE5' : '#FEE2E2', color: kasAkhir >= 0 ? '#10B981' : '#EF4444' }}>
                {fmt(kasAkhir)}
              </td>
            </tr>
            <tr style={{ background: '#F8FAFF' }}>
              <td style={{ ...tdCat, color: '#8896B3', fontSize: '11px' }}>Net Margin %</td>
              {colKeys.map(k => {
                const s = salesTotals[k] || 0
                const e = expTotals[k] || 0
                const m = s > 0 ? Math.round(((s - e) / s) * 100) : null
                return (
                  <td key={k} style={{ ...tdBase, fontSize: '11px', color: m === null ? '#CBD5E1' : m >= 20 ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                    {m === null ? '-' : `${m}%`}
                  </td>
                )
              })}
              <td style={{ ...tdBase, fontSize: '11px', fontWeight: '700', color: grandSalesTotal > 0 ? (Math.round(((grandSalesTotal - grandExpTotal) / grandSalesTotal) * 100) >= 20 ? '#10B981' : '#EF4444') : '#CBD5E1' }}>
                {grandSalesTotal > 0 ? `${Math.round(((grandSalesTotal - grandExpTotal) / grandSalesTotal) * 100)}%` : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [catData, setCatData] = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [time, setTime] = useState('')
  const [filterMonth, setFilterMonth] = useState(null)
  const [filterMode, setFilterMode] = useState('month')
  const pathname = usePathname()

  const loadCat = useCallback((month, mode, year) => {
    if (month === null || month === undefined || !year) return
    setCatLoading(true)
    setCatData(null)
    api.get(`/admin/dashboard-categories?month=${month}&mode=${mode}&year=${year}`)
      .then(r => setCatData(r.data))
      .catch(console.error)
      .finally(() => setCatLoading(false))
  }, [])

  useEffect(() => {
    api.get('/admin/dashboard').then(r => {
      setData(r.data)
      const m = r.data.currentMonthIndex
      const y = r.data.currentYear
      setFilterMonth(m)
      loadCat(m, 'month', y)
    }).catch(console.error)

    setTime(new Date().toLocaleString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    const tTime = setInterval(() => setTime(new Date().toLocaleString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })), 60000)
    return () => clearInterval(tTime)
  }, [pathname])

  if (!data) return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8896B3' }}>Memuat data...</div>
      </main>
    </div>
  )

  const dailyChart = data.dailyChart || []
  const monthlyChart = data.monthlyChart || []
  const year = data.currentYear || new Date().getFullYear()
  const totalExpMonth = dailyChart.reduce((s, d) => s + (d.expense || 0), 0)

  function handleChangeMonth(m) {
    setFilterMonth(m)
    setFilterMode('month')
    loadCat(m, 'month', year)
  }
  function handleChangeMode(mode) {
    setFilterMode(mode)
    loadCat(filterMonth, mode, year)
  }

  const cardStyle = { background: '#fff', borderRadius: '20px', padding: '28px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.06)', marginBottom: '20px' }

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Dashboard</div>
            <div className="topbar-sub">{time}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#ECFDF5', padding: '7px 14px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#10B981' }}>Live</span>
          </div>
        </div>

        <div className="content">

          {/* ── 1. Area Chart Harian ── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0F1729' }}>Pendapatan vs Pengeluaran</h2>
                <p style={{ fontSize: '12px', color: '#8896B3', marginTop: '3px' }}>Harian (Cut-Off 20) — {data.currentMonth} {year}</p>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                {[
                  { color: '#6366F1', label: 'Pendapatan', value: data.month?.revenue || 0 },
                  { color: '#EF4444', label: 'Pengeluaran', value: totalExpMonth },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '2px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: '11px', color: '#8896B3', fontWeight: '600' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F1729' }}>{fmt(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8896B3' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<DualTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Pendapatan" stroke="#6366F1" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{ r: 5, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 5, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── 2. Bar Chart Bulanan ── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0F1729' }}>Pendapatan vs Pengeluaran Bulanan</h2>
                <p style={{ fontSize: '12px', color: '#8896B3', marginTop: '3px' }}>Perbandingan tiap bulan — {year}</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {[{ color: '#6366F1', label: 'Pendapatan' }, { color: '#F97316', label: 'Pengeluaran' }].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color }} />
                    <span style={{ fontSize: '12px', color: '#8896B3', fontWeight: '600' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<DualTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="revenue" name="Pendapatan" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── 3. Kas Bulanan Summary ── */}
          {catData && filterMode === 'month' && (() => {
            const { kasAwal = 0, salesTotals = {}, expTotals = {} } = catData
            const totalSales = Object.values(salesTotals).reduce((s, v) => s + v, 0)
            const totalExp = Object.values(expTotals).reduce((s, v) => s + v, 0)
            const kasAkhir = kasAwal + totalSales - totalExp
            return (
              <div style={{ background: '#fff', borderRadius: '20px', padding: '20px 24px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.06)', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0F1729', marginBottom: '16px' }}>
                  Kas Bulanan — {MONTHS[filterMonth ?? data.currentMonthIndex]} {year}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Kas Awal Bulan', value: kasAwal, color: '#10B981', bg: '#ECFDF5' },
                    { label: 'Total Penjualan', value: totalSales, color: '#6366F1', bg: '#EFF4FF' },
                    { label: 'Total Pengeluaran', value: totalExp, color: '#EF4444', bg: '#FEF2F2' },
                    { label: 'Kas Akhir Bulan', value: kasAkhir, color: kasAkhir >= 0 ? '#10B981' : '#EF4444', bg: kasAkhir >= 0 ? '#ECFDF5' : '#FEF2F2' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: '14px', padding: '16px 18px' }}>
                      <div style={{ fontSize: '11px', color: '#8896B3', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color }}>{fmt(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── 4. Tabel Rekap ── */}
          <RekapTable
            catData={catLoading ? null : catData}
            filterMonth={filterMonth ?? data.currentMonthIndex}
            filterMode={filterMode}
            onChangeMonth={handleChangeMonth}
            onChangeMode={handleChangeMode}
            year={year}
            currentMonthIndex={data.currentMonthIndex}
          />

        </div>
      </main>
    </div>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

// ── Kategori waste ──
// URUTAN & warna dipakai untuk grafik bertumpuk, legenda, dan tabel.
const CATEGORIES = [
  { value: 'BUSUK',           label: 'Busuk',           color: '#EF4444', emoji: '🥀' },
  { value: 'TIDAK_TERPAKAI',  label: 'Tidak Terpakai',  color: '#F59E0B', emoji: '📦' },
  { value: 'DIPAKAI_SENDIRI', label: 'Dipakai Sendiri', color: '#10B981', emoji: '🍽️' },
  { value: 'SALAH_BUAT',      label: 'Salah Buat',      color: '#8B5CF6', emoji: '⚠️' },
  { value: 'RND',             label: 'RnD',             color: '#6366F1', emoji: '🧪' },
  { value: 'LAINNYA',         label: 'Lainnya',         color: '#94A3B8', emoji: '🔖' },
]
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// ── Format ──
const fmtRp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
// Ringkas untuk label sumbu grafik (mis. "1,2 jt")
const fmtRingkas = (n) => {
  const v = Math.round(Number(n) || 0)
  if (v >= 1000000) return (v / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt'
  if (v >= 1000) return (v / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb'
  return String(v)
}
const fmtQty = (n) => Number(n) % 1 !== 0
  ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: 3 })
  : Number(n).toLocaleString('id-ID')
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Styling halaman (kelas berprefix wrk- agar tidak bentrok) ──
const styles = `
  @keyframes wrkSpin { to { transform: rotate(360deg); } }
  .wrk-top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .wrk-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
  .wrk-seg { display: inline-flex; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
  .wrk-seg button { border: 0; background: transparent; padding: 6px 13px; border-radius: 8px; font-size: 12.5px; font-weight: 700; color: var(--text3); cursor: pointer; }
  .wrk-seg button.on { background: var(--surface); color: var(--accent); box-shadow: var(--shadow-xs); }
  .wrk-stepper { display: inline-flex; align-items: center; gap: 2px; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
  .wrk-stepper button { width: 26px; height: 26px; border: 0; background: transparent; border-radius: 7px; cursor: pointer; color: var(--text2); font-size: 15px; line-height: 1; }
  .wrk-stepper button:disabled { opacity: .35; cursor: not-allowed; }
  .wrk-stepper button:hover:not(:disabled) { background: var(--surface); color: var(--accent); }
  .wrk-stepper span { font-size: 12.5px; font-weight: 800; color: var(--text); min-width: 46px; text-align: center; }
  .wrk-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .wrk-sum { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 13px 16px; box-shadow: var(--shadow-xs); }
  .wrk-sum-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 6px; }
  .wrk-sum-value { font-size: 19px; font-weight: 800; color: var(--text); line-height: 1.2; }
  .wrk-sum-sub { font-size: 11.5px; color: var(--text3); margin-top: 5px; }
  .wrk-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .wrk-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 0; }
  .wrk-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; box-shadow: var(--shadow-xs); margin-bottom: 14px; }
  .wrk-card-title { font-size: 14px; font-weight: 800; color: var(--text); }
  .wrk-card-sub { font-size: 11.5px; color: var(--text3); margin-top: 2px; }
  .wrk-legend { display: flex; flex-wrap: wrap; gap: 6px; }
  .wrk-legend button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 11.5px; font-weight: 700; color: var(--text2); cursor: pointer; }
  .wrk-legend button.off { opacity: .42; }
  .wrk-legend i { width: 9px; height: 9px; border-radius: 3px; display: block; }
  .wrk-bar-row { display: grid; grid-template-columns: 130px 1fr 92px; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; }
  .wrk-bar-row:hover { background: var(--bg2); }
  .wrk-bar-row.on { border-color: var(--accent); background: var(--accent-light); }
  .wrk-bar-track { height: 9px; border-radius: 999px; background: var(--bg2); overflow: hidden; }
  .wrk-bar-fill { height: 100%; border-radius: 999px; }
  .wrk-bar-name { font-size: 12.5px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 6px; }
  .wrk-bar-val { font-size: 12.5px; font-weight: 800; color: var(--text); text-align: right; }
  .wrk-bar-pct { font-size: 11px; color: var(--text3); text-align: right; }
  .wrk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .wrk-table th { text-align: left; padding: 9px 10px; font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .wrk-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); color: var(--text2); }
  .wrk-table tr:last-child td { border-bottom: 0; }
  .wrk-table tbody tr.clickable { cursor: pointer; }
  .wrk-table tbody tr.clickable:hover { background: var(--bg2); }
  .wrk-table tbody tr.on { background: var(--bg2); }
  .wrk-table td.num, .wrk-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .wrk-table td.strong, .wrk-table td.bold { font-weight: 800; color: var(--text); }
  .wrk-scroll { overflow-x: auto; }
  .wrk-empty { padding: 40px 20px; text-align: center; color: var(--muted); }
  .wrk-spinner { width: 26px; height: 26px; border: 2.5px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: wrkSpin .7s linear infinite; margin: 0 auto 10px; }
  .wrk-tip { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; box-shadow: var(--shadow); font-size: 12px; min-width: 186px; }
  .wrk-tip-title { font-weight: 800; color: var(--text); margin-bottom: 6px; font-size: 12.5px; }
  .wrk-tip-row { display: flex; align-items: center; gap: 10px; justify-content: space-between; color: var(--text2); }
  .wrk-tip-lbl { display: flex; align-items: center; gap: 7px; }
  .wrk-tip-lbl i { width: 8px; height: 8px; border-radius: 2px; display: block; }
  @media (max-width: 900px) {
    .wrk-grid-2 { grid-template-columns: 1fr; }
    .wrk-bar-row { grid-template-columns: 106px 1fr 84px; }
  }
`


// Tooltip grafik: total + kejadian + rincian kategori (hanya yang ada nilainya)
function BucketTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const isi = CATEGORIES.filter(c => (row[c.value] || 0) > 0).sort((a, b) => row[b.value] - row[a.value])
  return (
    <div className="wrk-tip">
      <div className="wrk-tip-title">{label}</div>
      <div className="wrk-tip-row" style={{ marginBottom: isi.length ? '6px' : 0 }}>
        <span>Total waste</span>
        <b style={{ color: 'var(--text)' }}>{fmtRp(row.total)}</b>
      </div>
      <div className="wrk-tip-row" style={{ marginBottom: isi.length ? '6px' : 0 }}>
        <span>Jumlah kejadian</span>
        <b style={{ color: 'var(--text)' }}>{row.count}×</b>
      </div>
      {isi.map(c => (
        <div key={c.value} className="wrk-tip-row">
          <span className="wrk-tip-lbl"><i style={{ background: c.color }} />{c.label}</span>
          <span>{fmtRp(row[c.value])}</span>
        </div>
      ))}
      {!isi.length && <div className="wrk-tip-row" style={{ color: 'var(--muted)' }}>Belum ada catatan</div>}
    </div>
  )
}

const TODAY = todayWIB()
const TAHUN_INI = Number(TODAY.slice(0, 4))
const BULAN_INI = Number(TODAY.slice(5, 7))

export default function RekapWastePage() {
  const [mode, setMode] = useState('bulan')       // bulan = 12 bulan, hari = tanggal dalam sebulan
  const [year, setYear] = useState(TAHUN_INI)
  const [month, setMonth] = useState(BULAN_INI)
  const [category, setCategory] = useState(null)  // filter kategori (klik baris kategori)
  const [hidden, setHidden] = useState(() => new Set())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let batal = false
    ;(async () => {
      setLoading(true); setErr('')
      try {
        const params = new URLSearchParams({ mode, year: String(year), month: String(month) })
        if (category) params.append('category', category)
        const res = await api.get(`/admin/waste/rekap?${params}`)
        if (!batal) setData(res.data)
      } catch (e) {
        if (!batal) setErr(e.response?.data?.message || 'Gagal memuat data rekap')
      } finally {
        if (!batal) setLoading(false)
      }
    })()
    return () => { batal = true }
  }, [mode, year, month, category])

  const series = useMemo(() => data?.series || [], [data])
  const summary = data?.summary || {}
  const byCategory = data?.byCategory || []
  const topIngredients = data?.topIngredients || []
  const byUser = data?.byUser || []

  // Grafik: hanya kategori yang sedang tidak disembunyikan yang dikirim ke recharts
  const chartData = useMemo(() => series.map(s => {
    const o = { label: s.label, key: s.key, total: s.total, count: s.count }
    CATEGORIES.forEach(c => { if (!hidden.has(c.value)) o[c.value] = s[c.value] || 0 })
    return o
  }), [series, hidden])

  const adaData = (summary.count || 0) > 0
  const kategoriTeratas = byCategory.find(c => c.total > 0) || null
  const maxKategori = Math.max(...byCategory.map(c => c.total), 1)
  const maxBahan = Math.max(...topIngredients.map(i => i.total), 1)
  const bucketTerburuk = series.reduce((a, s) => (s.total > (a?.total || 0) ? s : a), null)
  const labelBucket = mode === 'hari' ? 'Tanggal' : 'Bulan'

  function geserTahun(arah) { setYear(y => Math.min(2100, Math.max(2000, y + arah))) }

  function toggleKategori(v) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else if (next.size < CATEGORIES.length - 1) next.add(v) // min. 1 kategori tetap tampil
      return next
    })
  }

  function keHari(bulan) { setMode('hari'); setMonth(bulan) }

  function resetFilter() {
    setCategory(null)
    setMode('bulan')
    setYear(TAHUN_INI)
    setMonth(BULAN_INI)
  }

  function exportCSV() {
    if (!data) return
    const aktif = CATEGORIES.filter(c => !hidden.has(c.value))
    const rows = [['Periode', 'Jumlah Kejadian', ...aktif.map(c => c.label), 'Total']]
    series.forEach(s => rows.push([s.label, s.count, ...aktif.map(c => s[c.value] || 0), s.total]))
    rows.push(['TOTAL', summary.count || 0, ...aktif.map(c => byCategory.find(b => b.category === c.value)?.total || 0), summary.total || 0])
    const suffix = category ? `-${CAT[category].label.toLowerCase().replace(/\s+/g, '-')}` : ''
    downloadCSV(rows, `rekap-waste-${data.from}-sd-${data.to}${suffix}.csv`)
  }


  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        <style>{styles}</style>

        <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px', height: 'auto', minHeight: '60px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Rekap Waste</div>
            <div className="topbar-sub">Tren & ringkasan bahan terbuang per bulan dan kategori</div>
          </div>
          <div className="wrk-top-actions">
            <button className="btn btn-ghost" onClick={resetFilter}>Reset</button>
            <button className="btn btn-ghost" onClick={exportCSV} disabled={!adaData}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <Link href="/waste" className="btn btn-primary">+ Catat Waste</Link>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* ── Filter periode ── */}
          <div className="wrk-filter">
            <div className="wrk-seg">
              <button className={mode === 'bulan' ? 'on' : ''} onClick={() => setMode('bulan')}>Per Bulan</button>
              <button className={mode === 'hari' ? 'on' : ''} onClick={() => setMode('hari')}>Per Tanggal</button>
            </div>

            <div className="wrk-stepper">
              <button onClick={() => geserTahun(-1)} disabled={year <= 2000} title="Tahun sebelumnya">‹</button>
              <span>{year}</span>
              <button onClick={() => geserTahun(1)} disabled={year >= 2100} title="Tahun berikutnya">›</button>
            </div>

            {mode === 'hari' && (
              <select className="input" style={{ width: '132px' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
              </select>
            )}

            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => { setMode('hari'); setYear(TAHUN_INI); setMonth(BULAN_INI) }}>Bulan Ini</button>
              <button className="btn btn-ghost" onClick={() => { setMode('bulan'); setYear(TAHUN_INI) }}>Tahun Ini</button>
            </div>
          </div>

          {category && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Filter aktif:</span>
              <span className="wrk-chip" style={{ background: `${CAT[category].color}22`, color: CAT[category].color, border: `1px solid ${CAT[category].color}55` }}>
                {CAT[category].emoji} {CAT[category].label}
              </span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11.5px' }} onClick={() => setCategory(null)}>Hapus filter</button>
            </div>
          )}

          {err && (
            <div className="wrk-card" style={{ borderColor: 'var(--red-border)', background: 'var(--red-light)', color: 'var(--red)', fontWeight: 600, fontSize: '12.5px' }}>
              {err}
            </div>
          )}

          {loading ? (
            <div className="wrk-card wrk-empty">
              <div className="wrk-spinner" />
              <div style={{ fontSize: '12.5px' }}>Menghitung rekap waste…</div>
            </div>
          ) : !adaData ? (
            <div className="wrk-card wrk-empty">
              <div style={{ fontSize: '30px', marginBottom: '8px' }}>🗑️</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                Belum ada catatan waste {data?.periodLabel?.toLowerCase()}{category ? ` untuk kategori ${CAT[category].label}` : ''}
              </div>
              <div style={{ fontSize: '12.5px', marginBottom: '16px' }}>
                Catat dulu bahan yang terbuang supaya trennya bisa dipantau di halaman ini.
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/waste" className="btn btn-primary">+ Catat Waste</Link>
                {category && <button className="btn btn-ghost" onClick={() => setCategory(null)}>Lihat semua kategori</button>}
              </div>
            </div>
          ) : (
            <>
              {renderSummary()}
              {renderChart()}
              <div className="wrk-grid-2">
                {renderKategori()}
                {renderBahan()}
              </div>
              {renderTabel()}
            </>
          )}
        </div>
      </main>
    </div>
  )

  // ── Kartu ringkasan ──
  function renderSummary() {
    const naik = (summary.diff || 0) > 0
    const turun = (summary.diff || 0) < 0
    const warnaDiff = naik ? 'var(--red)' : turun ? '#10B981' : 'var(--text3)'
    const bgDiff = naik ? 'var(--red-light)' : turun ? '#ECFDF5' : 'var(--bg2)'
    const kpi = [
      {
        label: `Total waste ${data.periodLabel}`,
        value: fmtRp(summary.total),
        sub: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="wrk-chip" style={{ background: bgDiff, color: warnaDiff }}>
              {naik ? '▲' : turun ? '▼' : '='} {fmtPct(Math.abs(summary.diffPct ?? 0))}
            </span>
            <span>vs {data.prevLabel} ({fmtRp(summary.prevTotal)})</span>
          </span>
        ),
      },
      {
        label: 'Jumlah kejadian',
        value: `${summary.count}×`,
        sub: `${summary.itemCount} baris bahan · rata-rata ${fmtRp(summary.avgPerNote)}/kejadian`,
      },
      {
        label: `Rata-rata per ${mode === 'hari' ? 'tanggal' : 'bulan'}`,
        value: fmtRp(summary.avgPerBucket),
        sub: `${summary.bucketAdaCatatan} dari ${series.length} ${mode === 'hari' ? 'tanggal' : 'bulan'} ada catatan`,
      },
      {
        label: 'Kategori terbesar',
        value: kategoriTeratas ? `${CAT[kategoriTeratas.category].emoji} ${CAT[kategoriTeratas.category].label}` : '-',
        sub: kategoriTeratas
          ? `${fmtRp(kategoriTeratas.total)} · ${fmtPct(kategoriTeratas.pct)} dari total (${kategoriTeratas.count}×)`
          : 'Belum ada data pada periode ini',
      },
    ]
    return (
      <div className="wrk-summary">
        {kpi.map((k, i) => (
          <div key={i} className="wrk-sum">
            <div className="wrk-sum-label">{k.label}</div>
            <div className="wrk-sum-value">{k.value}</div>
            <div className="wrk-sum-sub">{k.sub}</div>
          </div>
        ))}
      </div>
    )
  }

  // ── Grafik tren bertumpuk per kategori ──
  function renderChart() {
    const aktif = CATEGORIES.filter(c => !hidden.has(c.value))
    const maxBar = mode === 'hari' ? 14 : 30
    return (
      <div className="wrk-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div className="wrk-card-title">Tren Waste per Kategori</div>
            <div className="wrk-card-sub">
              {labelBucket} → nilai waste (Rp){category ? ` · kategori ${CAT[category].label}` : ''}
            </div>
          </div>
          <div className="wrk-legend">
            {CATEGORIES.map(c => {
              const off = hidden.has(c.value)
              return (
                <button key={c.value} className={off ? 'off' : ''} onClick={() => toggleKategori(c.value)}
                  title={off ? 'Tampilkan di grafik' : 'Sembunyikan dari grafik'}>
                  <i style={{ background: c.color }} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 10 }} barCategoryGap={mode === 'hari' ? '18%' : '24%'}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8896B3' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtRingkas} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={62} />
            <Tooltip content={<BucketTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
            {aktif.map((c, i) => (
              <Bar key={c.value} dataKey={c.value} name={c.label} stackId="waste" fill={c.color} maxBarSize={maxBar}
                radius={i === aktif.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {bucketTerburuk && bucketTerburuk.total > 0 && (
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--text3)' }}>
            Puncak waste: <b style={{ color: 'var(--text)' }}>{bucketTerburuk.label}</b> — {fmtRp(bucketTerburuk.total)} ({bucketTerburuk.count}× kejadian)
          </div>
        )}
      </div>
    )
  }

  // ── Rincian per kategori (klik untuk filter seluruh halaman) ──
  function renderKategori() {
    return (
      <div className="wrk-card" style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: '10px' }}>
          <div className="wrk-card-title">Rincian per Kategori</div>
          <div className="wrk-card-sub">Klik salah satu kategori untuk memfilter seluruh rekap</div>
        </div>
        {byCategory.map(c => {
          const info = CAT[c.category]
          const aktif = category === c.category
          return (
            <div key={c.category} className={`wrk-bar-row${aktif ? ' on' : ''}`}
              onClick={() => setCategory(aktif ? null : c.category)}
              title={aktif ? 'Klik untuk hapus filter' : `Filter kategori ${info.label}`}>
              <div>
                <div className="wrk-bar-name"><span>{info.emoji}</span>{info.label}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text3)' }}>{c.count}× kejadian</div>
              </div>
              <div className="wrk-bar-track">
                <div className="wrk-bar-fill" style={{ width: `${Math.round((c.total / maxKategori) * 100)}%`, background: info.color }} />
              </div>
              <div>
                <div className="wrk-bar-val">{fmtRp(c.total)}</div>
                <div className="wrk-bar-pct">{fmtPct(c.pct)} dari total</div>
              </div>
            </div>
          )
        })}
        {!byCategory.some(c => c.total > 0) && (
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px 4px' }}>Belum ada nilai tercatat pada periode ini.</div>
        )}
      </div>
    )
  }

  // ── Bahan paling sering terbuang ──
  function renderBahan() {
    return (
      <div className="wrk-card" style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: '10px' }}>
          <div className="wrk-card-title">Bahan Paling Boros</div>
          <div className="wrk-card-sub">Diurutkan dari nilai waste terbesar ({topIngredients.length} bahan teratas)</div>
        </div>
        {topIngredients.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px 4px' }}>Belum ada bahan tercatat.</div>
        ) : (
          <div className="wrk-scroll">
            <table className="wrk-table">
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th className="num">Jumlah</th>
                  <th className="num">Kali</th>
                  <th className="num">Nilai</th>
                  <th style={{ width: '90px' }}>Porsi</th>
                </tr>
              </thead>
              <tbody>
                {topIngredients.map((i, idx) => (
                  <tr key={`${i.name}-${i.unit}-${idx}`}>
                    <td className="bold">{i.name}</td>
                    <td className="num">{fmtQty(i.qty)} {i.unit}</td>
                    <td className="num">{i.count}×</td>
                    <td className="num bold">{fmtRp(i.total)}</td>
                    <td>
                      <div className="wrk-bar-track">
                        <div className="wrk-bar-fill" style={{ width: `${Math.max(4, Math.round((i.total / maxBahan) * 100))}%`, background: 'var(--accent)' }} />
                      </div>
                      <div className="wrk-bar-pct">{fmtPct(i.pct)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Tabel rekap tiap bucket + daftar pencatat ──
  function renderTabel() {
    const totalSeries = series.reduce((s, r) => s + r.total, 0)
    const maxTotal = Math.max(...series.map(s => s.total), 1)
    return (
      <>
        <div className="wrk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div>
              <div className="wrk-card-title">Rekap per {labelBucket} — {data.periodLabel}</div>
              <div className="wrk-card-sub">
                {category ? `Kategori ${CAT[category].label}` : 'Semua kategori'}
                {mode === 'bulan' ? ' · klik baris untuk melihat rincian harian bulan tersebut' : ''}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text3)' }}>
              {summary.bucketAdaCatatan} {mode === 'hari' ? 'tanggal' : 'bulan'} ada catatan dari {series.length}
            </div>
          </div>

          <div className="wrk-scroll">
            <table className="wrk-table">
              <thead>
                <tr>
                  <th>{labelBucket}</th>
                  <th className="num">Kejadian</th>
                  <th>Kategori Utama</th>
                  <th className="num">Nilai</th>
                  <th className="num">Porsi</th>
                  <th className="num">vs Sebelumnya</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s, i) => {
                  const sebelum = i > 0 ? series[i - 1].total : 0
                  const selisih = s.total - sebelum
                  const utama = CATEGORIES
                    .map(c => ({ ...c, nilai: s[c.value] || 0 }))
                    .filter(c => c.nilai > 0)
                    .sort((a, b) => b.nilai - a.nilai)[0]
                  const bisaKlik = mode === 'bulan'
                  return (
                    <tr key={s.key} className={bisaKlik ? 'clickable' : ''}
                      onClick={bisaKlik ? () => keHari(i + 1) : undefined}>
                      <td className="bold">
                        {s.label}
                        {mode === 'bulan' && <span style={{ fontWeight: 500, color: 'var(--text3)', fontSize: '11px' }}> {year}</span>}
                      </td>
                      <td className="num">{s.count}×</td>
                      <td>
                        {utama ? (
                          <span className="wrk-chip" style={{ background: `${utama.color}1A`, color: utama.color, border: `1px solid ${utama.color}44` }}>
                            {utama.emoji} {utama.label} · {fmtRp(utama.nilai)}
                          </span>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td className="num bold">{fmtRp(s.total)}</td>
                      <td>
                        <div className="wrk-bar-track">
                          <div className="wrk-bar-fill" style={{
                            width: `${s.total > 0 ? Math.max(3, Math.round((s.total / maxTotal) * 100)) : 0}%`,
                            background: utama?.color || 'var(--accent)',
                          }} />
                        </div>
                        <div className="wrk-bar-pct">{fmtPct(totalSeries > 0 ? (s.total / totalSeries) * 100 : 0)}</div>
                      </td>
                      <td className="num" style={{ color: selisih > 0 ? 'var(--red)' : selisih < 0 ? '#10B981' : 'var(--text3)', fontWeight: 700 }}>
                        {i === 0 || s.total === 0 && sebelum === 0 ? '—' : `${selisih > 0 ? '▲' : selisih < 0 ? '▼' : '='} ${fmtRp(Math.abs(selisih))}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="bold">TOTAL</td>
                  <td className="num bold">{summary.count}×</td>
                  <td style={{ fontSize: '11.5px', color: 'var(--text3)' }}>{summary.itemCount} baris bahan</td>
                  <td className="num bold">{fmtRp(summary.total)}</td>
                  <td className="num bold">100%</td>
                  <td className="num" style={{ color: 'var(--text3)' }}>vs {fmtRp(summary.prevTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {byUser.length > 0 && (
          <div className="wrk-card">
            <div style={{ marginBottom: '10px' }}>
              <div className="wrk-card-title">Pencatat Waste</div>
              <div className="wrk-card-sub">Siapa yang paling banyak mencatat waste pada periode ini</div>
            </div>
            {(() => {
              const maxUser = Math.max(...byUser.map(u => u.total), 1)
              return byUser.slice(0, 8).map(u => (
                <div key={u.name} className="wrk-bar-row" style={{ cursor: 'default' }}>
                  <div>
                    <div className="wrk-bar-name">{u.name}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text3)' }}>{u.count}× kejadian</div>
                  </div>
                  <div className="wrk-bar-track">
                    <div className="wrk-bar-fill" style={{ width: `${Math.round((u.total / maxUser) * 100)}%`, background: 'var(--accent)' }} />
                  </div>
                  <div>
                    <div className="wrk-bar-val">{fmtRp(u.total)}</div>
                    <div className="wrk-bar-pct">{fmtPct(u.pct)} dari total</div>
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </>
    )
  }
}


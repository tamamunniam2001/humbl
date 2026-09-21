'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)
const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const isToday = (d) => {
  const date = new Date(d)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
}

const SHIFT_LABELS = { SHIFT_1: 'Shift 1', SHIFT_2: 'Shift 2', SHIFT_3: 'Shift 3' }
const SHIFT_COLORS = {
  SHIFT_1: { bg: '#EBF1FB', color: '#4A7CC7', border: '#C0D0E8' },
  SHIFT_2: { bg: '#E8F7F1', color: '#2A9D6E', border: '#A7DFC8' },
  SHIFT_3: { bg: '#EEEAF8', color: '#6B5BAF', border: '#C8C0E8' },
}

export default function LaporanHarianPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [reopening, setReopening] = useState(null)
  const [expandedDay, setExpandedDay] = useState(null)
  const [deletingDay, setDeletingDay] = useState(null)
  const [addClosingTarget, setAddClosingTarget] = useState(null) // { dayKey, existingShifts, dayReports }
  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'

  const load = useCallback(async () => {
    try {
      const res = await api.get('/daily-reports')
      const reports = res.data.reports || []
      setReports(reports)
      localStorage.setItem('laporan_cache', JSON.stringify(reports))
    } catch { }
    finally { setLoading(false) }
  }, [])

  const pathname = usePathname()
  useEffect(() => {
    try {
      const cached = localStorage.getItem('laporan_cache')
      if (cached) { setReports(JSON.parse(cached)); setLoading(false) }
    } catch { }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load, pathname])

  async function handleReopen(r) {
    if (!confirm('Batalkan closing dan buka kembali order list? Laporan ini akan dihapus.')) return
    setReopening(r.id)
    try {
      await api.delete(`/daily-reports/${r.id}`)
      localStorage.removeItem('closing_date')
      setReports(prev => prev.filter(x => x.id !== r.id))
      alert('Closing dibatalkan. Silakan kembali ke halaman Kasir.')
    } catch (e) { alert(e.response?.data?.message || 'Gagal membuka kembali') }
    finally { setReopening(null) }
  }

  async function handleDeleteDay(dayKey, dayReports) {
    if (!confirm(`Hapus semua laporan tanggal ${fmtDate(dayReports[0].date)}? (${dayReports.length} shift) Tindakan ini tidak bisa dibatalkan.`)) return
    setDeletingDay(dayKey)
    try {
      await Promise.all(dayReports.map(r => api.delete(`/daily-reports/${r.id}`)))
      setReports(prev => prev.filter(x => !dayReports.find(r => r.id === x.id)))
      if (expandedDay === dayKey) setExpandedDay(null)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
    finally { setDeletingDay(null) }
  }

  const totalPengeluaran = (r) => (r.pengeluaran || []).reduce((s, p) => s + (p.harga * p.qty), 0)
  const kasAkhir = (r) => (r.kasAwal || 0) + (r.uangDisetor || 0) - totalPengeluaran(r)

  // Group reports by date (YYYY-MM-DD)
  const grouped = reports.reduce((acc, r) => {
    const key = new Date(r.date).toLocaleDateString('en-CA')
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})
  const dayKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Laporan Harian</div>
            <div className="topbar-sub">Ringkasan closing kasir harian</div>
          </div>
        </div>

        <div className="content">
          <div className="card" style={{ overflow: 'hidden' }}>
            {reports.length === 0 && loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>
            ) : reports.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                <div>Belum ada laporan harian</div>
              </div>
            ) : (
              <table className="table" style={{ fontSize: '11px' }}>
                <thead>
                  <tr style={{ fontSize: '10px' }}>{['Tanggal', 'Shift', 'Penjualan', 'Cash', 'QRIS', 'Transfer', 'Keluar', 'Kas Akhir', ''].map(h => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {dayKeys.map(dayKey => {
                    const dayReports = grouped[dayKey]
                    const isExpanded = expandedDay === dayKey
                    const todayFlag = isToday(dayReports[0].date)
                    const sumPenjualan = dayReports.reduce((s, r) => s + (r.penjualan || 0), 0)
                    const sumCash = dayReports.reduce((s, r) => s + (r.uangDisetor || 0), 0)
                    const sumQris = dayReports.reduce((s, r) => s + (r.qris || 0), 0)
                    const sumTransfer = dayReports.reduce((s, r) => s + (r.transfer || 0), 0)
                    const sumPengeluaran = dayReports.reduce((s, r) => s + totalPengeluaran(r), 0)
                    const lastReport = dayReports[dayReports.length - 1]
                    const sumKasAkhir = kasAkhir(lastReport)
                    const tdS = { padding: '5px 8px' }
                    return (
                      <>
                        <tr key={dayKey} style={{ cursor: 'pointer', background: isExpanded ? '#F0F4FF' : undefined }}
                          onClick={() => setExpandedDay(isExpanded ? null : dayKey)}>
                          <td style={{ ...tdS, fontWeight: '700', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                style={{ color: 'var(--accent)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              {fmtDate(dayReports[0].date)}
                            </div>
                          </td>
                          <td style={tdS}>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              {['SHIFT_1','SHIFT_2','SHIFT_3'].map(sk => {
                                const done = dayReports.some(r => r.shift === sk)
                                const sc = SHIFT_COLORS[sk]
                                return done ? (
                                  <span key={sk} style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: '700' }}>
                                    {sk.replace('SHIFT_', 'S')}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </td>
                          <td style={{ ...tdS, color: 'var(--accent)', fontWeight: '700' }}>{fmt(sumPenjualan)}</td>
                          <td style={{ ...tdS, color: 'var(--green)' }}>{fmt(sumCash)}</td>
                          <td style={{ ...tdS, color: '#6B5BAF' }}>{fmt(sumQris)}</td>
                          <td style={{ ...tdS, color: '#C47D1A' }}>{fmt(sumTransfer)}</td>
                          <td style={{ ...tdS, color: 'var(--red)' }}>{fmt(sumPengeluaran)}</td>
                          <td style={{ ...tdS, fontWeight: '700', color: sumKasAkhir >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(sumKasAkhir)}</td>
                          <td style={tdS}>
                            {(() => {
                              const allShiftKeys = ['SHIFT_1','SHIFT_2','SHIFT_3']
                              const doneShifts = dayReports.map(r => r.shift).filter(Boolean)
                              const missingShifts = allShiftKeys.filter(sk => !doneShifts.includes(sk))
                              return missingShifts.length > 0 && (isAdmin || todayFlag) ? (
                                <button className="btn" style={{ padding: '3px 8px', fontSize: '10px', background: '#EEF2FF', color: '#4A7CC7', border: '1px solid #C0D0E8', marginRight: '4px' }}
                                  onClick={e => { e.stopPropagation(); setAddClosingTarget({ dayKey, dayReports, missingShifts }) }}>
                                  + Closing Shift
                                </button>
                              ) : null
                            })()}
                            {isAdmin && (
                              <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '10px' }}
                                disabled={deletingDay === dayKey}
                                onClick={e => { e.stopPropagation(); handleDeleteDay(dayKey, dayReports) }}>
                                {deletingDay === dayKey ? '...' : '🗑 Hapus'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && dayReports.map(r => {
                          const sc = SHIFT_COLORS[r.shift] || SHIFT_COLORS.SHIFT_1
                          return (
                            <tr key={r.id} style={{ background: '#F8FAFF', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setSelected(r) }}>
                              <td style={{ ...tdS, paddingLeft: '24px' }}>
                                <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: '700' }}>
                                  {SHIFT_LABELS[r.shift] || r.shift}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '5px' }}>{r.closerName || r.cashier?.name || ''}</span>
                              </td>
                              <td style={tdS} />
                              <td style={{ ...tdS, color: 'var(--accent)', fontWeight: '600' }}>{fmt(r.penjualan)}</td>
                              <td style={{ ...tdS, color: 'var(--green)' }}>{fmt(r.uangDisetor)}</td>
                              <td style={{ ...tdS, color: '#6B5BAF' }}>{fmt(r.qris)}</td>
                              <td style={{ ...tdS, color: '#C47D1A' }}>{fmt(r.transfer)}</td>
                              <td style={{ ...tdS, color: 'var(--red)' }}>{fmt(totalPengeluaran(r))}</td>
                              <td style={{ ...tdS, fontWeight: '600', color: kasAkhir(r) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(kasAkhir(r))}</td>
                              <td style={{ ...tdS, display: 'flex', gap: '3px' }}>
                                <button className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C0D0E8', padding: '3px 7px', fontSize: '10px' }}
                                  onClick={e => { e.stopPropagation(); setSelected(r) }}>Detail</button>
                                {(isAdmin || todayFlag) && (
                                  <button className="btn" style={{ background: '#F5F8FE', color: 'var(--text2)', border: '1px solid var(--border)', padding: '3px 7px', fontSize: '10px' }}
                                    onClick={e => { e.stopPropagation(); setEditTarget(r) }}>Edit</button>
                                )}
                                {todayFlag && (
                                  <button className="btn btn-danger" style={{ padding: '3px 7px', fontSize: '10px' }}
                                    disabled={reopening === r.id}
                                    onClick={e => { e.stopPropagation(); handleReopen(r) }}>
                                    {reopening === r.id ? '...' : 'Buka'}
                                  </button>
                                )}
                                {isAdmin && !todayFlag && (
                                  <button className="btn btn-danger" style={{ padding: '3px 7px', fontSize: '10px' }}
                                    disabled={reopening === r.id}
                                    onClick={e => { e.stopPropagation(); handleReopen(r) }}>
                                    {reopening === r.id ? '...' : 'Hapus'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && <DetailModal report={selected} onClose={() => setSelected(null)} fmt={fmt} fmtDate={fmtDate} totalPengeluaran={totalPengeluaran} kasAkhir={kasAkhir} onEdit={() => { setEditTarget(selected); setSelected(null) }} onReopen={handleReopen} reopening={reopening} isAdmin={isAdmin} />}
        {editTarget && <EditModal report={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} fmt={fmt} fmtDate={fmtDate} isAdmin={isAdmin} />}
        {addClosingTarget && <AddClosingModal target={addClosingTarget} onClose={() => setAddClosingTarget(null)} onSaved={() => { setAddClosingTarget(null); load() }} fmt={fmt} fmtDate={fmtDate} isAdmin={isAdmin} />}
      </main>
    </div>
  )
}

const PAY_TABS = [
  { key: 'CASH', label: 'Cash', color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
  { key: 'QRIS', label: 'QRIS', color: '#6B5BAF', bg: '#EEEAF8', border: '#C8C0E8' },
  { key: 'TRANSFER', label: 'Transfer', color: '#C47D1A', bg: '#FDF4E3', border: '#F0D090' },
  { key: 'NONTUNAI', label: 'Non-Tunai', color: '#0891B2', bg: '#E0F7FA', border: '#A5D8E6' },
]

function DetailModal({ report: r, onClose, fmt, fmtDate, totalPengeluaran, kasAkhir, onEdit, onReopen, reopening, isAdmin }) {
  const kAkhir = kasAkhir(r)
  const totPengeluaran = totalPengeluaran(r)
  const [activeTab, setActiveTab] = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [txLoading, setTxLoading] = useState(false)

  async function loadTransactions() {
    if (transactions !== null) return
    setTxLoading(true)
    try {
      const res = await api.get(`/daily-reports/${r.id}/transactions`)
      setTransactions(res.data)
    } catch { setTransactions([]) }
    finally { setTxLoading(false) }
  }

  function handleTab(key) {
    setActiveTab(prev => prev === key ? null : key)
    loadTransactions()
  }

  const txByMethod = (key) => (transactions || []).filter(t => t.payMethod === key)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '720px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E2A3B' }}>Laporan Closing — {fmtDate(r.date)}</div>
            <div style={{ fontSize: '11px', color: '#7A8FAF', marginTop: '1px' }}>
              {SHIFT_LABELS[r.shift] || r.shift || 'Shift'} &nbsp;&middot;&nbsp;
              {r.closerName ? `Closer: ${r.closerName}` : `Kasir: ${r.cashier?.name || '-'}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(isAdmin || isToday(r.date)) && (
              <button onClick={onEdit} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#4A7CC7', fontSize: '12px', fontWeight: '600', padding: '5px 12px', fontFamily: 'inherit' }}>Edit</button>
            )}
            {(isAdmin || isToday(r.date)) && (
              <button onClick={() => onReopen(r)} disabled={reopening === r.id}
                style={{ background: 'rgba(201,85,85,0.08)', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', color: '#C95555', fontSize: '12px', fontWeight: '600', padding: '5px 12px', fontFamily: 'inherit' }}>
                {reopening === r.id ? '...' : isToday(r.date) ? 'Buka Kembali' : 'Hapus'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#5A6E90', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Ringkasan Penjualan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Total Penjualan', value: r.penjualan, color: '#4A7CC7', bg: '#EBF1FB', border: '#C0D0E8' },
                { label: 'Cash', value: r.uangDisetor, color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
                { label: 'QRIS', value: r.qris, color: '#6B5BAF', bg: '#EEEAF8', border: '#C8C0E8' },
                { label: 'Transfer', value: r.transfer, color: '#C47D1A', bg: '#FDF4E3', border: '#F0D090' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '9px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', borderRadius: '12px', border: '1px solid #C0D0E8', padding: '12px 14px', marginTop: 'auto' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#7A8FAF', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Kalkulasi Kas</div>
              {[
                ['Kas Awal', fmt(r.kasAwal || 0), 'var(--text2)'],
                ['+ Penjualan Cash', `+${fmt(r.uangDisetor || 0)}`, '#2A9D6E'],
                ...(totPengeluaran > 0 ? [['- Pengeluaran', `-${fmt(totPengeluaran)}`, '#C95555']] : []),
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <span style={{ color: '#7A8FAF' }}>{label}</span>
                  <span style={{ fontWeight: '600', color }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #C0D0E8', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E2A3B' }}>Total Kas Akhir</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: kAkhir >= 0 ? '#2A9D6E' : '#C95555' }}>{fmt(kAkhir)}</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: '#F5F8FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Pengeluaran</div>
                {totPengeluaran > 0 && <span style={{ fontSize: '11px', fontWeight: '700', color: '#C95555' }}>-{fmt(totPengeluaran)}</span>}
              </div>
              <div style={{ padding: '10px 12px' }}>
                {(r.pengeluaran || []).filter(p => p.barang).length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada pengeluaran</div>
                ) : (r.pengeluaran || []).filter(p => p.barang).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < (r.pengeluaran || []).filter(x => x.barang).length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{p.barang}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{p.qty} x {fmt(p.harga)}</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#C95555' }}>-{fmt(p.harga * p.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: '#F5F8FE' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Catatan</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                {r.catatan ? <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.6' }}>{r.catatan}</div>
                  : <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada catatan</div>}
              </div>
            </div>

            {/* Tabs transaksi per metode */}
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: '#F5F8FE' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Detail Transaksi per Metode</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', flexWrap: 'wrap' }}>
                {PAY_TABS.map(tab => {
                  const total = tab.key === 'CASH' ? r.uangDisetor : tab.key === 'QRIS' ? r.qris : tab.key === 'TRANSFER' ? r.transfer : 0
                  if (total === 0 && tab.key !== 'CASH') return null
                  const isActive = activeTab === tab.key
                  return (
                    <button key={tab.key} onClick={() => handleTab(tab.key)}
                      style={{
                        padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                        border: `1.5px solid ${isActive ? tab.color : tab.border}`,
                        background: isActive ? tab.bg : '#fff',
                        color: isActive ? tab.color : 'var(--muted)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                      {tab.label} {total > 0 ? `· ${fmt(total)}` : ''}
                    </button>
                  )
                })}
              </div>
              {activeTab && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '0 12px 10px' }}>
                  {txLoading ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>Memuat...</div>
                  ) : txByMethod(activeTab).length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada transaksi</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                      {txByMethod(activeTab).map((tx, i) => (
                        <div key={tx.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#F8FAFF' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>{tx.invoiceNo}</span>
                              {tx.customerName && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{tx.customerName}</span>}
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: PAY_TABS.find(t => t.key === activeTab)?.color }}>{fmt(tx.total)}</span>
                          </div>
                          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {tx.items.map((item, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'var(--text2)' }}>{item.name} <span style={{ color: 'var(--muted)' }}>x{item.qty}</span></span>
                                <span style={{ color: 'var(--text)', fontWeight: '600' }}>{fmt(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const SHIFTS_LIST = [
  { key: 'SHIFT_1', label: 'Shift 1' },
  { key: 'SHIFT_2', label: 'Shift 2' },
  { key: 'SHIFT_3', label: 'Shift 3' },
]

function EditModal({ report: r, onClose, onSaved, fmt, fmtDate, isAdmin }) {
  const [kasAwal, setKasAwal] = useState(String(r.kasAwal || ''))
  const [penjualan, setPenjualan] = useState(String(r.penjualan || ''))
  const [cash, setCash] = useState(String(r.uangDisetor || ''))
  const [qris, setQris] = useState(String(r.qris || ''))
  const [transfer, setTransfer] = useState(String(r.transfer || ''))
  const [shift, setShift] = useState(r.shift || 'SHIFT_1')
  const [closerName, setCloserName] = useState(r.closerName || '')
  const [pengeluaran, setPengeluaran] = useState((r.pengeluaran || []).map(p => ({ ...p })))
  const [catatan, setCatatan] = useState(r.catatan || '')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [employees, setEmployees] = useState([])
  useEffect(() => { api.get('/admin/employees').then(res => setEmployees(res.data.filter(e => e.isActive))).catch(() => {}) }, [])

  const totPengeluaran = pengeluaran.reduce((s, p) => s + (Number(p.harga) * Number(p.qty || 1)), 0)
  const kasAkhirPreview = (Number(kasAwal) || 0) + (Number(cash) || 0) - totPengeluaran

  function addPengeluaran() { setPengeluaran(prev => [...prev, { barang: '', qty: 1, harga: 0 }]) }
  function updateP(i, field, val) { setPengeluaran(prev => prev.map((p, n) => n === i ? { ...p, [field]: val } : p)) }

  // Sinkron nilai penjualan dari transaksi aktual sesuai jam shift
  async function handleSync() {
    const SHIFT_RANGES = {
      SHIFT_1: { startHour: 7,  endHour: 13 },
      SHIFT_2: { startHour: 13, endHour: 18 },
      SHIFT_3: { startHour: 18, endHour: 23 },
    }
    const currentShift = isAdmin ? shift : r.shift
    const shiftDef = SHIFT_RANGES[currentShift]
    if (!shiftDef) return alert('Shift tidak dikenal')
    setSyncing(true)
    try {
      const dateWIB = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const from = new Date(`${dateWIB}T${String(shiftDef.startHour).padStart(2,'0')}:00:00+07:00`)
      const to   = new Date(`${dateWIB}T${String(shiftDef.endHour - 1).padStart(2,'0')}:59:59.999+07:00`)
      const res = await api.get(`/transactions?slim=1&all=1&from=${from.toISOString()}&to=${to.toISOString()}`)
      const txs = (res.data.transactions || []).filter(t => t.status === 'COMPLETED' && !t.deletedAt)
      const totP   = txs.reduce((s, t) => s + t.total, 0)
      const totC   = txs.filter(t => t.payMethod === 'CASH').reduce((s, t) => s + t.total, 0)
      const totQ   = txs.filter(t => t.payMethod === 'QRIS').reduce((s, t) => s + t.total, 0)
      const totT   = txs.filter(t => t.payMethod === 'TRANSFER' || t.payMethod === 'NONTUNAI').reduce((s, t) => s + t.total, 0)
      setPenjualan(String(totP))
      setCash(String(totC))
      setQris(String(totQ))
      setTransfer(String(totT))
    } catch { alert('Gagal mengambil data transaksi') }
    finally { setSyncing(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put(`/daily-reports/${r.id}`, {
        kasAwal: Number(kasAwal) || 0,
        penjualan: Number(penjualan) || 0,
        uangDisetor: Number(cash) || 0,
        qris: Number(qris) || 0,
        transfer: Number(transfer) || 0,
        shift: isAdmin ? shift : r.shift,
        closerName: isAdmin ? closerName : r.closerName,
        pengeluaran: pengeluaran.filter(p => p.barang).map(p => ({ ...p, qty: Number(p.qty) || 1, harga: Number(p.harga) || 0 })),
        piutang: r.piutang || [], catatan,
      })
      onSaved()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  const inputS = { fontSize: '12px', padding: '7px 10px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: isAdmin ? '680px' : '480px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E2A3B' }}>Edit Laporan — {fmtDate(r.date)}</div>
            <div style={{ fontSize: '11px', color: '#7A8FAF', marginTop: '1px' }}>
              {isAdmin ? <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '5px', padding: '1px 7px', fontSize: '10px', fontWeight: '700' }}>⚡ Mode Admin</span> : `Kasir: ${r.cashier?.name || '-'}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#5A6E90', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', gap: '16px' }}>
          {/* Kolom kiri */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Shift & Closer — admin only */}
            {isAdmin && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#92400E', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Data Shift (Admin)</div>
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>Shift</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {SHIFTS_LIST.map(s => (
                      <button key={s.key} onClick={() => setShift(s.key)}
                        style={{ flex: 1, padding: '6px 4px', borderRadius: '7px', border: `1.5px solid ${shift === s.key ? 'var(--accent)' : 'var(--border)'}`, background: shift === s.key ? 'var(--accent)' : '#fff', color: shift === s.key ? '#fff' : 'var(--text2)', fontWeight: '700', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>Nama Closer</label>
                  <select className="input" style={inputS} value={closerName} onChange={e => setCloserName(e.target.value)}>
                    <option value="">Pilih nama staff...</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Kas Awal */}
            <div>
              <label className="label">Kas Awal</label>
              <input className="input" type="number" style={inputS} placeholder="0" value={kasAwal} onChange={e => setKasAwal(e.target.value)} />
            </div>

            {/* Penjualan — admin only */}
            {isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" style={{ margin: 0 }}>Data Penjualan</label>
                  <button type="button" onClick={handleSync} disabled={syncing}
                    style={{ fontSize: '11px', color: '#2A9D6E', background: '#E8F7F1', border: '1px solid #A7DFC8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                      <path d="M21 12a9 9 0 0 1-9 9m0-18a9 9 0 0 1 9 9M3 12a9 9 0 0 1 9-9"/><polyline points="16 12 21 12 21 7"/>
                    </svg>
                    {syncing ? 'Memuat...' : 'Sinkron dari Transaksi'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="label" style={{ fontSize: '11px' }}>Total Penjualan</label>
                    <input className="input" type="number" style={inputS} placeholder="0" value={penjualan} onChange={e => setPenjualan(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '11px', color: '#2A9D6E' }}>Cash</label>
                    <input className="input" type="number" style={{ ...inputS, borderColor: '#A7DFC8' }} placeholder="0" value={cash} onChange={e => setCash(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '11px', color: '#6B5BAF' }}>QRIS</label>
                    <input className="input" type="number" style={{ ...inputS, borderColor: '#C8C0E8' }} placeholder="0" value={qris} onChange={e => setQris(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '11px', color: '#C47D1A' }}>Transfer</label>
                    <input className="input" type="number" style={{ ...inputS, borderColor: '#F0D090' }} placeholder="0" value={transfer} onChange={e => setTransfer(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Preview kas akhir */}
            <div style={{ background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', borderRadius: '10px', border: '1px solid #C0D0E8', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', color: '#7A8FAF', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Preview Kas Akhir</div>
              {[['Kas Awal', Number(kasAwal)||0, 'var(--text2)'], ['+ Cash', Number(cash)||0, '#2A9D6E'], ['- Pengeluaran', -totPengeluaran, '#C95555']].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: '#7A8FAF' }}>{label}</span>
                  <span style={{ color, fontWeight: '600' }}>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #C0D0E8', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E2A3B' }}>Kas Akhir</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: kasAkhirPreview >= 0 ? '#2A9D6E' : '#C95555' }}>{fmt(kasAkhirPreview)}</span>
              </div>
            </div>
          </div>

          {/* Kolom kanan */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="label" style={{ margin: 0 }}>Pengeluaran</label>
                <button type="button" onClick={addPengeluaran}
                  style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>+ Tambah</button>
              </div>
              {pengeluaran.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '4px 0' }}>Belum ada pengeluaran</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {pengeluaran.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input className="input" placeholder="Nama barang" value={p.barang} onChange={e => updateP(i, 'barang', e.target.value)} style={{ flex: 2, ...inputS }} />
                    <input className="input" type="number" placeholder="Qty" value={p.qty} onChange={e => updateP(i, 'qty', e.target.value)} style={{ flex: '0 0 46px', ...inputS }} />
                    <input className="input" type="number" placeholder="Harga" value={p.harga} onChange={e => updateP(i, 'harga', e.target.value)} style={{ flex: 2, ...inputS }} />
                    <button onClick={() => setPengeluaran(prev => prev.filter((_, n) => n !== i))}
                      style={{ background: 'var(--red-light)', border: '1px solid #FECACA', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '7px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Catatan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
              <textarea className="input" rows={4} placeholder="Catatan tambahan..." value={catatan} onChange={e => setCatatan(e.target.value)} style={{ resize: 'none', fontSize: '12px' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Batal</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Closing Shift yang Terlewat ──
const SHIFT_HOUR_MAP = {
  SHIFT_1: { startHour: 7,  endHour: 13, label: 'Shift 1', jam: '07.00 – 13.00' },
  SHIFT_2: { startHour: 13, endHour: 18, label: 'Shift 2', jam: '13.00 – 18.00' },
  SHIFT_3: { startHour: 18, endHour: 23, label: 'Shift 3', jam: '18.00 – 23.00' },
}

function AddClosingModal({ target, onClose, onSaved, fmt, fmtDate, isAdmin }) {
  const { dayReports, missingShifts } = target

  // Ambil tanggal hari dari laporan yang sudah ada
  const reportDate = dayReports[0].date
  const dateLabel = fmtDate(reportDate)

  // Hitung kas awal otomatis = kas akhir shift terakhir yang sudah ada
  const totalPengeluaranOf = (r) => (r.pengeluaran || []).reduce((s, p) => s + p.harga * p.qty, 0)
  const kasAkhirOf = (r) => (r.kasAwal || 0) + (r.uangDisetor || 0) - totalPengeluaranOf(r)
  const sortedExisting = [...dayReports].sort((a, b) => {
    const order = { SHIFT_1: 1, SHIFT_2: 2, SHIFT_3: 3 }
    return (order[a.shift] || 0) - (order[b.shift] || 0)
  })
  const lastExisting = sortedExisting[sortedExisting.length - 1]
  const kasAwalOtomatis = kasAkhirOf(lastExisting)

  const [shift, setShift] = useState(missingShifts[0])
  const [employees, setEmployees] = useState([])
  const [closerName, setCloserName] = useState('')
  const [kasAwal, setKasAwal] = useState(String(kasAwalOtomatis || ''))
  const [penjualan, setPenjualan] = useState('0')
  const [cash, setCash] = useState('0')
  const [qris, setQris] = useState('0')
  const [transfer, setTransfer] = useState('0')
  const [pengeluaran, setPengeluaran] = useState([])
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingTx, setLoadingTx] = useState(false)

  useEffect(() => {
    api.get('/admin/employees').then(res => setEmployees(res.data.filter(e => e.isActive))).catch(() => {})
  }, [])

  // Saat shift berubah, hitung ulang kas awal dan auto-isi data transaksi dari range jam shift
  useEffect(() => {
    // Kas awal: kas akhir dari shift sebelumnya yang sudah di-closing pada hari yang sama
    const order = { SHIFT_1: 1, SHIFT_2: 2, SHIFT_3: 3 }
    const prevDone = sortedExisting.filter(r => (order[r.shift] || 0) < (order[shift] || 0))
    const prevLast = prevDone.length > 0 ? prevDone[prevDone.length - 1] : lastExisting
    setKasAwal(String(kasAkhirOf(prevLast) || 0))

    // Auto-fetch transaksi untuk shift ini dari range jam (berdasarkan tanggal laporan, bukan hari ini)
    async function fetchTx() {
      setLoadingTx(true)
      try {
        const shiftDef = SHIFT_HOUR_MAP[shift]
        const dateWIB = new Date(reportDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        const from = new Date(`${dateWIB}T${String(shiftDef.startHour).padStart(2,'0')}:00:00+07:00`)
        const to   = new Date(`${dateWIB}T${String(shiftDef.endHour).padStart(2,'0')}:59:59+07:00`)
        const res = await api.get(`/transactions?slim=1&all=1&from=${from.toISOString()}&to=${to.toISOString()}`)
        const txs = (res.data.transactions || []).filter(t => t.status === 'COMPLETED')
        const totPenjualan = txs.reduce((s, t) => s + t.total, 0)
        const totCash      = txs.filter(t => t.payMethod === 'CASH').reduce((s, t) => s + t.total, 0)
        const totQris      = txs.filter(t => t.payMethod === 'QRIS').reduce((s, t) => s + t.total, 0)
        const totTransfer  = txs.filter(t => t.payMethod === 'TRANSFER' || t.payMethod === 'NONTUNAI').reduce((s, t) => s + t.total, 0)
        setPenjualan(String(totPenjualan))
        setCash(String(totCash))
        setQris(String(totQris))
        setTransfer(String(totTransfer))
      } catch { /* biarkan user isi manual */ }
      finally { setLoadingTx(false) }
    }
    fetchTx()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift])

  const totPengeluaran = pengeluaran.reduce((s, p) => s + (Number(p.harga) * Number(p.qty || 1)), 0)
  const kasAkhirPreview = (Number(kasAwal) || 0) + (Number(cash) || 0) - totPengeluaran

  function addPengeluaran() { setPengeluaran(prev => [...prev, { barang: '', qty: 1, harga: 0 }]) }
  function updateP(i, field, val) { setPengeluaran(prev => prev.map((p, n) => n === i ? { ...p, [field]: val } : p)) }

  async function handleSave() {
    setSaving(true)
    try {
      // Tentukan tanggal closing: gunakan tengah-tengah jam shift pada hari tersebut
      const shiftDef = SHIFT_HOUR_MAP[shift]
      const dateWIB = new Date(reportDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const midHour = Math.floor((shiftDef.startHour + shiftDef.endHour) / 2)
      const reportDateISO = new Date(`${dateWIB}T${String(midHour).padStart(2,'0')}:30:00+07:00`).toISOString()

      await api.post('/daily-reports', {
        shift,
        kasAwal: Number(kasAwal) || 0,
        penjualan: Number(penjualan) || 0,
        uangDisetor: Number(cash) || 0,
        qris: Number(qris) || 0,
        transfer: Number(transfer) || 0,
        pengeluaran: pengeluaran.filter(p => p.barang).map(p => ({ ...p, qty: Number(p.qty) || 1, harga: Number(p.harga) || 0 })),
        piutang: [],
        catatan,
        closerName: closerName || '',
        date: reportDateISO,
      })
      onSaved()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan laporan')
    } finally { setSaving(false) }
  }

  const inputS = { fontSize: '12px', padding: '7px 10px' }
  const shiftDef = SHIFT_HOUR_MAP[shift]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '680px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E2A3B' }}>Closing Shift Terlewat — {dateLabel}</div>
            <div style={{ fontSize: '11px', color: '#7A8FAF', marginTop: '1px' }}>
              {shiftDef ? `${shiftDef.label} · ${shiftDef.jam}` : shift}
              {loadingTx && <span style={{ marginLeft: '8px', color: '#4A7CC7' }}>· Memuat data transaksi...</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#5A6E90', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', gap: '16px' }}>
          {/* Kolom kiri */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Pilih shift */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#92400E', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Pilih Shift yang Belum Di-closing</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {missingShifts.map(sk => {
                  const sd = SHIFT_HOUR_MAP[sk]
                  return (
                    <button key={sk} onClick={() => setShift(sk)}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: '7px', border: `1.5px solid ${shift === sk ? 'var(--accent)' : 'var(--border)'}`, background: shift === sk ? 'var(--accent)' : '#fff', color: shift === sk ? '#fff' : 'var(--text2)', fontWeight: '700', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: '1.4' }}>
                      {sd?.label || sk}<br/>
                      <span style={{ fontSize: '9px', opacity: 0.8 }}>{sd?.jam}</span>
                    </button>
                  )
                })}
              </div>

              {/* Nama closer */}
              <div>
                <label className="label" style={{ fontSize: '11px' }}>Nama Closer</label>
                <select className="input" style={inputS} value={closerName} onChange={e => setCloserName(e.target.value)}>
                  <option value="">Pilih nama staff...</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
            </div>

            {/* Kas Awal */}
            <div>
              <label className="label">Kas Awal <span style={{ color: 'var(--muted)', fontWeight: '400', fontSize: '10px' }}>(otomatis dari shift sebelumnya)</span></label>
              <input className="input" type="number" style={inputS} placeholder="0" value={kasAwal} onChange={e => setKasAwal(e.target.value)} />
            </div>

            {/* Penjualan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label className="label" style={{ fontSize: '11px' }}>Total Penjualan</label>
                <input className="input" type="number" style={inputS} placeholder="0" value={penjualan} onChange={e => setPenjualan(e.target.value)} />
              </div>
              <div>
                <label className="label" style={{ fontSize: '11px', color: '#2A9D6E' }}>Cash</label>
                <input className="input" type="number" style={{ ...inputS, borderColor: '#A7DFC8' }} placeholder="0" value={cash} onChange={e => setCash(e.target.value)} />
              </div>
              <div>
                <label className="label" style={{ fontSize: '11px', color: '#6B5BAF' }}>QRIS</label>
                <input className="input" type="number" style={{ ...inputS, borderColor: '#C8C0E8' }} placeholder="0" value={qris} onChange={e => setQris(e.target.value)} />
              </div>
              <div>
                <label className="label" style={{ fontSize: '11px', color: '#C47D1A' }}>Transfer</label>
                <input className="input" type="number" style={{ ...inputS, borderColor: '#F0D090' }} placeholder="0" value={transfer} onChange={e => setTransfer(e.target.value)} />
              </div>
            </div>

            {/* Preview kas akhir */}
            <div style={{ background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', borderRadius: '10px', border: '1px solid #C0D0E8', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', color: '#7A8FAF', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Preview Kas Akhir</div>
              {[['Kas Awal', Number(kasAwal)||0, 'var(--text2)'], ['+ Cash', Number(cash)||0, '#2A9D6E'], ['- Pengeluaran', -totPengeluaran, '#C95555']].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: '#7A8FAF' }}>{label}</span>
                  <span style={{ color, fontWeight: '600' }}>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #C0D0E8', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E2A3B' }}>Kas Akhir</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: kasAkhirPreview >= 0 ? '#2A9D6E' : '#C95555' }}>{fmt(kasAkhirPreview)}</span>
              </div>
            </div>
          </div>

          {/* Kolom kanan */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="label" style={{ margin: 0 }}>Pengeluaran</label>
                <button type="button" onClick={addPengeluaran}
                  style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>+ Tambah</button>
              </div>
              {pengeluaran.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '4px 0' }}>Belum ada pengeluaran</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {pengeluaran.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input className="input" placeholder="Nama barang" value={p.barang} onChange={e => updateP(i, 'barang', e.target.value)} style={{ flex: 2, ...inputS }} />
                    <input className="input" type="number" placeholder="Qty" value={p.qty} onChange={e => updateP(i, 'qty', e.target.value)} style={{ flex: '0 0 46px', ...inputS }} />
                    <input className="input" type="number" placeholder="Harga" value={p.harga} onChange={e => updateP(i, 'harga', e.target.value)} style={{ flex: 2, ...inputS }} />
                    <button onClick={() => setPengeluaran(prev => prev.filter((_, n) => n !== i))}
                      style={{ background: 'var(--red-light)', border: '1px solid #FECACA', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '7px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Catatan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
              <textarea className="input" rows={4} placeholder="Catatan tambahan..." value={catatan} onChange={e => setCatatan(e.target.value)} style={{ resize: 'none', fontSize: '12px' }} />
            </div>
            <div style={{ background: '#FEF9EC', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#92400E', lineHeight: '1.5' }}>
              ⚠️ Data penjualan diisi otomatis dari transaksi pada jam operasional shift. Periksa kembali sebelum menyimpan.
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Batal</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving || loadingTx}>
            {saving ? 'Menyimpan...' : loadingTx ? 'Memuat data...' : 'Simpan Closing'}
          </button>
        </div>
      </div>
    </div>
  )
}

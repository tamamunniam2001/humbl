'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

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

  const totalPengeluaran = (r) => (r.pengeluaran || []).reduce((s, p) => s + (p.harga * p.qty), 0)
  const kasAkhir = (r) => (r.kasAwal || 0) + (r.uangDisetor || 0) - totalPengeluaran(r)

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
              <table className="table">
                <thead>
                  <tr>{['Tanggal', 'Shift', 'Kasir / Closer', 'Total Penjualan', 'Cash', 'QRIS', 'Transfer', 'Pengeluaran', 'Kas Akhir', ''].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const sc = SHIFT_COLORS[r.shift] || SHIFT_COLORS.SHIFT_1
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                        <td style={{ fontWeight: '600' }}>{fmtDate(r.date)}</td>
                        <td>
                          <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>
                            {SHIFT_LABELS[r.shift] || r.shift || '-'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text2)' }}>
                          <div>{r.closerName || r.cashier?.name || '-'}</div>
                          {r.closerName && r.cashier?.name && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Login: {r.cashier.name}</div>}
                        </td>
                        <td style={{ color: 'var(--accent)', fontWeight: '700' }}>{fmt(r.penjualan)}</td>
                        <td style={{ color: 'var(--green)' }}>{fmt(r.uangDisetor)}</td>
                        <td style={{ color: '#6B5BAF' }}>{fmt(r.qris)}</td>
                        <td style={{ color: '#C47D1A' }}>{fmt(r.transfer)}</td>
                        <td style={{ color: 'var(--red)' }}>{fmt(totalPengeluaran(r))}</td>
                        <td style={{ fontWeight: '700', color: kasAkhir(r) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(kasAkhir(r))}</td>
                        <td style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C0D0E8', padding: '5px 10px', fontSize: '12px' }}
                            onClick={(e) => { e.stopPropagation(); setSelected(r) }}>Detail</button>
                          <button className="btn" style={{ background: '#F5F8FE', color: 'var(--text2)', border: '1px solid var(--border)', padding: '5px 10px', fontSize: '12px' }}
                            onClick={(e) => { e.stopPropagation(); setEditTarget(r) }}>Edit</button>
                          {isToday(r.date) && (
                            <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }}
                              disabled={reopening === r.id}
                              onClick={(e) => { e.stopPropagation(); handleReopen(r) }}>
                              {reopening === r.id ? '...' : 'Buka Kembali'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && <DetailModal report={selected} onClose={() => setSelected(null)} fmt={fmt} fmtDate={fmtDate} totalPengeluaran={totalPengeluaran} kasAkhir={kasAkhir} onEdit={() => { setEditTarget(selected); setSelected(null) }} onReopen={handleReopen} reopening={reopening} />}
        {editTarget && <EditModal report={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} fmt={fmt} fmtDate={fmtDate} />}
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

function DetailModal({ report: r, onClose, fmt, fmtDate, totalPengeluaran, kasAkhir, onEdit, onReopen, reopening }) {
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
            <button onClick={onEdit} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#4A7CC7', fontSize: '12px', fontWeight: '600', padding: '5px 12px', fontFamily: 'inherit' }}>Edit</button>
            {isToday(r.date) && (
              <button onClick={() => onReopen(r)} disabled={reopening === r.id}
                style={{ background: 'rgba(201,85,85,0.08)', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', color: '#C95555', fontSize: '12px', fontWeight: '600', padding: '5px 12px', fontFamily: 'inherit' }}>
                {reopening === r.id ? '...' : 'Buka Kembali'}
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

function EditModal({ report: r, onClose, onSaved, fmt, fmtDate }) {
  const [kasAwal, setKasAwal] = useState(String(r.kasAwal || ''))
  const [pengeluaran, setPengeluaran] = useState((r.pengeluaran || []).map(p => ({ ...p })))
  const [catatan, setCatatan] = useState(r.catatan || '')
  const [saving, setSaving] = useState(false)

  function addPengeluaran() { setPengeluaran(prev => [...prev, { barang: '', qty: 1, harga: 0 }]) }
  function updateP(i, field, val) { setPengeluaran(prev => prev.map((p, n) => n === i ? { ...p, [field]: val } : p)) }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put(`/daily-reports/${r.id}`, {
        kasAwal: Number(kasAwal) || 0,
        penjualan: r.penjualan, uangDisetor: r.uangDisetor, qris: r.qris, transfer: r.transfer,
        pengeluaran: pengeluaran.filter(p => p.barang).map(p => ({ ...p, qty: Number(p.qty) || 1, harga: Number(p.harga) || 0 })),
        piutang: r.piutang || [], catatan,
      })
      onSaved()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '480px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E2A3B' }}>Edit Laporan — {fmtDate(r.date)}</div>
            <div style={{ fontSize: '11px', color: '#7A8FAF' }}>Kasir: {r.cashier?.name || '-'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#5A6E90', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Kas Awal</label>
            <input className="input" type="number" placeholder="0" value={kasAwal} onChange={(e) => setKasAwal(e.target.value)} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="label" style={{ margin: 0 }}>Pengeluaran</label>
              <button type="button" onClick={addPengeluaran}
                style={{ fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>+ Tambah</button>
            </div>
            {pengeluaran.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '4px 0' }}>Belum ada pengeluaran</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pengeluaran.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input className="input" placeholder="Nama barang" value={p.barang} onChange={(e) => updateP(i, 'barang', e.target.value)} style={{ flex: 2, fontSize: '12px', padding: '7px 10px' }} />
                  <input className="input" type="number" placeholder="Qty" value={p.qty} onChange={(e) => updateP(i, 'qty', e.target.value)} style={{ flex: '0 0 52px', fontSize: '12px', padding: '7px 8px' }} />
                  <input className="input" type="number" placeholder="Harga" value={p.harga} onChange={(e) => updateP(i, 'harga', e.target.value)} style={{ flex: 2, fontSize: '12px', padding: '7px 10px' }} />
                  <button onClick={() => setPengeluaran(prev => prev.filter((_, n) => n !== i))}
                    style={{ background: 'var(--red-light)', border: '1px solid #FECACA', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '7px 9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Catatan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
            <textarea className="input" rows={3} placeholder="Catatan tambahan..." value={catatan} onChange={(e) => setCatatan(e.target.value)} style={{ resize: 'none' }} />
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

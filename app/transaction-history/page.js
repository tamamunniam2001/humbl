'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import { printThermal } from '@/lib/thermal'

const fmt = (n) => Number(n).toLocaleString('id-ID')
const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const methodColor = {
  CASH: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  QRIS: { bg: '#EDE9FE', color: '#7C3AED', border: '#C4B5FD' },
  TRANSFER: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  NONTUNAI: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
}

export default function TransactionHistoryPage() {
  const [data, setData] = useState({ days: [], totalDays: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedDays, setExpandedDays] = useState({})
  const [selectedTx, setSelectedTx] = useState(null)
  const [printingId, setPrintingId] = useState(null)

  async function load(p = page) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p })
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      const res = await api.get(`/admin/transaction-history?${params}`)
      setData(res.data)
      // Auto-expand hari pertama
      if (res.data.days.length > 0) {
        setExpandedDays({ [res.data.days[0].date]: true })
      }
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [page])

  function toggleDay(date) {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }))
  }

  async function handlePrint(tx) {
    setPrintingId(tx.id)
    try { await printThermal(tx) } catch (e) { alert('Gagal cetak: ' + e.message) }
    finally { setPrintingId(null) }
  }

  const totalAllRevenue = data.days.reduce((s, d) => s + d.totalRevenue, 0)

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">History Transaksi</div>
            <div className="topbar-sub">{data.totalDays} hari · {data.days.reduce((s, d) => s + d.count, 0)} transaksi ditampilkan</div>
          </div>
        </div>

        <div className="content">
          {/* Filter */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="label">Dari Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setPage(1); load(1) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Filter
            </button>
            {(from || to) && (
              <button className="btn btn-ghost" onClick={() => { setFrom(''); setTo(''); setPage(1); setTimeout(() => load(1), 0) }}>Reset</button>
            )}
            {totalAllRevenue > 0 && (
              <div style={{ marginLeft: 'auto', background: '#EFF4FF', border: '1px solid #C7D4F0', borderRadius: '10px', padding: '8px 16px', textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>TOTAL PERIODE</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#2563EB' }}>Rp {fmt(totalAllRevenue)}</div>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
              Memuat data...
            </div>
          ) : data.days.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧾</div>
              <div>Tidak ada transaksi</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.days.map(day => (
                <DayCard
                  key={day.date}
                  day={day}
                  expanded={!!expandedDays[day.date]}
                  onToggle={() => toggleDay(day.date)}
                  onSelectTx={setSelectedTx}
                  onPrint={handlePrint}
                  printingId={printingId}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: '13px', color: '#4A5578', fontWeight: '600' }}>{page} / {data.totalPages}</span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px' }} disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </main>

      {selectedTx && (
        <InvoiceModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          onPrint={handlePrint}
          printingId={printingId}
        />
      )}
    </div>
  )
}

function DayCard({ day, expanded, onToggle, onSelectTx, onPrint, printingId }) {
  const dateObj = new Date(day.date + 'T12:00:00')
  const dayLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header hari */}
      <div
        onClick={onToggle}
        style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', background: expanded ? '#FAFBFF' : '#fff', borderBottom: expanded ? '1px solid var(--border)' : 'none', userSelect: 'none' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', marginBottom: '2px' }}>{dayLabel}</div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>{day.count} transaksi</div>
        </div>

        {/* Breakdown metode */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {day.cash > 0 && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#059669', fontWeight: '700' }}>CASH</div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>Rp {fmt(day.cash)}</div>
            </div>
          )}
          {day.qris > 0 && (
            <div style={{ background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '700' }}>QRIS</div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#7C3AED' }}>Rp {fmt(day.qris)}</div>
            </div>
          )}
          {day.transfer > 0 && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#C2410C', fontWeight: '700' }}>TRANSFER</div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#C2410C' }}>Rp {fmt(day.transfer)}</div>
            </div>
          )}
          <div style={{ background: '#EFF4FF', border: '1px solid #C7D4F0', borderRadius: '8px', padding: '4px 12px', textAlign: 'center', minWidth: '90px' }}>
            <div style={{ fontSize: '10px', color: '#2563EB', fontWeight: '700' }}>TOTAL</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB' }}>Rp {fmt(day.totalRevenue)}</div>
          </div>
        </div>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Tabel transaksi */}
      {expanded && (
        <table className="table">
          <thead>
            <tr>
              {['Invoice', 'Waktu', 'Kasir', 'Pelanggan', 'Item', 'Metode', 'Total', ''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {day.transactions.map(tx => {
              const mc = methodColor[tx.payMethod] || { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
              return (
                <tr key={tx.id} style={{ cursor: 'pointer' }} onClick={() => onSelectTx(tx)}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8' }}>{tx.invoiceNo}</td>
                  <td style={{ fontSize: '12px', color: '#64748B' }}>{fmtTime(tx.createdAt)}</td>
                  <td style={{ fontWeight: '600', fontSize: '13px' }}>{tx.cashier.name}</td>
                  <td style={{ fontSize: '13px', color: tx.customerName ? 'var(--text)' : '#94A3B8' }}>
                    {tx.customerName || '—'}
                  </td>
                  <td style={{ fontSize: '12px', color: '#64748B' }}>
                    {tx.items.length} item
                    <span style={{ color: '#94A3B8', marginLeft: '4px' }}>
                      ({tx.items.slice(0, 2).map(i => i.product?.name || i.name).join(', ')}{tx.items.length > 2 ? ` +${tx.items.length - 2}` : ''})
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: mc.bg, color: mc.color, border: `1px solid ${mc.border}` }}>
                      {tx.payMethod}
                    </span>
                  </td>
                  <td style={{ fontWeight: '800', color: '#2563EB', fontSize: '13px' }}>Rp {fmt(tx.total)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="btn"
                      style={{ background: '#EFF4FF', color: '#2563EB', border: '1px solid #C7D4F0', padding: '4px 10px', fontSize: '11px', opacity: printingId === tx.id ? 0.6 : 1 }}
                      disabled={printingId === tx.id}
                      onClick={() => onPrint(tx)}
                    >
                      {printingId === tx.id ? '⏳' : '🖨️'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function InvoiceModal({ tx, onClose, onPrint, printingId }) {
  const mc = methodColor[tx.payMethod] || { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
  const subtotal = tx.items.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', marginBottom: '3px' }}>
              {tx.customerName || '(Tanpa Nama)'}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{tx.invoiceNo}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              {fmtDate(tx.createdAt)} · {fmtTime(tx.createdAt)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '7px', background: mc.bg, color: mc.color, border: `1px solid ${mc.border}` }}>
              {tx.payMethod}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Kasir */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700', marginBottom: '3px' }}>KASIR</div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{tx.cashier.name}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700', marginBottom: '3px' }}>STATUS</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: tx.status === 'COMPLETED' ? '#059669' : '#EF4444' }}>
                {tx.status === 'COMPLETED' ? '✓ Lunas' : tx.status}
              </div>
            </div>
          </div>

          {/* Catatan */}
          {tx.note && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#92400E', marginBottom: '3px' }}>CATATAN</div>
              <div style={{ fontSize: '13px', color: '#78350F' }}>{tx.note}</div>
            </div>
          )}

          {/* Items */}
          <div style={{ marginBottom: '14px' }}>
            <div className="section-label">Item Pesanan</div>
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {tx.items.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < tx.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      {item.product?.name || item.name || 'Item Manual'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                      {item.qty} × Rp {fmt(item.price)}
                      {item.category && <span style={{ marginLeft: '6px', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{item.category}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Rp {fmt(item.subtotal)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ringkasan pembayaran */}
          <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
            {subtotal !== tx.total && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
                <span>Subtotal</span>
                <span>Rp {fmt(subtotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tx.payment > 0 ? '8px' : '0' }}>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#2563EB' }}>Rp {fmt(tx.total)}</span>
            </div>
            {tx.payment > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                  <span>Bayar ({tx.payMethod})</span>
                  <span>Rp {fmt(tx.payment)}</span>
                </div>
                {tx.change > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                    <span>Kembalian</span>
                    <span>Rp {fmt(tx.change)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Tutup</button>
          <button
            onClick={() => onPrint(tx)}
            disabled={printingId === tx.id}
            style={{ flex: 1, padding: '10px', borderRadius: '9px', border: '1px solid #C7D4F0', background: '#EFF4FF', color: '#2563EB', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', opacity: printingId === tx.id ? 0.6 : 1 }}
          >
            {printingId === tx.id ? '⏳ Mencetak...' : '🖨️ Print Struk'}
          </button>
        </div>
      </div>
    </div>
  )
}

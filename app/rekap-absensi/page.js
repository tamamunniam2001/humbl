'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmt = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

export default function RekapAbsensiPage() {
  const [data, setData] = useState({ records: [], total: 0, totalPages: 1 })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page })
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      const res = await api.get(`/admin/attendance?${params}`)
      setData(res.data)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page])

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Rekap Absensi</div>
            <div className="topbar-sub">{data.total} total catatan absensi</div>
          </div>
        </div>

        <div className="content">
          {/* Filter */}
          <div className="card" style={{ padding: '18px 24px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="label">Dari Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setPage(1); load() }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Filter
            </button>
            {(from || to) && <button className="btn btn-ghost" onClick={() => { setFrom(''); setTo(''); setPage(1); setTimeout(load, 0) }}>Reset</button>}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  {['Tanggal', 'Waktu', 'Staff', 'Shift', 'Kas Awal Laci', 'Selfie', 'Checklist', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</td></tr>
                ) : data.records.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                    <div>Belum ada data absensi</div>
                  </td></tr>
                ) : data.records.map(r => {
                  const checklist = r.checklist || []
                  const done = checklist.filter(c => c.checked).length
                  const total = checklist.length
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: '600' }}>{fmtDate(r.date)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{fmtTime(r.date)}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text)' }}>{r.employee?.name || '-'}</td>
                      <td>
                        <span className="badge badge-orange">{r.type.replace('CLOSING_', 'Shift ')}</span>
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--green)' }}>{fmt(r.kasAwal)}</td>
                      <td>
                        {r.selfieUrl ? (
                          <img src={r.selfieUrl} alt="selfie" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)', cursor: 'pointer' }}
                            onClick={() => setSelected(r)} />
                        ) : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>-</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{done}/{total}</span>
                        </div>
                      </td>
                      <td>
                        <button className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => setSelected(r)}>Detail</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {data.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border)', background: '#FAFBFF' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{data.records.length} dari {data.total} catatan</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }} disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
                  <span style={{ fontSize: '13px', fontWeight: '600', padding: '0 8px' }}>{page} / {data.totalPages}</span>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }} disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selected && <DetailModal record={selected} onClose={() => setSelected(null)} fmt={fmt} fmtDate={fmtDate} fmtTime={fmtTime} />}
      </main>
    </div>
  )
}

function DetailModal({ record: r, onClose, fmt, fmtDate, fmtTime }) {
  const checklist = r.checklist || []
  const done = checklist.filter(c => c.checked).length
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '480px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{r.employee?.name} — {r.type.replace('CLOSING_', 'Shift ')}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{fmtDate(r.date)} · {fmtTime(r.date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: 'var(--text2)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {r.selfieUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px 0' }}>
            <img src={r.selfieUrl} alt="selfie"
              style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%', border: '3px solid var(--accent)', boxShadow: '0 4px 16px rgba(37,99,235,0.2)' }} />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: 'var(--orange-light)', borderRadius: '10px', padding: '12px', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>SHIFT</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--orange)' }}>{r.type.replace('CLOSING_', 'Shift ')}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--green-light)', borderRadius: '10px', padding: '12px', border: '1px solid #A7DFC8' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>KAS AWAL LACI</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)' }}>{fmt(r.kasAwal)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>CHECKLIST</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: done === checklist.length && checklist.length > 0 ? 'var(--green)' : 'var(--text)' }}>{done}/{checklist.length}</div>
            </div>
          </div>

          <div>
            <div className="section-label">Checklist SOP</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {checklist.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Tidak ada checklist</div>
              ) : checklist.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: i < checklist.length - 1 ? '1px solid var(--border)' : 'none', background: item.checked ? 'var(--accent-light)' : 'transparent' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: item.checked ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ fontSize: '13px', color: item.checked ? 'var(--accent)' : 'var(--text2)', fontWeight: item.checked ? '600' : '400' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const formatDuration = (start, end) => {
  if (!start || !end) return '-'
  const totalSeconds = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function RekapAbsensiPage() {
  const [data, setData] = useState({ records: [], total: 0, totalPages: 1 })
  const [employees, setEmployees] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const isAdmin = (() => { try { return JSON.parse(Cookies.get('user') || '{}').role === 'ADMIN' } catch { return false } })()

  useEffect(() => {
    api.get('/admin/employees').then(r => setEmployees(r.data.filter(e => e.isActive))).catch(() => {})
  }, [])

  async function load(p = page) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p })
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      if (employeeId) params.append('employeeId', employeeId)
      const res = await api.get(`/admin/attendance?${params}`)
      setData(res.data)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page])

  function handleFilter() { setPage(1); load(1) }
  function handleReset() { setFrom(''); setTo(''); setEmployeeId(''); setPage(1); setTimeout(() => load(1), 0) }

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
              <label className="label">Nama Staff</label>
              <select className="input" style={{ width: 'auto', minWidth: '160px' }} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                <option value="">Semua Staff</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dari Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleFilter}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Filter
            </button>
            {(from || to || employeeId) && <button className="btn btn-ghost" onClick={handleReset}>Reset</button>}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  {['Tanggal', 'Waktu', 'Staff', 'Shift', 'Status', 'Durasi', 'Selfie', 'Checklist', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</td></tr>
                ) : data.records.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
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
                      <td>
                        <span className="badge" style={{ background: r.isActive ? 'var(--green-light)' : 'var(--surface2)', color: r.isActive ? 'var(--green)' : 'var(--muted)', border: `1px solid ${r.isActive ? '#A7DFC8' : 'var(--border)'}` }}>
                          {r.isActive ? 'Aktif' : 'Selesai'}
                        </span>
                      </td>
                      <td style={{ color: r.isActive ? 'var(--green)' : 'var(--text2)', fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                        {r.clockOut ? formatDuration(r.date, r.clockOut) : r.isActive ? 'Berjalan...' : '-'}
                      </td>
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

        {selected && (
          <DetailModal
            record={selected}
            employees={employees}
            isAdmin={isAdmin}
            onClose={() => setSelected(null)}
            onDeleted={() => { setSelected(null); load() }}
            onUpdated={(updated) => { setSelected(updated); load() }}
            fmtDate={fmtDate} fmtTime={fmtTime}
          />
        )}
      </main>
    </div>
  )
}

function DetailModal({ record: r, employees, isAdmin, onClose, onDeleted, onUpdated, fmtDate, fmtTime }) {
  const checklist = r.checklist || []
  const done = checklist.filter(c => c.checked).length
  const [photos, setPhotos] = useState([])
  const [photoLoading, setPhotoLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ employeeId: r.employeeId, type: r.type })

  useEffect(() => {
    setPhotoLoading(true)
    api.get(`/admin/attendance?employeeId=${r.employeeId}&page=1`)
      .then(res => setPhotos(res.data.records.filter(x => x.selfieUrl)))
      .catch(() => {})
      .finally(() => setPhotoLoading(false))
  }, [r.employeeId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.patch(`/admin/attendance/${r.id}`, {
        employeeId: form.employeeId,
        type: form.type,
        checklist: r.checklist,
      })
      setEditing(false)
      onUpdated({ ...r, ...res.data })
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`Hapus data absensi ${r.employee?.name} — ${r.type.replace('CLOSING_', 'Shift ')} pada ${fmtDate(r.date)}?`)) return
    setDeleting(true)
    try {
      await api.delete(`/admin/attendance/${r.id}`)
      onDeleted()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menghapus')
      setDeleting(false)
    }
  }

  const SHIFT_OPTS = [
    { value: 'CLOSING_1', label: 'Shift 1 (07.00–13.00)' },
    { value: 'CLOSING_2', label: 'Shift 2 (13.00–18.00)' },
    { value: 'CLOSING_3', label: 'Shift 3 (18.00–23.00)' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '560px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{r.employee?.name} — {r.type.replace('CLOSING_', 'Shift ')}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{fmtDate(r.date)} · {fmtTime(r.date)}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isAdmin && !editing && (
              <>
                <button onClick={() => setEditing(true)}
                  style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: 'var(--accent)', padding: '5px 10px', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', color: '#EF4444', padding: '5px 10px', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  {deleting ? '...' : 'Hapus'}
                </button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: 'var(--text2)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Form Edit */}
          {editing ? (
            <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '16px', border: '1.5px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.5px' }}>✏️ MODE EDIT</div>
              <div>
                <label className="label">Nama Staff</label>
                <select className="input" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Shift</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {SHIFT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditing(false); setForm({ employeeId: r.employeeId, type: r.type }) }}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Selfie */}
              {r.selfieUrl && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={r.selfieUrl} alt="selfie" onClick={() => setLightbox(r.selfieUrl)}
                    style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '50%', border: '3px solid var(--accent)', boxShadow: '0 4px 16px rgba(37,99,235,0.2)', cursor: 'pointer' }} />
                </div>
              )}

              {/* Info cards */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, background: 'var(--orange-light)', borderRadius: '10px', padding: '12px', border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>SHIFT</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--orange)' }}>{r.type.replace('CLOSING_', 'Shift ')}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>STATUS</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: r.isActive ? 'var(--green)' : 'var(--muted)' }}>{r.isActive ? 'Aktif' : 'Selesai'}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--green-light)', borderRadius: '10px', padding: '12px', border: '1px solid #A7DFC8' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>DURASI</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{r.clockOut ? formatDuration(r.date, r.clockOut) : r.isActive ? 'Berjalan...' : '-'}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>CHECKLIST</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: done === checklist.length && checklist.length > 0 ? 'var(--green)' : 'var(--text)' }}>{done}/{checklist.length}</div>
                </div>
              </div>
            </>
          )}

          {/* Checklist SOP */}
          {!editing && (
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
          )}

          {/* Riwayat Foto */}
          {!editing && (
            <div>
              <div className="section-label">Riwayat Foto — {r.employee?.name}</div>
              {photoLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Memuat foto...</div>
              ) : photos.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>Belum ada foto selfie</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                  {photos.map(p => (
                    <div key={p.id} onClick={() => setLightbox(p.selfieUrl)}
                      style={{ cursor: 'pointer', borderRadius: '10px', overflow: 'hidden', border: p.id === r.id ? '2px solid var(--accent)' : '2px solid var(--border)', position: 'relative' }}>
                      <img src={p.selfieUrl} alt="selfie" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '3px 5px' }}>
                        <div style={{ fontSize: '9px', color: '#fff', fontWeight: '600', lineHeight: 1.3 }}>{fmtDate(p.date)}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.75)' }}>{p.type.replace('CLOSING_', 'S')}</div>
                      </div>
                      {p.id === r.id && (
                        <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', borderRadius: '4px', padding: '1px 5px', fontSize: '8px', color: '#fff', fontWeight: '700' }}>INI</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="selfie" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

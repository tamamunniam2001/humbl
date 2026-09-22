'use client'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

// Section status permintaan bahan baku — urutannya mengikuti alur pemrosesan
const STATUSES = [
  { key: 'BELUM_DIBELI', label: 'Belum Dibeli', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', empty: 'Tidak ada permintaan baru' },
  { key: 'DIPESAN', label: 'Dipesan', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', empty: 'Belum ada item yang dipesan' },
  { key: 'SELESAI', label: 'Selesai', color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', empty: 'Belum ada item yang selesai' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))

// Target perpindahan antar section (tombol di samping tiap item)
const MOVE_TARGETS = {
  BELUM_DIBELI: ['DIPESAN'],
  DIPESAN: ['SELESAI', 'BELUM_DIBELI'],
  SELESAI: ['DIPESAN'],
}

const fmt = n => {
  const num = Number(n)
  if (isNaN(num)) return '0'
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}
const fmtDate = d => d
  ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  : '-'

// Tampilkan qty dalam satuan opname (mis. 1 galon, bukan 19000 ml)
// Konversi: 1 satuanOpname = konversi satuan dasar → qty dasar ÷ konversi
function getOpnameQty(item) {
  const qty = Number(item.qty) || 0
  const konversi = Number(item.konversi) || 0
  if (item.satuanOpname && konversi > 0) {
    return { value: qty / konversi, unit: item.satuanOpname }
  }
  return { value: qty, unit: item.satuan }
}

export default function PantauBahanPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState(null)
  const [search, setSearch] = useState('')
  // Dropdown per section — di mobile semua tertutup agar halaman ringkas
  const [openSections, setOpenSections] = useState({ BELUM_DIBELI: true, DIPESAN: true, SELESAI: true })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/material-requests')
      setItems(res.data || [])
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal memuat data permintaan bahan baku')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Mobile: tutup semua section (dropdown) supaya tidak panjang saat di-scroll
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setOpenSections({ BELUM_DIBELI: false, DIPESAN: false, SELESAI: false })
    }
  }, [])

  const toggleSection = key => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  async function moveItem(item, status) {
    setMovingId(item.id)
    try {
      await api.patch('/admin/material-requests', { id: item.id, status })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status } : i))
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal memindahkan item')
    } finally { setMovingId(null) }
  }

  const q = search.trim().toLowerCase()
  const visible = q
    ? items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q))
    : items

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '60px' }}>
        <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px', height: 'auto', minHeight: '60px' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div className="topbar-title">Pantau Bahan Baku</div>
            <div className="topbar-sub">{items.length} bahan direquest dari stock opname</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" placeholder="Cari bahan..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: '1 1 150px', minWidth: 0, maxWidth: '220px', height: '38px' }} />
            <button className="btn btn-ghost" onClick={load} disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="15"/></svg>
              {loading ? 'Memuat...' : 'Muat Ulang'}
            </button>
          </div>
        </div>

        <div className="content">
          {/* Ringkasan jumlah per status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {STATUSES.map(s => (
              <div key={s.key} className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${s.color}` }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: s.color, marginTop: '2px' }}>
                  {items.filter(i => i.status === s.key).length}
                </div>
              </div>
            ))}
          </div>

          {/* Tiga section status — dropdown per section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {STATUSES.map(s => {
              const list = visible.filter(i => i.status === s.key)
              // Header section berfungsi sebagai dropdown: klik untuk buka/tutup;
              // saat pencarian, section yang berisi hasil dipaksa terbuka
              const isOpen = openSections[s.key] || (!!q && list.length > 0)
              return (
                <div key={s.key} className="card" style={{ overflow: 'hidden' }}>
                  {/* Header section — toggle dropdown */}
                  <button type="button" onClick={() => toggleSection(s.key)} aria-expanded={isOpen}
                    style={{
                      width: '100%', minHeight: '46px', padding: '12px 16px', border: 'none',
                      borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '8px', background: s.bg,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                    }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: s.color }}>{s.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', color: s.color, background: 'var(--surface)', border: `1px solid ${s.border}`, padding: '1px 8px', borderRadius: '20px' }}>{list.length}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Daftar item — dropdown: disembunyikan saat section ditutup */}
                  <div style={{ padding: '10px', display: isOpen ? 'flex' : 'none', flexDirection: 'column', gap: '8px', minHeight: '90px' }}>
                    {list.length === 0 ? (
                      <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                        {loading ? 'Memuat...' : (q ? 'Tidak ada item cocok' : s.empty)}
                      </div>
                    ) : list.map(item => (
                      <div key={item.id} className="pantau-item" style={{ border: '1px solid var(--border)', borderRadius: '11px', padding: '10px 12px', background: 'var(--surface2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        {/* Info item */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', wordBreak: 'break-word' }}>{item.name}</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '5px' }}>
                            {item.category && <span className="badge badge-blue" style={{ fontSize: '10px' }}>{item.category}</span>}
                            {/* Stok dalam satuan opname (mis. 1 galon, bukan 19000 ml) */}
                            <span className="badge badge-gray" style={{ fontSize: '10px' }}>{fmt(getOpnameQty(item).value)} {getOpnameQty(item).unit}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>Opname {fmtDate(item.opnameDate)}</div>
                          {item.note && (
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontStyle: 'italic' }}>📝 {item.note}</div>
                          )}
                        </div>

                        {/* Tombol pindah section (di samping item) */}
                        <div className="pantau-item-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          {(MOVE_TARGETS[s.key] || []).map(target => {
                            const t = STATUS_MAP[target]
                            const back = target === 'BELUM_DIBELI' || s.key === 'SELESAI'
                            return (
                              <button key={target} onClick={() => moveItem(item, target)} disabled={movingId === item.id}
                                title={`Pindahkan ke "${t.label}"`}
                                style={{
                                  padding: '7px 10px', borderRadius: '9px', cursor: movingId === item.id ? 'wait' : 'pointer', fontFamily: 'inherit',
                                  fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
                                  border: `1.5px solid ${t.border}`, background: t.bg, color: t.color,
                                  opacity: movingId === item.id ? 0.5 : 1,
                                }}>
                                {back ? `← ${t.label}` : `${t.label} →`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

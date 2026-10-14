'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import Cookies from 'js-cookie'
import api from '@/lib/api'

const fmt = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (d) => new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function MembersPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | inactive
  const [detail, setDetail] = useState(null) // { member, transactions, totalSpent }
  const [detailLoading, setDetailLoading] = useState(false)

  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/members')
      setMembers(res.data)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function openDetail(m) {
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await api.get(`/members/${m.id}/transactions`)
      setDetail(res.data)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memuat pembelian member')
    } finally { setDetailLoading(false) }
  }

  const q = search.trim().toLowerCase()
  const filtered = members
    .filter(m => statusFilter === 'all' || (statusFilter === 'active' ? m.isActive : !m.isActive))
    .filter(m => !q || m.name.toLowerCase().includes(q) || m.phone.includes(search.trim()))

  const activeCount = members.filter(m => m.isActive).length
  const totalPurchase = members.reduce((s, m) => s + (m.purchaseCount || 0), 0)
  const totalSpent = members.reduce((s, m) => s + (m.totalSpent || 0), 0)
  const memberCount = filtered.length


  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        {/* Topbar */}
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Daftar Member</div>
            <div className="topbar-sub">Monitor member aktif beserta riwayat pembeliannya</div>
          </div>
          {isAdmin && (
            <Link href="/member-settings" className="btn" style={{ textDecoration: 'none' }}>
              ⚙️ Kelola Member
            </Link>
          )}
        </div>

        <div className="content">
          {/* Statistik */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Total Member', value: members.length, color: '#4A7CC7', bg: '#EBF1FB', border: '#C0D0E8' },
              { label: 'Member Aktif', value: activeCount, color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
              { label: 'Total Pembelian', value: loading ? '…' : `${totalPurchase}×`, color: '#7C3AED', bg: '#F3EEFF', border: '#DDD0FB' },
              { label: 'Total Belanja', value: loading ? '…' : fmt(totalSpent), color: '#B4770B', bg: '#FDF4E3', border: '#EBD9A8' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{loading && s.value === undefined ? '…' : s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter + pencarian */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[['all', 'Semua'], ['active', 'Aktif'], ['inactive', 'Nonaktif']].map(([v, label]) => (
                <button key={v} className="btn" onClick={() => setStatusFilter(v)}
                  style={{
                    padding: '5px 12px', fontSize: '12px',
                    background: statusFilter === v ? '#4A7CC7' : 'var(--surface2)',
                    color: statusFilter === v ? '#fff' : 'var(--text2)',
                    border: `1px solid ${statusFilter === v ? '#4A7CC7' : 'var(--border)'}`,
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <input className="input" style={{ maxWidth: '300px' }} placeholder="Cari nama atau nomor telepon…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{memberCount} member</span>
          </div>

          {/* Tabel member */}
          {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '44px', marginBottom: '10px' }}>👥</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                {members.length === 0 ? 'Belum ada member' : 'Tidak ditemukan'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                {members.length === 0 ? 'Daftarkan member melalui menu Pengaturan Member' : 'Coba kata kunci atau filter lain'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                      {['Nama', 'Nomor Telepon', 'Status', 'Pembelian', 'Total Belanja', 'Terakhir Beli', ''].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: i >= 3 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text)' }}>{m.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text2)' }}>{m.phone}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${m.isActive ? 'badge-green' : 'badge-gray'}`}>
                            {m.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{m.purchaseCount}×</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#2A9D6E' }}>{fmt(m.totalSpent)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)', fontSize: '12px' }}>
                          {m.lastPurchase ? fmtDate(m.lastPurchase) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '11px' }} onClick={() => openDetail(m)}>
                            Lihat Pembelian
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal detail pembelian member */}
          {(detailLoading || detail) && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px' }}
              onClick={(e) => { if (e.target === e.currentTarget && !detailLoading) setDetail(null) }}>
              <div className="card fade-in" style={{ width: '640px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!detail ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat pembelian…</div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>{detail.member.name}</span>
                          <span className={`badge ${detail.member.isActive ? 'badge-green' : 'badge-gray'}`}>
                            {detail.member.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'monospace' }}>
                          {detail.member.phone} · terdaftar {fmtDate(detail.member.createdAt)}
                        </div>
                      </div>
                      <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--muted)', lineHeight: 1 }}>×</button>
                    </div>

                    {/* Ringkasan */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ background: '#F3EEFF', border: '1px solid #DDD0FB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Jumlah Pembelian</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED' }}>{detail.transactions.length}×</div>
                      </div>
                      <div style={{ background: '#E8F7F1', border: '1px solid #A7DFC8', borderRadius: '10px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Total Belanja</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#2A9D6E' }}>{fmt(detail.totalSpent)}</div>
                      </div>
                    </div>

                    {/* Riwayat pembelian */}
                    <div style={{ overflowY: 'auto', padding: '14px 20px' }}>
                      {detail.transactions.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                          Belum ada pembelian tercatat
                        </div>
                      ) : detail.transactions.map(t => (
                        <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', background: 'var(--surface2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', fontFamily: 'monospace' }}>{t.invoiceNo}</span>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{fmtDateTime(t.createdAt)}</span>
                          </div>
                          <div style={{ margin: '6px 0', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>
                            {t.items.map((it, idx) => (
                              <div key={idx}>• {it.name || 'Item'} ×{it.qty} — {fmt(it.subtotal)}</div>
                            ))}
                          </div>
                          {/* Potongan (bila ada) */}
                          {(t.discountAmount > 0 || t.voucherDiscount > 0 || t.taxAmount > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '11px', padding: '5px 0', borderTop: '1px dashed var(--border)' }}>
                              {t.discountAmount > 0 && <span style={{ color: '#C95555' }}>Diskon -{fmt(t.discountAmount)}</span>}
                              {t.voucherDiscount > 0 && <span style={{ color: '#7C3AED' }}>Voucher{t.voucherCode ? ` (${t.voucherCode})` : ''} -{fmt(t.voucherDiscount)}</span>}
                              {t.taxAmount > 0 && <span style={{ color: '#B4770B' }}>Pajak +{fmt(t.taxAmount)}</span>}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {t.payMethod}{t.cashier?.name ? ` · ${t.cashier.name}` : ''}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>{fmt(t.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

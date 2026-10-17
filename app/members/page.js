'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import { renderTemplate, templateNeedsVoucher, isVoucherAvailable, voucherDetailText } from '@/lib/wa-templates'

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

  // Kirim pesan WhatsApp (admin) — popup pilih template dari Pengaturan Pesan WhatsApp
  const [waMember, setWaMember] = useState(null)   // member tujuan (null = popup tertutup)
  const [waTemplates, setWaTemplates] = useState([])
  const [waTemplateId, setWaTemplateId] = useState('')
  const [waVouchers, setWaVouchers] = useState(null) // null = belum dimuat (lazy)
  const [waVoucherId, setWaVoucherId] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waSending, setWaSending] = useState(false)
  const [waError, setWaError] = useState('')
  const [waDone, setWaDone] = useState(null)         // hasil kirim terakhir

  // Broadcast
  const [bcOpen, setBcOpen] = useState(false)
  const [bcTemplates, setBcTemplates] = useState([])
  const [bcTemplateId, setBcTemplateId] = useState('')
  const [bcVouchers, setBcVouchers] = useState(null)
  const [bcVoucherId, setBcVoucherId] = useState('')
  const [bcLoading, setBcLoading] = useState(false)
  const [bcSending, setBcSending] = useState(false)
  const [bcError, setBcError] = useState('')
  const [bcDone, setBcDone] = useState(null)

  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'
  const canSendMsg = isAdmin || (Array.isArray(user.allowedPaths) && user.allowedPaths.includes('/members'))

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

  // ── Kirim pesan WhatsApp (admin) ──
  function closeWa() {
    setWaMember(null)
    setWaError('')
    setWaDone(null)
  }

  // Muat voucher tersedia (sekali saja) bila template membutuhkan kode voucher.
  async function waLoadVouchers() {
    if (waVouchers) return
    setWaLoading(true)
    try {
      const res = await api.get('/admin/vouchers')
      setWaVouchers(res.data)
    } catch (err) {
      setWaError(err.response?.data?.message || 'Gagal memuat daftar voucher')
    } finally { setWaLoading(false) }
  }

  async function waPickTemplate(t) {
    if (!t) { setWaTemplateId(''); return }
    setWaTemplateId(t.id)
    setWaVoucherId('')
    setWaError('')
    if (templateNeedsVoucher(t)) await waLoadVouchers()
  }

  async function openWa(m) {
    setWaMember(m)
    setWaTemplates([])
    setWaTemplateId('')
    setWaVouchers(null)
    setWaVoucherId('')
    setWaError('')
    setWaDone(null)
    setWaLoading(true)
    try {
      const res = await api.get('/admin/message-templates', { params: { active: '1' } })
      setWaTemplates(res.data)
      // Cuma ada satu template aktif → langsung pilih (sekalian muat voucher bila perlu)
      if (res.data.length === 1) await waPickTemplate(res.data[0])
    } catch (err) {
      setWaError(err.response?.data?.message || 'Gagal memuat template pesan')
    } finally { setWaLoading(false) }
  }

  async function waSend() {
    setWaError('')
    const t = waTemplates.find(x => x.id === waTemplateId)
    if (!t) { setWaError('Pilih template pesan terlebih dahulu'); return }
    if (templateNeedsVoucher(t) && !waVoucherId) { setWaError('Pilih kode voucher terlebih dahulu'); return }
    setWaSending(true)
    try {
      const res = await api.post(`/members/${waMember.id}/send-message`, {
        templateId: t.id,
        ...(waVoucherId ? { voucherId: waVoucherId } : {}),
      })
      setWaDone(res.data)
    } catch (err) {
      setWaError(err.response?.data?.message || 'Gagal mengirim pesan')
    } finally { setWaSending(false) }
  }

  // ── Broadcast ──
  async function openBroadcast() {
    setBcOpen(true)
    setBcTemplateId('')
    setBcVouchers(null)
    setBcVoucherId('')
    setBcError('')
    setBcDone(null)
    setBcLoading(true)
    try {
      const res = await api.get('/admin/message-templates', { params: { active: '1' } })
      setBcTemplates(res.data)
      if (res.data.length === 1) setBcTemplateId(res.data[0].id)
    } catch (err) {
      setBcError(err.response?.data?.message || 'Gagal memuat template')
    } finally { setBcLoading(false) }
  }

  async function bcPickTemplate(id) {
    setBcTemplateId(id)
    setBcVoucherId('')
    setBcError('')
    const t = bcTemplates.find(x => x.id === id)
    if (t && templateNeedsVoucher(t) && !bcVouchers) {
      setBcLoading(true)
      try {
        const res = await api.get('/admin/vouchers')
        setBcVouchers(res.data)
      } catch { } finally { setBcLoading(false) }
    }
  }

  async function bcSend() {
    const t = bcTemplates.find(x => x.id === bcTemplateId)
    if (!t) { setBcError('Pilih template pesan terlebih dahulu'); return }
    if (templateNeedsVoucher(t) && !bcVoucherId) { setBcError('Pilih kode voucher terlebih dahulu'); return }
    const activeCount = members.filter(m => m.isActive).length
    if (!confirm(`Kirim pesan "${t.name}" ke ${activeCount} member aktif? Proses ini tidak bisa dibatalkan.`)) return
    setBcSending(true)
    setBcError('')
    try {
      const res = await api.post('/members/broadcast', {
        templateId: t.id,
        ...(bcVoucherId ? { voucherId: bcVoucherId } : {}),
      })
      setBcDone(res.data)
    } catch (err) {
      setBcError(err.response?.data?.message || 'Gagal mengirim broadcast')
    } finally { setBcSending(false) }
  }

  // Turunan untuk popup kirim (preview, voucher tersedia, dsb.)
  const waTemplate = waTemplates.find(t => t.id === waTemplateId) || null
  const waVoucher = waVouchers ? waVouchers.find(v => v.id === waVoucherId) || null : null
  const waNeedsVoucher = templateNeedsVoucher(waTemplate)
  const waAvailableVouchers = (waVouchers || []).filter(v => isVoucherAvailable(v))
  const waPreview = waTemplate && waMember && (!waNeedsVoucher || waVoucher)
    ? renderTemplate(waTemplate.body, { memberName: waMember.name, voucher: waVoucher })
    : ''

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
          {canSendMsg && (
            <button className="btn btn-primary" onClick={openBroadcast}>
              📣 Broadcast
            </button>
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
                      {['Nama', 'Nomor Telepon', 'Status', 'Pesan Welcome', 'Pembelian', 'Total Belanja', 'Terakhir Beli', ''].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: i >= 4 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
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
                        <td style={{ padding: '10px 14px' }}>
                          {m.welcomeSentAt ? (
                            <span title={`Terkirim ${fmtDateTime(m.welcomeSentAt)}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#0EA472', background: '#ECFDF5', border: '1px solid #A7DFC8', borderRadius: '20px', padding: '2px 8px' }}>
                              ✅ Terkirim
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{m.purchaseCount}×</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#2A9D6E' }}>{fmt(m.totalSpent)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)', fontSize: '12px' }}>
                          {m.lastPurchase ? fmtDate(m.lastPurchase) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {canSendMsg && (
                              <button className="btn" style={{ padding: '4px 12px', fontSize: '11px', background: '#ECFDF5', color: '#0EA472', border: '1px solid #A7DFC8' }}
                                onClick={() => openWa(m)}>
                                ✈️ Kirim Pesan
                              </button>
                            )}
                            <button className="btn" style={{ padding: '4px 12px', fontSize: '11px' }} onClick={() => openDetail(m)}>
                              Lihat Pembelian
                            </button>
                          </div>
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

          {/* ── Modal kirim pesan WhatsApp (admin) ── */}
          {waMember && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: '16px' }}
              onClick={(e) => { if (e.target === e.currentTarget && !waSending) closeWa() }}>
              <div className="card fade-in" style={{ width: '560px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Kirim Pesan WhatsApp</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '3px' }}>
                      👤 {waMember.name} · <span style={{ fontFamily: 'monospace' }}>{waMember.phone}</span>
                    </div>
                  </div>
                  <button onClick={() => !waSending && closeWa()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--muted)', lineHeight: 1 }}>
                    ×
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
                  {waDone ? (
                    <div style={{ textAlign: 'center', padding: '6px 0' }}>
                      <div style={{ fontSize: '40px', marginBottom: '6px' }}>✅</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                        {waDone.dryRun ? 'Pesan terkirim (mode uji)' : 'Pesan terkirim!'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                        Ke <span style={{ fontFamily: 'monospace' }}>{waDone.target}</span> · {waDone.template}
                      </div>
                      <pre style={{ margin: '12px 0', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--text2)', textAlign: 'left', whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto' }}>{waDone.message}</pre>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => setWaDone(null)}>
                          Kirim Lagi
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={closeWa}>
                          Selesai
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {waError && (
                        <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                          {waError}
                        </div>
                      )}

                      {waLoading && waTemplates.length === 0 ? (
                        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)' }}>Memuat…</div>
                      ) : waTemplates.length === 0 ? (
                        <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                          Belum ada template pesan aktif.<br />
                          Atur dulu di <Link href="/wa-message-settings" style={{ color: 'var(--accent)', fontWeight: 700 }}>Pengaturan Pesan WhatsApp</Link>
                        </div>
                      ) : (
                        <>
                          {/* Pilih template */}
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '5px' }}>Template Pesan *</label>
                            <select className="input" value={waTemplateId}
                              onChange={e => waPickTemplate(waTemplates.find(x => x.id === e.target.value))}>
                              <option value="">— Pilih template pesan —</option>
                              {waTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}{t.inputType === 'VOUCHER_CODE' ? ' 🎫' : ''}</option>
                              ))}
                            </select>
                          </div>
                          {/* Pilih kode voucher (bila template membutuhkan) */}
                          {waNeedsVoucher && (
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '5px' }}>Kode Voucher *</label>
                              {waVouchers === null ? (
                                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Memuat daftar voucher…</div>
                              ) : waAvailableVouchers.length === 0 ? (
                                <div style={{ fontSize: '12.5px', color: '#B4770B' }}>
                                  Tidak ada voucher tersedia. Buat atau aktifkan dulu di menu Voucher &amp; Promo.
                                </div>
                              ) : (
                                <select className="input" value={waVoucherId}
                                  onChange={e => { setWaVoucherId(e.target.value); setWaError('') }}>
                                  <option value="">— Pilih kode voucher —</option>
                                  {waAvailableVouchers.map(v => (
                                    <option key={v.id} value={v.id}>
                                      {v.code} — {voucherDetailText(v)}{v.quota > 0 ? ` · sisa ${v.quota - v.usedCount}` : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Preview pesan yang akan terkirim */}
                      {waPreview && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '5px' }}>Preview Pesan</div>
                          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                            {waPreview}
                          </div>
                        </div>
                      )}

                      {/* Aksi */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} disabled={waSending} onClick={closeWa}>
                          Batal
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }}
                          disabled={waSending || waLoading || !waTemplateId} onClick={waSend}>
                          {waSending ? 'Mengirim…' : '📤 Kirim Pesan'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ── Modal Broadcast ── */}
          {bcOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: '16px' }}
              onClick={(e) => { if (e.target === e.currentTarget && !bcSending) { setBcOpen(false) } }}>
              <div className="card fade-in" style={{ width: '520px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>📣 Broadcast Pesan</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Kirim ke semua {members.filter(m => m.isActive).length} member aktif</div>
                  </div>
                  <button onClick={() => !bcSending && setBcOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--muted)', lineHeight: 1 }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
                  {bcDone ? (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>Broadcast selesai!</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        {[['Terkirim', bcDone.sent, '#2A9D6E', '#E8F7F1', '#A7DFC8'],
                          ['Gagal', bcDone.failed, '#C95555', '#FEF2F2', '#FECACA'],
                          ['Dilewati', bcDone.skipped, '#64748B', '#F1F5F9', '#D8E0EA']
                        ].map(([label, val, color, bg, border]) => (
                          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>{label}</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>Total {bcDone.total} member aktif diproses</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setBcDone(null)}>Kirim Lagi</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setBcOpen(false)}>Selesai</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {bcError && (
                        <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                          {bcError}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: 'var(--text2)', marginBottom: '14px', lineHeight: 1.6 }}>
                        ⚠️ Pesan akan dikirim satu per satu ke semua member aktif. Proses mungkin memakan waktu beberapa menit tergantung jumlah member.
                      </div>

                      {/* Pilih template */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '5px' }}>Template Pesan *</label>
                        {bcLoading && bcTemplates.length === 0 ? (
                          <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Memuat…</div>
                        ) : bcTemplates.length === 0 ? (
                          <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Belum ada template aktif. Atur di <Link href="/wa-message-settings" style={{ color: 'var(--accent)', fontWeight: 700 }}>Pengaturan Pesan WhatsApp</Link></div>
                        ) : (
                          <select className="input" value={bcTemplateId} onChange={e => bcPickTemplate(e.target.value)}>
                            <option value="">— Pilih template pesan —</option>
                            {bcTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}{t.inputType === 'VOUCHER_CODE' ? ' 🎟️' : ''}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Pilih voucher bila perlu */}
                      {bcTemplateId && templateNeedsVoucher(bcTemplates.find(t => t.id === bcTemplateId)) && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '5px' }}>Kode Voucher *</label>
                          {bcVouchers === null ? (
                            <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Memuat voucher…</div>
                          ) : (
                            <select className="input" value={bcVoucherId} onChange={e => { setBcVoucherId(e.target.value); setBcError('') }}>
                              <option value="">— Pilih kode voucher —</option>
                              {(bcVouchers || []).filter(v => isVoucherAvailable(v)).map(v => (
                                <option key={v.id} value={v.id}>{v.code} — {voucherDetailText(v)}{v.quota > 0 ? ` · sisa ${v.quota - v.usedCount}` : ''}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      {bcTemplateId && !templateNeedsVoucher(bcTemplates.find(t => t.id === bcTemplateId)) && (() => {
                        const t = bcTemplates.find(x => x.id === bcTemplateId)
                        const preview = t ? renderTemplate(t.body, { memberName: 'Nama Member' }) : ''
                        return preview ? (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '5px' }}>Preview Pesan</div>
                            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>{preview}</div>
                          </div>
                        ) : null
                      })()}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={bcSending} onClick={() => setBcOpen(false)}>Batal</button>
                        <button className="btn btn-primary" style={{ flex: 1 }}
                          disabled={bcSending || bcLoading || !bcTemplateId} onClick={bcSend}>
                          {bcSending ? '⏳ Mengirim…' : '📤 Kirim Broadcast'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

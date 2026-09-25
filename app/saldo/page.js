'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

const fmt = (n) => {
  const num = Number(n)
  if (isNaN(num)) return 'Rp 0'
  const hasDecimal = num % 1 !== 0
  return 'Rp ' + num.toLocaleString('id-ID', hasDecimal ? { minimumFractionDigits: 1, maximumFractionDigits: 2 } : {})
}

export default function SaldoPage() {
  const [saldo, setSaldo] = useState(0)
  const [ledger, setLedger] = useState([])
  const [pendingBelanja, setPendingBelanja] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('ALL') // ALL, RESTOCK, EXPENSE

  // Topup modal states
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [submittingTopup, setSubmittingTopup] = useState(false)

  // ACC/Reject modal states for Admin
  const [actionBelanja, setActionBelanja] = useState(null) // item belanja being acted on
  const [adminNote, setAdminNote] = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  // Current logged in user
  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'

  useEffect(() => {
    fetchSaldoData()
    if (isAdmin) {
      fetchPendingBelanja()
    }
  }, [isAdmin])

  async function fetchSaldoData() {
    setLoading(true)
    try {
      const res = await api.get('/operational/saldo')
      setSaldo(res.data.saldo || 0)
      setLedger(res.data.ledger || [])
    } catch (err) {
      console.error('Gagal mengambil data saldo:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPendingBelanja() {
    try {
      const res = await api.get('/operational/belanja?status=PENDING')
      setPendingBelanja(res.data || [])
    } catch (err) {
      console.error('Gagal mengambil pengajuan belanja:', err)
    }
  }

  async function handleTopupSubmit(e) {
    e.preventDefault()
    if (!isAdmin) {
      alert('Hanya Admin yang dapat mengisi saldo operasional.')
      return
    }

    const num = Number(topupAmount)
    if (isNaN(num) || num <= 0) {
      return alert('Masukkan nominal saldo yang valid')
    }

    setSubmittingTopup(true)
    try {
      const res = await api.post('/operational/saldo', {
        amount: num,
        note: topupNote || 'Pengisian Saldo Operasional oleh Admin',
      })
      alert(`Berhasil menambah saldo Rp ${num.toLocaleString('id-ID')}!`)
      setTopupOpen(false)
      setTopupAmount('')
      setTopupNote('')
      setSaldo(res.data.saldo)
      fetchSaldoData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambah saldo')
    } finally {
      setSubmittingTopup(false)
    }
  }

  async function handleApproveReject(id, newStatus) {
    setProcessingAction(true)
    try {
      await api.patch(`/operational/belanja/${id}`, {
        status: newStatus,
        adminNote: adminNote || null,
      })
      alert(newStatus === 'APPROVED' ? 'Pengajuan belanja berhasil di-ACC!' : 'Pengajuan belanja telah ditolak.')
      setActionBelanja(null)
      setAdminNote('')
      fetchSaldoData()
      fetchPendingBelanja()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memproses pengajuan belanja')
    } finally {
      setProcessingAction(false)
    }
  }

  const filteredLedger = ledger.filter(item => {
    if (filterType === 'RESTOCK') return item.type === 'RESTOCK'
    if (filterType === 'EXPENSE') return item.type === 'EXPENSE'
    return true
  })

  const totalRestock = ledger.filter(l => l.type === 'RESTOCK').reduce((acc, l) => acc + l.amount, 0)
  const totalExpense = ledger.filter(l => l.type === 'EXPENSE').reduce((acc, l) => acc + l.amount, 0)

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>

        {/* Topbar */}
        <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="topbar-title">Saldo Operasional</div>
            <div className="topbar-sub">Pantau saldo, pengisian, dan riwayat belanja operasional</div>
          </div>
          <div>
            {isAdmin ? (
              <button
                className="btn btn-primary"
                onClick={() => setTopupOpen(true)}
                style={{ gap: '8px', padding: '10px 18px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Isi Saldo
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={() => alert('Hanya Admin yang diizinkan untuk melakukan pengisian saldo operasional.')}
                style={{ gap: '6px', fontSize: '13px', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                title="Pengisian saldo khusus Admin"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Isi Saldo (Admin Only)
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '20px', flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>

          {/* Cards Header Saldo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>

            {/* Saldo Terkini */}
            <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, #1E293B, #0F172A)', color: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(15,23,42,0.2)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.08 }}>
                <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '8px' }}>Saldo Operasional Saat Ini</div>
              <div style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '14px', color: saldo < 100000 ? '#FCA5A5' : '#6EE7B7' }}>
                {fmt(saldo)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', opacity: 0.9 }}>
                <span>Status Saldo:</span>
                <span style={{ fontWeight: '700', padding: '2px 10px', borderRadius: '20px', background: saldo < 100000 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: saldo < 100000 ? '#F87171' : '#34D399' }}>
                  {saldo < 100000 ? 'Saldo Rendah' : 'Tersedia'}
                </span>
              </div>
            </div>

            {/* Total Penambahan (Top Up) */}
            <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Total Isi Saldo</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>{fmt(totalRestock)}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total akumulasi penambahan saldo oleh Admin</div>
            </div>

            {/* Total Pengeluaran (ACC) */}
            <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Total Belanja ACC</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>{fmt(totalExpense)}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total belanja yang telah di-ACC & memotong saldo</div>
            </div>

          </div>

          {/* Alert PENDING Belanja untuk Admin */}
          {isAdmin && pendingBelanja.length > 0 && (
            <div className="card" style={{ padding: '20px', borderRadius: '16px', border: '1.5px solid #FCD34D', background: '#FEFCE8', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>!</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#92400E' }}>{pendingBelanja.length} Pengajuan Belanja Menunggu ACC Admin</div>
                    <div style={{ fontSize: '12px', color: '#B45309' }}>Periksa item yang diajukan oleh tim Operasional di bawah ini:</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingBelanja.map(item => (
                  <div key={item.id} style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>{item.requesterName}</span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>· {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        {item.items?.map(i => `${i.itemName} (${i.qty} ${i.satuan || ''})`).join(', ')}
                      </div>
                      {item.keterangan && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontStyle: 'italic' }}>"{item.keterangan}"</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#DC2626' }}>{fmt(item.total)}</div>
                      <button
                        className="btn"
                        onClick={() => setActionBelanja(item)}
                        style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px' }}
                      >
                        Tinjau & ACC
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section History Ledger */}
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>Riwayat Saldo Operasional</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Daftar mutasi penambahan dan pengeluaran saldo</div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setFilterType('ALL')}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: filterType === 'ALL' ? 'var(--surface)' : 'transparent',
                    color: filterType === 'ALL' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: filterType === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Semua ({ledger.length})
                </button>
                <button
                  onClick={() => setFilterType('RESTOCK')}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: filterType === 'RESTOCK' ? 'var(--surface)' : 'transparent',
                    color: filterType === 'RESTOCK' ? '#10B981' : 'var(--muted)',
                    boxShadow: filterType === 'RESTOCK' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Isi Saldo
                </button>
                <button
                  onClick={() => setFilterType('EXPENSE')}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: filterType === 'EXPENSE' ? 'var(--surface)' : 'transparent',
                    color: filterType === 'EXPENSE' ? '#EF4444' : 'var(--muted)',
                    boxShadow: filterType === 'EXPENSE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Belanja (Pengeluaran)
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Memuat riwayat saldo...</div>
            ) : filteredLedger.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Belum ada mutasi saldo</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Pengisian saldo oleh Admin dan belanja yang di-ACC akan tampil di sini.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 10px' }}>Waktu</th>
                      <th style={{ padding: '12px 10px' }}>Tipe</th>
                      <th style={{ padding: '12px 10px' }}>Keterangan</th>
                      <th style={{ padding: '12px 10px' }}>Oleh</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right' }}>Nominal</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right' }}>Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map(item => {
                      const isTopup = item.type === 'RESTOCK'
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                              background: isTopup ? '#ECFDF5' : '#FEF2F2',
                              color: isTopup ? '#10B981' : '#EF4444',
                              border: `1px solid ${isTopup ? '#A7F3D0' : '#FECACA'}`
                            }}>
                              {isTopup ? '+ Isi Saldo' : '- Pengeluaran'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text)', fontWeight: '500' }}>
                            {item.note || '-'}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--muted)', fontSize: '12px' }}>
                            {item.createdBy || 'Admin'}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: isTopup ? '#10B981' : '#EF4444', whiteSpace: 'nowrap' }}>
                            {isTopup ? '+' : '-'} {fmt(item.amount)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {fmt(item.balanceAfter)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Modal Topup Saldo (Admin Only) */}
      {topupOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setTopupOpen(false) }}
        >
          <div className="card fade-in" style={{ width: '420px', maxWidth: '94vw', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#065F46' }}>Isi Saldo Operasional</div>
                <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>Fitur khusus Admin untuk menambah saldo</div>
              </div>
              <button onClick={() => setTopupOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handleTopupSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label">Nominal Top Up Saldo</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--muted)' }}>Rp</span>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="Contoh: 500000"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    style={{ paddingLeft: '38px', fontSize: '16px', fontWeight: '700' }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="label">Catatan / Keterangan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="Misal: Kas Operasional Mingguan"
                  value={topupNote}
                  onChange={e => setTopupNote(e.target.value)}
                />
              </div>

              <div style={{ padding: '12px', background: 'var(--surface2)', borderRadius: '10px', fontSize: '12px', color: 'var(--muted)' }}>
                Saldo saat ini: <strong style={{ color: 'var(--text)' }}>{fmt(saldo)}</strong><br />
                Saldo setelah isi: <strong style={{ color: '#10B981' }}>{fmt(saldo + (Number(topupAmount) || 0))}</strong>
              </div>

              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTopupOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn" disabled={submittingTopup} style={{ flex: 1, justifyContent: 'center', background: '#10B981', color: '#fff', border: 'none' }}>
                  {submittingTopup ? 'Memproses...' : 'Konfirmasi Top Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ACC / Reject Belanja Admin */}
      {actionBelanja && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setActionBelanja(null) }}
        >
          <div className="card fade-in" style={{ width: '480px', maxWidth: '94vw', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>Tinjau Pengajuan Belanja</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Diajukan oleh: <strong>{actionBelanja.requesterName}</strong></div>
              </div>
              <button onClick={() => setActionBelanja(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', marginBottom: '8px' }}>Rincian Item Belanja:</div>
                {actionBelanja.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span>{item.itemName} ({item.qty} {item.satuan || ''})</span>
                    <span style={{ fontWeight: '700' }}>{fmt(item.subtotal)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                  <span>Total Belanja:</span>
                  <span style={{ color: '#DC2626' }}>{fmt(actionBelanja.total)}</span>
                </div>
              </div>

              <div>
                <label className="label">Catatan Admin <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="Catatan persetujuan / penolakan..."
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                💡 <strong>Info:</strong> Menyetujui (ACC) akan otomatis memotong Saldo Operasional sebesar <strong>{fmt(actionBelanja.total)}</strong> dan mencatatnya ke Pengeluaran Toko.
              </div>

              <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={processingAction}
                  onClick={() => handleApproveReject(actionBelanja.id, 'REJECTED')}
                  style={{ flex: 1, justifyContent: 'center', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                >
                  Tolak
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={processingAction}
                  onClick={() => handleApproveReject(actionBelanja.id, 'APPROVED')}
                  style={{ flex: 1, justifyContent: 'center', background: '#10B981', color: '#fff', border: 'none', fontWeight: '700' }}
                >
                  {processingAction ? 'Memproses...' : 'ACC / Setujui'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

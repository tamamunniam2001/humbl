'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const EMPTY = {
  code: '', description: '', type: 'PERCENT', value: '',
  minSpend: '', maxDiscount: '', quota: '',
  startDate: '', endDate: '', isActive: true,
}

// Helper: ubah ISO date -> nilai untuk input type="date" (YYYY-MM-DD)
function toDateInput(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function VoucherSettingsPage() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = tambah baru
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/admin/vouchers')
      setVouchers(res.data)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setModalOpen(true)
  }

  function openEdit(v) {
    setEditing(v)
    setForm({
      code: v.code || '',
      description: v.description || '',
      type: v.type || 'PERCENT',
      value: v.value != null ? String(v.value) : '',
      minSpend: v.minSpend ? String(v.minSpend) : '',
      maxDiscount: v.maxDiscount ? String(v.maxDiscount) : '',
      quota: v.quota ? String(v.quota) : '',
      startDate: toDateInput(v.startDate),
      endDate: toDateInput(v.endDate),
      isActive: v.isActive !== false,
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim()) { setError('Kode voucher wajib diisi'); return }
    if (!(Number(form.value) > 0)) { setError('Nilai potongan harus lebih dari 0'); return }

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value) || 0,
      minSpend: Number(form.minSpend) || 0,
      maxDiscount: Number(form.maxDiscount) || 0,
      quota: Number(form.quota) || 0,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      isActive: form.isActive,
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/admin/vouchers/${editing.id}`, payload)
      } else {
        await api.post('/admin/vouchers', payload)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan voucher')
    } finally { setSaving(false) }
  }

  async function handleToggle(v) {
    try {
      await api.patch(`/admin/vouchers/${v.id}`, { isActive: !v.isActive })
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal mengubah status') }
  }

  async function handleDelete(v) {
    if (!confirm(`Hapus voucher "${v.code}"? Transaksi yang sudah memakai voucher ini tetap aman.`)) return
    try {
      await api.delete(`/admin/vouchers/${v.id}`)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menghapus voucher') }
  }

  const now = new Date()
  function statusBadge(v) {
    if (!v.isActive) return { text: 'Nonaktif', color: '#64748B', bg: '#F1F5F9' }
    if (v.startDate && now < new Date(v.startDate)) return { text: 'Terjadwal', color: '#B45309', bg: '#FFFBEB' }
    if (v.endDate && now > new Date(v.endDate)) return { text: 'Kedaluwarsa', color: '#C95555', bg: '#FEF2F2' }
    if (v.quota > 0 && v.usedCount >= v.quota) return { text: 'Kuota Habis', color: '#C95555', bg: '#FEF2F2' }
    return { text: 'Aktif', color: '#2A9D6E', bg: '#ECFDF5' }
  }

  function valueLabel(v) {
    if (v.type === 'PERCENT') {
      let s = `${v.value}%`
      if (v.maxDiscount > 0) s += ` (maks ${fmt(v.maxDiscount)})`
      return s
    }
    return fmt(v.value)
  }

  const inputS = { width: '100%' }
  const labelS = { fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px', display: 'block' }


  return (
    <>
      <Sidebar />
      <main className="main-content">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)' }}>Voucher & Kode Promo</h1>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>Atur kode voucher beserta potongan (persen atau tunai). Voucher bisa dipakai kasir saat transaksi.</p>
            </div>
            <button className="btn btn-primary" onClick={openAdd}>+ Tambah Voucher</button>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Jenis & Potongan</th>
                    <th>Min. Belanja</th>
                    <th>Masa Berlaku</th>
                    <th>Terpakai</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</td></tr>
                  ) : vouchers.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎟️</div>
                      <div>Belum ada voucher</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Klik "Tambah Voucher" untuk membuat kode promo pertama</div>
                    </td></tr>
                  ) : vouchers.map(v => {
                    const badge = statusBadge(v)
                    return (
                      <tr key={v.id}>
                        <td>
                          <div style={{ fontWeight: '800', color: 'var(--accent)', fontFamily: 'monospace', fontSize: '14px' }}>{v.code}</div>
                          {v.description && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.description}</div>}
                        </td>
                        <td>
                          <span className="badge badge-gray" style={{ marginRight: '6px' }}>{v.type === 'PERCENT' ? 'Persen' : 'Tunai'}</span>
                          <span style={{ fontWeight: '700' }}>{valueLabel(v)}</span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{v.minSpend > 0 ? fmt(v.minSpend) : '-'}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {v.startDate || v.endDate ? (
                            <>{toDateInput(v.startDate) || '∞'} → {toDateInput(v.endDate) || '∞'}</>
                          ) : 'Selalu'}
                        </td>
                        <td style={{ fontSize: '13px' }}>{v.quota > 0 ? `${v.usedCount} / ${v.quota}` : `${v.usedCount}×`}</td>
                        <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(v)}>Edit</button>
                            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleToggle(v)}>
                              {v.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(v)}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="card fade-in" style={{ width: '520px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800' }}>{editing ? `Edit Voucher — ${editing.code}` : 'Tambah Voucher'}</div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--muted)', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '20px' }}>
              {error && <div style={{ background: 'var(--red-light)', border: '1px solid #FECACA', color: 'var(--red)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}

              <div style={{ marginBottom: '14px' }}>
                <label style={labelS}>Kode Voucher *</label>
                <input className="input" style={inputS} placeholder="mis. DISKON10" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={labelS}>Deskripsi</label>
                <input className="input" style={inputS} placeholder="mis. Promo akhir pekan" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={labelS}>Jenis Potongan</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ k: 'PERCENT', label: 'Persen (%)' }, { k: 'NOMINAL', label: 'Tunai (Rp)' }].map(o => (
                    <button type="button" key={o.k} onClick={() => setForm({ ...form, type: o.k })}
                      style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1.5px solid ${form.type === o.k ? 'var(--accent)' : 'var(--border)'}`, background: form.type === o.k ? 'var(--accent)' : '#fff', color: form.type === o.k ? '#fff' : 'var(--text2)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelS}>Nilai Potongan * {form.type === 'PERCENT' ? '(%)' : '(Rp)'}</label>
                  <input className="input" type="number" min="0" style={inputS} placeholder={form.type === 'PERCENT' ? '10' : '5000'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                </div>
                <div>
                  <label style={labelS}>Min. Belanja (Rp)</label>
                  <input className="input" type="number" min="0" style={inputS} placeholder="0" value={form.minSpend} onChange={e => setForm({ ...form, minSpend: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                {form.type === 'PERCENT' && (
                  <div>
                    <label style={labelS}>Maks. Potongan (Rp)</label>
                    <input className="input" type="number" min="0" style={inputS} placeholder="0 = tanpa batas" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} />
                  </div>
                )}
                <div>
                  <label style={labelS}>Kuota Pemakaian</label>
                  <input className="input" type="number" min="0" style={inputS} placeholder="0 = tanpa batas" value={form.quota} onChange={e => setForm({ ...form, quota: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelS}>Mulai Berlaku</label>
                  <input className="input" type="date" style={inputS} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelS}>Berakhir</label>
                  <input className="input" type="date" style={inputS} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', cursor: 'pointer', fontSize: '13px', color: 'var(--text2)' }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                Voucher aktif (bisa dipakai kasir)
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}


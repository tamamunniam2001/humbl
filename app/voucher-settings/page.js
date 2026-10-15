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
  // ── Diskon member global ──
  const [promo, setPromo] = useState({ memberDiscountActive: false, memberDiscountType: 'PERCENT', memberDiscountValue: '', memberDiscountMax: '', memberDiscountMin: '' })
  const [promoSaving, setPromoSaving] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [vRes, pRes] = await Promise.all([
        api.get('/admin/vouchers'),
        api.get('/admin/promo-settings').catch(() => null),
      ])
      setVouchers(vRes.data)
      if (pRes?.data) {
        setPromo({
          memberDiscountActive: !!pRes.data.memberDiscountActive,
          memberDiscountType: pRes.data.memberDiscountType === 'NOMINAL' ? 'NOMINAL' : 'PERCENT',
          memberDiscountValue: pRes.data.memberDiscountValue != null ? String(pRes.data.memberDiscountValue) : '',
          memberDiscountMax: pRes.data.memberDiscountMax ? String(pRes.data.memberDiscountMax) : '',
          memberDiscountMin: pRes.data.memberDiscountMin ? String(pRes.data.memberDiscountMin) : '',
        })
      }
    } catch { } finally { setLoading(false) }
  }

  async function savePromo(e) {
    e?.preventDefault?.()
    setPromoMsg('')
    const value = Number(promo.memberDiscountValue) || 0
    if (promo.memberDiscountActive && !(value > 0)) {
      setPromoMsg('Nilai diskon harus lebih dari 0 untuk mengaktifkan')
      return
    }
    if (promo.memberDiscountType === 'PERCENT' && value > 100) {
      setPromoMsg('Diskon persen maksimal 100')
      return
    }
    setPromoSaving(true)
    try {
      const res = await api.put('/admin/promo-settings', {
        memberDiscountActive: promo.memberDiscountActive,
        memberDiscountType: promo.memberDiscountType,
        memberDiscountValue: value,
        memberDiscountMax: Number(promo.memberDiscountMax) || 0,
        memberDiscountMin: Number(promo.memberDiscountMin) || 0,
      })
      setPromo({
        memberDiscountActive: !!res.data.memberDiscountActive,
        memberDiscountType: res.data.memberDiscountType === 'NOMINAL' ? 'NOMINAL' : 'PERCENT',
        memberDiscountValue: res.data.memberDiscountValue != null ? String(res.data.memberDiscountValue) : '',
        memberDiscountMax: res.data.memberDiscountMax ? String(res.data.memberDiscountMax) : '',
        memberDiscountMin: res.data.memberDiscountMin ? String(res.data.memberDiscountMin) : '',
      })
      setPromoMsg('Pengaturan diskon member tersimpan')
    } catch (err) {
      setPromoMsg(err.response?.data?.message || 'Gagal menyimpan pengaturan')
    } finally { setPromoSaving(false) }
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
    if (!v.isActive) return { text: 'Nonaktif', cls: 'v-badge-gray' }
    if (v.startDate && now < new Date(v.startDate)) return { text: 'Terjadwal', cls: 'v-badge-orange' }
    if (v.endDate && now > new Date(v.endDate)) return { text: 'Kedaluwarsa', cls: 'v-badge-red' }
    if (v.quota > 0 && v.usedCount >= v.quota) return { text: 'Kuota Habis', cls: 'v-badge-red' }
    return { text: 'Aktif', cls: 'v-badge-green' }
  }

  function valueLabel(v) {
    if (v.type === 'PERCENT') {
      let s = `${v.value}%`
      if (v.maxDiscount > 0) s += ` · maks ${fmt(v.maxDiscount)}`
      return s
    }
    return fmt(v.value)
  }


  // Statistik ringkasan
  const totalVoucher = vouchers.length
  const activeVoucher = vouchers.filter(v => statusBadge(v).text === 'Aktif').length
  const totalTerpakai = vouchers.reduce((s, v) => s + (v.usedCount || 0), 0)

  return (
    <div className="page vch-page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        {/* ── Topbar ── */}
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Voucher & Kode Promo</div>
            <div className="topbar-sub">Atur kode voucher beserta potongannya</div>
          </div>
          <button className="btn btn-primary vch-add-btn" onClick={openAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Voucher
          </button>
        </div>

        <div className="content">
          {/* ── Statistik ── */}
          <div className="vch-stats">
            <div className="vch-stat">
              <div className="vch-stat-label">Total Voucher</div>
              <div className="vch-stat-value">{totalVoucher}</div>
            </div>
            <div className="vch-stat">
              <div className="vch-stat-label">Sedang Aktif</div>
              <div className="vch-stat-value" style={{ color: '#0EA472' }}>{activeVoucher}</div>
            </div>
            <div className="vch-stat">
              <div className="vch-stat-label">Total Terpakai</div>
              <div className="vch-stat-value" style={{ color: '#4F6EF7' }}>{totalTerpakai}×</div>
            </div>
          </div>

          {/* ── Daftar Voucher ── */}
          {/* ── Diskon semua member ── */}
      <form className="card" onSubmit={savePromo} style={{ padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>💜 Diskon Semua Member</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', maxWidth: '640px' }}>
              Berlaku otomatis untuk semua member aktif. Saat nama pelanggan di kasir memilih member,
              tombol <b>Diskon Member</b> muncul — kasir tinggal menekan untuk memasang/mencopotnya.
              Potongan dihitung dari subtotal setelah diskon manual.
            </div>
          </div>
          <label className="vch-check" style={{ margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={promo.memberDiscountActive}
              onChange={e => setPromo(p => ({ ...p, memberDiscountActive: e.target.checked }))} />
            Aktif
          </label>
        </div>
        <div className="vch-form-grid">
          <div className="vch-field">
            <label className="vch-label">Jenis Diskon</label>
            <div className="vch-seg">
              {[['PERCENT', 'Persen (%)'], ['NOMINAL', 'Nominal (Rp)']].map(([val, label]) => (
                <button type="button" key={val} onClick={() => setPromo(p => ({ ...p, memberDiscountType: val }))}
                  className={`vch-seg-btn ${promo.memberDiscountType === val ? 'active' : ''}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="vch-field">
            <label className="vch-label">Nilai {promo.memberDiscountType === 'PERCENT' ? '(%, mis. 10)' : '(Rp, mis. 5000)'}</label>
            <input className="input" type="number" min="0" max={promo.memberDiscountType === 'PERCENT' ? 100 : undefined}
              value={promo.memberDiscountValue} onChange={e => setPromo(p => ({ ...p, memberDiscountValue: e.target.value }))} placeholder="0" />
          </div>
          <div className="vch-field">
            <label className="vch-label">Minimal belanja (Rp, opsional)</label>
            <input className="input" type="number" min="0" value={promo.memberDiscountMin}
              onChange={e => setPromo(p => ({ ...p, memberDiscountMin: e.target.value }))} placeholder="0" />
          </div>
          {promo.memberDiscountType === 'PERCENT' && (
            <div className="vch-field">
              <label className="vch-label">Maksimal potongan (Rp, 0 = tanpa batas)</label>
              <input className="input" type="number" min="0" value={promo.memberDiscountMax}
                onChange={e => setPromo(p => ({ ...p, memberDiscountMax: e.target.value }))} placeholder="0" />
            </div>
          )}
        </div>
        {promoMsg && (
          <div className={promoMsg.includes('tersimpan') ? 'vch-ok' : 'vch-error'} style={{ marginBottom: '12px' }}>{promoMsg}</div>
        )}
        <button className="btn btn-primary" type="submit" disabled={promoSaving} style={{ justifyContent: 'center' }}>
          {promoSaving ? 'Menyimpan...' : '💾 Simpan Diskon Member'}
        </button>
      </form>

      {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : vouchers.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '44px', marginBottom: '10px' }}>🎟️</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>Belum ada voucher</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Klik "Tambah Voucher" untuk membuat kode promo pertama</div>
            </div>
          ) : (
            <div className="vch-grid">
              {vouchers.map(v => {
                const badge = statusBadge(v)
                return (
                  <div key={v.id} className="card vch-card">
                    <div className="vch-card-head">
                      <div className="vch-code">{v.code}</div>
                      <span className={`v-badge ${badge.cls}`}>{badge.text}</span>
                    </div>
                    {v.description && <div className="vch-desc">{v.description}</div>}

                    <div className="vch-card-body">
                      <div className="vch-rows">
                        <div className="vch-row">
                          <span className="vch-row-k">Jenis</span>
                          <span className="vch-row-v"><span className="badge badge-gray">{v.type === 'PERCENT' ? 'Persen' : 'Tunai'}</span></span>
                        </div>
                        <div className="vch-row">
                          <span className="vch-row-k">Potongan</span>
                          <span className="vch-row-v" style={{ fontWeight: '800', color: 'var(--green)' }}>{valueLabel(v)}</span>
                        </div>
                        <div className="vch-row">
                          <span className="vch-row-k">Min. Belanja</span>
                          <span className="vch-row-v">{v.minSpend > 0 ? fmt(v.minSpend) : '—'}</span>
                        </div>
                        <div className="vch-row">
                          <span className="vch-row-k">Masa Berlaku</span>
                          <span className="vch-row-v">
                            {v.startDate || v.endDate ? `${toDateInput(v.startDate) || '∞'} → ${toDateInput(v.endDate) || '∞'}` : 'Selalu'}
                          </span>
                        </div>
                        <div className="vch-row">
                          <span className="vch-row-k">Terpakai</span>
                          <span className="vch-row-v">{v.quota > 0 ? `${v.usedCount} / ${v.quota}` : `${v.usedCount}×`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="vch-actions">
                      <button className="btn vch-btn vch-btn-edit" onClick={() => openEdit(v)}>Edit</button>
                      <button className="btn vch-btn vch-btn-toggle" onClick={() => handleToggle(v)}>
                        {v.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button className="btn vch-btn vch-btn-del" onClick={() => handleDelete(v)}>Hapus</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Modal Form ── */}
      {modalOpen && (
        <div className="vch-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="card vch-modal fade-in">
            <div className="vch-modal-head">
              <div className="vch-modal-title">{editing ? `Edit Voucher — ${editing.code}` : 'Tambah Voucher'}</div>
              <button onClick={() => setModalOpen(false)} className="vch-modal-close">×</button>
            </div>
            <form onSubmit={handleSave} className="vch-modal-body">
              {error && <div className="vch-error">{error}</div>}

              <div className="vch-field">
                <label className="vch-label">Kode Voucher *</label>
                <input className="input" placeholder="mis. DISKON10" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>

              <div className="vch-field">
                <label className="vch-label">Deskripsi</label>
                <input className="input" placeholder="mis. Promo akhir pekan" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="vch-field">
                <label className="vch-label">Jenis Potongan</label>
                <div className="vch-seg">
                  {[{ k: 'PERCENT', label: 'Persen (%)' }, { k: 'NOMINAL', label: 'Tunai (Rp)' }].map(o => (
                    <button type="button" key={o.k} onClick={() => setForm({ ...form, type: o.k })}
                      className={`vch-seg-btn ${form.type === o.k ? 'active' : ''}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vch-form-grid">
                <div className="vch-field">
                  <label className="vch-label">Nilai Potongan * {form.type === 'PERCENT' ? '(%)' : '(Rp)'}</label>
                  <input className="input" type="number" min="0" placeholder={form.type === 'PERCENT' ? '10' : '5000'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                </div>
                <div className="vch-field">
                  <label className="vch-label">Min. Belanja (Rp)</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.minSpend} onChange={e => setForm({ ...form, minSpend: e.target.value })} />
                </div>
              </div>

              <div className="vch-form-grid">
                {form.type === 'PERCENT' && (
                  <div className="vch-field">
                    <label className="vch-label">Maks. Potongan (Rp)</label>
                    <input className="input" type="number" min="0" placeholder="0 = tanpa batas" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} />
                  </div>
                )}
                <div className="vch-field">
                  <label className="vch-label">Kuota Pemakaian</label>
                  <input className="input" type="number" min="0" placeholder="0 = tanpa batas" value={form.quota} onChange={e => setForm({ ...form, quota: e.target.value })} />
                </div>
              </div>

              <div className="vch-form-grid">
                <div className="vch-field">
                  <label className="vch-label">Mulai Berlaku</label>
                  <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="vch-field">
                  <label className="vch-label">Berakhir</label>
                  <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <label className="vch-check">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                Voucher aktif (bisa dipakai kasir)
              </label>

              <div className="vch-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .vch-add-btn { white-space: nowrap; }
        .vch-add-btn svg { flex-shrink: 0; }

        /* Statistik */
        .vch-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
        .vch-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .vch-stat-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        .vch-stat-value { font-size: 22px; font-weight: 800; color: var(--text); }

        /* Grid kartu voucher */
        .vch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .vch-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .vch-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .vch-code { font-family: monospace; font-weight: 800; font-size: 16px; color: var(--accent); letter-spacing: 0.5px; }
        .vch-desc { font-size: 12px; color: var(--muted); margin-top: -6px; }
        .vch-rows { display: flex; flex-direction: column; gap: 7px; }
        .vch-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; }
        .vch-row-k { color: var(--muted); }
        .vch-row-v { color: var(--text2); font-weight: 600; text-align: right; }

        /* Badge status */
        .v-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .v-badge-green { background: #ECFDF5; color: #0EA472; }
        .v-badge-red { background: #FEF2F2; color: #E03E3E; }
        .v-badge-orange { background: #FFFBEB; color: #B45309; }
        .v-badge-gray { background: #F1F5F9; color: #64748B; }

        /* Tombol aksi kartu */
        .vch-actions { display: flex; gap: 8px; }
        .vch-btn { flex: 1; justify-content: center; padding: 8px 6px; font-size: 12px; font-weight: 700; }
        .vch-btn-edit { background: var(--accent-light); color: var(--accent); border: 1px solid #C7D4F0; }
        .vch-btn-toggle { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .vch-btn-del { background: var(--red-light); color: var(--red); border: 1px solid var(--red-border); }

        /* Modal */
        .vch-modal-overlay { position: fixed; inset: 0; background: rgba(13,21,38,0.55); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(4px); padding: 16px; }
        .vch-modal { width: 520px; max-width: 100%; max-height: 92vh; overflow-y: auto; padding: 0; }
        .vch-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
        .vch-modal-title { font-size: 15px; font-weight: 800; color: var(--text); }
        .vch-modal-close { background: none; border: none; cursor: pointer; font-size: 24px; color: var(--muted); line-height: 1; }
        .vch-modal-body { padding: 20px; }
        .vch-error { background: var(--red-light); border: 1px solid var(--red-border); color: var(--red); padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
        .vch-ok { background: #ECFDF5; border: 1px solid #A7F3D0; color: #0E7A55; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
        .vch-field { margin-bottom: 14px; }
        .vch-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 5px; display: block; }
        .vch-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .vch-seg { display: flex; gap: 8px; }
        .vch-seg-btn { flex: 1; padding: 9px; border-radius: 9px; border: 1.5px solid var(--border); background: #fff; color: var(--text2); font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .vch-seg-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }
        .vch-check { display: flex; align-items: center; gap: 8px; margin: 4px 0 18px; cursor: pointer; font-size: 13px; color: var(--text2); }
        .vch-check input { width: 16px; height: 16px; }
        .vch-modal-actions { display: flex; gap: 8px; }
        .vch-modal-actions .btn { flex: 1; justify-content: center; padding: 11px; }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .vch-stats { gap: 8px; }
          .vch-stat { padding: 12px; }
          .vch-stat-value { font-size: 18px; }
          .vch-stat-label { font-size: 11px; }
          .vch-grid { grid-template-columns: 1fr; gap: 12px; }
          .vch-form-grid { grid-template-columns: 1fr; gap: 0; }
          .vch-btn { min-height: 38px; }
          .vch-modal-overlay { padding: 0; align-items: flex-end; }
          .vch-modal { width: 100%; max-height: 94vh; border-radius: 16px 16px 0 0; }
          .vch-modal-body { padding: 16px; }
        }
      `}</style>
    </div>
  )
}

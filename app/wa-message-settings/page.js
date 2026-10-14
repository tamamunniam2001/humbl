'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import api from '@/lib/api'

const EMPTY = { name: '', body: '', inputType: 'NONE', isActive: true }

// Template contoh bawaan saat admin pertama kali mengatur pesan WhatsApp.
const SAMPLE_TEMPLATES = [
  {
    name: 'Kirim Kode Voucher',
    inputType: 'VOUCHER_CODE',
    body: 'Halo {nama} 👋\n\nKabar baik! Ini kode voucher spesial untuk kamu dari *HAMBL*:\n\n🎫 *{kode_voucher}*\n{detail_voucher}\n\nBerlaku sesuai syarat & ketentuan yang berlaku. Selamat berbelanja! 😊',
  },
  {
    name: 'Pengumuman Member',
    inputType: 'NONE',
    body: 'Halo {nama} 👋\n\nKami ingin memberi kabar terbaru untuk kamu. Nantikan promo-promo menarik berikutnya, ya!\n\nTerima kasih sudah menjadi member setia HAMBL 🙏',
  },
]

const PLACEHOLDER_HINTS = [
  { code: '{nama}', desc: 'nama member' },
  { code: '{kode_voucher}', desc: 'kode voucher terpilih' },
  { code: '{detail_voucher}', desc: 'detail potongan voucher' },
]

export default function WaMessageSettingsPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = tambah baru
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [creatingSample, setCreatingSample] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/admin/message-templates')
      setTemplates(res.data)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setModalOpen(true)
  }

  function openEdit(t) {
    setEditing(t)
    setForm({
      name: t.name || '',
      body: t.body || '',
      inputType: t.inputType || 'NONE',
      isActive: t.isActive !== false,
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Nama template wajib diisi'); return }
    if (!form.body.trim()) { setError('Isi pesan wajib diisi'); return }
    if (form.inputType !== 'VOUCHER_CODE' && form.body.includes('{kode_voucher}')) {
      setError('Isi pesan memakai {kode_voucher} — ubah Jenis Input menjadi "Kode Voucher"')
      return
    }

    const payload = {
      name: form.name.trim(),
      body: form.body,
      inputType: form.inputType,
      isActive: form.isActive,
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/admin/message-templates/${editing.id}`, payload)
      } else {
        await api.post('/admin/message-templates', payload)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan template')
    } finally { setSaving(false) }
  }

  async function handleToggle(t) {
    try {
      await api.patch(`/admin/message-templates/${t.id}`, { isActive: !t.isActive })
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal mengubah status') }
  }

  async function handleDelete(t) {
    if (!confirm(`Hapus template "${t.name}"?`)) return
    try {
      await api.delete(`/admin/message-templates/${t.id}`)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menghapus template') }
  }

  // Buat dua template contoh sekaligus (sekali klik) untuk pemakaian pertama.
  async function createSampleTemplates() {
    setCreatingSample(true)
    try {
      for (const t of SAMPLE_TEMPLATES) await api.post('/admin/message-templates', t)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal membuat template contoh') }
    finally { setCreatingSample(false) }
  }

  const activeCount = templates.filter(t => t.isActive).length

  return (
    <div className="page tpl-page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        {/* ── Topbar ── */}
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Pengaturan Pesan WhatsApp</div>
            <div className="topbar-sub">Kelola template pesan yang bisa dikirim ke member dari halaman Daftar Member</div>
          </div>
          <button className="btn btn-primary tpl-add-btn" onClick={openAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Template
          </button>
        </div>

        <div className="content">
          {/* ── Cara pakai + placeholder ── */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: '14px', background: 'var(--surface2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Cara pakai</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.6 }}>
              Buka <Link href="/members" style={{ color: 'var(--accent)', fontWeight: 700 }}>Daftar Member</Link> → klik <b>Kirim Pesan</b> di baris member → pilih template → kirim.
              Template dengan jenis <b>Kode Voucher</b> akan meminta admin memilih kode voucher yang tersedia sebelum pesan dikirim.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {PLACEHOLDER_HINTS.map(h => (
                <span key={h.code} className="badge badge-gray" style={{ fontFamily: 'monospace' }}>
                  {h.code} — {h.desc}
                </span>
              ))}
            </div>
          </div>

          {/* ── Daftar template ── */}
          {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : templates.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '44px', marginBottom: '10px' }}>💬</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>Belum ada template pesan</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                Klik &quot;Tambah Template&quot; untuk membuat sendiri, atau mulai dari template contoh
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={createSampleTemplates} disabled={creatingSample}>
                  {creatingSample ? 'Membuat…' : '✨ Buat Template Contoh'}
                </button>
                <button className="btn" onClick={openAdd}>Tambah Template</button>
              </div>
            </div>
          ) : (
            <div className="tpl-grid">
              {templates.map(t => (
                <div key={t.id} className="card tpl-card">
                  <div className="tpl-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span className={`tpl-badge ${t.isActive ? 'tpl-badge-green' : 'tpl-badge-gray'}`}>
                        {t.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="tpl-card-title" title={t.name}>{t.name}</span>
                    </div>
                    <span className={`tpl-badge ${t.inputType === 'VOUCHER_CODE' ? 'tpl-badge-purple' : 'tpl-badge-gray'}`}
                      style={{ whiteSpace: 'nowrap' }}>
                      {t.inputType === 'VOUCHER_CODE' ? '🎫 Kode Voucher' : 'Teks Biasa'}
                    </span>
                  </div>
                  <div className="tpl-card-body">{t.body}</div>
                  <div className="tpl-card-actions">
                    <button className="btn tpl-btn tpl-btn-edit" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn tpl-btn tpl-btn-toggle" onClick={() => handleToggle(t)}>
                      {t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button className="btn tpl-btn tpl-btn-del" onClick={() => handleDelete(t)}>Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {templates.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
              {templates.length} template · {activeCount} aktif — tombol kirim muncul di halaman Daftar Member (khusus Admin)
            </div>
          )}
        </div>
      </main>

      {/* ── Modal tambah/edit template ── */}
      {modalOpen && (
        <div className="tpl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="card tpl-modal">
            <div className="tpl-modal-head">
              <div className="tpl-modal-title">{editing ? `Edit: ${editing.name}` : 'Tambah Template Pesan'}</div>
              <button type="button" onClick={() => setModalOpen(false)} className="tpl-modal-close">×</button>
            </div>
            <form onSubmit={handleSave} className="tpl-modal-body">
              {error && <div className="tpl-error">{error}</div>}

              <div className="tpl-field">
                <label className="tpl-label">Nama Template *</label>
                <input className="input" placeholder="mis. Kirim Kode Voucher"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="tpl-field">
                <label className="tpl-label">Jenis Input Saat Kirim</label>
                <div className="tpl-seg">
                  {[{ k: 'NONE', label: 'Teks Biasa' }, { k: 'VOUCHER_CODE', label: '🎫 Kode Voucher' }].map(o => (
                    <button type="button" key={o.k} onClick={() => setForm({ ...form, inputType: o.k })}
                      className={`tpl-seg-btn ${form.inputType === o.k ? 'active' : ''}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                  {form.inputType === 'VOUCHER_CODE'
                    ? 'Saat kirim, admin memilih kode voucher yang tersedia; {kode_voucher} & {detail_voucher} terisi otomatis.'
                    : 'Pesan dikirim apa adanya tanpa input tambahan.'}
                </div>
              </div>

              <div className="tpl-field">
                <label className="tpl-label">Isi Pesan *</label>
                <textarea className="input tpl-textarea" rows={7}
                  placeholder={'Halo {nama} 👋\n\nKode voucher kamu: {kode_voucher}\n{detail_voucher}'}
                  value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {PLACEHOLDER_HINTS.map(h => (
                    <button type="button" key={h.code} className="btn tpl-ph-chip"
                      title={`Sisipkan ${h.code}`}
                      onClick={() => setForm(f => ({ ...f, body: f.body + (f.body && !f.body.endsWith('\n') ? '\n' : '') + h.code }))}>
                      + {h.code}
                    </button>
                  ))}
                </div>
              </div>

              <label className="tpl-check">
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                Template aktif (muncul di pilihan kirim pesan)
              </label>

              <div className="tpl-modal-actions">
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        .tpl-add-btn { white-space: nowrap; }

        /* Badge (milik halaman ini, mirip gaya voucher-settings) */
        .tpl-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .tpl-badge-green { background: #ECFDF5; color: #0EA472; }
        .tpl-badge-gray { background: #F1F5F9; color: #64748B; }
        .tpl-badge-purple { background: #F3EEFF; color: #7C3AED; }

        .tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
        .tpl-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .tpl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .tpl-card-title { font-size: 13.5px; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tpl-card-body {
          font-size: 12.5px; color: var(--text2); line-height: 1.55; background: var(--surface2);
          border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
          white-space: pre-wrap; max-height: 110px; overflow: hidden;
        }
        .tpl-card-actions { display: flex; gap: 8px; }
        .tpl-btn { flex: 1; justify-content: center; padding: 7px 6px; font-size: 12px; font-weight: 700; }
        .tpl-btn-edit { background: var(--accent-light); color: var(--accent); border: 1px solid #C7D4F0; }
        .tpl-btn-toggle { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .tpl-btn-del { background: var(--red-light); color: var(--red); border: 1px solid var(--red-border); }

        .tpl-modal-overlay { position: fixed; inset: 0; background: rgba(13,21,38,0.55); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(4px); padding: 16px; }
        .tpl-modal { width: 560px; max-width: 100%; max-height: 92vh; overflow-y: auto; padding: 0; }
        .tpl-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
        .tpl-modal-title { font-size: 15px; font-weight: 800; color: var(--text); }
        .tpl-modal-close { background: none; border: none; cursor: pointer; font-size: 24px; color: var(--muted); line-height: 1; }
        .tpl-modal-body { padding: 20px; }
        .tpl-error { background: var(--red-light); border: 1px solid var(--red-border); color: var(--red); padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
        .tpl-field { margin-bottom: 14px; }
        .tpl-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 5px; display: block; }
        .tpl-seg { display: flex; gap: 8px; }
        .tpl-seg-btn { flex: 1; padding: 9px; border-radius: 9px; border: 1.5px solid var(--border); background: #fff; color: var(--text2); font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .tpl-seg-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }
        .tpl-textarea { min-height: 140px; resize: vertical; line-height: 1.55; font-size: 13.5px; }
        .tpl-ph-chip { padding: 4px 10px; font-size: 11.5px; font-weight: 700; background: var(--surface2); border: 1px dashed var(--border); color: var(--text2); font-family: monospace; }
        .tpl-check { display: flex; align-items: center; gap: 8px; margin: 4px 0 18px; cursor: pointer; font-size: 13px; color: var(--text2); }
        .tpl-check input { width: 16px; height: 16px; }
        .tpl-modal-actions { display: flex; gap: 8px; }
        .tpl-modal-actions .btn { flex: 1; justify-content: center; padding: 11px; }

        @media (max-width: 640px) {
          .tpl-grid { grid-template-columns: 1fr; }
          .tpl-modal-overlay { padding: 0; align-items: flex-end; }
          .tpl-modal { width: 100%; max-height: 94vh; border-radius: 16px 16px 0 0; }
          .tpl-modal-body { padding: 16px; }
        }
      `}</style>
    </div>
  )
}
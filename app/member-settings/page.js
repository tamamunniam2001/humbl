'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const normPhone = (v) => String(v || '').replace(/[\s\-().]/g, '')

const EMPTY_FORM = { name: '', phone: '' }

export default function MemberSettingsPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null) // null = tambah baru
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/members')
      setMembers(res.data)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function startAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  function startEdit(m) {
    setEditingId(m.id)
    setForm({ name: m.name, phone: m.phone })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const phone = normPhone(form.phone)
    if (!name) { setError('Nama member wajib diisi'); return }
    if (!/^\+?[0-9]{8,15}$/.test(phone)) { setError('Nomor telepon tidak valid (8–15 digit)'); return }

    setSaving(true)
    try {
      if (editingId) {
        await api.patch(`/members/${editingId}`, { name, phone })
      } else {
        await api.post('/members', { name, phone })
      }
      setEditingId(null)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan member')
    } finally { setSaving(false) }
  }

  async function handleToggle(m) {
    try {
      await api.patch(`/members/${m.id}`, { isActive: !m.isActive })
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal mengubah status') }
  }

  async function handleDelete(m) {
    if (!confirm(`Hapus member "${m.name}"? Riwayat transaksinya tetap aman.`)) return
    try {
      await api.delete(`/members/${m.id}`)
      if (editingId === m.id) startAdd()
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menghapus member') }
  }

  const q = search.trim().toLowerCase()
  const filtered = members.filter(m => !q || m.name.toLowerCase().includes(q) || m.phone.includes(search.trim()))
  const activeCount = members.filter(m => m.isActive).length


  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        {/* Topbar */}
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Pengaturan Member</div>
            <div className="topbar-sub">Daftarkan member dengan nama &amp; nomor telepon</div>
          </div>
        </div>

        <div className="content">
          {/* Statistik */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Total Member', value: members.length, color: '#4A7CC7', bg: '#EBF1FB', border: '#C0D0E8' },
              { label: 'Member Aktif', value: activeCount, color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
              { label: 'Nonaktif', value: members.length - activeCount, color: '#64748B', bg: '#F1F5F9', border: '#D8E0EA' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{loading ? '…' : s.value}</div>
              </div>
            ))}
          </div>

          {/* Form tambah / edit */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: '16px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>
              {editingId ? 'Edit Member' : 'Tambah Member Baru'}
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
              <div>
                <label className="label">Nama Member</label>
                <input className="input" placeholder="mis. Budi Santoso" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Nomor Telepon</label>
                <input className="input" placeholder="mis. 081234567890" inputMode="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Tambah Member'}
                </button>
                {editingId && (
                  <button type="button" className="btn" onClick={startAdd}>Batal</button>
                )}
              </div>
            </form>
            {error && <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: 'var(--red)' }}>{error}</div>}
          </div>

          {/* Pencarian */}
          <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: '340px' }} placeholder="Cari nama atau nomor telepon…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{filtered.length} member</span>
          </div>

          {/* Daftar member */}
          {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '44px', marginBottom: '10px' }}>👥</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                {members.length === 0 ? 'Belum ada member' : 'Tidak ditemukan'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                {members.length === 0 ? 'Isi form di atas untuk mendaftarkan member pertama' : 'Coba kata kunci lain'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                      {['Nama', 'Nomor Telepon', 'Status', 'Terdaftar', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', background: editingId === m.id ? 'rgba(74,124,199,0.06)' : undefined }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text)' }}>{m.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text2)' }}>{m.phone}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${m.isActive ? 'badge-green' : 'badge-gray'}`}>
                            {m.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '12px' }}>{fmtDate(m.createdAt)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => startEdit(m)}>Edit</button>
                            <button className="btn" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleToggle(m)}>
                              {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDelete(m)}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


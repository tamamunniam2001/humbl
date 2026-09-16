'use client'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import * as XLSX from 'xlsx'

const empty = { code: '', name: '', unit: '', price: '', packSize: '' }
const fmt = (n) => Number(n).toLocaleString('id-ID')

export default function IngredientsPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    const res = await api.get('/admin/ingredients')
    setItems(res.data)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (editId) await api.put(`/admin/ingredients/${editId}`, form)
    else await api.post('/admin/ingredients', form)
    setForm(empty); setEditId(null); setShowForm(false); load()
  }

  function startEdit(item) {
    setForm({
      code: item.code || '',
      name: item.name,
      unit: item.unit,
      price: item.price ?? '',
      packSize: item.packSize ?? '',
    })
    setEditId(item.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function downloadCSV() {
    const rows = [['No', 'Kode', 'Nama Bahan Baku', 'Satuan', 'Harga/Pack', 'Isi/Pack', 'Harga/Satuan']]
    sorted.forEach((item, i) => {
      const perUnit = item.price && item.packSize ? (item.price / item.packSize) : ''
      rows.push([i + 1, item.code || '', item.name, item.unit, item.price || '', item.packSize || '', perUnit ? perUnit.toFixed(2) : ''])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `bahan_baku_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Kode', 'Nama Bahan', 'Satuan'],
      ['BB-001', 'Kopi Arabika', 'gram'],
      ['BB-002', 'Susu Full Cream', 'ml'],
      ['BB-003', 'Gula Pasir', 'gram'],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bahan Baku')
    XLSX.writeFile(wb, 'template_bahan_baku.xlsx')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/admin/ingredients/bulk-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      load()
    } catch (e) {
      setImportResult({ error: e.response?.data?.message || 'Gagal mengimpor file' })
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sorted = [...items].sort((a, b) => {
    const va = (a[sortField] || '').toString().toLowerCase()
    const vb = (b[sortField] || '').toString().toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  async function handleDelete(id) {
    if (!confirm('Hapus bahan baku ini?')) return
    await api.delete(`/admin/ingredients/${id}`); load()
  }

  // Harga per satuan dihitung otomatis: price / packSize
  const pricePerUnit = form.price && form.packSize && Number(form.packSize) > 0
    ? (Number(form.price) / Number(form.packSize))
    : null

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Bahan Baku</div>
            <div className="topbar-sub">{items.length} bahan terdaftar</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={downloadCSV} disabled={items.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button className="btn btn-ghost" onClick={downloadTemplate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Template
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
            <button className="btn" style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }}
              onClick={() => fileRef.current.click()} disabled={importing}>
              {importing
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Mengimpor...</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Import Excel</>}
            </button>
            <button className="btn btn-primary" onClick={() => { setForm(empty); setEditId(null); setShowForm(!showForm) }}>
              {showForm
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Tutup</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Bahan</>}
            </button>
          </div>
        </div>

        <div className="content">
          {importResult && (
            <div className="slide-down" style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', marginTop: '1px' }}>{importResult.error ? '❌' : '✅'}</span>
                <div>
                  {importResult.error
                    ? <div style={{ fontSize: '13px', fontWeight: '600', color: '#EF4444' }}>{importResult.error}</div>
                    : <>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>Import berhasil</div>
                        <div style={{ fontSize: '12px', color: '#4A5578', display: 'flex', gap: '16px' }}>
                          <span>✚ <b>{importResult.created}</b> ditambahkan</span>
                          <span>↻ <b>{importResult.updated}</b> diperbarui</span>
                          <span>⊘ <b>{importResult.skipped}</b> dilewati</span>
                        </div>
                        {importResult.errors?.length > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#EF4444' }}>
                            {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                          </div>
                        )}
                      </>}
                </div>
              </div>
              <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {showForm && (
            <div className="card slide-down" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', background: editId ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'linear-gradient(135deg, #10B981, #34D399)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1526' }}>{editId ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>Isi detail bahan baku dan harga pembelian</div>
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ marginBottom: '16px' }}>
                  <div>
                    <label className="label">Kode Bahan <span style={{ color: '#94A3B8', fontWeight: '400' }}>(opsional)</span></label>
                    <input className="input" placeholder="BB-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Satuan</label>
                    <input className="input" placeholder="gram, ml, pcs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Nama Bahan Baku</label>
                    <input className="input" placeholder="Kopi Arabika" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                </div>

                {/* Harga */}
                <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Harga Pembelian <span style={{ fontWeight: '400', textTransform: 'none' }}>(opsional)</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="label">Harga Beli per Pack/Kemasan</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>Rp</span>
                        <input className="input" type="number" placeholder="0" value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          style={{ paddingLeft: '36px' }} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Isi per Pack ({form.unit || 'satuan'})</label>
                      <input className="input" type="number" placeholder={`misal: 1000 ${form.unit || 'gram'}`}
                        value={form.packSize}
                        onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
                    </div>
                  </div>
                  {/* Preview harga per satuan */}
                  {pricePerUnit !== null && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: '#EFF4FF', borderRadius: '8px', border: '1px solid #C7D4F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Harga per {form.unit || 'satuan'}</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>
                        Rp {pricePerUnit < 1 ? pricePerUnit.toFixed(4) : fmt(Math.round(pricePerUnit))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="divider" />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Simpan
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  {[['code', 'Kode'], ['name', 'Nama Bahan Baku'], ['unit', 'Satuan']].map(([field, label]) => (
                    <th key={field} onClick={() => toggleSort(field)}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {label}
                        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', opacity: sortField === field ? 1 : 0.3 }}>
                          <svg width="8" height="5" viewBox="0 0 8 5" fill={sortField === field && sortDir === 'asc' ? '#2563EB' : '#94A3B8'}><path d="M4 0L8 5H0z"/></svg>
                          <svg width="8" height="5" viewBox="0 0 8 5" fill={sortField === field && sortDir === 'desc' ? '#2563EB' : '#94A3B8'}><path d="M4 5L0 0H8z"/></svg>
                        </span>
                      </span>
                    </th>
                  ))}
                  <th>Harga/Pack</th>
                  <th>Isi/Pack</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Harga/Satuan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, i) => {
                  const perUnit = item.price && item.packSize && item.packSize > 0
                    ? item.price / item.packSize
                    : null
                  return (
                    <tr key={item.id}>
                      <td style={{ color: '#94A3B8', fontSize: '13px', width: '60px' }}>{i + 1}</td>
                      <td>
                        {item.code
                          ? <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.code}</span>
                          : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                      </td>
                      <td style={{ fontWeight: '600', color: '#0D1526' }}>{item.name}</td>
                      <td><span className="badge badge-green">{item.unit}</span></td>
                      <td style={{ fontSize: '13px', color: item.price ? 'var(--text)' : '#CBD5E1' }}>
                        {item.price ? `Rp ${fmt(item.price)}` : '—'}
                      </td>
                      <td style={{ fontSize: '13px', color: item.packSize ? 'var(--text)' : '#CBD5E1' }}>
                        {item.packSize ? `${fmt(item.packSize)} ${item.unit}` : '—'}
                      </td>
                      <td>
                        {perUnit !== null ? (
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', background: '#EFF4FF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #C7D4F0', whiteSpace: 'nowrap' }}>
                            Rp {perUnit < 1 ? perUnit.toFixed(4) : fmt(Math.round(perUnit))}/{item.unit}
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn" style={{ background: '#EFF4FF', color: '#2563EB', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }} onClick={() => startEdit(item)}>Edit</button>
                          <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleDelete(item.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧪</div>
                    <div>Belum ada bahan baku</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import * as XLSX from 'xlsx'

const emptyForm = { code: '', name: '', unit: '', price: '', packSize: '', yield: '', isComposite: false, components: [] }
const fmt = (n) => Number(n).toLocaleString('id-ID')

function calcCompositePrice(components, allItems) {
  return components.reduce((sum, c) => {
    const ing = allItems.find(i => i.id === c.ingredientId)
    if (!ing?.price || !ing?.packSize) return sum
    return sum + (ing.price / ing.packSize) * Number(c.qty)
  }, 0)
}

export default function IngredientsPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [compSearch, setCompSearch] = useState('')
  const fileRef = useRef(null)

  async function load() {
    const res = await api.get('/admin/ingredients')
    setItems(res.data)
    return res.data
  }
  useEffect(() => { load() }, [])

  function generateIngredientCode(itemList) {
    const nums = itemList
      .map(i => i.code?.match(/^BB-?(\d+)$/i)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `BB-${String(next).padStart(3, '0')}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = { ...form }
    if (form.isComposite) payload.packSize = form.yield ? Number(form.yield) : 1
    if (editId) await api.put(`/admin/ingredients/${editId}`, payload)
    else await api.post('/admin/ingredients', payload)
    setForm(emptyForm); setEditId(null); setShowForm(false); setCompSearch(''); load()
  }

  function startEdit(item) {
    setForm({
      code: item.code || '', name: item.name, unit: item.unit,
      price: item.price ?? '', packSize: item.packSize ?? '',
      isComposite: item.isComposite || false,
      yield: item.isComposite ? (item.packSize ?? '') : '',
      components: (item.components || []).map(c => ({ ingredientId: c.ingredientId, qty: c.qty })),
    })
    setEditId(item.id); setShowForm(true); setCompSearch('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleComponent(ing) {
    setForm(prev => {
      const exists = prev.components.find(c => c.ingredientId === ing.id)
      if (exists) return { ...prev, components: prev.components.filter(c => c.ingredientId !== ing.id) }
      return { ...prev, components: [...prev.components, { ingredientId: ing.id, qty: '' }] }
    })
  }

  function updateComponentQty(ingredientId, qty) {
    setForm(prev => ({ ...prev, components: prev.components.map(c => c.ingredientId === ingredientId ? { ...c, qty } : c) }))
  }

  function downloadCSV() {
    const rows = [['No', 'Kode', 'Nama', 'Satuan', 'Harga/Pack', 'Isi/Pack', 'Harga/Satuan', 'Tipe']]
    sorted.forEach((item, i) => {
      const perUnit = item.price && item.packSize ? item.price / item.packSize : ''
      rows.push([i + 1, item.code || '', item.name, item.unit, item.price || '', item.packSize || '', perUnit ? perUnit.toFixed(2) : '', item.isComposite ? 'Jadi' : 'Bahan'])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `bahan_baku_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Kode','Nama Bahan','Satuan'],['BB-001','Kopi Arabika','gram'],['BB-002','Susu Full Cream','ml']])
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bahan Baku')
    XLSX.writeFile(wb, 'template_bahan_baku.xlsx')
  }

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/admin/ingredients/bulk-import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult(res.data); load()
    } catch (err) { setImportResult({ error: err.response?.data?.message || 'Gagal mengimpor file' }) }
    finally { setImporting(false); fileRef.current.value = '' }
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
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

  const pricePerUnit = !form.isComposite && form.price && form.packSize && Number(form.packSize) > 0
    ? Number(form.price) / Number(form.packSize) : null
  const compositePreviewPrice = form.isComposite && form.components.length > 0
    ? calcCompositePrice(form.components, items) : null
  const availableForComp = items.filter(i =>
    !i.isComposite && (!editId || i.id !== editId) &&
    (compSearch === '' || i.name.toLowerCase().includes(compSearch.toLowerCase()))
  )

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Bahan Baku</div>
            <div className="topbar-sub">{items.filter(i => !i.isComposite).length} bahan · {items.filter(i => i.isComposite).length} bahan jadi</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={downloadCSV} disabled={items.length === 0}>Export CSV</button>
            <button className="btn btn-ghost" onClick={downloadTemplate}>Template</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
            <button className="btn" style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }} onClick={() => fileRef.current.click()} disabled={importing}>
              {importing ? 'Mengimpor...' : 'Import Excel'}
            </button>
            <button className="btn btn-primary" onClick={async () => {
              if (!showForm) {
                const list = items.length > 0 ? items : (await load())
                setForm({ ...emptyForm, code: generateIngredientCode(list) })
              } else {
                setForm(emptyForm)
              }
              setEditId(null); setShowForm(!showForm); setCompSearch('')
            }}>
              {showForm ? 'Tutup' : '+ Tambah Bahan'}
            </button>
          </div>
        </div>

        <div className="content">
          {importResult && (
            <div style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: importResult.error ? '#EF4444' : '#10B981', fontWeight: '600' }}>
                {importResult.error || `Import berhasil: +${importResult.created} ditambahkan, ${importResult.updated} diperbarui`}
              </div>
              <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
          )}

          {showForm && (
            <div className="card slide-down" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', background: form.isComposite ? 'linear-gradient(135deg,#10B981,#34D399)' : 'linear-gradient(135deg,#2563EB,#60A5FA)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{editId ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>Bahan biasa atau bahan baku jadi (sub-recipe)</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[{ label: 'Bahan Baku Biasa', value: false, color: 'var(--accent)', bg: '#EFF4FF', border: '#C7D4F0' }, { label: '🧪 Bahan Baku Jadi', value: true, color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' }].map(({ label, value, color, bg, border }) => (
                  <button key={String(value)} type="button"
                    onClick={() => setForm(prev => ({ ...prev, isComposite: value, components: [], price: '', packSize: '' }))}
                    style={{ padding: '8px 18px', borderRadius: '20px', border: `1.5px solid ${form.isComposite === value ? border : 'var(--border)'}`, background: form.isComposite === value ? bg : '#fff', color: form.isComposite === value ? color : 'var(--text2)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ marginBottom: '16px' }}>
                  <div>
                    <label className="label">Kode <span style={{ color: '#94A3B8', fontWeight: '400' }}>(opsional)</span></label>
                    <input className="input" placeholder="BB-001" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Satuan</label>
                    <input className="input" placeholder="gram, ml, pcs, porsi" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Nama Bahan Baku</label>
                    <input className="input" placeholder={form.isComposite ? 'misal: Espresso Shot, Sirup Gula' : 'misal: Kopi Arabika'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                </div>

                {!form.isComposite ? (
                  <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Harga Pembelian <span style={{ fontWeight: '400', textTransform: 'none' }}>(opsional)</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="label">Harga Beli per Pack</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>Rp</span>
                          <input className="input" type="number" placeholder="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ paddingLeft: '36px' }} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Isi per Pack ({form.unit || 'satuan'})</label>
                        <input className="input" type="number" placeholder="1000" value={form.packSize} onChange={e => setForm({ ...form, packSize: e.target.value })} />
                      </div>
                    </div>
                    {pricePerUnit !== null && (
                      <div style={{ marginTop: '12px', padding: '10px 14px', background: '#EFF4FF', borderRadius: '8px', border: '1px solid #C7D4F0', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Harga per {form.unit || 'satuan'}</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>Rp {pricePerUnit < 1 ? pricePerUnit.toFixed(4) : fmt(Math.round(pricePerUnit))}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#F0FDF4', borderRadius: '10px', padding: '16px', border: '1px solid #A7F3D0', marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                      Komponen Bahan Baku
                      {form.components.length > 0 && <span style={{ marginLeft: '8px', background: '#10B981', color: '#fff', padding: '1px 7px', borderRadius: '10px', fontSize: '10px' }}>{form.components.length} dipilih</span>}
                    </div>
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input className="input" style={{ paddingLeft: '30px', fontSize: '12px' }} placeholder="Cari bahan baku..." value={compSearch} onChange={e => setCompSearch(e.target.value)} />
                    </div>
                    <div style={{ border: '1px solid #A7F3D0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', background: '#fff', marginBottom: '10px' }}>
                      {availableForComp.length === 0
                        ? <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>Tidak ada bahan baku biasa tersedia</div>
                        : availableForComp.map(ing => {
                          const sel = form.components.find(c => c.ingredientId === ing.id)
                          const perUnit = ing.price && ing.packSize ? ing.price / ing.packSize : null
                          return (
                            <div key={ing.id} onClick={() => toggleComponent(ing)}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderBottom: '1px solid #F0FDF4', background: sel ? '#ECFDF5' : 'transparent', cursor: 'pointer' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${sel ? '#10B981' : '#CBD5E1'}`, background: sel ? '#10B981' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {sel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: sel ? '600' : '400', color: '#0D1526' }}>{ing.name}</div>
                                {perUnit && <div style={{ fontSize: '10px', color: '#94A3B8' }}>Rp {perUnit < 1 ? perUnit.toFixed(4) : fmt(Math.round(perUnit))}/{ing.unit}</div>}
                              </div>
                              <span style={{ fontSize: '11px', color: '#94A3B8', background: '#F1F5FB', padding: '2px 6px', borderRadius: '6px' }}>{ing.unit}</span>
                              {sel && (
                                <input type="number" step="0.01" min="0.01" placeholder="Qty"
                                  value={sel.qty} onClick={e => e.stopPropagation()}
                                  onChange={e => updateComponentQty(ing.id, e.target.value)}
                                  style={{ width: '70px', padding: '4px 8px', border: '1.5px solid #10B981', borderRadius: '6px', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
                              )}
                            </div>
                          )
                        })}
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <label className="label">Hasil / Yield ({form.unit || 'satuan'}) <span style={{ color: '#94A3B8', fontWeight: '400' }}>(opsional)</span></label>
                      <input className="input" type="number" placeholder={`misal: 500 (${form.unit || 'satuan'} yang dihasilkan)`} value={form.yield} onChange={e => setForm({ ...form, yield: e.target.value })} style={{ fontSize: '13px' }} />
                    </div>
                    {compositePreviewPrice !== null && compositePreviewPrice > 0 && (
                      <div style={{ marginTop: '10px', padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#065F46' }}>Total HPP Komponen</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#10B981' }}>Rp {fmt(Math.round(compositePreviewPrice))}</span>
                        </div>
                        {form.yield && Number(form.yield) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #A7F3D0' }}>
                            <span style={{ fontSize: '12px', color: '#065F46' }}>HPP per {form.unit || 'satuan'}</span>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#059669' }}>Rp {(compositePreviewPrice / Number(form.yield)) < 1 ? (compositePreviewPrice / Number(form.yield)).toFixed(4) : fmt(Math.round(compositePreviewPrice / Number(form.yield)))}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="divider" />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Simpan
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setCompSearch('') }}>Batal</button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  {[['code','Kode'],['name','Nama Bahan Baku'],['unit','Satuan']].map(([field, label]) => (
                    <th key={field} onClick={() => toggleSort(field)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {label}
                        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', opacity: sortField === field ? 1 : 0.3 }}>
                          <svg width="8" height="5" viewBox="0 0 8 5" fill={sortField === field && sortDir === 'asc' ? '#2563EB' : '#94A3B8'}><path d="M4 0L8 5H0z"/></svg>
                          <svg width="8" height="5" viewBox="0 0 8 5" fill={sortField === field && sortDir === 'desc' ? '#2563EB' : '#94A3B8'}><path d="M4 5L0 0H8z"/></svg>
                        </span>
                      </span>
                    </th>
                  ))}
                  <th>Tipe</th>
                  <th>Harga/Pack</th>
                  <th>Isi/Pack</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Harga/Satuan</th>
                  <th>Komponen</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, i) => {
                  const perUnit = item.price && item.packSize && item.packSize > 0 ? item.price / item.packSize : null
                  return (
                    <tr key={item.id}>
                      <td style={{ color: '#94A3B8', fontSize: '13px' }}>{i + 1}</td>
                      <td>{item.code ? <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.code}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ fontWeight: '600', color: '#0D1526' }}>{item.name}</td>
                      <td><span className="badge badge-green">{item.unit}</span></td>
                      <td>
                        {item.isComposite
                          ? <span style={{ fontSize: '11px', fontWeight: '700', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px' }}>🧪 Jadi</span>
                          : <span style={{ fontSize: '11px', color: '#94A3B8' }}>Biasa</span>}
                      </td>
                      <td style={{ fontSize: '13px', color: item.price ? 'var(--text)' : '#CBD5E1' }}>
                        {item.isComposite ? <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>auto</span> : (item.price ? `Rp ${fmt(item.price)}` : '—')}
                      </td>
                      <td style={{ fontSize: '13px', color: item.packSize ? 'var(--text)' : '#CBD5E1' }}>
                        {item.packSize ? `${fmt(item.packSize)} ${item.unit}` : '—'}
                      </td>
                      <td>
                        {perUnit !== null
                          ? <span style={{ fontSize: '13px', fontWeight: '700', color: item.isComposite ? '#059669' : 'var(--accent)', background: item.isComposite ? '#ECFDF5' : '#EFF4FF', padding: '3px 8px', borderRadius: '6px', border: `1px solid ${item.isComposite ? '#A7F3D0' : '#C7D4F0'}`, whiteSpace: 'nowrap' }}>Rp {perUnit < 1 ? perUnit.toFixed(4) : fmt(Math.round(perUnit))}/{item.unit}</span>
                          : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                      </td>
                      <td>
                        {item.isComposite && item.components?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {item.components.map(c => (
                              <span key={c.id} style={{ fontSize: '11px', color: '#4A5578', background: '#F1F5FB', padding: '2px 7px', borderRadius: '5px', whiteSpace: 'nowrap' }}>
                                {c.ingredient.name} × {c.qty % 1 === 0 ? c.qty : Number(c.qty).toFixed(2)} {c.ingredient.unit}
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
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
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
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

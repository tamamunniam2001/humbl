'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const empty = { code: '', name: '', category: '', satuan: '', satuanOpname: '', konversi: '', minimalStok: '' }

export default function ExpenseSettingsPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('items')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    const res = await api.get('/admin/expense-items')
    setItems(res.data)
  }

  async function loadCategories() {
    const res = await api.get('/admin/expense-categories')
    setCategories(res.data)
  }

  useEffect(() => { load(); loadCategories() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editId) await api.put(`/admin/expense-items/${editId}`, form)
      else await api.post('/admin/expense-items', form)
      setForm(empty); setEditId(null); load()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan item')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus item ini?')) return
    await api.delete(`/admin/expense-items/${id}`); load()
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    setCatSaving(true)
    try {
      await api.post('/admin/expense-categories', { name: newCat.trim() })
      setNewCat(''); loadCategories()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menyimpan') }
    finally { setCatSaving(false) }
  }

  async function handleDeleteCategory(id, name) {
    if (!id) return alert(`Kategori "${name}" berasal dari item yang ada, hapus melalui edit item.`)
    if (!confirm(`Hapus kategori "${name}"?`)) return
    try { await api.delete(`/admin/expense-categories/${id}`); loadCategories() }
    catch { alert('Gagal menghapus') }
  }

  function handleCancelEdit() { setForm(empty); setEditId(null) }
  function handleClearImport() { setImportResult(null) }

  async function handleSyncIngredients() {
    if (!confirm('Sync semua bahan baku (termasuk Bahan Baku Jadi) ke item pengeluaran dengan kategori "Persediaan"? Item yang sudah ada akan dilewati.')) return
    setSyncing(true)
    try {
      const res = await api.post('/admin/expense-items/sync-ingredients')
      setImportResult({ ...res.data, errors: [] })
      load()
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || 'Gagal sync' })
    } finally { setSyncing(false) }
  }
  function handleClickImport() { fileRef.current.click() }
  const handleSetTab = useCallback((key) => setActiveTab(key), [])
  const handleFormCode = useCallback(e => setForm(f => ({ ...f, code: e.target.value })), [])
  const handleFormName = useCallback(e => setForm(f => ({ ...f, name: e.target.value })), [])
  const handleFormSatuan = useCallback(e => setForm(f => ({ ...f, satuan: e.target.value })), [])
  const handleFormSatuanOpname = useCallback(e => setForm(f => ({ ...f, satuanOpname: e.target.value })), [])
  const handleFormKonversi = useCallback(e => setForm(f => ({ ...f, konversi: e.target.value })), [])
  const handleFormMinimalStok = useCallback(e => setForm(f => ({ ...f, minimalStok: e.target.value })), [])
  const handleFormCategory = useCallback(e => setForm(f => ({ ...f, category: e.target.value })), [])
  const handleNewCat = useCallback(e => setNewCat(e.target.value), [])
  const handleEditItem = useCallback((item) => {
    setForm({ code: item.code || '', name: item.name, category: item.category || '', satuan: item.satuan || '', satuanOpname: item.satuanOpname || '', konversi: item.konversi || '', minimalStok: item.minimalStok ?? '' })
    setEditId(item.id)
  }, [])

  const [search, setSearch] = useState('')
  const catNames = categories.map(c => c.name)
  const handleSearch = useCallback(e => setSearch(e.target.value), [])
  const filteredItems = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || '').toLowerCase().includes(search.toLowerCase()) || (i.category || '').toLowerCase().includes(search.toLowerCase())
  )

  function downloadTemplate() {
    const header = 'Kode,Nama,Kategori,Satuan'
    const contoh = [
     'BHN-001,Gula Pasir,Bahan Baku,kg',
     'BHN-002,Kopi Robusta,Bahan Baku,kg',
      'OPS-001,Air Isi Ulang,Operasional,galon',
      ',Plastik Kresek,Operasional,pcs',
    ].join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + contoh], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template-item-pengeluaran.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/admin/expense-items/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult(res.data)
      load()
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || 'Gagal import' })
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '80px' }}>
        <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px', height: 'auto', minHeight: '60px' }}>
          <div style={{ flex: 1 }}>
        <div className="topbar-title">Item Pengeluaran</div>
         <div className="topbar-sub">Kelola daftar item pengeluaran</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0' }}
              onClick={handleSyncIngredients} disabled={syncing}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.6 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
            {syncing ? 'Menyinkronkan...' : 'Sync dari Bahan Baku'}
            </button>
            <button className="btn btn-ghost" onClick={downloadTemplate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Template CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
            <button className="btn" style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }}
              onClick={handleClickImport} disabled={importing}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Mengimpor...' : 'Import CSV'}
            </button>
          </div>
        </div>

        <div className="content">
          {importResult && (
            <div className="slide-down" style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
               <span style={{ fontSize: '16px' }}>{importResult.error ? '❌' : '✅'}</span>
          <div>
                  {importResult.error
                    ? <div style={{ fontSize: '13px', fontWeight: '600', color: '#EF4444' }}>{importResult.error}</div>
                    : <>
                     <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>Import selesai</div>
                     <div style={{ fontSize: '12px', color: '#4A5578', display: 'flex', gap: '16px' }}>
                         <span>✚ <b>{importResult.created}</b> berhasil</span>
                         <span>⊘ <b>{importResult.skipped}</b> dilewati</span>
                         {importResult.restored > 0 && <span>↺ <b>{importResult.restored}</b> diaktifkan kembali</span>}
                   <span>∑ <b>{importResult.total}</b> total</span>
                        </div>
                    {importResult.errors?.length > 0 && (
                        <div style={{ marginTop: '8px', maxHeight: '100px', overflowY: 'auto', background: '#FEF2F2', borderRadius: '6px', padding: '8px 10px', border: '1px solid #FECACA' }}>
                            {importResult.errors.map((err, i) => <div key={i} style={{ fontSize: '11px', color: '#EF4444' }}>{err}</div>)}
                        </div>
                        )}
                      </>}
                </div>
              </div>
              <button onClick={handleClearImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="exp-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px', width: 'fit-content', maxWidth: '100%', border: '1px solid var(--border)' }}>
            {[['items', 'Daftar Item'], ['categories', 'Kategori']].map(([key, label]) => (
              <button key={key} onClick={() => handleSetTab(key)}
              style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
             background: activeTab === key ? 'var(--surface)' : 'transparent',
             color: activeTab === key ? 'var(--accent)' : 'var(--muted)',
             boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {label}
                {key === 'items' && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '10px' }}>{items.length}</span>}
                {key === 'categories' && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '10px' }}>{categories.length}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'items' && (
            <div className="exp-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
              {/* Form */}
              <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>
                 {editId ? 'Edit Item' : 'Tambah Item'}
                </div>
                <form onSubmit={handleSubmit}>
                  <label className="label">Kode <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" placeholder="BHN-001" value={form.code}
                    onChange={handleFormCode} style={{ marginBottom: '12px' }} />
                  <label className="label">Nama Item</label>
                  <input className="input" placeholder="Air Isi Ulang" value={form.name}
                    onChange={handleFormName} required style={{ marginBottom: '12px' }} />
            <label className="label">Satuan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" placeholder="pcs, kg, liter..." value={form.satuan}
                 onChange={handleFormSatuan} style={{ marginBottom: '12px' }} />
               <label className="label">Konversi Satuan Opname <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <input className="input" placeholder="Satuan opname (misal: pcs)" value={form.satuanOpname}
                      onChange={handleFormSatuanOpname} />
                    <input className="input" type="number" step="any" min="0" placeholder={`1 ${form.satuanOpname || 'pcs'} = ? ${form.satuan || 'satuan'}`} value={form.konversi}
                      onChange={handleFormKonversi} />
              </div>
                {form.satuanOpname && form.konversi && form.satuan && (
                 <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--accent-light)', borderRadius: '8px', border: '1px solid #C7D4F0', fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
                  1 {form.satuanOpname} = {form.konversi} {form.satuan}
                  </div>
                  )}
                  <label className="label">Minimal Stok <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" type="number" step="any" min="0" placeholder={`Misal: 2 ${form.satuanOpname || form.satuan || ''}`.trim()} value={form.minimalStok}
                    onChange={handleFormMinimalStok} style={{ marginBottom: '6px' }} />
                  <div style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    Dalam satuan {form.satuanOpname || form.satuan || 'opname'}. Jika stok opname ≤ angka ini, otomatis masuk Pantau Bahan Baku.
                  </div>
                  <label className="label">Kategori <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" placeholder="Pilih atau ketik kategori..." value={form.category}
                    onChange={handleFormCategory} style={{ marginBottom: '16px' }} list="cat-list" />
                  <datalist id="cat-list">
                    {catNames.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <div style={{ display: 'flex', gap: '8px' }}>
                 <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                   {editId ? 'Simpan' : 'Tambah'}
                  </button>
                    {editId && <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>Batal</button>}
                  </div>
                </form>
              </div>

              {/* List */}
              <div className="card" style={{ overflow: 'hidden' }}>
           <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="input" style={{ paddingLeft: '32px' }} placeholder="Cari nama, kode, atau kategori..." value={search} onChange={handleSearch} />
               </div>
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                  <table className="table" style={{ minWidth: '700px' }}>
                    <thead><tr><th>Kode</th><th>Nama</th><th>Satuan</th><th>Konversi Opname</th><th>Minimal Stok</th><th>Kategori</th><th>Aksi</th></tr></thead>
                    <tbody>
                   {filteredItems.map(item => (
                        <tr key={item.id}>
                        <td>{item.code ? <span className="badge badge-blue" style={{ fontFamily: 'monospace' }}>{item.code}</span> : null}</td>
                       <td style={{ fontWeight: '600' }}>{item.name}</td>
                     <td>{item.satuan ? <span className="badge badge-gray">{item.satuan}</span> : null}</td>
                        <td>{item.satuanOpname && item.konversi
                            ? <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C7D4F0' }}>1 {item.satuanOpname} = {item.konversi} {item.satuan}</span>
                         : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>}
                    </td>
                        <td>{item.minimalStok != null
                          ? <span className="badge badge-orange">{item.minimalStok} {item.satuanOpname || item.satuan}</span>
                          : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>}
                        </td>
                        <td>{item.category ? <span className="badge badge-blue">{item.category}</span> : null}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                           <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }}
                            onClick={() => handleEditItem(item)}>Edit</button>
                           <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }}
                             onClick={() => handleDelete(item.id)}>Hapus</button>
                          </div>
                        </td>
                        </tr>
                      ))}
                  {filteredItems.length === 0 && (
                       <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>{search ? 'Tidak ada item ditemukan' : 'Belum ada item'}</td></tr>
                      )}
                    </tbody>
               </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="exp-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>Tambah Kategori</div>
                <form onSubmit={handleAddCategory}>
                  <label className="label">Nama Kategori</label>
                  <input className="input" placeholder="Bahan Baku, Operasional..." value={newCat}
                    onChange={handleNewCat} required style={{ marginBottom: '16px' }} autoFocus />
               <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={catSaving}>
                  {catSaving ? 'Menyimpan...' : 'Tambah Kategori'}
                  </button>
                </form>
             <div style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '9px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
             Kategori yang ditambahkan di sini akan muncul sebagai pilihan saat menambah item pengeluaran dan saat input manual.
                </div>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                  {categories.length} Kategori
                </div>
                {categories.length === 0 ? (
               <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                 <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏷️</div>
                   <div style={{ fontSize: '13px' }}>Belum ada kategori</div>
                </div>
                ) : (
             <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 {categories.map((cat, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '9px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                       <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{cat.name}</span>
                         {!cat.id && <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '4px' }}>dari item</span>}
                     </div>
                        {cat.id && (
                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                     )}
                      </div>
                 ))}
                </div>
                )}
              </div>
            </div>
          )}
      </div>
      </main>
    </div>
  )
}

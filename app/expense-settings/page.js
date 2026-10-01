'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

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
  const [showFormModal, setShowFormModal] = useState(false)
  const fileRef = useRef(null)

  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'

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
      setForm(empty); setEditId(null); setShowFormModal(false); load()
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

  function handleCancelEdit() { setForm(empty); setEditId(null); setShowFormModal(false) }
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
    setForm({
      code: item.code || '',
      name: item.name,
      category: item.category || '',
      satuan: item.satuan || '',
      satuanOpname: item.satuanOpname || '',
      konversi: item.konversi || '',
      minimalStok: item.minimalStok ?? ''
    })
    setEditId(item.id)
    setShowFormModal(true)
  }, [])

  function handleOpenAddForm() {
    setForm(empty)
    setEditId(null)
    setShowFormModal(true)
  }

  const [search, setSearch] = useState('')
  const catNames = categories.map(c => c.name)
  const handleSearch = useCallback(e => setSearch(e.target.value), [])
  const filteredItems = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
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

  /* ── Form content (shared between modal and sidebar panel) ── */
  const FormContent = (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <label className="label">Kode <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
      <input className="input" placeholder="BHN-001" value={form.code}
        onChange={handleFormCode} style={{ marginBottom: '12px' }} />

      <label className="label">Nama Item</label>
      <input className="input" placeholder="Air Isi Ulang" value={form.name}
        onChange={handleFormName} required style={{ marginBottom: '12px' }} />

      <label className="label">Satuan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
      <input className="input" placeholder="pcs, kg, liter..." value={form.satuan}
        onChange={handleFormSatuan} style={{ marginBottom: '12px' }} />

      <label className="label">
        Konversi Satuan Opname <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Satuan opname</div>
          <input className="input" placeholder="misal: pcs" value={form.satuanOpname}
            onChange={handleFormSatuanOpname} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Nilai konversi</div>
          <input className="input" type="number" step="any" min="0"
            placeholder={`1 ${form.satuanOpname || 'pcs'} = ? ${form.satuan || 'satuan'}`}
            value={form.konversi} onChange={handleFormKonversi} />
        </div>
      </div>
      {form.satuanOpname && form.konversi && form.satuan && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--accent-light)', borderRadius: '8px', border: '1px solid #C7D4F0', fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
          1 {form.satuanOpname} = {form.konversi} {form.satuan}
        </div>
      )}

      <label className="label" style={{ marginTop: '4px' }}>
        Minimal Stok <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span>
      </label>
      <input className="input" type="number" step="any" min="0"
        placeholder={`Misal: 2 ${form.satuanOpname || form.satuan || ''}`.trim()}
        value={form.minimalStok} onChange={handleFormMinimalStok} style={{ marginBottom: '4px' }} />
      <div style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
        Dalam satuan {form.satuanOpname || form.satuan || 'opname'}. Jika stok opname ≤ angka ini, otomatis masuk Pantau Bahan Baku.
      </div>

      <label className="label">Kategori <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
      <input className="input" placeholder="Pilih atau ketik kategori..." value={form.category}
        onChange={handleFormCategory} style={{ marginBottom: '20px' }} list="cat-list" />
      <datalist id="cat-list">
        {catNames.map(c => <option key={c} value={c} />)}
      </datalist>

      <div style={{ display: 'flex', gap: '8px' }}>
        {(editId || isAdmin) && (
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            {editId ? 'Simpan Perubahan' : 'Tambah Item'}
          </button>
        )}
        {!editId && !isAdmin && (
          <div style={{ flex: 1, fontSize: '11px', color: 'var(--muted)', alignSelf: 'center', lineHeight: 1.5 }}>
            Operasional: tekan <b>Edit</b> pada item untuk mengisi minimal stok.
          </div>
        )}
        <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>Batal</button>
      </div>
    </form>
  )

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '80px' }}>

        {/* ── Topbar ── */}
        <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px', height: 'auto', minHeight: '60px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Item Pengeluaran</div>
            <div className="topbar-sub">Kelola daftar item pengeluaran</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0' }}
              onClick={handleSyncIngredients} disabled={syncing}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.6 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
              </svg>
              {syncing ? 'Menyinkronkan...' : 'Sync Bahan Baku'}
            </button>
            <button className="btn btn-ghost" onClick={downloadTemplate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Template
            </button>
            {isAdmin && (
              <>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
                <button className="btn" style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }}
                  onClick={handleClickImport} disabled={importing}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {importing ? 'Mengimpor...' : 'Import CSV'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="content">
          {/* ── Import result banner ── */}
          {importResult && (
            <div className="slide-down" style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px' }}>{importResult.error ? '❌' : '✅'}</span>
                <div>
                  {importResult.error
                    ? <div style={{ fontSize: '13px', fontWeight: '600', color: '#EF4444' }}>{importResult.error}</div>
                    : <>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>Import selesai</div>
                      <div style={{ fontSize: '12px', color: '#4A5578', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
              <button onClick={handleClearImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px', width: 'fit-content', maxWidth: '100%', border: '1px solid var(--border)' }}>
            {[['items', 'Daftar Item'], ['categories', 'Kategori']].map(([key, label]) => (
              <button key={key} onClick={() => handleSetTab(key)}
                style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: activeTab === key ? 'var(--surface)' : 'transparent', color: activeTab === key ? 'var(--accent)' : 'var(--muted)', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {label}
                <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '10px' }}>
                  {key === 'items' ? items.length : categories.length}
                </span>
              </button>
            ))}
          </div>

          {/* ── Items Tab ── */}
          {activeTab === 'items' && (
            <>
              {/* Search + Tambah button row */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input className="input" style={{ paddingLeft: '32px' }} placeholder="Cari nama, kode, atau kategori..." value={search} onChange={handleSearch} />
                </div>
                {isAdmin && (
                  <button className="btn btn-primary" onClick={handleOpenAddForm} style={{ flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Tambah Item
                  </button>
                )}
              </div>

              {/* Item cards — mobile friendly */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredItems.length === 0 ? (
                  <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📦</div>
                    <div style={{ fontSize: '13px' }}>{search ? 'Tidak ada item ditemukan' : 'Belum ada item'}</div>
                  </div>
                ) : filteredItems.map(item => (
                  <div key={item.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Left: info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)' }}>{item.name}</span>
                        {item.code && (
                          <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.code}</span>
                        )}
                        {item.category && (
                          <span className="badge badge-blue" style={{ fontSize: '11px' }}>{item.category}</span>
                        )}
                      </div>

                      {/* Satuan row */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.satuan ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Satuan:</span>
                            <span className="badge badge-gray" style={{ fontSize: '11px' }}>{item.satuan}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Satuan: —</span>
                        )}

                        {item.satuanOpname && item.konversi ? (
                          <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C7D4F0', fontSize: '11px' }}>
                            1 {item.satuanOpname} = {item.konversi} {item.satuan}
                          </span>
                        ) : null}

                        {item.minimalStok != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Min:</span>
                            <span className="badge badge-orange" style={{ fontSize: '11px' }}>
                              {item.minimalStok} {item.satuanOpname || item.satuan || ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignSelf: 'center' }}>
                      <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '6px 14px', fontSize: '12px' }}
                        onClick={() => handleEditItem(item)}>Edit</button>
                      {isAdmin && (
                        <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => handleDelete(item.id)}>Hapus</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Categories Tab ── */}
          {activeTab === 'categories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
              {/* Add form */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>Tambah Kategori</div>
                <form onSubmit={handleAddCategory}>
                  <label className="label">Nama Kategori</label>
                  <input className="input" placeholder="Bahan Baku, Operasional..." value={newCat}
                    onChange={handleNewCat} required style={{ marginBottom: '12px' }} autoFocus />
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={catSaving}>
                    {catSaving ? 'Menyimpan...' : 'Tambah Kategori'}
                  </button>
                </form>
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '9px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  Kategori akan muncul sebagai pilihan saat menambah item pengeluaran dan input manual.
                </div>
              </div>

              {/* List */}
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
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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

      {/* ── Modal Edit / Tambah ── */}
      {showFormModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) handleCancelEdit() }}
          className="exp-modal-overlay"
        >
          <div className="exp-modal-sheet">
            {/* Handle bar — only visible on mobile bottom sheet */}
            <div className="exp-modal-handle-wrap">
              <div className="exp-modal-handle" />
            </div>

            {/* Header */}
            <div style={{ padding: '12px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text)' }}>
                {editId ? 'Edit Item' : 'Tambah Item'}
              </div>
              <button onClick={handleCancelEdit} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px', flex: 1 }}>
              {FormContent}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .exp-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15,22,35,0.45);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .exp-modal-sheet {
          background: var(--surface);
          width: 100%;
          max-width: 520px;
          border-radius: 20px 20px 0 0;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          max-height: 92dvh;
          overflow: hidden;
        }
        .exp-modal-handle-wrap {
          padding: 12px 20px 0;
          display: flex;
          justify-content: center;
        }
        .exp-modal-handle {
          width: 40px;
          height: 4px;
          border-radius: 2px;
          background: var(--border2);
        }
        @media (min-width: 640px) {
          .exp-modal-overlay {
            align-items: center;
            padding: 24px;
          }
          .exp-modal-sheet {
            border-radius: 16px;
            max-height: 88dvh;
          }
          .exp-modal-handle-wrap {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

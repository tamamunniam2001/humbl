'use client'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import * as XLSX from 'xlsx'

const empty = { code: '', name: '', price: '', stock: '', categoryId: '', imageUrl: '' }
const emptyIng = { ingredientId: '', qty: '' }

const fmtRp = (n) => Number(n).toLocaleString('id-ID')

function calcHpp(selectedIngredients, allIngredients) {
  return selectedIngredients.reduce((sum, sel) => {
    const ing = allIngredients.find(i => i.id === sel.ingredientId)
    if (!ing || !ing.price || !ing.packSize || !sel.qty) return sum
    const perUnit = ing.price / ing.packSize
    return sum + perUnit * Number(sel.qty)
  }, 0)
}

function IngredientSearch({ allIngredients, selectedIngredients, onToggle, onQtyChange }) {
  const [search, setSearch] = useState('')
  const filtered = allIngredients
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const asel = selectedIngredients.some(s => s.ingredientId === a.id) ? 0 : 1
      const bsel = selectedIngredients.some(s => s.ingredientId === b.id) ? 0 : 1
      return asel - bsel
    })
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="input" style={{ paddingLeft: '34px', fontSize: '13px' }} placeholder="Cari bahan..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ border: '1.5px solid #E8EDF8', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto', background: '#FAFBFF' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Bahan tidak ditemukan</div>
        ) : filtered.map((ing) => {
          const sel = selectedIngredients.find((s) => s.ingredientId === ing.id)
          const perUnit = ing.price && ing.packSize ? ing.price / ing.packSize : null
          const lineHpp = perUnit && sel?.qty ? perUnit * Number(sel.qty) : null
          return (
            <div key={ing.id}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: '1px solid #F1F5FB', background: sel ? '#EFF4FF' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
              onClick={() => onToggle(ing)}>
              <div style={{ width: '17px', height: '17px', borderRadius: '5px', border: `2px solid ${sel ? '#2563EB' : '#CBD5E1'}`, background: sel ? '#2563EB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {sel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: sel ? '600' : '400', color: '#0D1526' }}>{ing.name}</div>
                {perUnit && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>Rp {perUnit < 1 ? perUnit.toFixed(4) : fmtRp(Math.round(perUnit))}/{ing.unit}</div>}
              </div>
              <span className="badge badge-blue" style={{ fontSize: '10px' }}>{ing.unit}</span>
              {sel && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={sel.qty}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onQtyChange(ing.id, e.target.value)}
                    style={{ width: '72px', padding: '4px 8px', border: '1.5px solid #2563EB', borderRadius: '7px', fontSize: '12px', outline: 'none', background: '#fff', fontFamily: 'inherit', color: '#0D1526' }}
                    placeholder="Qty"
                  />
                  {lineHpp !== null && <span style={{ fontSize: '10px', color: '#2A9D6E', fontWeight: '600' }}>Rp {fmtRp(Math.round(lineHpp))}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {selectedIngredients.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#2563EB', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {selectedIngredients.length} bahan dipilih
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allIngredients, setAllIngredients] = useState([])
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [formIngredients, setFormIngredients] = useState([])

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  const [showCatPanel, setShowCatPanel] = useState(false)
  const [catForm, setCatForm] = useState('')
  const [catEditId, setCatEditId] = useState(null)
  const [catError, setCatError] = useState('')

  const [ingModal, setIngModal] = useState(null)
  const [ingForm, setIngForm] = useState(emptyIng)
  const [selectedCat, setSelectedCat] = useState(null)
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  function handleSort(key) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  async function load() {
    const [p, c, ing] = await Promise.all([
      api.get('/products'),
      api.get('/admin/categories'),
      api.get('/admin/ingredients'),
    ])
    setProducts(p.data)
    setCategories(c.data)
    setAllIngredients(ing.data)
    return p.data
  }

  function generateProductCode(productList) {
    const nums = productList
      .map(p => p.code?.match(/^PRD-?(\d+)$/i)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `PRD-${String(next).padStart(3, '0')}`
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Kode', 'Nama Produk', 'Harga', 'Stok', 'Kategori', 'URL Gambar'],
      ['KP-001', 'Kopi Susu', 15000, 50, 'Minuman', ''],
      ['MK-001', 'Mie Goreng', 20000, 30, 'Makanan', ''],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, 'template_produk.xlsx')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/products/bulk-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      load()
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || 'Gagal mengimpor file' })
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  async function handleCatSubmit(e) {
    e.preventDefault()
    if (!catForm.trim()) return
    setCatError('')
    try {
      if (catEditId) await api.put(`/admin/categories/${catEditId}`, { name: catForm.trim() })
      else await api.post('/admin/categories', { name: catForm.trim() })
      setCatForm(''); setCatEditId(null); load()
    } catch (err) {
      setCatError(err.response?.data?.message || 'Gagal menyimpan kategori')
    }
  }

  async function handleCatDelete(id) {
    setCatError('')
    try {
      await api.delete(`/admin/categories/${id}`)
      load()
    } catch (err) {
      setCatError(err.response?.data?.message || 'Gagal menghapus kategori')
    }
  }

  function startCatEdit(cat) {
    setCatEditId(cat.id); setCatForm(cat.name); setCatError('')
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) }
    let savedId = editId
    try {
      if (editId) {
        await api.put(`/products/${editId}`, payload)
      } else {
        const res = await api.post('/products', payload)
        savedId = res.data.id
      }
      if (!editId && formIngredients.length > 0 && savedId) {
        await Promise.all(
          formIngredients
            .filter((i) => i.qty > 0)
            .map((i) => api.post(`/products/${savedId}/ingredients`, { ingredientId: i.ingredientId, qty: Number(i.qty) }))
        )
      }
      setForm(empty); setEditId(null); setShowForm(false); setFormIngredients([]); load()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan produk')
    }
  }

  function startEdit(p) {
    setForm({ code: p.code || '', name: p.name, price: p.price, stock: p.stock, categoryId: p.categoryId, imageUrl: p.imageUrl || '' })
    setEditId(p.id); setShowForm(true)
    const mapped = (p.ingredients || []).map(item => ({ ingredientId: item.ingredientId, qty: item.qty }))
    setFormIngredients(mapped)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('Hapus produk ini?')) return
    await api.delete(`/products/${id}`); load()
  }

  function toggleFormIngredient(ing) {
    setFormIngredients((prev) => {
      const exists = prev.find((i) => i.ingredientId === ing.id)
      if (exists) return prev.filter((i) => i.ingredientId !== ing.id)
      return [...prev, { ingredientId: ing.id, qty: '' }]
    })
  }

  function updateFormIngredientQty(ingredientId, qty) {
    setFormIngredients((prev) => prev.map((i) => i.ingredientId === ingredientId ? { ...i, qty } : i))
  }

  async function openIngModal(p) {
    const res = await api.get(`/products/${p.id}/ingredients`)
    setIngModal({ productId: p.id, productName: p.name, items: res.data })
    setIngForm(emptyIng)
  }

  async function refreshIngModal(productId) {
    const res = await api.get(`/products/${productId}/ingredients`)
    setIngModal((prev) => ({ ...prev, items: res.data }))
  }

  async function handleAddIngredient(e) {
    e.preventDefault()
    if (!ingForm.ingredientId || !ingForm.qty) return
    await api.post(`/products/${ingModal.productId}/ingredients`, {
      ingredientId: ingForm.ingredientId,
      qty: Number(ingForm.qty),
    })
    setIngForm(emptyIng)
    refreshIngModal(ingModal.productId)
  }

  async function handleRemoveIngredient(id) {
    await api.delete(`/products/${ingModal.productId}/ingredients/${id}`)
    refreshIngModal(ingModal.productId)
  }

  const filtered = products
    .filter((p) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code || '').toLowerCase().includes(search.toLowerCase())) &&
      (!selectedCat || p.category?.name === selectedCat)
    )
    .sort((a, b) => {
      let av, bv
      if (sort.key === 'price' || sort.key === 'stock') { av = a[sort.key]; bv = b[sort.key] }
      else if (sort.key === 'category') { av = a.category?.name ?? ''; bv = b.category?.name ?? '' }
      else { av = (a[sort.key] || '').toLowerCase(); bv = (b[sort.key] || '').toLowerCase() }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">Produk</div>
            <div className="topbar-sub">{products.length} produk terdaftar</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => { setShowCatPanel(!showCatPanel); setCatForm(''); setCatEditId(null); setCatError('') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              Kategori
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
            <button className="btn btn-primary" onClick={async () => { 
              if (!showForm) {
                const p = products.length > 0 ? products : (await load())
                setForm({ ...empty, code: generateProductCode(p) })
              } else {
                setForm(empty)
              }
              setEditId(null); setFormIngredients([]); setShowForm(!showForm) 
            }}>
              {showForm ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Tutup</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Produk</>
              )}
            </button>
          </div>
        </div>

        <div className="content">
          {showCatPanel && (
            <div className="card slide-down" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1526' }}>Manajemen Kategori</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{categories.length} kategori terdaftar</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                {/* Form tambah/edit */}
                <div style={{ width: '260px', flexShrink: 0 }}>
                  <form onSubmit={handleCatSubmit}>
                    <label className="label">{catEditId ? 'Edit Nama Kategori' : 'Nama Kategori Baru'}</label>
                    <input
                      className="input"
                      placeholder="contoh: Minuman"
                      value={catForm}
                      onChange={(e) => { setCatForm(e.target.value); setCatError('') }}
                      required
                      style={{ marginBottom: '10px' }}
                    />
                    {catError && (
                      <div style={{ fontSize: '12px', color: '#EF4444', marginBottom: '10px', padding: '8px 10px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA' }}>{catError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {catEditId ? 'Simpan' : 'Tambah'}
                      </button>
                      {catEditId && (
                        <button type="button" className="btn btn-ghost" onClick={() => { setCatEditId(null); setCatForm(''); setCatError('') }}>Batal</button>
                      )}
                    </div>
                  </form>
                </div>

                {/* List kategori */}
                <div style={{ flex: 1, maxHeight: '280px', overflowY: 'auto' }}>
                  {categories.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px', background: '#FAFBFF', borderRadius: '10px', border: '1.5px dashed #E8EDF8' }}>Belum ada kategori</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {categories.map((cat) => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: catEditId === cat.id ? '#EFF4FF' : '#FAFBFF', borderRadius: '8px', border: `1px solid ${catEditId === cat.id ? '#C7D4F0' : '#E8EDF8'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6', flexShrink: 0 }} />
                            <span style={{ fontWeight: '600', fontSize: '13px', color: '#0D1526' }}>{cat.name}</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8', background: '#F1F5FB', padding: '2px 8px', borderRadius: '10px' }}>
                              {cat.activeCount ?? cat._count?.products ?? 0} produk aktif
                            </span>
                            {cat._count?.products > (cat.activeCount ?? 0) && (
                              <span style={{ fontSize: '11px', color: '#F59E0B', background: '#FFFBEB', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                                +{cat._count.products - (cat.activeCount ?? 0)} terhapus
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn" style={{ background: '#EFF4FF', color: '#2563EB', border: '1px solid #C7D4F0', padding: '4px 10px', fontSize: '12px' }} onClick={() => startCatEdit(cat)}>Edit</button>
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleCatDelete(cat.id)}>Hapus</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
          {/* Form */}
          {showForm && (
            <div className="card slide-down" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', background: editId ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'linear-gradient(135deg, #2563EB, #60A5FA)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">{editId ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}</svg>
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1526' }}>{editId ? 'Edit Produk' : 'Tambah Produk Baru'}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{editId ? 'Perbarui informasi produk' : 'Isi detail produk baru'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <div className="section-label">Informasi Produk</div>
                  <div className="form-grid">
                    <div>
                      <label className="label">Kode Produk</label>
                      <input className="input" placeholder="KPI-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                    </div>
                    <div>
                      <label className="label">Nama Produk</label>
                      <input className="input" placeholder="Cappuccino" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="label">Harga Jual (Rp)</label>
                      <input className="input" type="number" placeholder="25000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                      {(() => {
                        const hpp = calcHpp(formIngredients, allIngredients)
                        const price = Number(form.price)
                        if (!price || hpp === 0) return null
                        const margin = ((price - hpp) / hpp) * 100
                        const profit = price - hpp
                        const color = margin >= 50 ? '#2A9D6E' : margin >= 20 ? '#C47D1A' : '#C95555'
                        const bg = margin >= 50 ? '#E8F7F1' : margin >= 20 ? '#FDF4E3' : '#FEF2F2'
                        const border = margin >= 50 ? '#A7DFC8' : margin >= 20 ? '#F0D090' : '#FECACA'
                        return (
                          <div style={{ marginTop: '6px', padding: '8px 12px', background: bg, border: `1px solid ${border}`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>Margin · HPP Rp {fmtRp(Math.round(hpp))}</span>
                            <span style={{ fontSize: '13px', fontWeight: '800', color }}>{margin.toFixed(1)}% · +Rp {fmtRp(Math.round(profit))}</span>
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <label className="label">Stok</label>
                      <input className="input" type="number" placeholder="100" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
                    </div>
                    <div>
                      <label className="label">Kategori</label>
                      <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                        <option value="">Pilih Kategori</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">URL Gambar <span style={{ color: '#94A3B8', fontWeight: '400' }}>(opsional)</span></label>
                      <input className="input" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div className="section-label" style={{ margin: 0 }}>Bahan Baku</div>
                      {formIngredients.length > 0 && (
                        <span className="badge badge-blue">{formIngredients.length} dipilih</span>
                      )}
                    </div>
                    <IngredientSearch
                      allIngredients={allIngredients}
                      selectedIngredients={formIngredients}
                      onToggle={toggleFormIngredient}
                      onQtyChange={updateFormIngredientQty}
                    />
                    {(() => {
                      const hpp = calcHpp(formIngredients, allIngredients)
                      if (hpp === 0) return null
                      const price = Number(form.price)
                      const margin = price ? ((price - hpp) / hpp) * 100 : null
                      const profit = price ? price - hpp : null
                      const color = margin === null ? '#4A7CC7' : margin >= 50 ? '#2A9D6E' : margin >= 20 ? '#C47D1A' : '#C95555'
                      const bg = margin === null ? '#EBF1FB' : margin >= 50 ? '#E8F7F1' : margin >= 20 ? '#FDF4E3' : '#FEF2F2'
                      const border = margin === null ? '#C0D0E8' : margin >= 50 ? '#A7DFC8' : margin >= 20 ? '#F0D090' : '#FECACA'
                      return (
                        <div style={{ marginTop: '10px', padding: '10px 14px', background: bg, border: `1px solid ${border}`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>Total HPP Bahan Baku</div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color }}>Rp {fmtRp(Math.round(hpp))}</div>
                          </div>
                          {margin !== null && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>Margin · Profit</div>
                              <div style={{ fontSize: '15px', fontWeight: '800', color }}>{margin.toFixed(1)}% · +Rp {fmtRp(Math.round(profit))}</div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
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

          {/* Search + Filter Kategori */}
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative', maxWidth: '320px', flex: 1 }}>
                <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="input" style={{ paddingLeft: '36px' }} placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <span style={{ fontSize: '13px', color: '#94A3B8' }}>{filtered.length} hasil</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[{ label: 'Semua', value: null }, ...categories.map(c => ({ label: c.name, value: c.name }))].map(({ label, value }) => (
                <button key={label} onClick={() => setSelectedCat(value)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${selectedCat === value ? 'var(--accent)' : 'var(--border)'}`, background: selectedCat === value ? 'var(--accent)' : '#fff', color: selectedCat === value ? '#fff' : 'var(--text2)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  {[{ label: 'Kode', key: 'code' }, { label: 'Nama Produk', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Harga Jual', key: 'price' }, { label: 'HPP', key: null }, { label: 'Pajak (0.5%)', key: null }, { label: 'Profit', key: null }, { label: 'Margin', key: null }, { label: 'Stok', key: 'stock' }, { label: 'Bahan Baku', key: null }, { label: 'Aksi', key: null }].map(({ label, key }) => (
                    <th key={label} onClick={key ? () => handleSort(key) : undefined}
                      style={key ? { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' } : {}}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {label}
                        {key && (
                          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, opacity: sort.key === key ? 1 : 0.3 }}>
                            <svg width="8" height="5" viewBox="0 0 8 5" fill={sort.key === key && sort.dir === 'asc' ? '#2563EB' : '#94A3B8'}><path d="M4 0L8 5H0z"/></svg>
                            <svg width="8" height="5" viewBox="0 0 8 5" fill={sort.key === key && sort.dir === 'desc' ? '#2563EB' : '#94A3B8'} style={{ marginTop: '2px' }}><path d="M4 5L0 0H8z"/></svg>
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const hpp = (p.ingredients || []).reduce((sum, item) => {
                    const ing = item.ingredient
                    if (!ing?.price || !ing?.packSize) return sum
                    return sum + (ing.price / ing.packSize) * item.qty
                  }, 0)
                  const pajak = Math.round(p.price * 0.005)
                  const profit = hpp > 0 ? Math.round(p.price - hpp - pajak) : null
                  const margin = hpp > 0 && p.price ? ((p.price - hpp) / hpp) * 100 : null
                  const mColor = margin === null ? null : margin >= 50 ? '#2A9D6E' : margin >= 20 ? '#C47D1A' : '#C95555'
                  const mBg = margin === null ? null : margin >= 50 ? '#E8F7F1' : margin >= 20 ? '#FDF4E3' : '#FEF2F2'
                  const mBorder = margin === null ? null : margin >= 50 ? '#A7DFC8' : margin >= 20 ? '#F0D090' : '#FECACA'
                  return (
                  <tr key={p.id}>
                    <td><span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{p.code}</span></td>
                    <td style={{ fontWeight: '600', color: '#0D1526' }}>{p.name}</td>
                    <td><span className="badge badge-gray">{p.category?.name}</span></td>
                    <td style={{ fontWeight: '700', color: '#0D1526' }}>Rp {p.price.toLocaleString('id-ID')}</td>
                    <td>
                      {hpp > 0
                        ? <span style={{ fontSize: '12px', fontWeight: '700', color: '#4A7CC7' }}>Rp {fmtRp(Math.round(hpp))}</span>
                        : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#C47D1A' }}>Rp {fmtRp(pajak)}</span>
                    </td>
                    <td>
                      {profit !== null
                        ? <span style={{ fontSize: '12px', fontWeight: '700', color: profit >= 0 ? '#2A9D6E' : '#C95555' }}>Rp {fmtRp(profit)}</span>
                        : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                    </td>
                    <td>
                      {margin !== null
                        ? <span style={{ fontSize: '12px', fontWeight: '800', color: mColor, background: mBg, border: `1px solid ${mBorder}`, padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>{margin.toFixed(1)}%</span>
                        : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${p.stock < 10 ? 'badge-red' : 'badge-green'}`}>{p.stock}</span>
                    </td>
                    <td>
                      <button className="btn btn-success" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => openIngModal(p)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg>
                        {p.ingredients?.length > 0 ? `${p.ingredients.length} bahan` : 'Atur'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn" style={{ background: '#EFF4FF', color: '#2563EB', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }} onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleDelete(p.id)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                    <div>Tidak ada produk ditemukan</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Bahan Baku */}
      {ingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIngModal(null) }}>
          <div className="card fade-in" style={{ width: '580px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(13,21,38,0.18)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1E40AF, #2563EB)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Bahan Baku</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>{ingModal.productName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '20px' }}>
                  {ingModal.items.length} bahan
                </span>
                <button onClick={() => setIngModal(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '7px', display: 'flex', color: 'white' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            {/* Body: 2 kolom */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

              {/* Kiri: Tambah bahan */}
              <div style={{ width: '240px', flexShrink: 0, borderRight: '1px solid #E8EDF8', display: 'flex', flexDirection: 'column', background: '#FAFBFF' }}>
                <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid #E8EDF8' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#4A5578', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tambah Bahan</div>
                </div>
                <form onSubmit={handleAddIngredient} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {/* Search bahan */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', display: 'block', marginBottom: '5px' }}>CARI BAHAN</label>
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        className="input"
                        style={{ paddingLeft: '30px', fontSize: '12px', padding: '8px 10px 8px 30px' }}
                        placeholder="Ketik nama bahan..."
                        value={ingForm.search ?? ''}
                        onChange={(e) => setIngForm({ ...ingForm, search: e.target.value, ingredientId: '' })}
                      />
                    </div>
                  </div>

                  {/* List bahan hasil search */}
                  <div style={{ flex: 1, overflowY: 'auto', border: '1.5px solid #E8EDF8', borderRadius: '10px', background: '#fff', maxHeight: '220px' }}>
                    {(() => {
                      const q = (ingForm.search ?? '').toLowerCase()
                      const available = allIngredients.filter((ing) =>
                        !ingModal.items.find((i) => i.ingredientId === ing.id) &&
                        (q === '' || ing.name.toLowerCase().includes(q))
                      )
                      if (available.length === 0) return (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Tidak ditemukan</div>
                      )
                      return available.map((ing) => {
                        const selected = ingForm.ingredientId === ing.id
                        return (
                          <div key={ing.id}
                            onClick={() => setIngForm({ ...ingForm, ingredientId: ing.id })}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderBottom: '1px solid #F1F5FB', cursor: 'pointer', background: selected ? '#EFF4FF' : 'transparent', transition: 'background 0.1s' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${selected ? '#2563EB' : '#CBD5E1'}`, background: selected ? '#2563EB' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: selected ? '600' : '400', color: '#0D1526' }}>{ing.name}</div>
                              {ing.price && ing.packSize && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>Rp {(ing.price/ing.packSize < 1 ? (ing.price/ing.packSize).toFixed(4) : Math.round(ing.price/ing.packSize).toLocaleString('id-ID'))}/{ing.unit}</div>}
                            </div>
                            <span style={{ fontSize: '10px', color: '#94A3B8', background: '#F1F5FB', padding: '2px 6px', borderRadius: '6px', flexShrink: 0 }}>{ing.unit}</span>
                          </div>
                        )
                      })
                    })()}
                  </div>

                  {/* Qty */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', display: 'block', marginBottom: '5px' }}>JUMLAH</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        style={{ fontSize: '13px', paddingRight: ingForm.ingredientId ? '40px' : '10px' }}
                        type="number" step="0.01" min="0.01" placeholder="0"
                        value={ingForm.qty}
                        onChange={(e) => setIngForm({ ...ingForm, qty: e.target.value })}
                        required
                      />
                      {ingForm.ingredientId && (
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94A3B8', pointerEvents: 'none' }}>
                          {allIngredients.find((i) => i.id === ingForm.ingredientId)?.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const selIng = allIngredients.find(i => i.id === ingForm.ingredientId)
                    if (!selIng?.price || !selIng?.packSize || !ingForm.qty) return null
                    const lineHpp = (selIng.price / selIng.packSize) * Number(ingForm.qty)
                    return (
                      <div style={{ padding: '8px 10px', background: '#E8F7F1', border: '1px solid #A7DFC8', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#64748B' }}>HPP bahan ini</span>
                        <span style={{ fontWeight: '700', color: '#2A9D6E' }}>Rp {Math.round(lineHpp).toLocaleString('id-ID')}</span>
                      </div>
                    )
                  })()}
                  <button type="submit" className="btn btn-primary"
                    disabled={!ingForm.ingredientId || !ingForm.qty}
                    style={{ width: '100%', justifyContent: 'center', opacity: (!ingForm.ingredientId || !ingForm.qty) ? 0.5 : 1 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Tambah Bahan
                  </button>
                </form>
              </div>

              {/* Kanan: List bahan terpasang */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid #E8EDF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#4A5578', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Terpasang</div>
                  {ingModal.items.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: '600', background: '#EFF4FF', padding: '2px 8px', borderRadius: '10px' }}>{ingModal.items.length} item</span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  {ingModal.items.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: '8px' }}>
                      <div style={{ width: '48px', height: '48px', background: '#F1F5FB', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>Belum ada bahan</div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1' }}>Pilih dari panel kiri</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ingModal.items.map((item, idx) => {
                        const perUnit = item.ingredient.price && item.ingredient.packSize ? item.ingredient.price / item.ingredient.packSize : null
                        const lineHpp = perUnit ? perUnit * item.qty : null
                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #E8EDF8' }}>
                            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #EFF4FF, #DBEAFE)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB' }}>{idx + 1}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '600', color: '#0D1526', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ingredient.name}</div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px', display: 'flex', gap: '8px' }}>
                                <span>{item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)} {item.ingredient.unit}</span>
                                {perUnit && <span style={{ color: '#94A3B8' }}>· Rp {perUnit < 1 ? perUnit.toFixed(4) : fmtRp(Math.round(perUnit))}/{item.ingredient.unit}</span>}
                              </div>
                            </div>
                            {lineHpp !== null && (
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#2A9D6E', whiteSpace: 'nowrap' }}>Rp {fmtRp(Math.round(lineHpp))}</span>
                            )}
                            <button
                              onClick={() => handleRemoveIngredient(item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px', color: '#CBD5E1', display: 'flex', transition: 'color 0.15s, background 0.15s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'none' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          </div>
                        )
                      })}
                      {/* Total HPP */}
                      {(() => {
                        const totalHpp = ingModal.items.reduce((sum, item) => {
                          const perUnit = item.ingredient.price && item.ingredient.packSize ? item.ingredient.price / item.ingredient.packSize : null
                          return perUnit ? sum + perUnit * item.qty : sum
                        }, 0)
                        const product = products.find(p => p.id === ingModal.productId)
                        const price = product?.price
                        if (totalHpp === 0) return null
                        const margin = price ? ((price - totalHpp) / totalHpp) * 100 : null
                        const color = margin === null ? '#4A7CC7' : margin >= 50 ? '#2A9D6E' : margin >= 20 ? '#C47D1A' : '#C95555'
                        const bg = margin === null ? '#EBF1FB' : margin >= 50 ? '#E8F7F1' : margin >= 20 ? '#FDF4E3' : '#FEF2F2'
                        const border = margin === null ? '#C0D0E8' : margin >= 50 ? '#A7DFC8' : margin >= 20 ? '#F0D090' : '#FECACA'
                        return (
                          <div style={{ marginTop: '4px', padding: '10px 14px', background: bg, border: `1px solid ${border}`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Total HPP</div>
                              <div style={{ fontSize: '14px', fontWeight: '800', color }}>Rp {fmtRp(Math.round(totalHpp))}</div>
                            </div>
                            {margin !== null && (
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Margin · Harga Rp {fmtRp(price)}</div>
                                <div style={{ fontSize: '14px', fontWeight: '800', color }}>{margin.toFixed(1)}%</div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

'use client'
import { useEffect, useState, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = (n) => {
  const num = Number(n)
  if (isNaN(num)) return 'Rp 0'
  const hasDecimal = num % 1 !== 0
  return 'Rp ' + num.toLocaleString('id-ID', hasDecimal ? { minimumFractionDigits: 1, maximumFractionDigits: 2 } : {})
}

export default function PengeluaranPage() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState({})
  const today = new Date().toISOString().slice(0, 10)
  const [catatan, setCatatan] = useState('')
  const [tanggal, setTanggal] = useState(today)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ name: '', keterangan: '', satuan: '', kategori: '', harga: '', isi: '', qty: '' })
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)
  const [editCartItem, setEditCartItem] = useState(null) // { itemId, harga, isi, qty, keterangan }
  const [cartOpen, setCartOpen] = useState(false)      // bottom-sheet keranjang (mobile)
  const [cartFlash, setCartFlash] = useState(false)    // sorot singkat panel keranjang (desktop)

  const [expenseCategories, setExpenseCategories] = useState([])

  useEffect(() => {
    api.get('/admin/expense-items').then(r => setItems(r.data)).catch(() => {})
    api.get('/admin/expense-categories').then(r => setExpenseCategories(r.data.map(c => c.name))).catch(() => {})
  }, [])

  // Kunci scroll body saat bottom-sheet keranjang terbuka (mobile)
  useEffect(() => {
    if (cartOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen])

  const categories = ['Semua', ...Array.from(new Set(items.filter(i => !i.isManual && i.category).map(i => i.category)))]

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Semua' || i.category === activeCategory || i.isManual
    return matchSearch && matchCat
  })

  function updateCart(itemId, field, value) {
    setCart(prev => ({ ...prev, [itemId]: { harga: '', qty: '', keterangan: '', isi: '', ...prev[itemId], [field]: value } }))
  }

  // Harga satuan = harga ÷ isi (ml/gr/ps). Jika isi kosong, harga dianggap sudah per satuan.
  function unitPrice(entry) {
    const harga = Number(entry.harga) || 0
    const isi = Number(entry.isi) || 0
    return isi > 0 ? harga / isi : harga
  }

  function addToCart(item) {
    const entry = cart[item.id] || {}
    if (!Number(entry.harga)) return alert('Isi harga terlebih dahulu')
    const qty = Number(entry.qty)
    if (!(qty > 0)) return alert('Isi Qty dengan angka lebih dari 0')
    const isi = Number(entry.isi) || 0
    setCart(prev => ({ ...prev, [item.id]: { ...prev[item.id], isi: isi > 0 ? String(isi) : '', qty: String(qty), added: true } }))
  }

  function removeFromCart(itemId) {
    setCart(prev => { const next = { ...prev }; delete next[itemId]; return next })
  }

  // Buka keranjang: mobile → bottom sheet, desktop → sorot panel kanan
  function openCart() {
    if (window.innerWidth <= 768) { setCartOpen(true); return }
    const el = document.getElementById('pg-cart')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setCartFlash(true)
    window.setTimeout(() => setCartFlash(false), 1400)
  }

  function downloadTemplate() {
    const header = 'Tanggal,Kode,Kategori,Nama,Keterangan,Satuan,Harga,Qty'
    const contoh = [
      '23/04/2025,EXP-001,,,,,50000,2',
      '23/04/2025,,Bahan Baku,Kopi Robusta,,kg,120000,1',
      '24/04/2025,,Operasional,Listrik,Bulan April,,350000,1',
    ].join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + contoh], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template-import-pengeluaran.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null); setImportProgress(0)
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return prev }
        return prev + Math.random() * 8
      })
    }, 400)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/expenses/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      clearInterval(progressInterval)
      setImportProgress(100)
      setTimeout(() => { setImportResult(res.data); setImporting(false); setImportProgress(0) }, 400)
    } catch (err) {
      clearInterval(progressInterval)
      setImportProgress(0)
      setImportResult({ error: err.response?.data?.message || 'Gagal import' })
      setImporting(false)
    } finally { fileRef.current.value = '' }
  }

  function addManual(e) {
    e.preventDefault()
    if (!manual.name || !manual.harga) return
    if (!(Number(manual.qty) > 0)) return alert('Isi Qty dengan angka lebih dari 0')
    const id = `manual_${Date.now()}`
    const isi = Number(manual.isi) || 0
    setCart(prev => ({ ...prev, [id]: { harga: manual.harga, isi: isi > 0 ? String(isi) : '', qty: manual.qty, keterangan: manual.keterangan, satuan: manual.satuan, category: manual.kategori || '', added: true, isManual: true } }))
    setItems(prev => [...prev, { id, name: manual.name, code: null, category: manual.kategori || null, isManual: true }])
    setManual({ name: '', keterangan: '', satuan: '', kategori: '', harga: '', isi: '', qty: '' })
    setManualOpen(false)
  }

  const cartItems = items.filter(i => cart[i.id]?.added)
  const total = cartItems.reduce((s, i) => s + (Number(cart[i.id].harga) || 0) * (Number(cart[i.id].qty) || 0), 0)

  async function handleSave() {
    if (!cartItems.length) return alert('Belum ada item pengeluaran')
    const invalidQtyItem = cartItems.find(i => !(Number(cart[i.id].qty) > 0))
    if (invalidQtyItem) return alert(`Qty untuk ${invalidQtyItem.name} harus diisi dengan angka lebih dari 0`)
    setSaving(true)
    try {
      const res = await api.post('/expenses', {
        catatan, date: tanggal,
        items: cartItems.map(i => ({
          expenseItemId: i.isManual ? null : i.id,
          name: i.name,
          category: cart[i.id].category || '',
          keterangan: cart[i.id].keterangan || '',
          satuan: cart[i.id].satuan || '',
          harga: Number(cart[i.id].harga),
          isi: Number(cart[i.id].isi) > 0 ? Number(cart[i.id].isi) : null,
          qty: Number(cart[i.id].qty),
        })),
      })
      setSaved(res.data)
      setCart({}); setCatatan(''); setCartOpen(false)
      setItems(prev => prev.filter(i => !i.isManual))
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  // ── Success screen ──
  if (saved) return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar"><div className="topbar-title">Pengeluaran</div></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px' }}>
          <div className="card fade-in" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: '440px', width: '100%' }}>
            <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #2A9D6E, #34C98A)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 24px rgba(42,157,110,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px' }}>Pengeluaran Tersimpan!</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--red)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{fmt(saved.total)}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>{saved.items?.length} item · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '4px', marginBottom: '24px', border: '1px solid var(--border)' }}>
              {saved.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < saved.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{item.name}{item.keterangan ? <span style={{ color: 'var(--muted)', fontWeight: '400' }}> · {item.keterangan}</span> : null}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{fmt(item.harga)} × {item.qty}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{fmt(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '14px' }} onClick={() => setSaved(null)}>
              Catat Pengeluaran Lagi
            </button>
          </div>
        </div>
      </main>
    </div>
  )

  return (
    <div className="page">
      <Sidebar />
      <main className="main pg-main" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' }}>

        {/* Topbar: judul + ikon keranjang */}
        <div className="topbar pg-topbar">
          <div>
            <div className="topbar-title">Pengeluaran</div>
            <div className="topbar-sub">Catat pengeluaran harian</div>
          </div>
          <div className="pg-topbar-actions">
            <button className="pg-cart-btn" type="button" onClick={openCart} aria-label="Buka keranjang">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              <span className="pg-cart-btn-label">Keranjang</span>
              {cartItems.length > 0 && <span className="pg-cart-badge">{cartItems.length}</span>}
            </button>
          </div>
        </div>

        {/* Toolbar aksi — baris terpisah supaya header tidak sempit/mepet */}
        <div className="pg-toolbar">
          <button className="btn btn-ghost" onClick={downloadTemplate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Template
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn" style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }}
            onClick={() => fileRef.current.click()} disabled={importing}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import CSV
          </button>
          <button className="btn btn-ghost" onClick={() => setManualOpen(true)} style={{ gap: '7px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Input Manual
          </button>
        </div>

        {/* Progress Bar Import */}
        {importing && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
            <div style={{ height: '3px', background: '#E2E8F0' }}>
              <div style={{ height: '100%', width: `${importProgress}%`, background: 'linear-gradient(90deg, #10B981, #34D399)', transition: 'width 0.2s ease', borderRadius: '0 2px 2px 0' }} />
            </div>
          </div>
        )}
        {importing && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}>
            <div className="card fade-in" style={{ padding: '32px 24px', textAlign: 'center', width: '90vw', maxWidth: '380px' }}>
              <div style={{ width: '56px', height: '56px', background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid #A7F3D0' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>Mengimpor Data...</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>Mohon tunggu, sedang memproses file CSV</div>
              <div style={{ background: '#F1F5F9', borderRadius: '99px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${importProgress}%`, background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: '99px', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#10B981' }}>{Math.round(importProgress)}%</div>
            </div>
          </div>
        )}

        <div className="pg-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left: Item List ── */}
          <div className="pg-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>

            {/* Search + Filter */}
            <div className="pg-search" style={{ padding: '16px 20px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <svg style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="input" style={{ paddingLeft: '40px', background: 'var(--surface2)' }}
                  placeholder="Cari item pengeluaran..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {categories.length > 1 && (
                <div className="pg-chips" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      style={{ padding: '5px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all 0.15s',
                        background: activeCategory === cat ? 'var(--accent)' : 'var(--surface)',
                        borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border)',
                        color: activeCategory === cat ? '#fff' : 'var(--text2)',
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="pg-items" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
                  <div style={{ fontWeight: '600' }}>Tidak ada item ditemukan</div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(item => {
                  const entry = cart[item.id] || {}
                  const isAdded = !!entry.added
                  const harga = Number(entry.harga) || 0
                  const qty = Number(entry.qty) || 0

                  return (
                    <div key={item.id} style={{
                      background: isAdded ? 'var(--accent-light)' : 'var(--surface)',
                      border: `1.5px solid ${isAdded ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '12px', padding: '14px 16px',
                      transition: 'all 0.15s',
                    }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isAdded ? '0' : '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {item.category && !item.isManual && (
                              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(74,124,199,0.2)' }}>{item.category}</span>
                            )}
                            {item.isManual && (
                              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--orange)', background: 'var(--orange-light)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(196,125,26,0.2)' }}>Manual</span>
                            )}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginTop: '4px' }}>{item.name}</div>
                          {item.code && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>#{item.code}</div>}
                          {!item.isManual && (item.avgHarga || item.satuan) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                              {item.satuan && (
                                <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 8px', borderRadius: '20px', border: '1px solid rgba(74,124,199,0.2)', fontWeight: '600' }}>{item.satuan}</span>
                              )}
                              {item.avgHarga && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Rata-rata: <strong style={{ color: 'var(--text2)' }}>{Number(item.avgHarga).toLocaleString('id-ID', { maximumFractionDigits: 10 })}</strong></span>
                                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>({item.totalPembelian}× beli)</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {isAdded && (
                          <div className="pg-added-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)' }}>{fmt(harga * qty)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{fmt(harga)} × {qty}</div>
                              {Number(entry.isi) > 0 && (
                                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Harga satuan: {fmt(unitPrice(entry))}/{item.satuan || entry.satuan || 'isi'}</div>
                              )}
                            </div>
                            <button onClick={() => removeFromCart(item.id)}
                              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Input row */}
                      {!isAdded && (() => {
                        const isi = Number(entry.isi) || 0
                        const hargaSatuan = unitPrice(entry)
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="pg-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input className="input pg-ket" placeholder="Keterangan" value={entry.keterangan || ''}
                                onChange={e => updateCart(item.id, 'keterangan', e.target.value)}
                                style={{ flex: 1, fontSize: '12px', padding: '7px 11px', minWidth: 0 }} />

                              <div className="pg-nw" style={{ position: 'relative', flexShrink: 0 }}>
                                <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', pointerEvents: 'none' }}>Rp</span>
                                <input className="input" type="number" step="any" placeholder={item.avgHarga ? String(item.avgHarga) : 'Harga'} value={entry.harga || ''}
                                  onChange={e => updateCart(item.id, 'harga', e.target.value)}
                                  style={{ width: '120px', fontSize: '12px', padding: '7px 11px 7px 28px' }} />
                              </div>

                              <div className="pg-nw" style={{ position: 'relative', flexShrink: 0 }}>
                                <input className="input" type="number" step="any" min="0" placeholder={`Isi (${item.satuan || entry.satuan || 'ml/gr/ps'})`} value={entry.isi || ''}
                                  onChange={e => updateCart(item.id, 'isi', e.target.value)}
                                  style={{ width: '96px', fontSize: '12px', padding: '7px 8px', textAlign: 'center' }} />
                              </div>

                              <input className="input pg-qty" type="number" step="any" min="0.01" placeholder="Qty" aria-label={`Qty ${item.name}`} value={entry.qty ?? ''}
                                onChange={e => updateCart(item.id, 'qty', e.target.value)}
                                style={{ width: '56px', textAlign: 'center', fontSize: '12px', padding: '7px 8px', flexShrink: 0 }} />
                              <button onClick={() => addToCart(item)}
                                style={{ width: '34px', height: '34px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(74,124,199,0.35)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              </button>
                            </div>

                            {/* Preview harga satuan (harga ÷ isi) */}
                            {Number(entry.harga) > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '2px' }}>
                                Harga satuan: <strong style={{ color: 'var(--accent)' }}>
                                  Rp {hargaSatuan.toLocaleString('id-ID', { maximumFractionDigits: 10 })}
                                </strong>
                                {isi > 0 ? `/${item.satuan || entry.satuan || 'isi'}` : ''}
                                {' · '}Total: <strong style={{ color: 'var(--red)' }}>{fmt((Number(entry.harga) || 0) * qty)}</strong>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Backdrop bottom-sheet keranjang (mobile) */}
          {cartOpen && <div className="pg-cart-backdrop" onClick={() => setCartOpen(false)} />}

          {/* ── Right: Summary Panel ── */}
          <div id="pg-cart" className={`pg-cart${cartOpen ? ' open' : ''}${cartFlash ? ' flash' : ''}`} style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
            {/* Handle + tombol tutup (hanya tampil di mobile) */}
            <div className="pg-cart-sheetbar">
              <span className="pg-cart-handle" />
              <button className="pg-cart-close" type="button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Panel header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #EBF1FB, #F5F8FE)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text2)', marginBottom: '2px' }}>Ringkasan</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: total > 0 ? 'var(--red)' : 'var(--muted)', letterSpacing: '-0.5px' }}>{fmt(total)}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', marginBottom: '6px' }}>Tanggal</div>
              <input type="date" className="input" value={tanggal} onChange={e => setTanggal(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 11px', background: '#fff' }} />
            </div>

            {/* Cart items */}
            <div className="pg-cart-items" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧾</div>
                  <div style={{ fontSize: '12px', fontWeight: '500' }}>Belum ada item dipilih</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cartItems.map((item, i) => {
                    const e = cart[item.id]
                    const harga = Number(e.harga) || 0
                    const qty = Number(e.qty) || 0
                    return (
                      <div key={i} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                              {item.isManual && <span style={{ marginLeft: '5px', fontSize: '9px', background: 'var(--orange-light)', color: 'var(--orange)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>Manual</span>}
                            </div>
                            {e.keterangan && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{e.keterangan}</div>}
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{fmt(harga)} × {qty}{Number(e.isi) > 0 ? ` · ${fmt(harga / Number(e.isi))}/${item.satuan || e.satuan || 'isi'}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--red)' }}>{fmt(harga * qty)}</div>
                            <button onClick={() => setEditCartItem({ itemId: item.id, harga: String(harga), isi: e.isi || '', qty: String(e.qty ?? ''), keterangan: e.keterangan || '' })}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => removeFromCart(item.id)} title="Hapus dari keranjang"
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Catatan + Save */}
            <div className="pg-cart-footer" style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <textarea className="input" rows={2} placeholder="Catatan pengeluaran... (opsional)" value={catatan}
                onChange={e => setCatatan(e.target.value)} style={{ resize: 'none', fontSize: '12px', marginBottom: '10px' }} />
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', opacity: cartItems.length ? 1 : 0.5, cursor: cartItems.length ? 'pointer' : 'not-allowed' }}
                onClick={handleSave} disabled={saving || !cartItems.length}>
                {saving ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Menyimpan...
                  </span>
                ) : 'Simpan Pengeluaran'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FAB keranjang (mobile) — ringkasan item + pintasan buka sheet */}
      {cartItems.length > 0 && !importResult && (
        <button className="pg-cart-fab" type="button" onClick={openCart}>
          <span className="pg-cart-fab-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span className="pg-cart-badge">{cartItems.length}</span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, opacity: 0.9 }}>{cartItems.length} item di keranjang</span>
            <span style={{ display: 'block', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px' }}>{fmt(total)}</span>
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>Lihat</span>
        </button>
      )}

      {/* ── Modal Input Manual ── */}
      {manualOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setManualOpen(false) }}>
          <div className="card fade-in" style={{ width: '420px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Input Manual</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Tambah item yang tidak ada di daftar</div>
              </div>
              <button onClick={() => setManualOpen(false)} style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={addManual} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Nama Item</label>
                <input className="input" placeholder="Nama barang atau jasa..." value={manual.name}
                  onChange={e => setManual({ ...manual, name: e.target.value })} required autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Kategori <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" placeholder="Operasional, Bahan..." value={manual.kategori}
                    onChange={e => setManual({ ...manual, kategori: e.target.value })}
                    list="manual-cat-list" />
                  <datalist id="manual-cat-list">
                    {expenseCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Keterangan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                  <input className="input" placeholder="Misal: merek, toko..." value={manual.keterangan}
                    onChange={e => setManual({ ...manual, keterangan: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Satuan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                <input className="input" placeholder="pcs, kg, liter..." value={manual.satuan}
                  onChange={e => setManual({ ...manual, satuan: e.target.value })} />
              </div>
              <div className="pg-grid3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Harga</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>Rp</span>
                    <input className="input" type="number" step="any" placeholder="0" value={manual.harga}
                      onChange={e => setManual({ ...manual, harga: e.target.value })}
                      style={{ paddingLeft: '32px' }} required />
                  </div>
                </div>
                <div>
                  <label className="label">Isi (ml/gr/ps)</label>
                  <input className="input" type="number" step="any" min="0" placeholder="0" value={manual.isi}
                    onChange={e => setManual({ ...manual, isi: e.target.value })} />
                </div>
                <div>
                  <label className="label">Qty</label>
                  <input className="input" type="number" step="any" min="0.01" placeholder="Qty" value={manual.qty}
                    onChange={e => setManual({ ...manual, qty: e.target.value })} required />
                  <input className="input" type="number" step="any" min="0" value={manual.qty}
                    onChange={e => setManual({ ...manual, qty: e.target.value })} />
                </div>
              </div>
              {Number(manual.harga) > 0 && Number(manual.isi) > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderRadius: '9px', border: '1px solid #A7DFC8', fontSize: '12px', color: 'var(--green)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Harga satuan: {fmt(Number(manual.harga) / Number(manual.isi))}{manual.satuan ? `/${manual.satuan}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setManualOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Tambah ke Daftar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Cart Item */}
      {editCartItem && (() => {
        const item = items.find(i => i.id === editCartItem.itemId)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setEditCartItem(null) }}>
            <div className="card fade-in" style={{ width: '380px', maxWidth: '96vw', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Edit Item</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{item?.name}</div>
                </div>
                <button onClick={() => setEditCartItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="label">Keterangan</label>
                  <input className="input" placeholder="Keterangan..." value={editCartItem.keterangan}
                    onChange={e => setEditCartItem(p => ({ ...p, keterangan: e.target.value }))} autoFocus />
                </div>
                <div className="pg-grid3" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.8fr', gap: '12px' }}>
                  <div>
                    <label className="label">Harga</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)', fontWeight: '600' }}>Rp</span>
                      <input className="input" type="number" step="any" value={editCartItem.harga}
                        onChange={e => setEditCartItem(p => ({ ...p, harga: e.target.value }))}
                        style={{ paddingLeft: '32px' }} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Isi (ml/gr/ps)</label>
                    <input className="input" type="number" step="any" min="0" placeholder="0" value={editCartItem.isi || ''}
                      onChange={e => setEditCartItem(p => ({ ...p, isi: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Qty</label>
                    <input className="input" type="number" step="any" min="0.01" placeholder="Qty" value={editCartItem.qty}
                      onChange={e => setEditCartItem(p => ({ ...p, qty: e.target.value }))}
                      style={{ textAlign: 'center' }} required />
                  </div>
                </div>
                {Number(editCartItem.harga) > 0 && (
                  <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: '9px', border: '1px solid #FECACA', fontSize: '13px', fontWeight: '700', color: 'var(--red)', textAlign: 'center' }}>
                    {Number(editCartItem.isi) > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.85, marginBottom: '2px' }}>
                        Harga satuan: {fmt(Number(editCartItem.harga) / Number(editCartItem.isi))}{item?.satuan ? `/${item.satuan}` : ''}
                      </div>
                    )}
                    Total: {fmt(Number(editCartItem.harga) * (Number(editCartItem.qty) || 0))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditCartItem(null)}>Batal</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
                    if (!Number(editCartItem.harga)) return alert('Isi harga terlebih dahulu')
                    if (!(Number(editCartItem.qty) > 0)) return alert('Isi Qty dengan angka lebih dari 0')
                    setCart(prev => ({ ...prev, [editCartItem.itemId]: { ...prev[editCartItem.itemId], harga: editCartItem.harga, isi: Number(editCartItem.isi) > 0 ? String(editCartItem.isi) : '', qty: editCartItem.qty, keterangan: editCartItem.keterangan } }))
                    setEditCartItem(null)
                  }}>Simpan</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Hasil Import */}
      {importResult && (
        <div className="pg-toast" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 600, maxWidth: '380px', width: '100%' }}>
          <div className="slide-down" style={{ padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '16px', marginTop: '1px' }}>{importResult.error ? '❌' : '✅'}</span>
              <div>
                {importResult.error
                  ? <div style={{ fontSize: '13px', fontWeight: '600', color: '#EF4444' }}>{importResult.error}</div>
                  : <>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>Import selesai</div>
                      <div style={{ fontSize: '12px', color: '#4A5578', display: 'flex', gap: '16px', marginBottom: importResult.errors?.length > 0 ? '8px' : '0' }}>
                        <span>✚ <b>{importResult.created}</b> berhasil</span>
                        <span>⊘ <b>{importResult.skipped}</b> gagal</span>
                      </div>
                      {importResult.debug?.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Tanggal diproses: {importResult.debug.join(', ')}</div>
                      )}
                      {importResult.errors?.length > 0 && (
                        <div style={{ maxHeight: '100px', overflowY: 'auto', background: '#FEF2F2', borderRadius: '6px', padding: '8px 10px', border: '1px solid #FECACA' }}>
                          {importResult.errors.map((e, i) => (
                            <div key={i} style={{ fontSize: '11px', color: '#EF4444', marginBottom: i < importResult.errors.length - 1 ? '3px' : '0' }}>{e}</div>
                          ))}
                        </div>
                      )}
                    </>}
              </div>
            </div>
            <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pgFlash { 0%, 100% { box-shadow: inset 0 0 0 2px rgba(79,110,247,0); } 50% { box-shadow: inset 0 0 0 2px var(--accent); } }

        /* ── Pengeluaran: header, toolbar & keranjang ── */
        .pg-added-row { flex-wrap: wrap; }
        .pg-topbar-actions { display: flex; align-items: center; gap: 8px; }
        .pg-toolbar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 10px 24px; background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .pg-cart-btn {
          position: relative;
          display: flex; align-items: center; gap: 7px;
          padding: 8px 13px; border-radius: 10px;
          border: 1.5px solid var(--border); background: var(--surface);
          color: var(--text2); font-family: inherit; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .pg-cart-btn:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
        .pg-cart-badge {
          position: absolute; top: -7px; right: -7px;
          min-width: 18px; height: 18px; padding: 0 4px;
          border-radius: 99px; background: var(--red); color: #fff;
          font-size: 10px; font-weight: 800; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--surface);
        }
        .pg-cart-sheetbar, .pg-cart-backdrop, .pg-cart-fab { display: none; }
        .pg-cart.flash { animation: pgFlash 0.6s ease-in-out 2; }

        /* ── Pengeluaran: mobile friendly ── */
        @media (max-width: 768px) {
          /* Header lega: judul + ikon keranjang, aksi di baris toolbar */
          .pg-topbar { height: auto !important; min-height: 56px; padding-top: 9px !important; padding-bottom: 9px !important; flex-wrap: wrap; gap: 8px; }
          .pg-toolbar { padding: 10px 12px !important; gap: 6px; }
          .pg-toolbar .btn { flex: 1 1 0; min-width: 0; justify-content: center; padding: 9px 6px !important; font-size: 11px !important; white-space: nowrap; overflow: hidden; }
          .pg-cart-btn { padding: 7px 11px !important; }

          /* Layout menumpuk */
          .pg-main { height: auto !important; min-height: 100vh; overflow: visible !important; padding-bottom: 132px !important; }
          .pg-layout { flex-direction: column; overflow: visible !important; }
          .pg-list { border-right: none !important; overflow: visible !important; }
          .pg-items { overflow: visible !important; padding: 12px !important; }
          .pg-search { padding: 12px 12px 10px !important; }
          .pg-chips { overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 4px !important; }
          .pg-chips::-webkit-scrollbar { display: none; }

          /* Input baris item */
          .pg-input-row { flex-wrap: wrap; }
          .pg-ket { flex: 1 1 100% !important; min-width: 0; }
          .pg-nw { flex: 1 1 0; min-width: 76px; }
          .pg-nw > input { width: 100% !important; }
          .pg-qty { flex: 0 1 64px; width: auto !important; }
          .pg-grid3 { grid-template-columns: 1fr 1fr !important; }
          .pg-added-row { margin-left: 0 !important; width: 100%; justify-content: space-between; }

          /* Keranjang = bottom sheet */
          .pg-cart-backdrop { display: block; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 205; backdrop-filter: blur(2px); }
          .pg-cart {
            position: fixed; left: 0; right: 0; bottom: 0;
            width: auto !important; max-width: none !important;
            max-height: 86vh; z-index: 210;
            border-radius: 20px 20px 0 0;
            border-top: 1px solid var(--border) !important;
            box-shadow: 0 -8px 40px rgba(15,23,42,0.28);
            transform: translateY(100%); transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            padding-bottom: env(safe-area-inset-bottom);
          }
          .pg-cart.open { transform: translateY(0); }
          .pg-cart-sheetbar { display: block; position: relative; padding: 9px 46px 5px; }
          .pg-cart-handle { display: block; width: 44px; height: 5px; margin: 0 auto; border-radius: 99px; background: var(--border2); }
          .pg-cart-close { display: flex; align-items: center; justify-content: center; position: absolute; right: 10px; top: 4px; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--muted); cursor: pointer; }
          .pg-cart-items { flex: 1 1 auto !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch; padding: 12px !important; }
          .pg-cart-footer { padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important; }

          /* FAB keranjang (ringkasan + pintasan sheet) */
          .pg-cart-fab {
            display: flex; align-items: center; gap: 10px;
            position: fixed; left: 12px; right: 12px; bottom: 70px; z-index: 60;
            padding: 10px 14px; border: none; border-radius: 15px;
            background: var(--accent); color: #fff;
            box-shadow: 0 10px 28px rgba(79,110,247,0.42);
            cursor: pointer; font-family: inherit; text-align: left;
            -webkit-tap-highlight-color: transparent;
          }
          .pg-cart-fab-icon { position: relative; display: flex; align-items: center; justify-content: center; }
          .pg-cart-fab .pg-cart-badge { border-color: var(--accent); background: #fff; color: var(--red); }

          .pg-toast { left: 12px !important; right: 12px !important; bottom: 76px !important; max-width: none !important; width: auto !important; }
        }
      `}</style>
    </div>
  )
}

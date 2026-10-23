'use client'
import { useEffect, useState, useMemo } from 'react'
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

// Helper: Hitung HPP produk berdasarkan bahan baku resepnya
function getProductHpp(product) {
  if (!product?.ingredients || !product.ingredients.length) return 0
  return product.ingredients.reduce((sum, item) => {
    const ing = item.ingredient
    if (!ing?.price || !ing?.packSize || !item.qty) return sum
    const perUnit = Number(ing.price) / Number(ing.packSize)
    return sum + (perUnit * Number(item.qty))
  }, 0)
}

export default function VoucherSettingsPage() {
  const [activeTab, setActiveTab] = useState('bundling') // 'bundling' | 'voucher'
  const [vouchers, setVouchers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = tambah baru
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Diskon member global ──
  const [promo, setPromo] = useState({
    memberDiscountActive: false,
    memberDiscountType: 'PERCENT',
    memberDiscountValue: '',
    memberDiscountMax: '',
    memberDiscountMin: '',
  })
  const [promoSaving, setPromoSaving] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')

  // ── Kalkulator Bundling State ──
  const [bundleItems, setBundleItems] = useState([]) // [ { product, qty } ]
  const [bundleName, setBundleName] = useState('')
  const [bundlePrice, setBundlePrice] = useState('')
  const [packagingCost, setPackagingCost] = useState('0')
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [vRes, pRes, prodRes] = await Promise.all([
        api.get('/admin/vouchers'),
        api.get('/admin/promo-settings').catch(() => null),
        api.get('/products').catch(() => ({ data: [] })),
      ])
      setVouchers(vRes?.data || [])
      if (pRes?.data) {
        setPromo({
          memberDiscountActive: !!pRes.data.memberDiscountActive,
          memberDiscountType: pRes.data.memberDiscountType === 'NOMINAL' ? 'NOMINAL' : 'PERCENT',
          memberDiscountValue: pRes.data.memberDiscountValue != null ? String(pRes.data.memberDiscountValue) : '',
          memberDiscountMax: pRes.data.memberDiscountMax ? String(pRes.data.memberDiscountMax) : '',
          memberDiscountMin: pRes.data.memberDiscountMin ? String(pRes.data.memberDiscountMin) : '',
        })
      }
      if (prodRes?.data) {
        setProducts(prodRes.data)
      }
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

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

  // Statistik ringkasan voucher
  const totalVoucher = vouchers.length
  const activeVoucher = vouchers.filter(v => statusBadge(v).text === 'Aktif').length
  const totalTerpakai = vouchers.reduce((s, v) => s + (v.usedCount || 0), 0)

  // ── LOGIKA KALKULATOR BUNDLING ──
  const categories = useMemo(() => {
    const list = products.map(p => p.category?.name).filter(Boolean)
    return Array.from(new Set(list))
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = productSearch.toLowerCase().trim()
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q))
      const matchCat = categoryFilter === 'ALL' || p.category?.name === categoryFilter
      return matchSearch && matchCat
    })
  }, [products, productSearch, categoryFilter])

  function addToBundle(product) {
    setBundleItems(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  function changeQty(productId, delta) {
    setBundleItems(prev => {
      return prev.map(item => {
        if (item.product.id !== productId) return item
        const nextQty = item.qty + delta
        return nextQty > 0 ? { ...item, qty: nextQty } : null
      }).filter(Boolean)
    })
  }

  function setDirectQty(productId, val) {
    const num = parseInt(val, 10)
    if (isNaN(num) || num <= 0) {
      removeFromBundle(productId)
      return
    }
    setBundleItems(prev => prev.map(item => item.product.id === productId ? { ...item, qty: num } : item))
  }

  function removeFromBundle(productId) {
    setBundleItems(prev => prev.filter(item => item.product.id !== productId))
  }

  function clearBundle() {
    setBundleItems([])
    setBundlePrice('')
    setBundleName('')
    setPackagingCost('0')
  }

  // Perhitungan Bundling
  const totalQty = bundleItems.reduce((acc, it) => acc + it.qty, 0)
  const totalNormalPrice = bundleItems.reduce((acc, it) => acc + (Number(it.product.price || 0) * it.qty), 0)
  const totalRecipeHpp = bundleItems.reduce((acc, it) => acc + (getProductHpp(it.product) * it.qty), 0)
  const extraCostNum = Math.max(0, Number(packagingCost) || 0)
  const totalHpp = totalRecipeHpp + extraCostNum

  const priceNum = Number(bundlePrice) || 0
  const finalSellPrice = priceNum > 0 ? priceNum : totalNormalPrice

  const discountNominal = totalNormalPrice > priceNum && priceNum > 0 ? totalNormalPrice - priceNum : 0
  const discountPct = totalNormalPrice > 0 && priceNum > 0 ? ((totalNormalPrice - priceNum) / totalNormalPrice) * 100 : 0

  const profit = priceNum > 0 ? priceNum - totalHpp : (totalNormalPrice > 0 ? totalNormalPrice - totalHpp : 0)
  const marginPct = finalSellPrice > 0 ? (profit / finalSellPrice) * 100 : 0
  const markupPct = totalHpp > 0 ? (profit / totalHpp) * 100 : 0

  function applyDiscountPreset(pct) {
    if (pct === 0) {
      setBundlePrice(String(totalNormalPrice))
      return
    }
    const discounted = Math.round((totalNormalPrice * (1 - pct / 100)) / 500) * 500
    setBundlePrice(String(discounted))
  }

  function copySummary() {
    if (bundleItems.length === 0) return
    const lines = [
      `✨ PROMO BUNDLING${bundleName ? ': ' + bundleName.toUpperCase() : ''} ✨`,
      '────────────────────────────',
      '📦 Isi Paket:',
      ...bundleItems.map(it => `• ${it.qty}x ${it.product.name} (@ ${fmt(it.product.price)})`),
      '────────────────────────────',
      `💰 Total Normal : ${fmt(totalNormalPrice)}`,
    ]
    if (priceNum > 0) {
      lines.push(`🔥 Harga Promo  : ${fmt(priceNum)}`)
      if (discountNominal > 0) {
        lines.push(`🎉 Hemat        : ${fmt(discountNominal)} (${discountPct.toFixed(0)}% OFF)`)
      }
    }
    lines.push('────────────────────────────')
    lines.push('Yuk buruan pesan sebelum kehabisan! 🙌')

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {})
  }

  function createVoucherFromBundle() {
    setActiveTab('voucher')
    setEditing(null)
    const suggestedCode = (bundleName ? bundleName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : 'BUNDLE').toUpperCase() + Math.round(discountPct || 10)
    setForm({
      code: suggestedCode,
      description: `Promo Bundling: ${bundleName || 'Paket Bundling'} (Diskon ${discountPct > 0 ? discountPct.toFixed(0) + '%' : fmt(discountNominal)})`,
      type: discountPct > 0 ? 'PERCENT' : 'NOMINAL',
      value: discountPct > 0 ? String(Math.round(discountPct)) : String(discountNominal || 5000),
      minSpend: String(totalNormalPrice),
      maxDiscount: '',
      quota: '',
      startDate: '',
      endDate: '',
      isActive: true,
    })
    setError('')
    setModalOpen(true)
  }

  return (
    <div className="page vch-page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        {/* ── Topbar ── */}
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Voucher & Promo</div>
            <div className="topbar-sub">Kelola kode voucher, diskon member, dan simulasi keuntungan bundling promo</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeTab === 'voucher' ? (
              <button className="btn btn-primary vch-add-btn" onClick={openAdd}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Voucher
              </button>
            ) : (
              bundleItems.length > 0 && (
                <button className="btn btn-ghost" onClick={clearBundle} style={{ color: 'var(--red)', borderColor: 'var(--red-border)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Reset Bundling
                </button>
              )
            )}
          </div>
        </div>

        <div className="content">
          {/* ── Tab Switcher ── */}
          <div className="vch-nav-tabs">
            <button
              type="button"
              className={`vch-nav-tab ${activeTab === 'bundling' ? 'active' : ''}`}
              onClick={() => setActiveTab('bundling')}
            >
              <span className="vch-nav-icon">🧮</span>
              <span className="vch-nav-text">Kalkulator Bundling</span>
              {bundleItems.length > 0 && (
                <span className="vch-tab-pill">{totalQty} item</span>
              )}
            </button>
            <button
              type="button"
              className={`vch-nav-tab ${activeTab === 'voucher' ? 'active' : ''}`}
              onClick={() => setActiveTab('voucher')}
            >
              <span className="vch-nav-icon">🎟️</span>
              <span className="vch-nav-text">Voucher & Diskon Member</span>
              <span className="vch-tab-pill neutral">{totalVoucher}</span>
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 1: KALKULATOR BUNDLING ── */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'bundling' && (
            <div className="bundle-wrap fade-in">
              <div className="bundle-layout">
                {/* ── Kolom Kiri: Produk & Keranjang Bundling ── */}
                <div className="bundle-left">
                  {/* Card 1: Daftar Produk Bundling Terpilih */}
                  <div className="card bundle-card" style={{ marginBottom: '18px' }}>
                    <div className="bundle-card-header">
                      <div>
                        <div className="bundle-card-title">
                          📦 Produk Dalam Paket Bundling
                          {bundleItems.length > 0 && (
                            <span className="badge badge-blue" style={{ marginLeft: '8px', fontSize: '11px' }}>
                              {bundleItems.length} jenis ({totalQty} pcs)
                            </span>
                          )}
                        </div>
                        <div className="bundle-card-desc">Produk yang digabungkan dalam paket promo ini</div>
                      </div>
                      {bundleItems.length > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={clearBundle} style={{ color: 'var(--red)', fontSize: '12px' }}>
                          Kosongkan
                        </button>
                      )}
                    </div>

                    {bundleItems.length === 0 ? (
                      <div className="bundle-empty">
                        <div style={{ fontSize: '38px', marginBottom: '8px' }}>🛍️</div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)' }}>Belum Ada Produk Dipilih</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', maxWidth: '360px', marginInline: 'auto' }}>
                          Pilih produk dari katalog di bawah untuk menambahkan ke kalkulator bundling dan melihat total harga serta HPP-nya.
                        </div>
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table className="table bundle-table">
                          <thead>
                            <tr>
                              <th>Produk</th>
                              <th style={{ textAlign: 'center', width: '130px' }}>Jumlah</th>
                              <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                              <th style={{ textAlign: 'right' }}>HPP Satuan</th>
                              <th style={{ textAlign: 'right' }}>Subtotal Harga</th>
                              <th style={{ textAlign: 'right' }}>Subtotal HPP</th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {bundleItems.map((item) => {
                              const p = item.product
                              const hppSatuan = getProductHpp(p)
                              const subtotalHarga = (Number(p.price) || 0) * item.qty
                              const subtotalHpp = hppSatuan * item.qty
                              return (
                                <tr key={p.id}>
                                  <td>
                                    <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '13px' }}>{p.name}</div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                      {p.code && <span className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: '10px' }}>{p.code}</span>}
                                      {p.category?.name && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.category.name}</span>}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div className="bundle-qty-box">
                                      <button type="button" className="bundle-qty-btn" onClick={() => changeQty(p.id, -1)}>−</button>
                                      <input
                                        type="number"
                                        min="1"
                                        className="bundle-qty-input"
                                        value={item.qty}
                                        onChange={(e) => setDirectQty(p.id, e.target.value)}
                                      />
                                      <button type="button" className="bundle-qty-btn" onClick={() => changeQty(p.id, 1)}>+</button>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text2)', fontSize: '13px' }}>
                                    {fmt(p.price)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '12px' }}>
                                    {hppSatuan > 0 ? (
                                      <span style={{ color: '#4F6EF7', fontWeight: '600' }}>{fmt(Math.round(hppSatuan))}</span>
                                    ) : (
                                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text)', fontSize: '13px' }}>
                                    {fmt(subtotalHarga)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: '700', color: '#4F6EF7', fontSize: '13px' }}>
                                    {subtotalHpp > 0 ? fmt(Math.round(subtotalHpp)) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className="bundle-del-btn"
                                      title="Hapus produk dari bundling"
                                      onClick={() => removeFromBundle(p.id)}
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'var(--surface2)', fontWeight: '800' }}>
                              <td colSpan="4" style={{ textAlign: 'right', color: 'var(--text2)', fontSize: '13px' }}>
                                TOTAL NORMAL PRODUK:
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text)', fontSize: '14px', fontWeight: '800' }}>
                                {fmt(totalNormalPrice)}
                              </td>
                              <td style={{ textAlign: 'right', color: '#4F6EF7', fontSize: '14px', fontWeight: '800' }}>
                                {fmt(Math.round(totalRecipeHpp))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Katalog Produk untuk Ditambahkan */}
                  <div className="card bundle-card">
                    <div className="bundle-card-header">
                      <div>
                        <div className="bundle-card-title">🔍 Tambahkan Produk ke Bundling</div>
                        <div className="bundle-card-desc">Cari dan klik tombol tambah untuk memasukkan ke paket bundling</div>
                      </div>
                    </div>

                    {/* Filter & Search */}
                    <div className="bundle-filter-bar">
                      <div className="bundle-search-wrap">
                        <svg className="bundle-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                          type="text"
                          className="input bundle-search-input"
                          placeholder="Cari nama atau kode produk..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                        />
                        {productSearch && (
                          <button className="bundle-search-clear" onClick={() => setProductSearch('')}>×</button>
                        )}
                      </div>

                      {/* Filter Kategori */}
                      <div className="bundle-cat-chips">
                        <button
                          type="button"
                          className={`bundle-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
                          onClick={() => setCategoryFilter('ALL')}
                        >
                          Semua ({products.length})
                        </button>
                        {categories.map(cat => (
                          <button
                            type="button"
                            key={cat}
                            className={`bundle-chip ${categoryFilter === cat ? 'active' : ''}`}
                            onClick={() => setCategoryFilter(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grid Produk */}
                    {loading ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>Memuat produk...</div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                        Tidak ada produk yang cocok dengan pencarian "{productSearch}"
                      </div>
                    ) : (
                      <div className="bundle-prod-grid">
                        {filteredProducts.map(p => {
                          const hpp = getProductHpp(p)
                          const inBundle = bundleItems.find(it => it.product.id === p.id)
                          const margin = hpp > 0 && p.price ? ((p.price - hpp) / p.price) * 100 : null

                          return (
                            <div key={p.id} className={`bundle-prod-card ${inBundle ? 'selected' : ''}`}>
                              <div className="bundle-prod-info">
                                <div className="bundle-prod-name">{p.name}</div>
                                <div className="bundle-prod-meta">
                                  {p.code && <span className="bundle-prod-code">{p.code}</span>}
                                  {p.category?.name && <span className="bundle-prod-cat">{p.category.name}</span>}
                                </div>
                                <div className="bundle-prod-prices">
                                  <div className="bundle-prod-sell">{fmt(p.price)}</div>
                                  <div className="bundle-prod-hpp">
                                    {hpp > 0 ? (
                                      <span>HPP: <b>{fmt(Math.round(hpp))}</b> {margin !== null && `(${margin.toFixed(0)}%)`}</span>
                                    ) : (
                                      <span style={{ color: 'var(--muted)' }}>Resep belum ada</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className={`btn ${inBundle ? 'btn-primary' : 'btn-ghost'} bundle-add-btn`}
                                onClick={() => addToBundle(p)}
                              >
                                {inBundle ? (
                                  <><span>+ Tambah</span> <span className="bundle-count-pill">{inBundle.qty}</span></>
                                ) : (
                                  <span>+ Pilih</span>
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Kolom Kanan: Simulasi Finansial & Margin ── */}
                <div className="bundle-right">
                  <div className="card bundle-summary-card">
                    <div className="bundle-card-header" style={{ marginBottom: '14px' }}>
                      <div>
                        <div className="bundle-card-title">🧮 Simulasi Finansial Bundling</div>
                        <div className="bundle-card-desc">Atur harga paket dan pantau margin serta labanya</div>
                      </div>
                    </div>

                    {/* Input Nama Paket */}
                    <div className="vch-field" style={{ marginBottom: '12px' }}>
                      <label className="vch-label">Nama Paket Bundling (Opsional)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="mis. Paket Hemat Berdua / Kopi + Roti"
                        value={bundleName}
                        onChange={(e) => setBundleName(e.target.value)}
                      />
                    </div>

                    {/* Rincian Komparasi Normal vs Modal */}
                    <div className="bundle-cost-box">
                      <div className="bundle-cost-row">
                        <span className="bundle-cost-label">Total Harga Jual Normal</span>
                        <span className="bundle-cost-val" style={{ fontWeight: '800', color: 'var(--text)' }}>
                          {fmt(totalNormalPrice)}
                        </span>
                      </div>
                      <div className="bundle-cost-row">
                        <span className="bundle-cost-label">Total HPP Bahan Baku</span>
                        <span className="bundle-cost-val" style={{ color: '#4F6EF7', fontWeight: '700' }}>
                          {fmt(Math.round(totalRecipeHpp))}
                        </span>
                      </div>

                      {/* Input Tambahan Biaya Packaging/Kemasan */}
                      <div className="bundle-cost-row" style={{ alignItems: 'center', marginTop: '6px' }}>
                        <span className="bundle-cost-label" title="Biaya cup tambahan, kantong belanja, box bundling, dsb">
                          Biaya Kemasan / Ekstra (Rp)
                        </span>
                        <div style={{ width: '130px' }}>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            className="input"
                            style={{ padding: '6px 10px', fontSize: '13px', textAlign: 'right' }}
                            value={packagingCost}
                            onChange={(e) => setPackagingCost(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="bundle-cost-divider" />

                      <div className="bundle-cost-row total">
                        <span className="bundle-cost-label" style={{ fontWeight: '800', color: 'var(--text)' }}>
                          TOTAL MODAL / HPP BUNDLING
                        </span>
                        <span className="bundle-cost-val" style={{ fontWeight: '900', color: '#4F6EF7', fontSize: '16px' }}>
                          {fmt(Math.round(totalHpp))}
                        </span>
                      </div>
                    </div>

                    {/* Input Harga Jual Bundling */}
                    <div style={{ margin: '18px 0 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="vch-label" style={{ margin: 0, fontWeight: '700' }}>
                          🎯 Tentukan Harga Jual Paket Promo (Rp)
                        </label>
                      </div>

                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--muted)', fontSize: '14px' }}>Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          className="input bundle-price-input"
                          placeholder={totalNormalPrice > 0 ? String(totalNormalPrice) : '0'}
                          value={bundlePrice}
                          onChange={(e) => setBundlePrice(e.target.value)}
                        />
                      </div>

                      {/* Tombol Shortcut Preset Diskon */}
                      {totalNormalPrice > 0 && (
                        <div className="bundle-preset-row">
                          <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Preset:</span>
                          <button type="button" className="bundle-preset-btn" onClick={() => applyDiscountPreset(10)}>Diskon 10%</button>
                          <button type="button" className="bundle-preset-btn" onClick={() => applyDiscountPreset(15)}>Diskon 15%</button>
                          <button type="button" className="bundle-preset-btn" onClick={() => applyDiscountPreset(20)}>Diskon 20%</button>
                          <button type="button" className="bundle-preset-btn" onClick={() => applyDiscountPreset(25)}>Diskon 25%</button>
                          <button type="button" className="bundle-preset-btn" onClick={() => applyDiscountPreset(0)}>Normal</button>
                        </div>
                      )}
                    </div>

                    {/* Ringkasan Hasil Analisis Finansial */}
                    <div className="bundle-metrics">
                      {/* Metrik 1: Hemat Pelanggan */}
                      <div className="bundle-metric">
                        <div className="bundle-m-label">Hemat Pelanggan</div>
                        <div className="bundle-m-val" style={{ color: discountNominal > 0 ? 'var(--orange)' : 'var(--muted)' }}>
                          {discountNominal > 0 ? fmt(discountNominal) : 'Rp 0'}
                        </div>
                        <div className="bundle-m-sub">
                          {discountPct > 0 ? `${discountPct.toFixed(1)}% lebih murah` : 'Sama dengan normal'}
                        </div>
                      </div>

                      {/* Metrik 2: Estimasi Laba Bersih / Kotor */}
                      <div className="bundle-metric">
                        <div className="bundle-m-label">Estimasi Laba Kotor</div>
                        <div className="bundle-m-val" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmt(Math.round(profit))}
                        </div>
                        <div className="bundle-m-sub">
                          {profit >= 0 ? 'Laba per paket terjual' : 'Potensi rugi per paket!'}
                        </div>
                      </div>

                      {/* Metrik 3: Margin Keuntungan */}
                      <div className="bundle-metric">
                        <div className="bundle-m-label">Margin Keuntungan</div>
                        <div className="bundle-m-val" style={{ color: marginPct >= 40 ? 'var(--green)' : marginPct >= 20 ? 'var(--orange)' : 'var(--red)' }}>
                          {marginPct.toFixed(1)}%
                        </div>
                        <div className="bundle-m-sub">
                          Markup: {markupPct.toFixed(0)}% dari HPP
                        </div>
                      </div>
                    </div>

                    {/* Alert Status Kelayakan Bisnis */}
                    {priceNum > 0 && totalHpp > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        {profit < 0 ? (
                          <div className="bundle-alert danger">
                            <span style={{ fontSize: '18px' }}>🚨</span>
                            <div>
                              <div style={{ fontWeight: '800' }}>Peringatan: Harga di Bawah HPP!</div>
                              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                                Harga jual promo lebih kecil dari modal bahan baku. Anda berisiko rugi <b>{fmt(Math.abs(Math.round(profit)))}</b> tiap transaksi.
                              </div>
                            </div>
                          </div>
                        ) : marginPct < 20 ? (
                          <div className="bundle-alert warning">
                            <span style={{ fontSize: '18px' }}>⚠️</span>
                            <div>
                              <div style={{ fontWeight: '800' }}>Margin Tipis ({marginPct.toFixed(1)}%)</div>
                              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                                Margin di bawah 20%. Pastikan target volume penjualan cukup tinggi untuk menutup beban operasional.
                              </div>
                            </div>
                          </div>
                        ) : marginPct >= 45 ? (
                          <div className="bundle-alert success">
                            <span style={{ fontSize: '18px' }}>✨</span>
                            <div>
                              <div style={{ fontWeight: '800' }}>Margin Sangat Sehat ({marginPct.toFixed(1)}%)</div>
                              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                                Paket promo ini sangat menguntungkan dengan laba kotor <b>{fmt(Math.round(profit))}</b> per paket.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bundle-alert info">
                            <span style={{ fontSize: '18px' }}>💡</span>
                            <div>
                              <div style={{ fontWeight: '800' }}>Margin Ideal Promo ({marginPct.toFixed(1)}%)</div>
                              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                                Proporsi diskon menarik pelanggan dan margin keuntungan tetap aman terjaga.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Aksi Bundling */}
                    <div className="bundle-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={copySummary}
                        disabled={bundleItems.length === 0}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {copied ? '✅ Rincian Tersalin!' : '📋 Salin Ringkasan Promo'}
                      </button>

                      {discountNominal > 0 && (
                        <button
                          type="button"
                          className="btn"
                          onClick={createVoucherFromBundle}
                          style={{
                            background: 'var(--surface2)',
                            color: 'var(--accent)',
                            border: '1.5px solid var(--border)',
                            fontWeight: '700',
                            justifyContent: 'center',
                          }}
                        >
                          🎟️ Buat Voucher dari Diskon Ini
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 2: VOUCHER & DISKON MEMBER ── */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'voucher' && (
            <div className="fade-in">
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

              {/* ── Daftar Voucher ── */}
              {loading ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Memuat data voucher...</div>
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
          )}
        </div>
      </main>

      {/* ── Modal Form Voucher ── */}
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

        /* ── Nav Tabs ── */
        .vch-nav-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 2px;
          overflow-x: auto;
        }
        .vch-nav-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 10px 10px 0 0;
          border: none;
          background: transparent;
          color: var(--muted);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          white-space: nowrap;
          font-family: inherit;
        }
        .vch-nav-tab:hover {
          color: var(--text);
          background: rgba(79, 110, 247, 0.05);
        }
        .vch-nav-tab.active {
          color: var(--accent);
          background: var(--surface);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.03);
        }
        .vch-nav-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent);
          border-radius: 3px 3px 0 0;
        }
        .vch-nav-icon { font-size: 16px; }
        .vch-tab-pill {
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          background: var(--accent);
          color: #fff;
        }
        .vch-tab-pill.neutral {
          background: var(--surface2);
          color: var(--text2);
          border: 1px solid var(--border);
        }

        /* ── Bundling Layout ── */
        .bundle-wrap { width: 100%; }
        .bundle-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          align-items: start;
        }
        .bundle-left { min-width: 0; }
        .bundle-right { position: sticky; top: 20px; }

        .bundle-card { padding: 18px 20px; }
        .bundle-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .bundle-card-title {
          font-size: 15px;
          font-weight: 800;
          color: var(--text);
          display: flex;
          align-items: center;
        }
        .bundle-card-desc {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* Empty state */
        .bundle-empty {
          padding: 40px 20px;
          text-align: center;
          background: var(--surface2);
          border-radius: 12px;
          border: 1.5px dashed var(--border);
        }

        /* Bundling Table */
        .bundle-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
        .bundle-qty-box {
          display: inline-flex;
          align-items: center;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface);
        }
        .bundle-qty-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: var(--surface2);
          color: var(--text);
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s;
        }
        .bundle-qty-btn:hover { background: var(--border); }
        .bundle-qty-input {
          width: 38px;
          height: 28px;
          border: none;
          text-align: center;
          font-weight: 700;
          font-size: 13px;
          color: var(--text);
          background: transparent;
          outline: none;
          -moz-appearance: textfield;
        }
        .bundle-qty-input::-webkit-outer-spin-button,
        .bundle-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .bundle-del-btn {
          background: none;
          border: none;
          color: var(--red);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          transition: background 0.1s;
        }
        .bundle-del-btn:hover { background: var(--red-light); }

        /* Filter & Search Bar */
        .bundle-filter-bar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        .bundle-search-wrap {
          position: relative;
          width: 100%;
        }
        .bundle-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }
        .bundle-search-input {
          padding-left: 36px;
          padding-right: 32px;
          width: 100%;
        }
        .bundle-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 16px;
          color: var(--muted);
          cursor: pointer;
        }
        .bundle-cat-chips {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .bundle-chip {
          padding: 5px 12px;
          border-radius: 20px;
          border: 1.5px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: all 0.15s;
        }
        .bundle-chip:hover { border-color: var(--accent); color: var(--accent); }
        .bundle-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }

        /* Product Grid */
        .bundle-prod-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 10px;
          max-height: 380px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .bundle-prod-card {
          border: 1.5px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
          background: var(--surface);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }
        .bundle-prod-card:hover {
          border-color: var(--accent);
          box-shadow: 0 2px 8px rgba(79, 110, 247, 0.08);
        }
        .bundle-prod-card.selected {
          border-color: var(--accent);
          background: var(--accent-light);
        }
        .bundle-prod-info { flex: 1; min-width: 0; }
        .bundle-prod-name { font-weight: 700; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bundle-prod-meta { display: flex; gap: 4px; align-items: center; margin-top: 2px; }
        .bundle-prod-code { font-family: monospace; font-size: 10px; color: var(--muted); }
        .bundle-prod-cat { font-size: 10px; color: var(--muted); }
        .bundle-prod-prices { margin-top: 4px; }
        .bundle-prod-sell { font-weight: 800; font-size: 13px; color: var(--text); }
        .bundle-prod-hpp { font-size: 10px; color: var(--text3); }
        .bundle-add-btn {
          flex-shrink: 0;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 7px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .bundle-count-pill {
          background: #fff;
          color: var(--accent);
          border-radius: 10px;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 800;
        }

        /* ── Summary & Metrics (Kolom Kanan) ── */
        .bundle-summary-card {
          border: 1.5px solid var(--border2);
          box-shadow: var(--shadow-sm);
        }
        .bundle-cost-box {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .bundle-cost-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .bundle-cost-label { color: var(--text2); }
        .bundle-cost-val { text-align: right; }
        .bundle-cost-divider {
          height: 1px;
          background: var(--border);
          margin: 8px 0;
        }
        .bundle-cost-row.total {
          margin-bottom: 0;
          padding-top: 2px;
        }

        .bundle-price-input {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          padding-left: 40px;
          letter-spacing: 0.5px;
        }
        .bundle-preset-row {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .bundle-preset-btn {
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .bundle-preset-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .bundle-metrics {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-top: 14px;
        }
        .bundle-metric {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
        }
        .bundle-m-label { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .bundle-m-val { font-size: 20px; font-weight: 900; margin: 2px 0; }
        .bundle-m-sub { font-size: 11px; color: var(--muted); }

        .bundle-alert {
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 13px;
        }
        .bundle-alert.danger {
          background: var(--red-light);
          border: 1px solid var(--red-border);
          color: var(--red);
        }
        .bundle-alert.warning {
          background: var(--orange-light);
          border: 1px solid var(--orange-border);
          color: var(--orange);
        }
        .bundle-alert.success {
          background: var(--green-light);
          border: 1px solid var(--green-border);
          color: var(--green);
        }
        .bundle-alert.info {
          background: var(--accent-light);
          border: 1px solid #C7D4F0;
          color: var(--accent);
        }

        .bundle-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
        }

        /* ── Voucher Styles ── */
        .vch-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
        .vch-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .vch-stat-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        .vch-stat-value { font-size: 22px; font-weight: 800; color: var(--text); }

        .vch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .vch-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .vch-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .vch-code { font-family: monospace; font-weight: 800; font-size: 16px; color: var(--accent); letter-spacing: 0.5px; }
        .vch-desc { font-size: 12px; color: var(--muted); margin-top: -6px; }
        .vch-rows { display: flex; flex-direction: column; gap: 7px; }
        .vch-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; }
        .vch-row-k { color: var(--muted); }
        .vch-row-v { color: var(--text2); font-weight: 600; text-align: right; }

        .v-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .v-badge-green { background: #ECFDF5; color: #0EA472; }
        .v-badge-red { background: #FEF2F2; color: #E03E3E; }
        .v-badge-orange { background: #FFFBEB; color: #B45309; }
        .v-badge-gray { background: #F1F5F9; color: #64748B; }

        .vch-actions { display: flex; gap: 8px; }
        .vch-btn { flex: 1; justify-content: center; padding: 8px 6px; font-size: 12px; font-weight: 700; }
        .vch-btn-edit { background: var(--accent-light); color: var(--accent); border: 1px solid #C7D4F0; }
        .vch-btn-toggle { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .vch-btn-del { background: var(--red-light); color: var(--red); border: 1px solid var(--red-border); }

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
        .vch-seg-btn { flex: 1; padding: 9px; border-radius: 9px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text2); font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .vch-seg-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }
        .vch-check { display: flex; align-items: center; gap: 8px; margin: 4px 0 18px; cursor: pointer; font-size: 13px; color: var(--text2); }
        .vch-check input { width: 16px; height: 16px; }
        .vch-modal-actions { display: flex; gap: 8px; }
        .vch-modal-actions .btn { flex: 1; justify-content: center; padding: 11px; }

        /* ── Responsive Mobile ── */
        @media (max-width: 900px) {
          .bundle-layout { grid-template-columns: 1fr; }
          .bundle-right { position: static; }
        }
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
          .bundle-prod-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

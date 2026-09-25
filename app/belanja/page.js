'use client'
import { useEffect, useState, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

const fmt = (n) => {
  const num = Number(n)
  if (isNaN(num)) return 'Rp 0'
  const hasDecimal = num % 1 !== 0
  return 'Rp ' + num.toLocaleString('id-ID', hasDecimal ? { minimumFractionDigits: 1, maximumFractionDigits: 2 } : {})
}

// ── Styling halaman (desktop + mobile friendly) ──
// Kelas pg-* dipakai bareng dengan halaman Pengeluaran agar konsisten.
const pgStyles = (
  <style>{`
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pgFlash { 0%, 100% { box-shadow: inset 0 0 0 2px rgba(74,124,199,0); } 50% { box-shadow: inset 0 0 0 2px var(--accent); } }

    /* ── Belanja Operasional: header, toolbar & keranjang ── */
    .pg-topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .pg-topbar-title { min-width: 0; }
    .pg-topbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .pg-saldo {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface2); padding: 6px 14px;
      border-radius: 12px; border: 1px solid var(--border);
    }
    .pg-tabs { display: flex; background: var(--surface2); padding: 3px; border-radius: 10px; border: 1px solid var(--border); }
    .pg-tab {
      display: flex; align-items: center; justify-content: center;
      padding: 6px 14px; border-radius: 7px; border: none;
      font-size: 12px; font-weight: 600; font-family: inherit;
      background: transparent; color: var(--muted);
      cursor: pointer; transition: background 0.15s, color 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .pg-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .pg-added-row { flex-wrap: wrap; }
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

    /* Riwayat pengajuan */
    .pg-hist-item { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
    .pg-hist-item > span:first-child { min-width: 0; }
    .pg-hist-item > span:last-child { flex-shrink: 0; font-weight: 600; }
    .pg-hist-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .pg-hist-actions .btn { gap: 6px; font-size: 12px; padding: 7px 13px; }

    /* Modal edit pengajuan (Admin & Operasional) */
    .pg-edit-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .pg-edit-item { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .pg-edit-item-head { display: flex; gap: 8px; align-items: center; }
    .pg-edit-item-head > input:first-child { flex: 1; min-width: 0; }
    .pg-edit-item-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .pg-edit-item-total { flex: 1 1 100%; text-align: right; font-size: 12.5px; font-weight: 800; color: var(--red); }
    .pg-unit-hint { font-size: 11px; color: var(--muted); padding-left: 2px; }
    .pg-isi { width: 88px; }
    .pg-modal-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }

    /* ── Belanja Operasional: mobile friendly ── */
    @media (max-width: 768px) {
      /* Header bertumpuk: judul, badge saldo, tab + keranjang */
      .pg-topbar {
        height: auto !important; min-height: 56px;
        flex-direction: column; align-items: stretch;
        padding: 9px 12px !important; gap: 8px;
      }
      .pg-topbar-actions { width: 100%; gap: 8px; flex-wrap: wrap; }
      .pg-saldo { flex: 1 1 100%; justify-content: space-between; padding: 6px 12px !important; }
      .pg-tabs { flex: 1 1 auto; }
      .pg-tab { flex: 1; padding: 8px !important; font-size: 11.5px !important; white-space: nowrap; }
      .pg-cart-btn { flex: 0 0 auto; padding: 8px 11px !important; }

      /* Toolbar aksi */
      .pg-toolbar { padding: 10px 12px !important; gap: 6px; }
      .pg-toolbar .btn { flex: 1 1 0; min-width: 0; justify-content: center; padding: 9px 6px !important; font-size: 11px !important; white-space: nowrap; overflow: hidden; }

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
      .pg-isi { flex: 1 1 0 !important; min-width: 76px !important; width: auto !important; }
      .pg-qty { flex: 0 1 64px; width: auto !important; }
      .pg-added-row { margin-left: 0 !important; width: 100%; justify-content: space-between; }

      /* Riwayat pengajuan */
      .pg-history { padding: 12px !important; }
      .pg-history .card { padding: 14px !important; }
      .pg-hist-head { flex-direction: column; align-items: stretch !important; }
      .pg-hist-total { text-align: left !important; display: flex; align-items: baseline; gap: 8px; }
      .pg-hist-actions { flex-direction: column; }
      .pg-hist-actions .btn { width: 100%; justify-content: center; padding: 10px !important; font-size: 12.5px !important; }

      /* Modal edit pengajuan jadi bottom sheet */
      .pg-edit-grid { grid-template-columns: minmax(0, 1fr) !important; }
      .pg-modal-body { max-height: 58vh; }
      .pg-modal-footer { padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important; }

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
        background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff;
        box-shadow: 0 10px 28px rgba(217,119,6,0.42);
        cursor: pointer; font-family: inherit; text-align: left;
        -webkit-tap-highlight-color: transparent;
      }
      .pg-cart-fab-icon { position: relative; display: flex; align-items: center; justify-content: center; }
      .pg-cart-fab .pg-cart-badge { border-color: #D97706; background: #fff; color: var(--red); }

      /* Modal input manual jadi bottom sheet */
      .pg-modal-overlay { align-items: flex-end !important; }
      .pg-modal {
        width: 100% !important; max-width: 100% !important;
        max-height: 92vh; overflow-y: auto;
        border-radius: 18px 18px 0 0 !important;
        padding-bottom: env(safe-area-inset-bottom);
      }

      /* Toast hasil import */
      .pg-toast { left: 12px !important; right: 12px !important; bottom: 76px !important; max-width: none !important; width: auto !important; }

      /* Kartu sukses */
      .pg-success-card { padding: 28px 18px !important; }
    }

    @media (max-width: 400px) {
      .pg-cart-btn-label { display: none; }
      .pg-cart-btn { padding: 8px 10px !important; }
    }
  `}</style>
)

export default function BelanjaPage() {
  const [activeTab, setActiveTab] = useState('FORM') // FORM, HISTORY
  const [saldo, setSaldo] = useState(0)

  // Form & Cart States
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState({})
  const today = new Date().toISOString().slice(0, 10)
  const [catatan, setCatatan] = useState('')
  const [tanggal, setTanggal] = useState(today)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ name: '', keterangan: '', satuan: '', kategori: '', harga: '', isi: '', qty: 1 })
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)
  const [editCartItem, setEditCartItem] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartFlash, setCartFlash] = useState(false)

  const [expenseCategories, setExpenseCategories] = useState([])

  // History States
  const [historyList, setHistoryList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Edit pengajuan (Admin & Operasional) — hanya untuk pengajuan ber-status PENDING
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ tanggal: '', keterangan: '', items: [] })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editParam, setEditParam] = useState(null) // deep link ?edit=<id> dari halaman Saldo
  const [toastMsg, setToastMsg] = useState('')

  // User login (pola sama dengan Sidebar & halaman lain)
  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const isAdmin = user.role === 'ADMIN'
  const hasBelanjaAccess = (() => {
    if (isAdmin) return true
    const allowed = Array.isArray(user.allowedPaths) ? user.allowedPaths : []
    return allowed.some(p => '/belanja' === p || '/belanja'.startsWith(p + '/'))
  })()
  // Admin boleh mengubah semua pengajuan; Operasional boleh mengubah pengajuan miliknya
  // (atau seluruh pengajuan bila custom role-nya diberi akses halaman /belanja)
  const canEditItem = (item) =>
    item.status === 'PENDING' && (isAdmin || hasBelanjaAccess || (!!user.id && item.requesterId === user.id))

  useEffect(() => {
    fetchExpenseData()
    fetchSaldo()
  }, [])

  // Dukungan tautan ?edit=<id> (tombol "Ubah Rincian" di halaman Saldo)
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('edit')
    if (target) {
      setEditParam(target)
      setActiveTab('HISTORY')
    }
  }, [])

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(''), 2800)
    return () => clearTimeout(t)
  }, [toastMsg])

  function fetchSaldo() {
    api.get('/operational/saldo').then(r => setSaldo(r.data.saldo || 0)).catch(() => {})
  }

  function fetchExpenseData() {
    api.get('/admin/expense-items').then(r => setItems(r.data)).catch(() => {})
    api.get('/admin/expense-categories').then(r => setExpenseCategories(r.data.map(c => c.name))).catch(() => {})
  }

  function fetchHistory() {
    setLoadingHistory(true)
    api.get('/operational/belanja')
      .then(r => {
        const list = r.data || []
        setHistoryList(list)
        // Buka otomatis modal edit bila datang dari tautan ?edit=<id>
        if (editParam) {
          const target = list.find(b => b.id === editParam)
          if (target && canEditItem(target)) openEdit(target)
          setEditParam(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory()
    }
  }, [activeTab])

  // Kunci scroll body saat keranjang (sheet mobile), modal input manual, atau modal edit terbuka
  useEffect(() => {
    if (cartOpen || manualOpen || editOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, manualOpen, editOpen])

  const categories = ['Semua', ...Array.from(new Set(items.filter(i => !i.isManual && i.category).map(i => i.category)))]

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Semua' || i.category === activeCategory || i.isManual
    return matchSearch && matchCat
  })

  function updateCart(itemId, field, value) {
    setCart(prev => ({ ...prev, [itemId]: { harga: '', qty: 1, keterangan: '', isi: '', ...prev[itemId], [field]: value } }))
  }

  function unitPrice(entry) {
    const harga = Number(entry.harga) || 0
    const isi = Number(entry.isi) || 0
    return isi > 0 ? harga / isi : harga
  }

  function addToCart(item) {
    const entry = cart[item.id] || {}
    if (!Number(entry.harga)) return alert('Isi harga terlebih dahulu')
    const isi = Number(entry.isi) || 0
    setCart(prev => ({ ...prev, [item.id]: { ...prev[item.id], isi: isi > 0 ? String(isi) : '', qty: String(Number(entry.qty) || 1), added: true } }))
  }

  function removeFromCart(itemId) {
    setCart(prev => { const next = { ...prev }; delete next[itemId]; return next })
  }

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
    a.href = url; a.download = 'template-import-belanja.csv'; a.click()
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
    const id = `manual_${Date.now()}`
    const isi = Number(manual.isi) || 0
    setCart(prev => ({ ...prev, [id]: { harga: manual.harga, isi: isi > 0 ? String(isi) : '', qty: manual.qty, keterangan: manual.keterangan, satuan: manual.satuan, category: manual.kategori || '', added: true, isManual: true } }))
    setItems(prev => [...prev, { id, name: manual.name, code: null, category: manual.kategori || null, isManual: true }])
    setManual({ name: '', keterangan: '', satuan: '', kategori: '', harga: '', isi: '', qty: 1 })
    setManualOpen(false)
  }

  const cartItems = items.filter(i => cart[i.id]?.added)
  const total = cartItems.reduce((s, i) => s + (Number(cart[i.id].harga) || 0) * (Number(cart[i.id].qty) || 1), 0)

  async function handleSaveBelanja() {
    if (!cartItems.length) return alert('Belum ada item belanja')
    setSaving(true)
    try {
      const res = await api.post('/operational/belanja', {
        keterangan: catatan,
        tanggal: tanggal,
        items: cartItems.map(i => ({
          itemId: i.isManual ? null : i.id,
          name: i.name,
          harga: Number(cart[i.id].harga),
          qty: Number(cart[i.id].qty) || 1,
          satuan: i.satuan || cart[i.id].satuan || '',
          keterangan: cart[i.id].keterangan || '',
          isi: cart[i.id].isi ? Number(cart[i.id].isi) : null,
          isManual: !!i.isManual,
        })),
      })
      setSaved(res.data.data)
      setCart({}); setCatatan(''); setCartOpen(false)
      setItems(prev => prev.filter(i => !i.isManual))
      fetchSaldo()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal mengajukan belanja')
    } finally { setSaving(false) }
  }

  // ── Edit pengajuan belanja (Admin & Operasional, status PENDING) ──
  function openEdit(item) {
    setEditId(item.id)
    setEditForm({
      tanggal: item.tanggal ? new Date(item.tanggal).toISOString().slice(0, 10) : today,
      keterangan: item.keterangan || '',
      items: (item.items || []).map((it, idx) => ({
        key: it.id || `it_${idx}`,
        itemId: it.itemId || null,
        itemName: it.itemName || '',
        harga: it.harga ?? '',
        isi: it.isi ?? null,
        qty: it.qty ?? 1,
        satuan: it.satuan || '',
        keterangan: it.keterangan || '',
      })),
    })
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditId(null)
    setEditForm({ tanggal: '', keterangan: '', items: [] })
  }

  function setEditItemField(idx, field, value) {
    setEditForm(prev => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }))
  }

  function addEditItem() {
    setEditForm(prev => ({
      ...prev,
      items: [...prev.items, { key: `new_${Date.now()}`, itemId: null, itemName: '', harga: '', isi: null, qty: 1, satuan: '', keterangan: '' }],
    }))
  }

  function removeEditItem(idx) {
    setEditForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const editTotal = editForm.items.reduce((s, it) => s + (Number(it.harga) || 0) * (Number(it.qty) || 1), 0)
  const editTarget = historyList.find(b => b.id === editId) || null

  async function handleSaveEdit(e) {
    e?.preventDefault()
    if (!editForm.items.length) return alert('Belum ada item belanja')
    if (editForm.items.some(it => !String(it.itemName || '').trim())) return alert('Nama item belanja wajib diisi')
    setSavingEdit(true)
    try {
      await api.patch(`/operational/belanja/${editId}`, {
        action: 'EDIT',
        tanggal: editForm.tanggal,
        keterangan: editForm.keterangan,
        items: editForm.items.map(it => ({
          itemId: it.itemId || null,
          name: it.itemName,
          harga: Number(it.harga) || 0,
          isi: Number(it.isi) > 0 ? Number(it.isi) : null,
          qty: Number(it.qty) || 1,
          satuan: it.satuan || '',
          keterangan: it.keterangan || '',
        })),
      })
      closeEdit()
      fetchHistory()
      fetchSaldo()
      setToastMsg('Pengajuan belanja berhasil diperbarui')
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui pengajuan belanja')
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Hapus riwayat pengajuan belanja (Khusus Admin) ──
  async function handleDeleteBelanja(item) {
    if (!isAdmin) {
      alert('Hanya Admin yang berhak menghapus riwayat pengajuan belanja')
      return
    }

    const label = item.keterangan ? `"${item.keterangan}" (${fmt(item.total)})` : `${fmt(item.total)} oleh ${item.requesterName}`
    const confirmMsg = item.status === 'APPROVED'
      ? `Yakin ingin menghapus riwayat pengajuan belanja ini: ${label}?\n\nPerhatian: Pengajuan ini sudah berstatus DISETUJUI (ACC). Menghapus pengajuan ini hanya membersihkan riwayat pengajuan belanja, tanpa mengubah data pembukuan Toko/Ledger yang sudah tercatat.`
      : `Yakin ingin menghapus riwayat pengajuan belanja ini: ${label}?`

    if (!window.confirm(confirmMsg)) return

    setDeletingId(item.id)
    try {
      await api.delete(`/operational/belanja/${item.id}`)
      fetchHistory()
      fetchSaldo()
      setToastMsg('Riwayat pengajuan belanja berhasil dihapus')
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus riwayat pengajuan belanja')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Success screen ──
  if (saved) return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar"><div className="topbar-title">Belanja Operasional</div></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px' }}>
          <div className="card fade-in pg-success-card" style={{ padding: '44px 36px', textAlign: 'center', maxWidth: '460px', width: '100%', borderRadius: '18px' }}>
            <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(245,158,11,0.35)', color: '#fff' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px' }}>Pengajuan Belanja Dikirim!</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#D97706', background: '#FEF3C7', padding: '4px 14px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px', border: '1px solid #FDE68A' }}>
              Status: Menunggu ACC Admin
            </div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--red)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{fmt(saved.total)}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '24px' }}>{saved.items?.length} item · {new Date(saved.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            
            <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '6px 12px', marginBottom: '24px', border: '1px solid var(--border)', textAlign: 'left' }}>
              {saved.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < saved.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{item.itemName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      {fmt(item.harga)} × {item.qty} {item.satuan}
                      {Number(item.isi) > 0 ? ` · ${fmt(Number(item.harga) / Number(item.isi))}/${item.satuan || 'isi'}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{fmt(item.subtotal)}</div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSaved(null); setActiveTab('HISTORY') }}>
                Lihat Riwayat
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: '13px' }} onClick={() => setSaved(null)}>
                Ajukan Belanja Lagi
              </button>
            </div>
          </div>
        </div>
      </main>
      {pgStyles}
    </div>
  )

  return (
    <div className="page">
      <Sidebar />
      <main className="main pg-main" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' }}>

        {/* Topbar dengan Indikator Saldo Operasional */}
        <div className="topbar pg-topbar">
          <div className="pg-topbar-title">
            <div className="topbar-title">Belanja Operasional</div>
            <div className="topbar-sub">Input belanja operasional yang perlu di-ACC Admin</div>
          </div>

          <div className="pg-topbar-actions">
            {/* Saldo Operasional Badge */}
            <div className="pg-saldo">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)' }}>Saldo Operasional:</div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: saldo < 100000 ? '#EF4444' : '#10B981' }}>{fmt(saldo)}</div>
            </div>

            {/* Toggle Tab (Form vs History) */}
            <div className="pg-tabs">
              <button type="button" className={`pg-tab${activeTab === 'FORM' ? ' active' : ''}`} onClick={() => setActiveTab('FORM')}>
                + Input Belanja
              </button>
              <button type="button" className={`pg-tab${activeTab === 'HISTORY' ? ' active' : ''}`} onClick={() => setActiveTab('HISTORY')}>
                Riwayat Pengajuan
              </button>
            </div>

            {activeTab === 'FORM' && (
              <button className="pg-cart-btn" type="button" onClick={openCart} aria-label="Buka keranjang">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span className="pg-cart-btn-label">Keranjang</span>
                {cartItems.length > 0 && <span className="pg-cart-badge">{cartItems.length}</span>}
              </button>
            )}
          </div>
        </div>

        {/* Tab Content: HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="pg-history" style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px' }}>Daftar Pengajuan Belanja Operasional</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>Pantau status pengajuan belanja (Pending, Approved, Rejected)</div>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Memuat riwayat pengajuan...</div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛒</div>
                  <div style={{ fontWeight: '600' }}>Belum ada pengajuan belanja</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyList.map(item => {
                    const statusColor = item.status === 'APPROVED' ? '#10B981' : item.status === 'REJECTED' ? '#EF4444' : '#F59E0B'
                    const statusBg = item.status === 'APPROVED' ? '#ECFDF5' : item.status === 'REJECTED' ? '#FEF2F2' : '#FEF3C7'
                    const statusText = item.status === 'APPROVED' ? 'Disetujui (ACC)' : item.status === 'REJECTED' ? 'Ditolak' : 'Menunggu ACC'

                    return (
                      <div key={item.id} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border)' }}>
                        <div className="pg-hist-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '20px', background: statusBg, color: statusColor }}>
                                {statusText}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Diajukan oleh: <strong>{item.requesterName}</strong></div>
                          </div>

                          <div className="pg-hist-total" style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)' }}>{fmt(item.total)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.items?.length} item</div>
                          </div>
                        </div>

                        {/* Rincian Item */}
                        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                          {item.items?.map((sub, idx) => (
                            <div key={idx} className="pg-hist-item">
                              <span>
                                {sub.itemName} ({sub.qty} {sub.satuan || ''})
                                {Number(sub.isi) > 0 && (
                                  <span style={{ color: 'var(--muted)' }}> · {fmt(Number(sub.harga) / Number(sub.isi))}/{sub.satuan || 'isi'}</span>
                                )}
                              </span>
                              <span>{fmt(sub.subtotal)}</span>
                            </div>
                          ))}
                        </div>

                        {item.keterangan && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontStyle: 'italic' }}>Catatan: &quot;{item.keterangan}&quot;</div>}
                        {item.adminNote && <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', fontWeight: '600' }}>Catatan Admin: &quot;{item.adminNote}&quot;</div>}

                        {/* Aksi baris riwayat */}
                        <div className="pg-hist-actions">
                          {/* Aksi edit — Admin & Operasional, hanya saat status masih PENDING */}
                          {canEditItem(item) && (
                            <button type="button" className="btn" onClick={() => openEdit(item)}
                              title="Ubah tanggal, catatan, atau rincian item pengajuan"
                              style={{ background: 'var(--orange-light)', color: 'var(--orange)', border: '1px solid var(--orange-light)', fontWeight: '700' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              Edit Rincian
                            </button>
                          )}

                          {/* Aksi hapus riwayat pengajuan belanja — Khusus Admin */}
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDeleteBelanja(item)}
                              disabled={deletingId === item.id}
                              title="Hapus riwayat pengajuan belanja ini"
                              style={{ padding: '7px 12px', fontSize: '12px' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              {deletingId === item.id ? 'Menghapus...' : 'Hapus'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: FORM BELANJA */}
        {activeTab === 'FORM' && (
          <>
            {/* Toolbar aksi */}
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
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
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

              {/* Left Item List */}
              <div className="pg-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
                {/* Search + Filter */}
                <div className="pg-search" style={{ padding: '16px 20px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <svg style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="input" style={{ paddingLeft: '40px', background: 'var(--surface2)' }}
                      placeholder="Cari item belanja..."
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

                {/* Item List */}
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
                      const qty = Number(entry.qty) || 1

                      return (
                        <div key={item.id} style={{
                          background: isAdded ? 'var(--accent-light)' : 'var(--surface)',
                          border: `1.5px solid ${isAdded ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: '12px', padding: '14px 16px',
                          transition: 'all 0.15s',
                        }}>
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
                            </div>

                            {isAdded && (
                              <div className="pg-added-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)' }}>{fmt(harga * qty)}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                    {fmt(harga)} × {qty}
                                    {Number(entry.isi) > 0 ? ` · ${fmt(unitPrice(entry))}/${item.satuan || 'isi'}` : ''}
                                  </div>
                                </div>
                                <button onClick={() => removeFromCart(item.id)}
                                  style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            )}
                          </div>

                          {!isAdded && (() => {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div className="pg-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input className="input pg-ket" placeholder="Keterangan" value={entry.keterangan || ''}
                                    onChange={e => updateCart(item.id, 'keterangan', e.target.value)}
                                    style={{ flex: 1, fontSize: '12px', padding: '7px 11px', minWidth: 0 }} />

                                  <div className="pg-nw" style={{ position: 'relative', flexShrink: 0 }}>
                                    <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', pointerEvents: 'none' }}>Rp</span>
                                    <input className="input" type="number" step="any" placeholder="Harga" value={entry.harga || ''}
                                      onChange={e => updateCart(item.id, 'harga', e.target.value)}
                                      style={{ width: '120px', fontSize: '12px', padding: '7px 11px 7px 28px' }} />
                                  </div>

                                  <input className="input pg-isi" type="number" step="any" min="0"
                                    placeholder={`Isi${item.satuan ? ` (${item.satuan})` : ''}`}
                                    title="Isi per kemasan (ml/gram/pcs) — dipakai untuk menghitung harga per ml/gram di rekap pengeluaran"
                                    value={entry.isi || ''}
                                    onChange={e => updateCart(item.id, 'isi', e.target.value)}
                                    style={{ width: '88px', textAlign: 'center', fontSize: '12px', padding: '7px 8px', flexShrink: 0 }} />

                                  <input className="input pg-qty" type="number" step="any" min="0" value={entry.qty || 1}
                                    onChange={e => updateCart(item.id, 'qty', e.target.value)}
                                    style={{ width: '56px', textAlign: 'center', fontSize: '12px', padding: '7px 8px', flexShrink: 0 }} />

                                  <button onClick={() => addToCart(item)}
                                    style={{ width: '34px', height: '34px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(74,124,199,0.35)' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  </button>
                                </div>

                                {/* Hitung harga per ml/gram dari isi kemasan */}
                                {Number(entry.isi) > 0 && Number(entry.harga) > 0 && (
                                  <div className="pg-unit-hint">
                                    Harga per {item.satuan || 'ml/gram'}: <strong style={{ color: 'var(--accent)' }}>{fmt(unitPrice(entry))}</strong>
                                    {' · '}{fmt(Number(entry.harga))} ÷ {Number(entry.isi)} {item.satuan || ''}
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

              {/* Right Cart Summary Panel */}
              <div id="pg-cart" className={`pg-cart${cartOpen ? ' open' : ''}${cartFlash ? ' flash' : ''}`} style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
                <div className="pg-cart-sheetbar">
                  <span className="pg-cart-handle" />
                  <button className="pg-cart-close" type="button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', marginBottom: '2px' }}>Total Pengajuan Belanja</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: total > 0 ? '#DC2626' : 'var(--muted)', letterSpacing: '-0.5px' }}>{fmt(total)}</div>
                  <div style={{ fontSize: '11px', color: '#B45309', marginTop: '4px' }}>*Memotong Saldo Operasional setelah di-ACC Admin</div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '10px', marginBottom: '4px' }}>Tanggal Belanja</div>
                  <input type="date" className="input" value={tanggal} onChange={e => setTanggal(e.target.value)}
                    style={{ fontSize: '12px', padding: '7px 11px', background: '#fff' }} />
                </div>

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
                        const qty = Number(e.qty) || 1
                        const isi = Number(e.isi) || 0
                        const satuan = item.satuan || e.satuan || ''
                        return (
                          <div key={i} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.name}
                                  {item.isManual && <span style={{ marginLeft: '5px', fontSize: '9px', background: 'var(--orange-light)', color: 'var(--orange)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>Manual</span>}
                                </div>
                                {e.keterangan && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{e.keterangan}</div>}
                                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {fmt(harga)} × {qty}
                                  {isi > 0 ? ` · isi ${isi} ${satuan} → ${fmt(harga / isi)}/${satuan || 'isi'}` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--red)' }}>{fmt(harga * qty)}</div>
                                <button onClick={() => removeFromCart(item.id)}
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

                <div className="pg-cart-footer" style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <textarea className="input" rows={2} placeholder="Catatan pengajuan belanja... (opsional)" value={catatan}
                    onChange={e => setCatatan(e.target.value)} style={{ resize: 'none', fontSize: '12px', marginBottom: '10px' }} />
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', opacity: cartItems.length ? 1 : 0.5, cursor: cartItems.length ? 'pointer' : 'not-allowed' }}
                    onClick={handleSaveBelanja} disabled={saving || !cartItems.length}>
                    {saving ? 'Mengirim Pengajuan...' : 'Ajukan Belanja Operasional'}
                  </button>
                </div>
              </div>

            </div>
          </>
        )}

      </main>

      {/* FAB keranjang (mobile) — ringkasan item + pintasan buka sheet */}
      {activeTab === 'FORM' && cartItems.length > 0 && !importResult && (
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

      {/* Modal Input Manual */}
      {manualOpen && (
        <div className="pg-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setManualOpen(false) }}>
          <div className="card fade-in pg-modal" style={{ width: '420px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Input Manual Belanja</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Tambah item yang tidak ada di daftar</div>
              </div>
              <button onClick={() => setManualOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            <form onSubmit={addManual} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Nama Item Belanja</label>
                <input className="input" placeholder="Nama barang atau jasa..." value={manual.name}
                  onChange={e => setManual({ ...manual, name: e.target.value })} required autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Harga</label>
                  <input className="input" type="number" step="any" placeholder="0" value={manual.harga}
                    onChange={e => setManual({ ...manual, harga: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Qty</label>
                  <input className="input" type="number" step="any" min="0" value={manual.qty}
                    onChange={e => setManual({ ...manual, qty: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Satuan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(ml/gr/ps)</span></label>
                  <input className="input" placeholder="ml, gram, pcs..." value={manual.satuan}
                    onChange={e => setManual({ ...manual, satuan: e.target.value })} />
                </div>
                <div>
                  <label className="label">Isi per Kemasan</label>
                  <input className="input" type="number" step="any" min="0" placeholder="0" value={manual.isi}
                    onChange={e => setManual({ ...manual, isi: e.target.value })} />
                </div>
              </div>
              {Number(manual.harga) > 0 && Number(manual.isi) > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderRadius: '9px', border: '1px solid #A7DFC8', fontSize: '12px', color: 'var(--green)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Harga per {manual.satuan || 'ml/gram'}: {fmt(Number(manual.harga) / Number(manual.isi))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setManualOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Tambah</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast sukses edit pengajuan */}
      {toastMsg && (
        <div className="pg-toast" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 700, maxWidth: '380px', width: '100%' }}>
          <div className="slide-down" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #A7F3D0', background: '#F0FDF4', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>✅</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#10B981' }}>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Modal Edit Pengajuan Belanja — Admin & Operasional (status PENDING) */}
      {editOpen && (
        <div className="pg-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 420, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeEdit() }}>
          <div className="card fade-in pg-modal" style={{ width: '620px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div className="pg-edit-head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Edit Pengajuan Belanja</div>
                <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                  {editTarget?.requesterName ? `Diajukan oleh: ${editTarget.requesterName}` : 'Perbarui tanggal, catatan, dan rincian item'}
                </div>
              </div>
              <button type="button" onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="pg-modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                <div className="pg-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 190px) minmax(0, 1fr)', gap: '12px' }}>
                  <div>
                    <label className="label">Tanggal Belanja</label>
                    <input type="date" className="input" value={editForm.tanggal}
                      onChange={e => setEditForm(prev => ({ ...prev, tanggal: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Catatan Pengajuan</label>
                    <input type="text" className="input" placeholder="Catatan pengajuan belanja (opsional)"
                      value={editForm.keterangan}
                      onChange={e => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <label className="label" style={{ marginBottom: 0 }}>Rincian Item ({editForm.items.length})</label>
                    <button type="button" className="btn btn-ghost" onClick={addEditItem} style={{ gap: '5px', fontSize: '11.5px', padding: '6px 11px', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Tambah Item
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {editForm.items.length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '14px', textAlign: 'center', background: 'var(--surface2)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                        Belum ada item. Tambahkan minimal 1 item belanja.
                      </div>
                    )}

                    {editForm.items.map((it, idx) => (
                      <div key={it.key} className="pg-edit-item">
                        <div className="pg-edit-item-head">
                          <input className="input" placeholder="Nama item belanja" value={it.itemName}
                            onChange={e => setEditItemField(idx, 'itemName', e.target.value)}
                            style={{ fontSize: '12.5px' }} />
                          <button type="button" onClick={() => removeEditItem(idx)} title="Hapus item"
                            style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1px solid #FECACA', background: 'var(--red-light)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>

                        <div className="pg-edit-item-row">
                          <div style={{ position: 'relative', flex: '1 1 130px', minWidth: 0 }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', pointerEvents: 'none' }}>Rp</span>
                            <input className="input" type="number" step="any" min="0" placeholder="Harga" value={it.harga}
                              onChange={e => setEditItemField(idx, 'harga', e.target.value)}
                              style={{ width: '100%', fontSize: '12.5px', paddingLeft: '32px' }} />
                          </div>
                          <input className="input" type="number" step="any" min="0" title="Qty" value={it.qty}
                            onChange={e => setEditItemField(idx, 'qty', e.target.value)}
                            style={{ flex: '0 1 70px', fontSize: '12.5px', textAlign: 'center' }} />
                          <input className="input" placeholder="Satuan" value={it.satuan}
                            onChange={e => setEditItemField(idx, 'satuan', e.target.value)}
                            style={{ flex: '1 1 90px', minWidth: 0, fontSize: '12.5px' }} />
                          <input className="input" type="number" step="any" min="0" title="Isi per kemasan (ml/gram/pcs)"
                            placeholder="Isi" value={it.isi ?? ''}
                            onChange={e => setEditItemField(idx, 'isi', e.target.value)}
                            style={{ flex: '0 1 80px', fontSize: '12.5px', textAlign: 'center' }} />
                          <div className="pg-edit-item-total">{fmt((Number(it.harga) || 0) * (Number(it.qty) || 1))}</div>
                        </div>

                        {Number(it.isi) > 0 && Number(it.harga) > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Harga per {it.satuan || 'ml/gram'}: <strong style={{ color: 'var(--accent)' }}>{fmt(Number(it.harga) / Number(it.isi))}</strong>
                          </div>
                        )}

                        <input className="input" placeholder="Keterangan item (opsional)" value={it.keterangan}
                          onChange={e => setEditItemField(idx, 'keterangan', e.target.value)}
                          style={{ fontSize: '12px' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pg-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: '600' }}>Total Pengajuan</span>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: '#DC2626' }}>{fmt(editTotal)}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={closeEdit} disabled={savingEdit}>Batal</button>
                  <button type="submit" className="btn" disabled={savingEdit}
                    style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', border: 'none', fontWeight: '700' }}>
                    {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                  Setelah diperbarui, pengajuan tetap ber-status Pending dan menunggu ACC Admin.
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {pgStyles}
    </div>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

// ── Kategori waste ──
// URUTAN mengikuti urutan tombol di halaman & ringkasan.
const CATEGORIES = [
  { value: 'BUSUK',           label: 'Busuk',           desc: 'Rusak, basi, atau kadaluarsa',   emoji: '🥀' },
  { value: 'TIDAK_TERPAKAI',  label: 'Tidak Terpakai',  desc: 'Sisa / tidak jadi dipakai',      emoji: '📦' },
  { value: 'DIPAKAI_SENDIRI', label: 'Dipakai Sendiri', desc: 'Konsumsi sendiri / staf',        emoji: '🍽️' },
  { value: 'SALAH_BUAT',      label: 'Salah Buat',      desc: 'Gagal produksi / salah resep',   emoji: '⚠️' },
  { value: 'RND',             label: 'RnD',             desc: 'Riset & pengembangan menu',      emoji: '🧪' },
  { value: 'LAINNYA',         label: 'Lainnya',         desc: 'Sebab lain',                     emoji: '🔖' },
]
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))
const catLabel = (v) => CAT[v]?.label || v

// ── Format ──
const fmtRp = (n) => 'Rp ' + Number(Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })
// Harga per satuan bisa < 1 (mis. per gram) → pakai 4 desimal agar tidak dibulatkan jadi 0
const fmtHarga = (n) => {
  const num = Number(n) || 0
  return num > 0 && num < 1 ? 'Rp ' + num.toFixed(4) : 'Rp ' + num.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}
const fmtQty = (n) => Number(n) % 1 !== 0
  ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: 3 })
  : Number(n).toLocaleString('id-ID')
const fmtTanggal = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
const awalBulanWIB = () => `${todayWIB().slice(0, 7)}-01`

// Harga satuan bahan baku = harga per kemasan (Ingredient.price) dibagi isi
// per kemasan (Ingredient.packSize). Sama seperti HET di halaman Belanja Operasional.
// packSize kosong → harga dianggap harga per satuan.
const hetBahan = (ing) => {
  if (!ing) return null
  const perPack = Number(ing.price)
  if (!isFinite(perPack) || perPack <= 0) return null
  const isi = Number(ing.packSize) || 0
  return isi > 0 ? perPack / isi : perPack
}

const emptyForm = () => ({ tanggal: todayWIB(), category: 'BUSUK', note: '', items: [] })

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Styling halaman (kelas berprefix wst- agar tidak bentrok) ──
const styles = `
  @keyframes wstSpin { to { transform: rotate(360deg); } }
  .wst-topbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .wst-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .wst-sum-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 13px 16px; box-shadow: var(--shadow-xs); }
  .wst-sum-label { font-size: 10.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); }
  .wst-sum-value { font-size: 19px; font-weight: 800; color: var(--text); margin-top: 4px; letter-spacing: -.5px; }
  .wst-sum-sub { font-size: 11.5px; color: var(--text3); margin-top: 3px; }
  .wst-cats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .wst-cat {
    display: flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 11px;
    border: 1.5px solid var(--border); background: var(--surface); cursor: pointer;
    font-family: inherit; font-size: 12px; color: var(--text2);
    transition: border-color .15s, background .15s, color .15s; -webkit-tap-highlight-color: transparent;
  }
  .wst-cat:hover { border-color: var(--border2); }
  .wst-cat.active { border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 700; }
  .wst-cat-nilai { font-weight: 700; opacity: .85; }
  .wst-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; padding: 14px; margin-bottom: 16px; }
  .wst-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .wst-field > label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
  .wst-search { position: relative; flex: 1 1 200px; min-width: 150px; }
  .wst-search > svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
  .wst-search .input { padding-left: 32px; }
  .wst-list { display: flex; flex-direction: column; gap: 12px; }
  .wst-note { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-xs); }
  .wst-note-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .wst-note-date { font-weight: 700; color: var(--text); font-size: 13px; }
  .wst-note-meta { font-size: 11.5px; color: var(--muted); }
  .wst-note-total { margin-left: auto; text-align: right; }
  .wst-note-total b { display: block; font-size: 15px; font-weight: 800; color: var(--red); }
  .wst-items { width: 100%; border-collapse: collapse; }
  .wst-items th { padding: 7px 14px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); text-align: left; background: var(--surface2); border-bottom: 1px solid var(--border); font-weight: 700; }
  .wst-items td { padding: 9px 14px; font-size: 12.5px; color: var(--text2); border-bottom: 1px solid var(--border); }
  .wst-items tr:last-child td { border-bottom: none; }
  .wst-num { text-align: right; white-space: nowrap; }
  .wst-note-foot { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-top: 1px solid var(--border); background: var(--surface2); flex-wrap: wrap; }
  .wst-note-note { flex: 1 1 200px; font-size: 12px; color: var(--text2); }
  .wst-actions { display: flex; gap: 6px; margin-left: auto; }
  .wst-btn-sm { padding: 5px 12px !important; font-size: 12px !important; }
  .wst-empty { padding: 44px 20px; text-align: center; color: var(--muted); }
  .wst-alert { display: flex; gap: 10px; align-items: flex-start; padding: 13px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 12.5px; }
  .wst-spinner { width: 26px; height: 26px; border: 2.5px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: wstSpin .7s linear infinite; margin: 0 auto 10px; }
  .wst-pager { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 16px; font-size: 12.5px; color: var(--text3); flex-wrap: wrap; }
  .wst-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(2px); z-index: 300; display: flex; align-items: flex-start; justify-content: center; padding: 26px 16px; overflow-y: auto; }
  .wst-modal { width: 100%; max-width: 880px; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow-lg); overflow: hidden; }
  .wst-modal-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
  .wst-modal-title { font-size: 15px; font-weight: 700; color: var(--text); flex: 1; }
  .wst-modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
  .wst-modal-foot { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--border); background: var(--surface2); flex-wrap: wrap; }
  .wst-cats-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .wst-cat-opt { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; font-family: inherit; font-size: 12px; color: var(--text2); -webkit-tap-highlight-color: transparent; }
  .wst-cat-opt.active { border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 700; }
  .wst-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; align-items: end; }
  .wst-item { display: flex; flex-direction: column; gap: 9px; padding: 11px 12px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface2); }
  .wst-item-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
  .wst-static { display: flex; align-items: center; min-height: 38px; padding: 0 12px; border: 1px dashed var(--border2); border-radius: 10px; background: var(--surface); font-weight: 700; color: var(--text); font-size: 12.5px; }
  .wst-item-name { font-size: 12.5px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wst-item-sub { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .wst-tag { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 6px; }
  .wst-tag-het { background: var(--green-light); color: var(--green); border: 1px solid var(--green-border); }
  .wst-tag-manual { background: var(--orange-light); color: var(--orange); border: 1px solid var(--orange-border); }
  .wst-x { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--red-border); background: var(--red-light); color: var(--red); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .wst-preview { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11.5px; color: var(--text3); padding: 9px 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }

  @media (max-width: 820px) {
    .wst-overlay { padding: 0; align-items: flex-end; }
    .wst-modal { max-width: 100%; border-radius: 18px 18px 0 0; max-height: 94vh; overflow-y: auto; }
    .wst-modal-body { padding: 14px; }
    .wst-modal-foot { padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
    .wst-modal-foot .btn { flex: 1; justify-content: center; }
    .wst-picker { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
    .wst-item-fields { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
    .wst-note-total { margin-left: 0; text-align: left; width: 100%; display: flex; align-items: baseline; gap: 8px; }
    .wst-actions { margin-left: 0; width: 100%; }
    .wst-actions .btn { flex: 1; justify-content: center; }
  }
`

export default function WastePage() {
  // Master Bahan Baku (Ingredient) — sumber pilihan + harga otomatis
  const [bahan, setBahan] = useState([])
  const [bahanError, setBahanError] = useState('')
  const [bahanSearch, setBahanSearch] = useState('')

  // Filter + data daftar catatan
  const [filters, setFilters] = useState({ from: awalBulanWIB(), to: todayWIB(), category: '', q: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState({
    notes: [], total: 0, totalPages: 1,
    summary: { nilai: 0, catatan: 0, item: 0, byCategory: {} },
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [picker, setPicker] = useState({ ingredientId: '', qty: '', hargaSatuan: '', note: '' })
  const [deletingId, setDeletingId] = useState(null)

  async function loadBahan() {
    try {
      const res = await api.get('/admin/ingredients')
      setBahan(res.data || [])
      setBahanError('')
    } catch (e) {
      setBahanError(e.response?.data?.message || 'Gagal memuat data Bahan Baku')
    }
  }

  async function loadList(nextPage = 1, nextFilters = filters) {
    setLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({ page: String(nextPage) })
      if (nextFilters.from) params.set('from', nextFilters.from)
      if (nextFilters.to) params.set('to', nextFilters.to)
      if (nextFilters.category) params.set('category', nextFilters.category)
      if (nextFilters.q.trim()) params.set('q', nextFilters.q.trim())
      const res = await api.get(`/admin/waste?${params.toString()}`)
      setData(res.data)
      setPage(nextPage)
    } catch (e) {
      setData({ notes: [], total: 0, totalPages: 1, summary: { nilai: 0, catatan: 0, item: 0, byCategory: {} } })
      const msg = e.response?.data?.message || 'Gagal memuat catatan waste'
      setLoadError(
        !e.response
          ? `${msg}. Pastikan server berjalan dan tabel waste sudah dibuat (npx prisma db push).`
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBahan() }, [])
  useEffect(() => { loadList(1) }, []) // muat awal pakai filter default (bulan berjalan)

  // Daftar bahan untuk dropdown (difilter oleh kotak cari)
  const bahanSorted = useMemo(
    () => [...bahan].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id')),
    [bahan]
  )
  const bahanFiltered = useMemo(() => {
    const s = bahanSearch.trim().toLowerCase()
    if (!s) return bahanSorted
    return bahanSorted.filter(i =>
      (i.name || '').toLowerCase().includes(s) || (i.code || '').toLowerCase().includes(s)
    )
  }, [bahanSorted, bahanSearch])

  const pickerBahan = bahan.find(i => i.id === picker.ingredientId) || null
  const pickerHet = hetBahan(pickerBahan)
  const formTotal = form.items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.hargaSatuan) || 0), 0
  )
  const kategoriAktif = CAT[form.category]

  // ── Aksi form ──
  function bukaFormBaru() {
    setForm(emptyForm())
    setEditId(null)
    setFormError('')
    setPicker({ ingredientId: '', qty: '', hargaSatuan: '', note: '' })
    setBahanSearch('')
    setShowForm(true)
  }

  function tutupForm() {
    setShowForm(false)
    setEditId(null)
    setFormError('')
    setForm(emptyForm())
    setPicker({ ingredientId: '', qty: '', hargaSatuan: '', note: '' })
    setBahanSearch('')
  }

  function mulaiEdit(note) {
    setEditId(note.id)
    setForm({
      tanggal: new Date(note.tanggal).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
      category: note.category,
      note: note.note || '',
      items: note.items.map(i => {
        const ing = bahan.find(b => b.id === i.ingredientId) || null
        return {
          key: i.id,
          ingredientId: i.ingredientId,
          ingredientName: i.ingredientName,
          code: i.code || '',
          unit: i.unit || '',
          qty: i.qty,
          hargaSatuan: i.hargaSatuan,
          hargaPack: i.hargaPack,
          packSize: i.packSize,
          het: hetBahan(ing),
          note: i.note || '',
        }
      }),
    })
    setFormError('')
    setPicker({ ingredientId: '', qty: '', hargaSatuan: '', note: '' })
    setBahanSearch('')
    setShowForm(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Pilih bahan → harga satuan otomatis terisi dari data Bahan Baku
  function pilihBahan(id) {
    const ing = bahan.find(i => i.id === id) || null
    const het = hetBahan(ing)
    setPicker({
      ingredientId: id,
      qty: '',
      hargaSatuan: het != null ? String(Number(het.toFixed(6))) : '',
      note: '',
    })
    setFormError(ing && het == null ? `Harga ${ing.name} belum diisi di halaman Bahan Baku — isi harga satuan manual.` : '')
  }

  function tambahItem() {
    if (!pickerBahan) return setFormError('Pilih bahan baku terlebih dahulu')
    const qty = Number(picker.qty)
    if (!(qty > 0)) return setFormError('Qty harus lebih dari 0')
    setFormError('')
    setForm(f => ({
      ...f,
      items: [
        ...f.items,
        {
          key: `${pickerBahan.id}-${Date.now()}`,
          ingredientId: pickerBahan.id,
          ingredientName: pickerBahan.name,
          code: pickerBahan.code || '',
          unit: pickerBahan.unit || '',
          qty,
          hargaSatuan: Number(picker.hargaSatuan) || 0,
          hargaPack: pickerBahan.price != null ? Number(pickerBahan.price) : null,
          packSize: pickerBahan.packSize != null ? Number(pickerBahan.packSize) : null,
          het: hetBahan(pickerBahan),
          note: picker.note || '',
        },
      ],
    }))
    setPicker({ ingredientId: '', qty: '', hargaSatuan: '', note: '' })
    setBahanSearch('')
  }

  function ubahItem(key, patch) {
    setForm(f => ({ ...f, items: f.items.map(i => (i.key === key ? { ...i, ...patch } : i)) }))
  }

  function hapusItem(key) {
    setForm(f => ({ ...f, items: f.items.filter(i => i.key !== key) }))
  }

  async function simpan(e) {
    e.preventDefault()
    if (!form.items.length) return setFormError('Tambahkan minimal satu bahan baku')
    if (form.items.some(i => !(Number(i.qty) > 0))) return setFormError('Qty bahan harus lebih dari 0')
    setSaving(true)
    setFormError('')
    const payload = {
      tanggal: form.tanggal,
      category: form.category,
      note: form.note,
      items: form.items.map(i => ({
        ingredientId: i.ingredientId,
        ingredientName: i.ingredientName,
        code: i.code,
        unit: i.unit,
        qty: Number(i.qty),
        hargaSatuan: Number(i.hargaSatuan) || 0,
        hargaPack: i.hargaPack,
        packSize: i.packSize,
        note: i.note,
      })),
    }
    try {
      if (editId) {
        await api.put(`/admin/waste/${editId}`, payload)
        tutupForm()
        await loadList(page)
      } else {
        await api.post('/admin/waste', payload)
        tutupForm()
        await loadList(1)
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan catatan waste')
    } finally {
      setSaving(false)
    }
  }

  async function hapus(note) {
    if (!confirm(`Hapus catatan ${catLabel(note.category)} ${fmtTanggal(note.tanggal)} (${fmtRp(note.total)})?`)) return
    setDeletingId(note.id)
    try {
      await api.delete(`/admin/waste/${note.id}`)
      await loadList(page)
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menghapus catatan')
    } finally {
      setDeletingId(null)
    }
  }

  function terapkanFilter(patch, resetPage = true) {
    const next = { ...filters, ...patch }
    setFilters(next)
    loadList(resetPage ? 1 : page, next)
  }

  function exportCSV() {
    const rows = [['Tanggal', 'Kategori', 'Bahan', 'Kode', 'Qty', 'Satuan', 'Harga Satuan', 'Subtotal', 'Ket. Item', 'Catatan', 'Dicatat Oleh']]
    data.notes.forEach(n => {
      if (!n.items.length) {
        rows.push([fmtTanggal(n.tanggal), catLabel(n.category), '', '', '', '', '', '', '', n.note || '', n.createdByName || ''])
        return
      }
      n.items.forEach(it => rows.push([
        fmtTanggal(n.tanggal), catLabel(n.category), it.ingredientName, it.code || '',
        it.qty, it.unit || '', it.hargaSatuan, it.subtotal, it.note || '',
        n.note || '', n.createdByName || '',
      ]))
    })
    downloadCSV(rows, `catatan_waste_${filters.from}_${filters.to}.csv`)
  }

  // Periode cepat (bulan ini / 7 hari / 30 hari terakhir)
  function pilihPeriode(v) {
    if (!v) return
    const hariIni = todayWIB()
    if (v === 'bulan') return terapkanFilter({ from: awalBulanWIB(), to: hariIni })
    const d = new Date(`${hariIni}T00:00:00+07:00`)
    d.setDate(d.getDate() - (Number(v) - 1))
    terapkanFilter({ from: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }), to: hariIni })
  }

  const s = data.summary || { nilai: 0, catatan: 0, item: 0, byCategory: {} }

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ paddingBottom: '90px' }}>
        <style>{styles}</style>

        <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px', height: 'auto', minHeight: '60px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-title">Catatan Waste</div>
            <div className="topbar-sub">Bahan baku terbuang / terpakai di luar penjualan — harga otomatis dari data Bahan Baku</div>
          </div>
          <div className="wst-topbar-actions">
            <button className="btn btn-ghost" onClick={exportCSV} disabled={!data.notes.length}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={bukaFormBaru}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Catatan Baru
            </button>
          </div>
        </div>

        <div className="content">
          {loadError && (
            <div className="wst-alert" style={{ background: 'var(--red-light)', border: '1px solid var(--red-border)', color: 'var(--red)' }}>
              <span>⚠️</span><span>{loadError}</span>
            </div>
          )}

          {/* Ringkasan sesuai filter aktif */}
          <div className="wst-summary">
            <div className="wst-sum-card">
              <div className="wst-sum-label">Total Nilai Waste</div>
              <div className="wst-sum-value" style={{ color: 'var(--red)' }}>{fmtRp(s.nilai)}</div>
              <div className="wst-sum-sub">{filters.from || '—'} s/d {filters.to || '—'}</div>
            </div>
            <div className="wst-sum-card">
              <div className="wst-sum-label">Jumlah Catatan</div>
              <div className="wst-sum-value">{s.catatan}</div>
              <div className="wst-sum-sub">{s.item} baris bahan baku</div>
            </div>
            <div className="wst-sum-card">
              <div className="wst-sum-label">Rata-rata / Catatan</div>
              <div className="wst-sum-value">{fmtRp(s.catatan ? s.nilai / s.catatan : 0)}</div>
              <div className="wst-sum-sub">{filters.category ? `Kategori: ${catLabel(filters.category)}` : 'Semua kategori'}</div>
            </div>
          </div>

          {/* Chip kategori → filter cepat */}
          <div className="wst-cats">
            <button type="button" className={`wst-cat${filters.category === '' ? ' active' : ''}`}
              onClick={() => terapkanFilter({ category: '' })}>
              <span>📊</span>Semua
              <span className="wst-cat-nilai">{fmtRp(s.nilai)}</span>
            </button>
            {CATEGORIES.map(c => {
              const d = (s.byCategory && s.byCategory[c.value]) || { nilai: 0, catatan: 0 }
              return (
                <button key={c.value} type="button" title={c.desc}
                  className={`wst-cat${filters.category === c.value ? ' active' : ''}`}
                  onClick={() => terapkanFilter({ category: filters.category === c.value ? '' : c.value })}>
                  <span>{c.emoji}</span>{c.label}
                  <span className="wst-cat-nilai">{fmtRp(d.nilai)}</span>
                  <span style={{ opacity: 0.6 }}>· {d.catatan}x</span>
                </button>
              )
            })}
          </div>

          {/* Filter rentang tanggal + pencarian */}
          <div className="card wst-filters">
            <div className="wst-field">
              <label>Dari Tanggal</label>
              <input type="date" className="input" value={filters.from}
                onChange={e => terapkanFilter({ from: e.target.value })} />
            </div>
            <div className="wst-field">
              <label>Sampai Tanggal</label>
              <input type="date" className="input" value={filters.to}
                onChange={e => terapkanFilter({ to: e.target.value })} />
            </div>
            <div className="wst-field">
              <label>Periode Cepat</label>
              <select className="input" value="" onChange={e => pilihPeriode(e.target.value)}>
                <option value="">Pilih…</option>
                <option value="bulan">Bulan ini</option>
                <option value="7">7 hari terakhir</option>
                <option value="30">30 hari terakhir</option>
              </select>
            </div>
            <div className="wst-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="input" placeholder="Cari bahan / catatan / pencatat…" value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') terapkanFilter({ q: e.target.value }) }} />
            </div>
            <button className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
              onClick={() => terapkanFilter({ q: filters.q })}>Cari</button>
          </div>

          {/* Daftar catatan */}
          {loading ? (
            <div className="card wst-empty">
              <div className="wst-spinner" />
              <div style={{ fontSize: '12.5px' }}>Memuat catatan waste…</div>
            </div>
          ) : data.notes.length === 0 ? (
            <div className="card wst-empty">
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗑️</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px' }}>Belum ada catatan waste</div>
              <div style={{ fontSize: '12px' }}>
                {filters.category || filters.q
                  ? 'Tidak ada hasil untuk filter ini — coba ubah periode / kategori / kata kunci.'
                  : 'Tekan “Catatan Baru” untuk mencatat bahan baku yang busuk, tidak terpakai, dipakai sendiri, salah buat, atau untuk keperluan RnD.'}
              </div>
            </div>
          ) : (
            <div className="wst-list">
              {data.notes.map(n => {
                const c = CAT[n.category] || { label: n.category, emoji: '🔖' }
                return (
                  <div key={n.id} className="wst-note">
                    <div className="wst-note-head">
                      <span style={{ fontSize: '16px' }}>{c.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="wst-note-date">{fmtTanggal(n.tanggal)}</div>
                        <div className="wst-note-meta">
                          {n.createdByName ? `Dicatat oleh ${n.createdByName}` : 'Tidak diketahui'} · {n.items.length} bahan
                        </div>
                      </div>
                      <span className="badge badge-blue">{c.label}</span>
                      <div className="wst-note-total">
                        <b>{fmtRp(n.total)}</b>
                        <span className="wst-note-meta">total kerugian</span>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table className="wst-items" style={{ minWidth: '560px' }}>
                        <thead>
                          <tr>
                            <th>Bahan Baku</th>
                            <th className="wst-num">Qty</th>
                            <th className="wst-num">Harga Satuan</th>
                            <th className="wst-num">Subtotal</th>
                            <th>Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {n.items.map(it => (
                            <tr key={it.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{it.ingredientName}</div>
                                {it.code ? <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>{it.code}</span> : null}
                              </td>
                              <td className="wst-num">{fmtQty(it.qty)} {it.unit}</td>
                              <td className="wst-num">{fmtHarga(it.hargaSatuan)}</td>
                              <td className="wst-num" style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtRp(it.subtotal)}</td>
                              <td style={{ fontSize: '12px' }}>{it.note || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="wst-note-foot">
                      <div className="wst-note-note">
                        {n.note ? <>📝 {n.note}</> : <span style={{ color: 'var(--muted)' }}>Tanpa catatan tambahan</span>}
                      </div>
                      <div className="wst-actions">
                        <button className="btn btn-ghost wst-btn-sm" onClick={() => mulaiEdit(n)}>Edit</button>
                        <button className="btn wst-btn-sm" style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
                          disabled={deletingId === n.id} onClick={() => hapus(n)}>
                          {deletingId === n.id ? 'Menghapus…' : 'Hapus'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="wst-pager">
              <button className="btn btn-ghost wst-btn-sm" disabled={page <= 1 || loading} onClick={() => loadList(page - 1)}>‹ Sebelumnya</button>
              <span>Halaman <b>{page}</b> dari {data.totalPages} · {data.total} catatan</span>
              <button className="btn btn-ghost wst-btn-sm" disabled={page >= data.totalPages || loading} onClick={() => loadList(page + 1)}>Berikutnya ›</button>
            </div>
          )}
        </div>
      </main>

      {/* ── Modal form catatan waste ── */}
      {showForm && (
        <div className="wst-overlay" onClick={e => { if (e.target === e.currentTarget) tutupForm() }}>
          <form className="wst-modal" onSubmit={simpan}>
            <div className="wst-modal-head">
              <span style={{ fontSize: '17px' }}>{kategoriAktif?.emoji || '🗑️'}</span>
              <div className="wst-modal-title">{editId ? 'Edit Catatan Waste' : 'Catatan Waste Baru'}</div>
              <button type="button" className="btn btn-ghost wst-btn-sm" onClick={tutupForm}>Tutup</button>
            </div>

            <div className="wst-modal-body">
              {formError && (
                <div className="wst-alert" style={{ marginBottom: 0, background: 'var(--orange-light)', border: '1px solid var(--orange-border)', color: 'var(--orange)' }}>
                  <span>⚠️</span><span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                <div className="wst-field">
                  <label>Tanggal</label>
                  <input type="date" className="input" value={form.tanggal} required
                    onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                </div>
                <div className="wst-field" style={{ gridColumn: 'span 2' }}>
                  <label>Kategori Waste</label>
                  <div className="wst-cats-grid">
                    {CATEGORIES.map(c => (
                      <button key={c.value} type="button" title={c.desc}
                        className={`wst-cat-opt${form.category === c.value ? ' active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, category: c.value }))}>
                        <span>{c.emoji}</span>{c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {kategoriAktif && (
                <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '-6px' }}>
                  Kategori terpilih: <b>{kategoriAktif.label}</b> — {kategoriAktif.desc}
                </div>
              )}

              {/* Pilih bahan baku — harga satuan otomatis dari data Bahan Baku */}
              <div className="wst-item" style={{ background: 'var(--surface2)' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Tambah Bahan Baku</div>
                {bahanError && <div style={{ fontSize: '11.5px', color: 'var(--red)' }}>{bahanError}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  <div className="wst-field">
                    <label>Cari Bahan</label>
                    <input className="input" placeholder="Ketik nama / kode bahan…" value={bahanSearch}
                      onChange={e => setBahanSearch(e.target.value)} />
                  </div>
                  <div className="wst-field">
                    <label>Bahan Baku ({bahanFiltered.length})</label>
                    <select className="input" value={picker.ingredientId} onChange={e => pilihBahan(e.target.value)}>
                      <option value="">— Pilih bahan baku —</option>
                      {bahanFiltered.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name}{i.code ? ` (${i.code})` : ''}{i.unit ? ` · ${i.unit}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {pickerBahan && (
                  <div className="wst-preview">
                    <span>
                      Harga bahan: <b>{pickerBahan.price != null ? fmtRp(pickerBahan.price) : 'belum diisi'}</b>
                      {pickerBahan.packSize ? ` / kemasan (isi ${fmtQty(pickerBahan.packSize)} ${pickerBahan.unit || ''})` : ' (tanpa isi kemasan)'}
                    </span>
                    <span>
                      Harga satuan: <b>{pickerHet != null ? fmtHarga(pickerHet) : '—'}</b>
                      {pickerBahan.unit ? ` per ${pickerBahan.unit}` : ''}
                    </span>
                  </div>
                )}

                <div className="wst-picker">
                  <div className="wst-field">
                    <label>Qty {pickerBahan?.unit ? `(${pickerBahan.unit})` : ''}</label>
                    <input type="number" step="any" min="0" className="input" placeholder="0"
                      value={picker.qty} onChange={e => setPicker(p => ({ ...p, qty: e.target.value }))} />
                  </div>
                  <div className="wst-field">
                    <label>Harga Satuan</label>
                    <input type="number" step="any" min="0" className="input" placeholder="0"
                      value={picker.hargaSatuan} onChange={e => setPicker(p => ({ ...p, hargaSatuan: e.target.value }))} />
                  </div>
                  <div className="wst-field">
                    <label>Subtotal</label>
                    <div className="wst-static">
                      {fmtRp((Number(picker.qty) || 0) * (Number(picker.hargaSatuan) || 0))}
                    </div>
                  </div>
                  <div className="wst-field">
                    <label>Ket. Item (opsional)</label>
                    <input className="input" placeholder="mis. batch #2" value={picker.note}
                      onChange={e => setPicker(p => ({ ...p, note: e.target.value }))} />
                  </div>
                  <button type="button" className="btn btn-success" style={{ height: '39px', justifyContent: 'center' }}
                    onClick={tambahItem}>+ Tambah</button>
                </div>
              </div>

              {/* Daftar bahan yang dicatat */}
              {form.items.length === 0 ? (
                <div className="wst-preview" style={{ justifyContent: 'center' }}>
                  Belum ada bahan. Pilih bahan baku di atas, isi qty, lalu tekan <b>+ Tambah</b>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {form.items.map(it => {
                    const hetSama = it.het != null && Math.abs(Number(it.hargaSatuan) - Number(it.het)) < 1e-9
                    return (
                      <div key={it.key} className="wst-item">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="wst-item-name" title={it.ingredientName}>{it.ingredientName}</div>
                            <div className="wst-item-sub">
                              {it.code ? `${it.code} · ` : ''}
                              {it.hargaPack != null
                                ? `Rp ${Number(it.hargaPack).toLocaleString('id-ID')}/kemasan${it.packSize ? ` (isi ${fmtQty(it.packSize)} ${it.unit || ''})` : ''}`
                                : 'harga bahan belum diisi di halaman Bahan Baku'}
                              {it.het != null && (
                                <span className={`wst-tag ${hetSama ? 'wst-tag-het' : 'wst-tag-manual'}`} style={{ marginLeft: '6px' }}>
                                  {hetSama ? 'sesuai data bahan' : 'harga manual'}
                                </span>
                              )}
                            </div>
                          </div>
                          <button type="button" className="wst-x" title="Hapus bahan" onClick={() => hapusItem(it.key)}>×</button>
                        </div>

                        <div className="wst-item-fields">
                          <div className="wst-field">
                            <label>Qty {it.unit ? `(${it.unit})` : ''}</label>
                            <input type="number" step="any" min="0" className="input" value={it.qty}
                              onChange={e => ubahItem(it.key, { qty: e.target.value })} />
                          </div>
                          <div className="wst-field">
                            <label>Harga Satuan</label>
                            <input type="number" step="any" min="0" className="input" value={it.hargaSatuan}
                              onChange={e => ubahItem(it.key, { hargaSatuan: e.target.value })} />
                          </div>
                          <div className="wst-field">
                            <label>Subtotal</label>
                            <div className="wst-static">{fmtRp((Number(it.qty) || 0) * (Number(it.hargaSatuan) || 0))}</div>
                          </div>
                        </div>

                        <input className="input" placeholder="Keterangan item (opsional)" value={it.note}
                          onChange={e => ubahItem(it.key, { note: e.target.value })} />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Catatan tambahan */}
              <div className="wst-field">
                <label>Catatan Tambahan</label>
                <textarea className="input" rows={3} placeholder="mis. dimasak ulang 2x, sisa bahan dari event, dst."
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            <div className="wst-modal-foot">
              <div style={{ fontSize: '12.5px', color: 'var(--text3)' }}>
                Total nilai waste:{' '}
                <b style={{ color: 'var(--red)', fontSize: '15px' }}>{fmtRp(formTotal)}</b>
                <span style={{ marginLeft: '8px' }}>· {form.items.length} bahan</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" onClick={tutupForm}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan…' : editId ? 'Simpan Perubahan' : 'Simpan Catatan'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

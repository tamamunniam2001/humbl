'use client'
import { useEffect, useState, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtDate = (d) => {
  const date = new Date(d)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function RekapProdukPage() {
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 1 })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [nullOnly, setNullOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [byKategori, setByKategori] = useState([])
  const [byKategoriLoading, setByKategoriLoading] = useState(true)
  const [activeKategori, setActiveKategori] = useState('')
  const [exportModal, setExportModal] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [nullStats, setNullStats] = useState(null)
  const [backfilling, setBackfilling] = useState(false)
  const [monthly, setMonthly] = useState(Array.from({ length: 12 }, (_, m) => ({ month: m + 1, total: 0, qty: 0 })))
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthlyLoading, setMonthlyLoading] = useState(true)

  async function loadByKategori(f = from, t = to) {
    setByKategoriLoading(true)
    try {
      const params = new URLSearchParams({ bykategori: 1 })
      if (f) params.append('from', f)
      if (t) params.append('to', t)
      const res = await api.get(`/admin/product-sales?${params}`)
      setByKategori(res.data.byKategori)
    } catch { } finally { setByKategoriLoading(false) }
  }

  async function loadMonthly(y = year) {
    setMonthlyLoading(true)
    try {
      const res = await api.get(`/admin/product-sales?monthly=1&year=${y}`)
      setMonthly(res.data.monthly)
    } catch { }
    finally { setMonthlyLoading(false) }
  }

  async function load(p = page, overrideNullOnly = nullOnly, f = from, t = to, kat = activeKategori) {
    setLoading(true)
    setSelected(new Set())
    try {
      const params = new URLSearchParams({ page: p })
      if (f) params.append('from', f)
      if (t) params.append('to', t)
      if (overrideNullOnly) params.append('nullOnly', '1')
      if (kat) params.append('category', kat)
      const res = await api.get(`/admin/product-sales?${params}`)
      setData(res.data)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load(page, nullOnly, from, to, activeKategori) }, [page])
  useEffect(() => { loadMonthly(); loadByKategori() }, [])
  useEffect(() => {
    api.get('/admin/categories').then(r => setCategories(r.data.map(c => c.name))).catch(() => {})
    api.get('/admin/product-sales/backfill').then(r => { if (r.data.total > 0) setNullStats(r.data) }).catch(() => {})
  }, [])

  async function handleBackfill() {
    if (!confirm(`Perbaiki ${nullStats.total} data null? Nama produk akan diisi otomatis dari master produk.`)) return
    setBackfilling(true)
    try {
      const res = await api.post('/admin/product-sales/backfill')
      alert(res.data.message)
      setNullStats(null)
      load(1)
      loadMonthly()
    } catch (e) { alert(e.response?.data?.message || 'Gagal backfill') }
    finally { setBackfilling(false) }
  }

  function handleFilter() { setPage(1); load(1, nullOnly, from, to, activeKategori); loadByKategori(from, to) }
  function handleReset() { setFrom(''); setTo(''); setNullOnly(false); setActiveKategori(''); setPage(1); setTimeout(() => { load(1, false, '', '', ''); loadByKategori('', '') }, 0) }

  function handleClickMonth(i) {
    const f = `${year}-${String(i + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, i + 1, 0).getDate()
    const t = `${year}-${String(i + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    setFrom(f); setTo(t); setPage(1); setActiveKategori(''); setSelected(new Set())
    load(1, nullOnly, f, t, '')
    loadByKategori(f, t)
  }

  function handleClickKategori(kat) {
    const newKat = activeKategori === kat ? '' : kat
    setActiveKategori(newKat); setPage(1)
    load(1, nullOnly, from, to, newKat)
  }

  function toggleNullOnly() {
    const next = !nullOnly
    setNullOnly(next)
    setPage(1)
    load(1, next, from, to, activeKategori)
  }

  // ── Select ──
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === data.rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.rows.map(r => r.id)))
    }
  }

  // ── Delete single ──
  function openEdit(r) {
    setEditForm({ name: r.name, category: r.category === '-' ? '' : r.category, code: r.code === '-' ? '' : r.code, qty: r.qty, total: r.total })
    setEditModal(r)
  }

  async function handleEditSave() {
    setEditSaving(true)
    try {
      await api.patch(`/admin/product-sales/${editModal.id}`, editForm)
      setData(prev => ({ ...prev, rows: prev.rows.map(r => r.id === editModal.id ? { ...r, ...editForm, code: editForm.code || '-', category: editForm.category || '-', total: Number(editForm.total), qty: Number(editForm.qty) } : r) }))
      setEditModal(null)
      loadMonthly()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setEditSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus item ini?')) return
    try {
      await api.delete(`/admin/product-sales/${id}`)
      setData(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id), total: prev.total - 1 }))
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
      loadMonthly()
      loadByKategori(from, to)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
  }

  // ── Delete bulk ──
  async function handleDeleteSelected() {
    if (!confirm(`Hapus ${selected.size} item yang dipilih?`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id => api.delete(`/admin/product-sales/${id}`)))
      setData(prev => ({
        ...prev,
        rows: prev.rows.filter(r => !selected.has(r.id)),
        total: prev.total - selected.size,
      }))
      setSelected(new Set())
      loadMonthly()
      loadByKategori(from, to)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
    finally { setDeleting(false) }
  }

  // ── Template ──
  function downloadTemplate() {
    const header = 'Tanggal,Kode Produk,Kategori,Nama Produk,QTY,Total'
    const contoh = [
      '23/04/2025,KP-001,Minuman,Kopi Susu,2,30000',
      '23/04/2025,MK-001,Makanan,Mie Goreng,1,20000',
      '24/04/2025,-,Minuman,Es Teh,3,15000',
    ].join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + contoh], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template-import-penjualan.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import dengan progress ──
  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null); setImportProgress(0)

    // Simulasi progress upload
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return prev }
        return prev + Math.random() * 8
      })
    }, 400)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/admin/product-sales/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      clearInterval(progressInterval)
      setImportProgress(100)
      setTimeout(() => {
        setImportResult(res.data)
        setImporting(false)
        setImportProgress(0)
        load(1)
        loadMonthly()
      }, 400)
    } catch (err) {
      clearInterval(progressInterval)
      setImportProgress(0)
      setImportResult({ error: err.response?.data?.message || 'Gagal import' })
      setImporting(false)
    } finally {
      fileRef.current.value = ''
    }
  }

  // ── Export CSV ──
  async function exportCSV() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: 1, limit: 99999 })
      if (exportFrom) params.append('from', exportFrom)
      if (exportTo) params.append('to', exportTo)
      const res = await api.get(`/admin/product-sales?${params}`)
      const rows = res.data.rows || []
      const header = ['Tanggal', 'Kode Produk', 'Kategori', 'Nama Produk', 'QTY', 'Total']
      const lines = [
        header.join(','),
        ...rows.map(r => [fmtDate(r.date), r.code, `"${r.category}"`, `"${r.name}"`, r.qty, r.total].join(','))
      ]
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rekap-produk${exportFrom ? `-${exportFrom}` : ''}${exportTo ? `-sd-${exportTo}` : ''}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setExportModal(false)
    } catch { alert('Gagal export') }
    finally { setExporting(false) }
  }

  const totalQty = data.rows.reduce((s, r) => s + r.qty, 0)
  const totalRevenue = data.rows.reduce((s, r) => s + r.total, 0)
  const allSelected = data.rows.length > 0 && selected.size === data.rows.length
  const someSelected = selected.size > 0 && !allSelected

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Produk Terjual</div>
            <div className="topbar-sub">{data.total} item terjual</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
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
            <button className="btn btn-ghost" onClick={() => { setExportFrom(from); setExportTo(to); setExportModal(true) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
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
            <div className="card fade-in" style={{ padding: '32px 40px', textAlign: 'center', minWidth: '320px' }}>
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

        <div className="content">
          {/* Rekap Bulanan */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Rekap Penjualan Bulanan</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => { const y = year - 1; setYear(y); loadMonthly(y) }}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: '4px 10px', fontSize: '13px', color: 'var(--text2)', fontFamily: 'inherit' }}>‹</button>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', minWidth: '48px', textAlign: 'center' }}>{year}</span>
                <button onClick={() => { const y = year + 1; setYear(y); loadMonthly(y) }}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: '4px 10px', fontSize: '13px', color: 'var(--text2)', fontFamily: 'inherit' }}>›</button>
              </div>
            </div>
            {(() => {
              const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
              const maxTotal = Math.max(...monthly.map(m => m.total), 1)
              const grandTotal = monthly.reduce((s, m) => s + m.total, 0)
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}>
                    {monthly.map((m, i) => {
                      const pct = Math.round((m.total / maxTotal) * 100)
                      const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === i
                      const isActive = from === `${year}-${String(i + 1).padStart(2, '0')}-01`
                      return (
                        <div key={i} onClick={() => m.total > 0 && handleClickMonth(i)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: m.total > 0 ? 'pointer' : 'default' }}>
                          <div style={{ width: '100%', height: '60px', background: isActive ? '#DBEAFE' : 'var(--surface2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, transition: 'border 0.15s' }}>
                            <div style={{ width: '100%', height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%`, background: isActive ? 'var(--accent)' : isCurrentMonth ? 'var(--accent)' : m.total > 0 ? '#93C5FD' : 'transparent', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' }} />
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: m.total > 0 ? 'var(--accent)' : 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>
                            {m.total > 0 ? `Rp ${m.total.toLocaleString('id-ID')}` : '-'}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: isActive || isCurrentMonth ? '700' : '500', color: isActive ? 'var(--accent)' : isCurrentMonth ? 'var(--accent)' : 'var(--muted)' }}>{MONTHS[i]}</div>
                        </div>
                      )
                    })}
                  </div>
                  {grandTotal > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '24px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Total {year}: <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '13px' }}>{fmt(grandTotal)}</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Rata-rata/bulan: <span style={{ fontWeight: '700', color: 'var(--text)' }}>{fmt(Math.round(grandTotal / (monthly.filter(m => m.total > 0).length || 1)))}</span></div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Rekap Per Kategori */}
          {(byKategoriLoading || byKategori.length > 0) && (
            <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px' }}>Penjualan per Kategori</div>
              {byKategoriLoading ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Memuat...</div>
              ) : (() => {
                const maxKat = Math.max(...byKategori.map(k => k.total), 1)
                const totalKat = byKategori.reduce((s, k) => s + k.total, 0)
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(byKategori.length, 12)}, 1fr)`, gap: '8px' }}>
                      {byKategori.map((k, i) => {
                        const pct = Math.round((k.total / maxKat) * 100)
                        const isTop = i === 0
                        const isActive = activeKategori === k.category
                        return (
                          <div key={i} onClick={() => handleClickKategori(k.category)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <div style={{ width: '100%', height: '60px', background: isActive ? '#DBEAFE' : 'var(--surface2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, transition: 'border 0.15s' }}>
                              <div style={{ width: '100%', height: `${Math.max(pct, k.total > 0 ? 4 : 0)}%`, background: isActive ? 'var(--accent)' : isTop ? 'var(--accent)' : '#93C5FD', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' }} />
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: k.total > 0 ? 'var(--accent)' : 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>
                              {fmt(k.total)}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: isActive || isTop ? '700' : '500', color: isActive ? 'var(--accent)' : isTop ? 'var(--accent)' : 'var(--muted)', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word' }}>
                              {k.category}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {totalKat > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '24px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Total: <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '13px' }}>{fmt(totalKat)}</span></div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Terbesar: <span style={{ fontWeight: '700', color: 'var(--text)' }}>{byKategori[0]?.category}</span></div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Filter */}
          <div className="card" style={{ padding: '18px 24px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="label">Dari Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleFilter}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Filter
            </button>
            {(from || to || nullOnly || activeKategori) && <button className="btn btn-ghost" onClick={handleReset}>Reset</button>}
            {activeKategori && <span style={{ fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '4px 10px', borderRadius: '20px', border: '1px solid #C7D4F0', fontWeight: '600' }}>Kategori: {activeKategori}</span>}
            <button onClick={toggleNullOnly}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '9px', border: `1.5px solid ${nullOnly ? '#FECACA' : 'var(--border)'}`, background: nullOnly ? '#FEF2F2' : 'var(--surface)', color: nullOnly ? 'var(--red)' : 'var(--text2)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `2px solid ${nullOnly ? 'var(--red)' : 'var(--muted)'}`, background: nullOnly ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {nullOnly && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              Tampilkan Data Null
            </button>
          </div>

          {/* Banner data null */}
          {nullStats && (
            <div className="slide-down" style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400E' }}>Ditemukan {nullStats.total} data dengan nama produk kosong</div>
                  <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                    {nullStats.withProduct} item bisa diisi dari master produk · {nullStats.withoutProduct} item akan diisi sebagai "Item Manual"
                  </div>
                </div>
              </div>
              <button onClick={handleBackfill} disabled={backfilling}
                style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', background: '#F59E0B', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, opacity: backfilling ? 0.6 : 1 }}>
                {backfilling ? 'Memperbaiki...' : '✨ Perbaiki Sekarang'}
              </button>
            </div>
          )}

          {/* Hasil Import */}
          {importResult && (
            <div className="slide-down" style={{ marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', border: `1px solid ${importResult.error ? '#FECACA' : '#A7F3D0'}`, background: importResult.error ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
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
                          <span>∑ <b>{importResult.total}</b> total diproses</span>
                        </div>
                        {importResult.errors?.length > 0 && (
                          <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#FEF2F2', borderRadius: '6px', padding: '8px 10px', border: '1px solid #FECACA' }}>
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
          )}

          {/* Summary cards */}
          {!loading && data.rows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Total Item (halaman ini)</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)' }}>{totalQty.toLocaleString('id-ID')}</div>
              </div>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Total Pendapatan (halaman ini)</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent)' }}>{fmt(totalRevenue)}</div>
              </div>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Total Baris Data</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)' }}>{data.total.toLocaleString('id-ID')}</div>
              </div>
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="slide-down" style={{ marginBottom: '12px', padding: '10px 16px', background: 'var(--accent-light)', border: '1px solid #C7D4F0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>{selected.size} item dipilih</span>
              <button className="btn btn-danger" style={{ padding: '5px 14px', fontSize: '12px' }}
                onClick={handleDeleteSelected} disabled={deleting}>
                {deleting ? 'Menghapus...' : `Hapus ${selected.size} Item`}
              </button>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={() => setSelected(new Set())}>
                Batal
              </button>
            </div>
          )}

          {/* Tabel */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected }}
                      onChange={toggleSelectAll}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                  </th>
                  <th>Tanggal</th>
                  <th>Kode Produk</th>
                  <th>Kategori</th>
                  <th>Nama Produk</th>
                  <th style={{ textAlign: 'center' }}>QTY</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</td></tr>
                ) : data.rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                    <div>Belum ada data transaksi produk</div>
                  </td></tr>
                ) : data.rows.map((r, i) => {
                  const isNull = r.isNameNull
                  return (
                  <tr key={i} style={{ background: selected.has(r.id) ? 'var(--accent-light)' : isNull ? '#FFF8F8' : undefined }}>
                    <td>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: '13px', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td>
                      {r.code !== '-'
                        ? <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.code}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>}
                    </td>
                    <td><span className="badge badge-gray">{r.category}</span></td>
                    <td style={{ fontWeight: '600', color: isNull ? 'var(--red)' : 'var(--text)' }}>
                      {isNull
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '11px', background: '#FEF2F2', color: 'var(--red)', border: '1px solid #FECACA', borderRadius: '5px', padding: '1px 6px', fontWeight: '700' }}>NULL</span>
                            <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: '400' }}>Tidak ada nama</span>
                          </span>
                        : r.name}
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-purple">{r.qty}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>{fmt(r.total)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(r.id)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
              {!loading && data.rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#FAFBFF' }}>
                    <td colSpan={5} style={{ padding: '12px 18px', fontWeight: '700', color: 'var(--text2)', fontSize: '13px' }}>
                      Total halaman ini
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>{totalQty}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: '800', color: 'var(--accent)' }}>{fmt(totalRevenue)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border)', background: '#FAFBFF' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} dari {data.total} baris
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }} disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
                  <span style={{ fontSize: '13px', fontWeight: '600', padding: '0 8px' }}>{page} / {data.totalPages}</span>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }} disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Edit */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditModal(null) }}>
          <div className="card fade-in" style={{ width: '400px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Edit Item Penjualan</div>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label">Nama Produk</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Kode Produk</label>
                <input className="input" value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} placeholder="KP-001 atau kosongkan" />
              </div>
              <div>
                <label className="label">Kategori</label>
                <input className="input" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} list="edit-cat-list" placeholder="Pilih atau ketik kategori" />
                <datalist id="edit-cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">QTY</label>
                  <input className="input" type="number" min="1" value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Total</label>
                  <input className="input" type="number" min="0" value={editForm.total} onChange={e => setEditForm(f => ({ ...f, total: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', background: 'var(--surface2)' }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditModal(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export CSV */}
      {exportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setExportModal(false) }}>
          <div className="card fade-in" style={{ width: '420px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Export CSV</div>
              <button onClick={() => setExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>Pilih rentang waktu data yang akan diekspor. Kosongkan untuk export semua data.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label className="label">Dari Tanggal</label>
                  <input type="date" className="input" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">Sampai Tanggal</label>
                  <input type="date" className="input" value={exportTo} onChange={e => setExportTo(e.target.value)} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px', fontSize: '12px', color: 'var(--muted)' }}>
                {exportFrom || exportTo
                  ? `Export data dari ${exportFrom || '...'} sampai ${exportTo || '...'}`
                  : 'Export semua data (tanpa filter tanggal)'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setExportModal(false)}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={exportCSV} disabled={exporting}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {exporting ? 'Mengekspor...' : 'Download CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = n => Number(n) % 1 !== 0 ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: 4 }) : Number(n).toLocaleString('id-ID')
const fmtRp = n => 'Rp ' + Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const fmtDate = d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
const fmtDateShort = d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
// Label status permintaan restock (dipakai juga di halaman Pantau Bahan Baku)
const REQUEST_STATUS_LABEL = { BELUM_DIBELI: 'Belum dibeli', DIPESAN: 'Dipesan', SELESAI: 'Selesai' }

export default function StockOpnamePage() {
  const [opnames, setOpnames] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')
  const [opnameDate, setOpnameDate] = useState(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
    return now.toISOString().slice(0, 10)
  })
  const [showCreate, setShowCreate] = useState(false)

  // Detail view
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [filterBelum, setFilterBelum] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editHarga, setEditHarga] = useState('')
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualItem, setManualItem] = useState({ itemName: '', satuan: '', hargaTerakhir: '' })
  const [addingManual, setAddingManual] = useState(false)
  const [search, setSearch] = useState('')
  const [reopening, setReopening] = useState(false)
  const [requestingId, setRequestingId] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showLaporanRequest, setShowLaporanRequest] = useState(false)
  const [showSendWA, setShowSendWA] = useState(false)
  const [waSending, setWaSending] = useState(false)
  const [waTargets, setWaTargets] = useState({ admin: false, group: false })
  const [waStatus, setWaStatus] = useState(null)
  const [waMessage, setWaMessage] = useState('')
  const [waOpname, setWaOpname] = useState(null)
  const [syncing, setSyncing] = useState(false)
  // Mobile: tampilkan panel edit sebagai bottom sheet
  const [editSheet, setEditSheet] = useState(null) // item object
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/stock-opname?page=${page}`)
      setOpnames(res.data.opnames)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch { } finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  // Focus input saat bottom sheet terbuka
  useEffect(() => {
    if (editSheet && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [editSheet])

  function downloadOpnameListCSV() {
    const rows = [['Tanggal', 'Oleh', 'Total Item', 'Selisih', 'Status', 'Total Nilai', 'Catatan']]
    opnames.forEach(o => rows.push([fmtDate(o.date), o.user?.name || '', o.totalItems, o.itemsSelisih, o.status, o.totalNilai || 0, o.note || '']))
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `stock_opname_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  function downloadOpnameDetailCSV() {
    const rows = [['Nama Barang', 'Kategori', 'Stok Sebelumnya', 'Satuan', 'Qty Aktual', 'Harga Satuan', 'Nilai Stok', 'Catatan']]
    detail.items.forEach(item => {
      const satuan = (item.satuanOpname && item.konversi) ? item.satuanOpname : (item.inventoryItem?.satuan || item.satuan || '')
      const qtyTampil = (item.satuanOpname && item.konversi) ? item.qtyActual / item.konversi : item.qtyActual
      const qtySebelumnya = (item.satuanOpname && item.konversi && item.qtySebelumnya != null) ? item.qtySebelumnya / item.konversi : (item.qtySebelumnya ?? '')
      const harga = item.hargaTerakhir || 0
      rows.push([item.inventoryItem?.name || item.itemName || '', item.inventoryItem?.category || item.expenseItem?.category || '', qtySebelumnya, satuan, qtyTampil, harga, item.qtyActual * harga, item.note || ''])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `opname_${new Date(detail.date).toISOString().slice(0,10)}.csv`; a.click()
  }

  async function handleSendWA() {
    const targets = []
    if (waTargets.admin && process.env.NEXT_PUBLIC_WA_ADMIN_NUMBER) targets.push(process.env.NEXT_PUBLIC_WA_ADMIN_NUMBER)
    if (waTargets.group && process.env.NEXT_PUBLIC_WA_GROUP_NUMBER) targets.push(process.env.NEXT_PUBLIC_WA_GROUP_NUMBER)
    if (!targets.length) return alert('Pilih minimal satu tujuan')
    const opname = waOpname
    setWaSending(true); setWaStatus('sending')
    try {
      const res = await api.post(`/admin/stock-opname/${opname.id}/send-wa`, {
        targets,
        caption: `📋 *Laporan Stock Opname*\n${new Date(opname.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}\nOleh: ${opname.user?.name}\nStatus: ${opname.status}${opname.note ? `\nCatatan: ${opname.note}` : ''}`,
      })
      setWaStatus('success')
      setWaMessage(`Berhasil dikirim ke ${res.data.results?.filter(r => r.success).length} tujuan`)
    } catch (e) {
      setWaStatus('error')
      setWaMessage(e.response?.data?.message || 'Gagal mengirim')
    } finally { setWaSending(false) }
  }

  async function handleSyncManual() {
    if (!confirm('Ambil item manual dari opname sebelumnya?')) return
    setSyncing(true)
    try {
      const res = await api.patch(`/admin/stock-opname/${detail.id}`, { action: 'sync-manual' })
      setDetail(prev => ({ ...prev, items: [...prev.items, ...res.data] }))
    } catch (e) { alert(e.response?.data?.message || 'Gagal sync item manual') }
    finally { setSyncing(false) }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await api.post('/admin/stock-opname', { note, date: opnameDate })
      setNote(''); setShowCreate(false)
      await openDetail(res.data.id)
      load()
    } catch (e) {
      const msg = e.response?.data?.message || 'Gagal membuat opname'
      const id = e.response?.data?.id
      if (e.response?.status === 409 && id) {
        if (confirm(msg + '. Buka opname yang ada?')) openDetail(id)
      } else alert(msg)
    } finally { setCreating(false) }
  }

  async function openDetail(id) {
    setDetailLoading(true); setDetail(null)
    try {
      const res = await api.get(`/admin/stock-opname/${id}`)
      setDetail(res.data); setFilterCat(''); setFilterBelum(false); setEditingId(null)
    } catch (e) { alert(e.response?.data?.message || 'Gagal memuat detail') }
    finally { setDetailLoading(false) }
  }

  async function handleSaveItem(itemId, qtyVal, noteVal, hargaVal) {
    setSaving(true)
    try {
      const item = detail.items.find(i => i.id === itemId)
      const konversi = item?.konversi
      const qtyToSave = konversi ? Number(qtyVal) * konversi : Number(qtyVal)
      const hargaToSave = item?.isManual && hargaVal !== '' && hargaVal != null ? Number(hargaVal) : undefined
      await api.patch(`/admin/stock-opname/${detail.id}`, { itemId, qtyActual: qtyToSave, note: noteVal ?? '', hargaTerakhir: hargaToSave })
      setDetail(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId
          ? { ...i, qtyActual: qtyToSave, note: noteVal ?? '', ...(hargaToSave !== undefined ? { hargaTerakhir: hargaToSave } : {}) }
          : i
        )
      }))
      setEditingId(null); setEditSheet(null)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  async function handleAddManual() {
    if (!manualItem.itemName.trim()) return alert('Nama item wajib diisi')
    setAddingManual(true)
    try {
      const res = await api.patch(`/admin/stock-opname/${detail.id}`, { action: 'add-item', itemName: manualItem.itemName, satuan: manualItem.satuan, hargaTerakhir: manualItem.hargaTerakhir })
      setDetail(prev => ({ ...prev, items: [...prev.items, res.data] }))
      setManualItem({ itemName: '', satuan: '', hargaTerakhir: '' }); setShowAddManual(false)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menambah item') }
    finally { setAddingManual(false) }
  }

  async function handleReopen() {
    if (!confirm('Buka kembali opname ini untuk diedit?')) return
    setReopening(true)
    try {
      await api.patch(`/admin/stock-opname/${detail.id}`, { action: 'reopen' })
      setDetail(prev => ({ ...prev, status: 'DRAFT' }))
    } catch (e) { alert(e.response?.data?.message || 'Gagal membuka opname') }
    finally { setReopening(false) }
  }

  async function handleDeleteManualItem(itemId) {
    if (!confirm('Hapus item manual ini?')) return
    try {
      await api.delete(`/admin/stock-opname/${detail.id}`, { data: { itemId } })
      setDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }))
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
  }

  async function handleFinish() {
    if (!confirm('Selesaikan opname ini? Qty inventaris akan diperbarui sesuai qty aktual.')) return
    setFinishing(true)
    try {
      await api.patch(`/admin/stock-opname/${detail.id}`, { action: 'selesai' })
      setDetail(prev => ({ ...prev, status: 'SELESAI' })); load()
      const hasRequest = detail.items.some(i => i.isRequested)
      if (hasRequest) setShowLaporanRequest(true)
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyelesaikan') }
    finally { setFinishing(false) }
  }

  async function setRequestState(itemId, isRequested) {
    try {
      await api.patch(`/admin/stock-opname/${detail.id}`, { action: 'request-item', itemId, isRequested, requestQty: null })
      setDetail(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId
          ? { ...i, isRequested, requestQty: null, requestStatus: isRequested ? 'BELUM_DIBELI' : i.requestStatus }
          : i)
      }))
      return true
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan request')
      return false
    }
  }

  // Tombol Request di depan kartu → langsung nilai tanpa membuka sheet
  function handleToggleRequest(e, item) {
    e.stopPropagation()
    return setRequestState(item.id, !item.isRequested)
  }

  async function handleSaveRequest(itemId) {
    const item = detail.items.find(i => i.id === itemId)
    const ok = await setRequestState(itemId, !item?.isRequested)
    if (ok) { setRequestingId(null); setShowRequestModal(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus opname ini?')) return
    try { await api.delete(`/admin/stock-opname/${id}`); load() }
    catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
  }

  function openEditSheet(item) {
    const displayQty = item.konversi && item.konversi > 0
      ? String(item.qtyActual / item.konversi)
      : String(item.qtyActual)
    setEditSheet(item)
    setEditVal(displayQty)
    setEditNote(item.note || '')
    setEditHarga(item.isManual ? String(item.hargaTerakhir || '') : '')
  }

  // ── DETAIL VIEW ──
  if (detail || detailLoading) {
    const cats = detail ? [...new Set(detail.items.map(i => i.inventoryItem?.category || i.expenseItem?.category).filter(Boolean))].sort() : []
    const filtered = detail ? detail.items.filter(i => {
      const matchCat = !filterCat || (i.inventoryItem?.category || i.expenseItem?.category) === filterCat
      const matchBelum = !filterBelum || i.qtyActual === 0
      const matchSearch = !search || (i.inventoryItem?.name || i.itemName || '').toLowerCase().includes(search.toLowerCase())
      return matchCat && matchBelum && matchSearch
    }).sort((a, b) => {
      // Belum diisi dulu, lalu alphabetical
      if (a.qtyActual === 0 && b.qtyActual !== 0) return -1
      if (a.qtyActual !== 0 && b.qtyActual === 0) return 1
      return (a.inventoryItem?.name || a.itemName || '').localeCompare(b.inventoryItem?.name || b.itemName || '', 'id')
    }) : []
    const isDraft = detail?.status === 'DRAFT'
    const sudahDiisi = detail ? detail.items.filter(i => i.qtyActual > 0).length : 0
    const belumDiisi = detail ? detail.items.filter(i => i.qtyActual === 0).length : 0
    const pct = detail?.items.length ? Math.round(sudahDiisi / detail.items.length * 100) : 0

    return (
      <div className="page">
        <Sidebar />
        <main className="main" style={{ paddingBottom: isDraft ? '80px' : '16px' }}>

          {/* Topbar */}
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <button onClick={() => setDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '4px 0', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                <span className="hide-mobile">Kembali</span>
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="topbar-title" style={{ fontSize: '14px' }}>Detail Opname</div>
                {detail && (
                  <div className="topbar-sub" style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fmtDateShort(detail.date)} · {detail.user?.name} ·{' '}
                    <span style={{ color: detail.status === 'SELESAI' ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{detail.status}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {detail && isDraft && (
                <>
                  <button className="btn btn-ghost" onClick={handleSyncManual} disabled={syncing} title="Sync Item Manual" style={{ padding: '6px 10px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                    <span className="hide-mobile">{syncing ? 'Sync...' : 'Sync'}</span>
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowAddManual(true)} style={{ padding: '6px 10px' }} title="Tambah Manual">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span className="hide-mobile">Manual</span>
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={downloadOpnameDetailCSV} disabled={!detail} style={{ padding: '6px 10px' }} title="Export CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              {detail && !isDraft && (
                <button className="btn btn-ghost" onClick={handleReopen} disabled={reopening} style={{ padding: '6px 10px' }} title="Edit Opname">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span className="hide-mobile">{reopening ? 'Membuka...' : 'Edit'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="content">
            {detailLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
            ) : detail && (
              <>
                {/* Progress bar + summary */}
                <div className="card" style={{ padding: '14px 16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
                      Progress: <span style={{ color: '#10B981' }}>{sudahDiisi}</span> / {detail.items.length} item
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: pct === 100 ? '#10B981' : '#F59E0B' }}>{pct}%</div>
                  </div>
                  <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F59E0B', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Belum Diisi', val: belumDiisi, color: '#F59E0B' },
                      { label: 'Total Nilai', val: fmtRp(detail.items.reduce((s, i) => s + (i.qtyActual * (i.hargaPerSatuanDasar ?? i.hargaTerakhir ?? 0)), 0)), color: '#8B5CF6' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{s.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filter bar — sticky di mobile */}
                <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', paddingBottom: '8px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 160px', minWidth: '120px' }}>
                      <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input className="input" style={{ paddingLeft: '32px', width: '100%', fontSize: '14px', height: '40px' }}
                        placeholder="Cari barang..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="input" style={{ flex: '0 1 140px', minWidth: '100px', fontSize: '13px', height: '40px' }}
                      value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                      <option value="">Semua Kategori</option>
                      {cats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => setFilterBelum(v => !v)}
                      style={{ height: '40px', padding: '0 12px', borderRadius: '8px', border: `1.5px solid ${filterBelum ? '#F59E0B' : 'var(--border)'}`, background: filterBelum ? '#FFFBEB' : 'var(--surface)', color: filterBelum ? '#D97706' : 'var(--muted)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {filterBelum ? '● Belum' : 'Belum saja'}
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{filtered.length} item</span>
                  </div>
                </div>

                {/* Item cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filtered.length === 0 ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Tidak ada item</div>
                  ) : filtered.map(item => {
                    const satuanTampil = (item.satuanOpname && item.konversi) ? item.satuanOpname : (item.inventoryItem?.satuan || item.satuan || '')
                    const satuanDasar = item.inventoryItem?.satuan || item.satuan || ''
                    const qtyTampil = (item.satuanOpname && item.konversi) ? item.qtyActual / item.konversi : item.qtyActual
                    const qtySebelumnyaTampil = (item.satuanOpname && item.konversi && item.qtySebelumnya != null) ? item.qtySebelumnya / item.konversi : item.qtySebelumnya
                    // Gunakan hargaPerSatuanDasar untuk valuasi yang akurat
                    const hargaDasar = item.hargaPerSatuanDasar ?? item.hargaTerakhir ?? 0
                    const nilaiStok = item.qtyActual * hargaDasar
                    // Label keterangan harga: "Rp X / satuanOpname" atau "Rp X / satuan"
                    const labelSatuan = satuanTampil || satuanDasar
                    const hargaPerSatuanTampil = item.konversi && item.hargaTerakhir
                      ? item.hargaTerakhir / item.konversi  // harga per satuanOpname
                      : (item.hargaPerSatuanDasar ?? item.hargaTerakhir ?? null)
                    const sudahIsi = item.qtyActual > 0
                    const cat = item.inventoryItem?.category || item.expenseItem?.category
                    return (
                      <div key={item.id}
                        onClick={() => isDraft && openEditSheet(item)}
                        style={{
                          background: 'var(--surface)',
                          border: `1.5px solid ${sudahIsi ? 'var(--border)' : '#FDE68A'}`,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          cursor: isDraft ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'border-color 0.15s',
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        {/* Tombol Request — ditaruh di depan agar mudah ditekan */}
                        <button
                          onClick={e => handleToggleRequest(e, item)}
                          title={item.isRequested ? 'Batalkan request restock' : 'Tandai perlu restock'}
                          style={{
                            flexShrink: 0, width: '42px', height: '42px', borderRadius: '11px',
                            border: `1.5px solid ${item.isRequested ? '#FECACA' : '#FDE68A'}`,
                            background: item.isRequested ? '#FEF2F2' : '#FFFBEB',
                            color: item.isRequested ? '#EF4444' : '#D97706',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                          }}>
                          {item.isRequested
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>}
                        </button>

                        {/* Status dot */}
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: sudahIsi ? '#10B981' : '#F59E0B', marginTop: '2px' }} />

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)' }}>
                              {item.inventoryItem?.name || item.itemName}
                            </span>
                            {item.isManual && (
                              <span style={{ fontSize: '10px', background: '#FFF7ED', color: '#D97706', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '4px', fontWeight: '700', flexShrink: 0 }}>Manual</span>
                            )}
                            {item.isRequested && (
                              <span style={{ fontSize: '10px', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', padding: '1px 6px', borderRadius: '4px', fontWeight: '700', flexShrink: 0 }}>
                                Request · {REQUEST_STATUS_LABEL[item.requestStatus] || 'Belum dibeli'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {cat && <span style={{ fontSize: '11px', color: '#4A7CC7', background: '#EBF1FB', border: '1px solid #C0D0E8', padding: '1px 6px', borderRadius: '4px' }}>{cat}</span>}
                            {qtySebelumnyaTampil != null && (
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Sblm: {fmt(qtySebelumnyaTampil)} {satuanTampil}</span>
                            )}
                            {/* Selisih vs opname sebelumnya */}
                            {qtySebelumnyaTampil != null && sudahIsi && (() => {
                              const selisih = qtyTampil - qtySebelumnyaTampil
                              if (selisih === 0) return <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '700' }}>= sama</span>
                              const naik = selisih > 0
                              return (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: naik ? '#10B981' : '#EF4444' }}>
                                  {naik ? '▲' : '▼'} {fmt(Math.abs(selisih))}
                                </span>
                              )
                            })()}
                            {hargaPerSatuanTampil != null && (
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {fmtRp(hargaPerSatuanTampil)}{labelSatuan ? `/${labelSatuan}` : ''}
                              </span>
                            )}
                            {nilaiStok > 0 && (
                              <span style={{ fontSize: '11px', color: '#8B5CF6', fontWeight: '700' }}>{fmtRp(nilaiStok)}</span>
                            )}
                          </div>
                          {item.note && (
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', fontStyle: 'italic' }}>📝 {item.note}</div>
                          )}
                        </div>

                        {/* Qty badge */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontSize: '18px', fontWeight: '800',
                            color: sudahIsi ? '#10B981' : '#F59E0B',
                            lineHeight: 1,
                          }}>
                            {sudahIsi ? fmt(qtyTampil) : '—'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{satuanTampil}</div>
                          {isDraft && (
                            <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px', fontWeight: '600' }}>Tap untuk isi</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* FAB Selesaikan di bawah */}
          {detail && isDraft && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', zIndex: 60, display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: '14px', fontWeight: '800', background: '#10B981', borderColor: '#10B981' }}
                onClick={handleFinish} disabled={finishing}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                {finishing ? 'Menyimpan...' : 'Selesaikan Opname'}
              </button>
            </div>
          )}
        </main>

        {/* Bottom Sheet Edit Item */}
        {editSheet && isDraft && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200 }}
              onClick={() => setEditSheet(null)} />
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
              padding: '0 0 env(safe-area-inset-bottom)',
              animation: 'slideUp 0.2s ease',
            }}>
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '99px' }} />
              </div>

              <div style={{ padding: '8px 20px 20px' }}>
                {/* Header */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', lineHeight: 1.3 }}>
                    {editSheet.inventoryItem?.name || editSheet.itemName}
                  </div>
                  {(editSheet.inventoryItem?.category || editSheet.expenseItem?.category) && (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      {editSheet.inventoryItem?.category || editSheet.expenseItem?.category}
                    </div>
                  )}
                </div>

                {/* Panel referensi opname sebelumnya */}
                {(() => {
                  const sat = (editSheet.satuanOpname && editSheet.konversi)
                    ? editSheet.satuanOpname
                    : (editSheet.inventoryItem?.satuan || editSheet.satuan || '')
                  const qtySeb = (editSheet.satuanOpname && editSheet.konversi && editSheet.qtySebelumnya != null)
                    ? editSheet.qtySebelumnya / editSheet.konversi
                    : editSheet.qtySebelumnya
                  const nilaiSeb = qtySeb != null
                    ? (editSheet.qtySebelumnya ?? 0) * (editSheet.hargaPerSatuanDasar ?? editSheet.hargaTerakhir ?? 0)
                    : null
                  const qtyInput = Number(editVal) || 0
                  const selisih = qtySeb != null ? qtyInput - qtySeb : null
                  const prevDate = detail?.prevOpnameInfo?.date
                    ? new Date(detail.prevOpnameInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
                    : null

                  if (qtySeb == null) return null

                  return (
                    <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Opname Sebelumnya{prevDate ? ` · ${prevDate}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Qty</div>
                          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text2)' }}>{fmt(qtySeb)} <span style={{ fontSize: '11px', fontWeight: '500' }}>{sat}</span></div>
                        </div>
                        {nilaiSeb != null && nilaiSeb > 0 && (
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Nilai</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>{fmtRp(Math.round(nilaiSeb))}</div>
                          </div>
                        )}
                        {selisih !== null && (
                          <div style={{ marginLeft: 'auto' }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Selisih</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: selisih === 0 ? '#10B981' : selisih > 0 ? '#4A7CC7' : '#EF4444' }}>
                              {selisih === 0 ? '= sama' : `${selisih > 0 ? '+' : ''}${fmt(selisih)}`}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Input Qty dengan tombol ± */}
                {(() => {
                  const satuanTampil = (editSheet.satuanOpname && editSheet.konversi) ? editSheet.satuanOpname : (editSheet.inventoryItem?.satuan || editSheet.satuan || '')
                  return (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                        Qty Aktual {satuanTampil && `(${satuanTampil})`}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => setEditVal(v => String(Math.max(0, (Number(v) || 0) - 1)))}
                          style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface2)', fontSize: '22px', fontWeight: '300', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
                          −
                        </button>
                        <input
                          ref={inputRef}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          style={{ flex: 1, textAlign: 'center', fontSize: '28px', fontWeight: '800', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '10px', fontFamily: 'inherit', background: 'var(--surface2)', outline: 'none', minWidth: 0 }}
                          onFocus={e => e.target.select()}
                        />
                        <button onClick={() => setEditVal(v => String((Number(v) || 0) + 1))}
                          style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface2)', fontSize: '22px', fontWeight: '300', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
                          +
                        </button>
                      </div>
                      {editSheet.satuanOpname && editSheet.konversi && (
                        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
                          = {fmt((Number(editVal) || 0) * editSheet.konversi)} {editSheet.inventoryItem?.satuan || editSheet.satuan}
                        </div>
                      )}
                      {/* Preview valuasi real-time */}
                      {(() => {
                        const hargaDasar = editSheet.hargaPerSatuanDasar ?? editSheet.hargaTerakhir ?? null
                        if (!hargaDasar) return null
                        const qtyDasar = editSheet.konversi
                          ? (Number(editVal) || 0) * editSheet.konversi
                          : (Number(editVal) || 0)
                        const nilai = qtyDasar * hargaDasar
                        const satuanTampil = (editSheet.satuanOpname && editSheet.konversi) ? editSheet.satuanOpname : (editSheet.inventoryItem?.satuan || editSheet.satuan || '')
                        // harga per satuanOpname
                        const hargaPerSatuanTampil = editSheet.konversi && editSheet.hargaTerakhir
                          ? editSheet.hargaTerakhir / editSheet.konversi
                          : hargaDasar
                        return (
                          <div style={{ marginTop: '10px', padding: '10px 14px', background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)', border: '1px solid #C4B5FD', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valuasi Stok</div>
                                <div style={{ fontSize: '11px', color: '#6D28D9', marginTop: '2px' }}>
                                  {fmtRp(Math.round(hargaPerSatuanTampil))}{satuanTampil ? `/${satuanTampil}` : ''}
                                  {editSheet.konversi && editSheet.hargaTerakhir && (
                                    <span style={{ marginLeft: '6px', opacity: 0.7 }}>
                                      · {fmtRp(Math.round(editSheet.hargaTerakhir))}/{editSheet.satuanBeli || 'satuan beli'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: '20px', fontWeight: '800', color: '#7C3AED' }}>
                                {fmtRp(Math.round(nilai))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}

                {/* Harga (item manual saja) */}
                {editSheet.isManual && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Harga / Satuan</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--muted)', fontWeight: '600', pointerEvents: 'none' }}>Rp</span>
                      <input type="number" inputMode="numeric" step="any" min="0" placeholder="0" value={editHarga}
                        onChange={e => setEditHarga(e.target.value)}
                        style={{ width: '100%', fontSize: '16px', fontWeight: '700', padding: '12px 12px 12px 36px', border: '1.5px solid var(--border)', borderRadius: '12px', fontFamily: 'inherit', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
                    </div>
                  </div>
                )}

                {/* Catatan */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Catatan (opsional)</label>
                  <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Catatan tambahan..."
                    style={{ width: '100%', fontSize: '14px', padding: '12px', border: '1.5px solid var(--border)', borderRadius: '12px', fontFamily: 'inherit', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
                </div>

                {/* Tombol aksi */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {editSheet.isManual && (
                    <button onClick={() => { handleDeleteManualItem(editSheet.id); setEditSheet(null) }}
                      style={{ padding: '14px', borderRadius: '12px', border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Hapus
                    </button>
                  )}
                  <button onClick={() => {
                    const item = detail.items.find(i => i.id === editSheet.id)
                    const isReq = !item?.isRequested
                    handleSaveRequest(editSheet.id).then(() => {})
                  }}
                    style={{ padding: '14px', borderRadius: '12px', border: `1.5px solid ${editSheet.isRequested ? '#FECACA' : '#FDE68A'}`, background: editSheet.isRequested ? '#FEF2F2' : '#FFFBEB', color: editSheet.isRequested ? '#EF4444' : '#D97706', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {editSheet.isRequested ? '✓ Request' : 'Request'}
                  </button>
                  <button onClick={() => setEditSheet(null)}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Batal
                  </button>
                  <button onClick={() => handleSaveItem(editSheet.id, editVal, editNote, editHarga)} disabled={saving}
                    style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal Tambah Item Manual */}
        {showAddManual && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddManual(false) }}>
            <div className="card fade-in" style={{ width: '100%', maxWidth: '500px', borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Tambah Item Manual</div>
                <button onClick={() => setShowAddManual(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '22px', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="label">Nama Item</label>
                  <input className="input" style={{ fontSize: '16px' }} placeholder="Nama barang..." value={manualItem.itemName}
                    onChange={e => setManualItem(p => ({ ...p, itemName: e.target.value }))} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">Satuan</label>
                    <input className="input" style={{ fontSize: '16px' }} placeholder="pcs, kg..." value={manualItem.satuan}
                      onChange={e => setManualItem(p => ({ ...p, satuan: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Harga/Satuan</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', pointerEvents: 'none' }}>Rp</span>
                      <input className="input" type="number" inputMode="numeric" step="any" min="0" placeholder="0" value={manualItem.hargaTerakhir}
                        onChange={e => setManualItem(p => ({ ...p, hargaTerakhir: e.target.value }))} style={{ paddingLeft: '30px', fontSize: '16px' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 20px 20px', display: 'flex', gap: '8px', background: 'var(--surface2)' }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setShowAddManual(false)}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px' }} onClick={handleAddManual} disabled={addingManual}>
                  {addingManual ? 'Menambah...' : 'Tambah Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Request */}
        {showRequestModal && requestingId && (() => {
          const item = detail.items.find(i => i.id === requestingId)
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(6px)' }}
              onClick={e => { if (e.target === e.currentTarget) { setShowRequestModal(false); setRequestingId(null) } }}>
              <div className="card fade-in" style={{ width: '340px', maxWidth: '96vw', overflow: 'hidden' }}>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{item?.isRequested ? 'Batalkan Request?' : 'Tandai Perlu Restock?'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{item?.inventoryItem?.name || item?.itemName}</div>
                </div>
                <div style={{ padding: '0 20px 20px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => { setShowRequestModal(false); setRequestingId(null) }}>Batal</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', background: item?.isRequested ? '#EF4444' : '#F59E0B', borderColor: item?.isRequested ? '#EF4444' : '#F59E0B' }}
                    onClick={() => handleSaveRequest(requestingId)}>
                    {item?.isRequested ? 'Batalkan' : 'Tandai'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Popup Laporan Request */}
        {showLaporanRequest && detail && (() => {
          const requested = detail.items.filter(i => i.isRequested)
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(6px)' }}>
              <div className="card fade-in" style={{ width: '420px', maxWidth: '96vw', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Daftar Restock ({requested.length} item)</div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {requested.map((item, i) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#D97706', width: '20px', flexShrink: 0 }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{item.inventoryItem?.name || item.itemName}</div>
                        {(item.expenseItem?.category || item.inventoryItem?.category) && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.expenseItem?.category || item.inventoryItem?.category}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#F59E0B', borderColor: '#F59E0B' }} onClick={() => setShowLaporanRequest(false)}>Tutup</button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ── LIST VIEW ──
  const sortedOpnames = [...opnames].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Stock Opname</div>
            <div className="topbar-sub">{total} opname tercatat</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={downloadOpnameListCSV} disabled={opnames.length === 0} style={{ padding: '6px 10px' }} title="Export CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span className="hide-mobile">Export</span>
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat Opname
            </button>
          </div>
        </div>

        <div className="content">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : opnames.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              <div>Belum ada data stock opname</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedOpnames.map(o => {
                const isDraft = o.status === 'DRAFT'
                const pct = o.totalItems ? Math.round((o.totalItems - o.itemsSelisih) / o.totalItems * 100) : 0
                return (
                  <div key={o.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => openDetail(o.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      {/* Status icon */}
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDraft ? '#FFFBEB' : '#F0FDF4', border: `1.5px solid ${isDraft ? '#FDE68A' : '#A7F3D0'}` }}>
                        {isDraft
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        }
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>{fmtDateShort(o.date)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{o.user?.name} · {o.totalItems} item</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: isDraft ? '#FFFBEB' : '#F0FDF4', color: isDraft ? '#D97706' : '#10B981', border: `1px solid ${isDraft ? '#FDE68A' : '#A7F3D0'}` }}>
                              {o.status}
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        {isDraft && o.totalItems > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ height: '5px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: '99px' }} />
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>
                              {o.totalItems - o.itemsSelisih} / {o.totalItems} item terisi
                            </div>
                          </div>
                        )}
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {o.totalNilai > 0 && (
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#8B5CF6' }}>{fmtRp(o.totalNilai)}</span>
                          )}
                          {o.itemsSelisih > 0 && (
                            <span style={{ fontSize: '11px', color: '#EF4444', background: '#FEF2F2', border: '1px solid #FECACA', padding: '1px 6px', borderRadius: '5px', fontWeight: '600' }}>{o.itemsSelisih} selisih</span>
                          )}
                          {o.note && <span style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>📝 {o.note}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Tombol aksi */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}
                      onClick={e => e.stopPropagation()}>
                      <button className="btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '8px', fontSize: '13px', fontWeight: '700' }}
                        onClick={() => openDetail(o.id)}>
                        {isDraft ? '✏️ Isi Opname' : '👁 Lihat'}
                      </button>
                      <button className="btn" style={{ padding: '8px 12px', background: '#F0FDF4', color: '#22C55E', border: '1px solid #A7F3D0', fontSize: '13px' }}
                        title="Kirim WA"
                        onClick={() => { setWaOpname(o); setShowSendWA(true); setWaStatus(null); setWaTargets({ admin: false, group: false }) }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                      <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: '13px' }}
                        onClick={() => handleDelete(o.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}>
              <button className="btn btn-ghost" style={{ padding: '8px 16px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Hal {page} / {totalPages}</span>
              <button className="btn btn-ghost" style={{ padding: '8px 16px' }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </main>

      {/* Modal Buat Opname */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '500px', borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Buat Stock Opname</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '22px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Tanggal</label>
                <input type="date" className="input" style={{ fontSize: '16px' }} value={opnameDate} onChange={e => setOpnameDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Catatan <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                <input className="input" style={{ fontSize: '16px' }} placeholder="Misal: Opname bulanan..." value={note} onChange={e => setNote(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              </div>
            </div>
            <div style={{ padding: '14px 20px 24px', display: 'flex', gap: '8px', background: 'var(--surface2)' }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setShowCreate(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px' }} onClick={handleCreate} disabled={creating}>
                {creating ? 'Membuat...' : 'Buat & Mulai Isi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kirim WhatsApp */}
      {showSendWA && waOpname && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget && !waSending) setShowSendWA(false) }}>
          <div className="card fade-in" style={{ width: '380px', maxWidth: '96vw', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', borderBottom: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Kirim ke WhatsApp</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>PDF akan digenerate otomatis</div>
              </div>
              {!waSending && <button onClick={() => setShowSendWA(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '22px', lineHeight: 1 }}>×</button>}
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {waStatus !== 'success' && waStatus !== 'sending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[{ key: 'admin', label: 'Admin', desc: 'Pesan pribadi ke nomor admin', color: '#4A7CC7', bg: '#EFF4FF', bdr: '#C7D4F0' },
                    { key: 'group', label: 'Grup', desc: 'Kirim ke grup WhatsApp', color: '#10B981', bg: '#F0FDF4', bdr: '#A7F3D0' }
                  ].map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', border: `2px solid ${waTargets[opt.key] ? opt.bdr : 'var(--border)'}`, background: waTargets[opt.key] ? opt.bg : 'var(--surface)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={waTargets[opt.key]} onChange={e => setWaTargets(p => ({ ...p, [opt.key]: e.target.checked }))}
                        style={{ width: '18px', height: '18px', accentColor: opt.color, cursor: 'pointer', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: waTargets[opt.key] ? opt.color : 'var(--text)' }}>{opt.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {waStatus === 'sending' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                  <span style={{ width: '18px', height: '18px', border: '2px solid #A7F3D0', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                  <div style={{ fontSize: '13px', color: '#15803D', fontWeight: '600' }}>Mengirim...</div>
                </div>
              )}
              {waStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F0FDF4', border: '2px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Terkirim!</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{waMessage}</div>
                </div>
              )}
              {waStatus === 'error' && (
                <div style={{ padding: '12px 14px', background: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA', fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>
                  Gagal: {waMessage}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: '8px' }}>
              {waStatus === 'success' ? (
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', background: '#22C55E', borderColor: '#22C55E' }} onClick={() => setShowSendWA(false)}>Tutup</button>
              ) : (
                <>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setShowSendWA(false)} disabled={waSending}>Batal</button>
                  <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px', background: '#22C55E', borderColor: '#22C55E', opacity: (!waTargets.admin && !waTargets.group) ? 0.5 : 1 }}
                    onClick={handleSendWA} disabled={waSending || (!waTargets.admin && !waTargets.group)}>
                    {waSending ? 'Mengirim...' : 'Kirim PDF'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

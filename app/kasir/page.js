'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import { printThermal } from '@/lib/thermal'
import Cookies from 'js-cookie'

const fmt = (n) => Number(n).toLocaleString('id-ID')
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const translations = {
  namaItem: 'Nama Item',
  harga: 'Harga',
  kategori: 'Kategori',
  opsional: '(opsional)',
  namaPembeli: 'Nama Pembeli',
  catatan: 'Catatan',
  kasAwal: 'Kas Awal',
  pengeluaran: 'Pengeluaran',
  tambahItemManual: 'Tambah Item Manual',
}
const t = (key) => translations[key]

export default function KasirPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [closingOpen, setClosingOpen] = useState(false)
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [ordersExpanded, setOrdersExpanded] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [paidOrders, setPaidOrders] = useState([])
  const [paidOrderAlert, setPaidOrderAlert] = useState(null)
  const notifIntervalRef = useRef(null)

  const playNotif = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const gain = ctx.createGain()
      gain.connect(ctx.destination)

      // Ringtone melodi — pola 8 nada (mirip classic phone ringtone)
      const notes = [
        [1318, 0.00], // E6
        [1174, 0.12], // D6
        [740,  0.24], // F#5
        [830,  0.36], // Ab5
        [1108, 0.48], // C#6
        [987,  0.60], // B5
        [622,  0.72], // Eb5
        [698,  0.84], // F5
      ]
      notes.forEach(([freq, delay]) => {
        const osc = ctx.createOscillator()
        osc.connect(gain)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
        gain.gain.setValueAtTime(0.9, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.11)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.11)
      })
    } catch {}
  }, [])

  const startNotifLoop = useCallback(() => {
    if (notifIntervalRef.current) clearInterval(notifIntervalRef.current)
    playNotif()
    notifIntervalRef.current = setInterval(playNotif, 3000)
  }, [playNotif])

  const stopNotifLoop = useCallback(() => {
    if (notifIntervalRef.current) {
      clearInterval(notifIntervalRef.current)
      notifIntervalRef.current = null
    }
  }, [])

  // Restart loop jika masih ada paid alert yang belum dikonfirmasi
  const restartIfNeeded = useCallback((remainingPaidOrders) => {
    if (remainingPaidOrders.length > 0) startNotifLoop()
    else stopNotifLoop()
  }, [startNotifLoop, stopNotifLoop])

  // Bersihkan saat unmount
  useEffect(() => () => stopNotifLoop(), [stopNotifLoop])
  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()

  const todayKey = new Date().toLocaleDateString('en-CA')
  const [closed, setClosed] = useState(false)
  const [todayShifts, setTodayShifts] = useState([]) // shift yang sudah closing hari ini

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    api.get(`/daily-reports?from=${today.toISOString()}&to=${endOfDay.toISOString()}`)
      .then(res => {
        const reports = res.data.reports || []
        const shifts = reports.map(r => r.shift).filter(Boolean)
        setTodayShifts(shifts)
        const allDone = ['SHIFT_1', 'SHIFT_2', 'SHIFT_3'].every(s => shifts.includes(s))
        if (allDone) {
          localStorage.setItem('closing_date', todayKey)
          setClosed(true)
        } else {
          localStorage.removeItem('closing_date')
          setClosed(false)
        }
      })
      .catch(() => {
        setClosed(localStorage.getItem('closing_date') === todayKey)
      })
  }, [])

  // Set untuk track order yang sedang in-flight PATCH servedAt
  const pendingServed = useState(() => new Set())[0]

  const load = useCallback(async (silent = false) => {
    // Tampil dari cache dulu agar instan
    if (!silent) {
      const cached = localStorage.getItem('kasir_products_cache')
      if (cached) {
        try {
          const { products: cp, categories: cc } = JSON.parse(cached)
          setProducts(cp); setCategories(cc); setLoading(false)
        } catch { }
      } else {
        setLoading(true)
      }
    }
    try {
      const [prodsRes, catsRes] = await Promise.all([
        api.get('/products?slim=1'),
        api.get('/admin/categories'),
      ])
      const cats = catsRes.data.map((c) => c.name).sort()
      setProducts(prodsRes.data)
      setCategories(cats)
      localStorage.setItem('kasir_products_cache', JSON.stringify({ products: prodsRes.data, categories: cats, ts: Date.now() }))
    } catch { }
    setLoading(false)
  }, [])

  const loadOrders = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA')
    const closingDate = localStorage.getItem('closing_date')
    // Hapus closing_date lama jika sudah hari baru
    if (closingDate && closingDate !== today) localStorage.removeItem('closing_date')
    if (closingDate === today) return
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
      const res = await api.get(`/transactions?slim=1&from=${today.toISOString()}&to=${endOfDay.toISOString()}&page=1`)
      const incoming = res.data.transactions || []
      const incomingIds = new Set(incoming.map((o) => o.id))
      setOrders((prev) => {
        const prevMap = Object.fromEntries(prev.map((o) => [o.id, o]))
        // Pertahankan self-order (yang tidak ada di transactions)
        const selfOrders = prev.filter((o) => !incomingIds.has(o.id) && o.orderNo)
        const merged = incoming.map((o) => pendingServed.has(o.id) ? { ...o, servedAt: prevMap[o.id]?.servedAt } : o)
        return [...selfOrders, ...merged]
      })
    } catch { }
  }, [pendingServed])

  const pathname = usePathname()

  useEffect(() => {
    Promise.all([load(), loadOrders()])
  }, [load, loadOrders, pathname])

  useEffect(() => {
    const tOrders = setInterval(() => loadOrders(), 5000)
    const tProducts = setInterval(() => load(true), 300000)
    return () => { clearInterval(tOrders); clearInterval(tProducts) }
  }, [load, loadOrders])

  // SSE real-time self-order
  useEffect(() => {
    let es
    let reconnectTimer
    function connect() {
      es = new EventSource('/api/self-orders/stream')
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'PAID_ORDERS' && data.orders?.length) {
            setPaidOrders(prev => {
              const ids = new Set(prev.map(o => o.id))
              const newOnes = data.orders.filter(o => !ids.has(o.id))
              if (!newOnes.length) return prev
              startNotifLoop()
              setPaidOrderAlert(newOnes[0])
              // Masukkan ke list card order hari ini
              setOrders(prevOrders => {
                const existingIds = new Set(prevOrders.map(o => o.id))
                const toAdd = newOnes
                  .filter(o => !existingIds.has(o.id))
                  .map(o => ({
                    ...o,
                    invoiceNo: o.orderNo,
                    // Jika ada dokuInvoiceNo berarti bayar via QRIS, selain itu CASH
                    payMethod: o.dokuInvoiceNo ? 'QRIS' : 'CASH',
                    servedAt: o.servedAt || null,
                  }))
                if (!toAdd.length) return prevOrders
                return [...toAdd, ...prevOrders]
              })
              return [...newOnes, ...prev]
            })
          }
        } catch {}
      }
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 5000) }
    }
    connect()
    return () => { es?.close(); clearTimeout(reconnectTimer) }
  }, [])

  function dismissPaidOrder(id) {
    setPaidOrders(prev => {
      const remaining = prev.filter(o => o.id !== id)
      restartIfNeeded(remaining)
      return remaining
    })
    if (paidOrderAlert?.id === id) setPaidOrderAlert(null)
  }

  function toggleServed(orderId, currentServedAt) {
    const newServedAt = currentServedAt ? null : new Date().toISOString()
    pendingServed.add(orderId)
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, servedAt: newServedAt } : o))
    setSelectedOrder((prev) => prev?.id === orderId ? { ...prev, servedAt: newServedAt } : prev)
    api.patch(`/transactions/${orderId}`, { servedAt: newServedAt }).then((res) => {
      pendingServed.delete(orderId)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, servedAt: res.data.servedAt } : o))
      setSelectedOrder((prev) => prev?.id === orderId ? { ...prev, servedAt: res.data.servedAt } : prev)
    }).catch(() => {
      pendingServed.delete(orderId)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, servedAt: currentServedAt } : o))
      setSelectedOrder((prev) => prev?.id === orderId ? { ...prev, servedAt: currentServedAt } : prev)
    })
  }

  async function deleteOrder(orderId) {
    if (!confirm('Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      await api.delete(`/transactions/${orderId}`)
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
  }

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.code || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !selectedCat || p.category?.name === selectedCat
    return matchSearch && matchCat
  })

  function addToCart(product) {
    if (product.stock <= 0) return
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function updateQty(productId, delta) {
    setCart((prev) => prev
      .map((i) => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
      .filter((i) => i.qty > 0)
    )
  }

  function clearCart() { setCart([]) }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const qtyOf = (id) => cart.find((i) => i.product.id === id)?.qty || 0
  const totalQty = cart.reduce((s, i) => s + i.qty, 0)

  // hitung summary orders
  const ordersToday = orders.length
  const ordersServed = orders.filter((o) => o.servedAt).length
  const ordersPending = ordersToday - ordersServed
  const completedOrders = orders.filter(o => o.status === 'COMPLETED')
  const totalPendapatan = completedOrders.reduce((s, o) => s + o.total, 0)
  const totalCash = completedOrders.filter(o => o.payMethod === 'CASH').reduce((s, o) => s + o.total, 0)
  const totalQris = completedOrders.filter(o => o.payMethod === 'QRIS').reduce((s, o) => s + o.total, 0)
  const totalTransfer = completedOrders.filter(o => o.payMethod === 'TRANSFER' || o.payMethod === 'NONTUNAI').reduce((s, o) => s + o.total, 0)

  return (
    <div className="page">
      {/* Alert popup order sudah dibayar */}
      {paidOrderAlert && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, width: '320px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '2px solid #059669', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: '13px', fontWeight: '800' }}>Pembayaran Diterima!</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>#{paidOrderAlert.orderNo}</div>
            </div>
            <button onClick={() => dismissPaidOrder(paidOrderAlert.id)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: '16px' }}>×</button>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A0F00', marginBottom: '4px' }}>
              {paidOrderAlert.customerName || 'Pelanggan'}{paidOrderAlert.tableNo ? ` · Meja ${paidOrderAlert.tableNo}` : ''}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
              {paidOrderAlert.items?.length} item · Rp {fmt(paidOrderAlert.total)}
            </div>
            <button onClick={() => dismissPaidOrder(paidOrderAlert.id)}
              style={{ width: '100%', padding: '8px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>✓ Siap Diproses</button>
          </div>
        </div>
      )}

      <Sidebar />
      <main className="main" style={{ overflow: 'hidden', position: 'relative' }}>
        {/* Topbar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">Kasir</div>
            <div className="topbar-sub">{user.name || 'Kasir'}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input className="input" style={{ paddingLeft: '32px', width: '220px' }} placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-ghost" onClick={load}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            </button>
            <button className="btn" style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', fontWeight: '700' }} onClick={() => setClosingOpen(true)}>
              Closing
            </button>
          </div>
        </div>

        {/* Banner Kasir Tutup */}
        {closed && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', margin: '16px 24px 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#C95555' }}>Kasir sudah closing semua shift hari ini</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Untuk membuka kembali, buka <a href="/kasir/laporan" style={{ color: 'var(--accent)', fontWeight: '600' }}>Laporan Harian</a> dan batalkan closing.</div>
            </div>
          </div>
        )}
        {!closed && todayShifts.length > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', margin: '16px 24px 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            <div style={{ fontSize: '12px', color: '#92400E' }}>
              Shift selesai: <strong>{todayShifts.map(s => s.replace('SHIFT_', 'Shift ')).join(', ')}</strong>
            </div>
          </div>
        )}

        {/* Produk area — full width */}
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

          {/* ── Order List ── */}
          <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: ordersExpanded ? '1px solid var(--border)' : 'none' }}>
              {/* Kiri: toggle order list */}
              <div onClick={() => setOrdersExpanded(!ordersExpanded)}
                style={{ flex: 1, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Order Hari Ini</span>
                <span style={{ fontSize: '11px', fontWeight: '700', background: '#EFF4FF', color: 'var(--accent)', padding: '2px 8px', borderRadius: '20px', border: '1px solid #C7D4F0' }}>{ordersToday} order</span>
                {ordersPending > 0 && <span style={{ fontSize: '11px', fontWeight: '700', background: 'var(--orange-light)', color: 'var(--orange)', padding: '2px 8px', borderRadius: '20px', border: '1px solid #FDE68A' }}>{ordersPending} belum disajikan</span>}
                {orders.filter(o => o.status !== 'COMPLETED').length > 0 && <span style={{ fontSize: '11px', fontWeight: '700', background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: '20px', border: '1px solid #FECACA' }}>{orders.filter(o => o.status !== 'COMPLETED').length} belum bayar</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); loadOrders() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '2px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  </button>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: '#94A3B8', transition: 'transform 0.2s', transform: ordersExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
              {/* Kanan: ringkasan pendapatan */}
              <div style={{ borderLeft: '1px solid var(--border)', padding: '8px 20px', display: 'flex', gap: '16px', alignItems: 'center', background: '#FAFBFF', flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>Rp {fmt(totalPendapatan)}</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
                {[
                  { label: 'Cash', value: totalCash, color: '#2A9D6E' },
                  { label: 'QRIS', value: totalQris, color: '#6B5BAF' },
                  { label: 'Transfer', value: totalTransfer, color: '#C47D1A' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: value > 0 ? color : 'var(--muted)' }}>Rp {fmt(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards */}
            {ordersExpanded && (
              <div style={{ overflowX: 'auto', padding: '0 20px 12px', display: 'flex', gap: '10px' }}>
                {orders.length === 0 ? (
                  <div style={{ padding: '12px 0', color: '#94A3B8', fontSize: '13px' }}>Belum ada order hari ini</div>
                ) : orders.map((order) => {
                  const served = !!order.servedAt
                  const paid = order.status === 'COMPLETED'
                  return (
                    <div key={order.id} style={{ flexShrink: 0, width: '170px', background: '#fff', borderRadius: '14px', border: `1.5px solid ${!paid ? '#FECACA' : served ? '#A7F3D0' : 'var(--border)'}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(13,21,38,0.06)', transition: 'box-shadow 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(13,21,38,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(13,21,38,0.06)'}
                    >
                      {/* Klik area untuk detail */}
                      <div onClick={() => setSelectedOrder(order)} style={{ padding: '12px 12px 8px', cursor: 'pointer' }}>
                        {/* Waktu + invoice */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)' }}>{fmtTime(order.createdAt)}</span>
                          <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>#{order.invoiceNo.slice(-5)}</span>
                        </div>
                        {/* Nama pembeli */}
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {order.customerName || '(Tanpa Nama)'}
                        </div>
                        {/* Total */}
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)', marginBottom: '8px' }}>Rp {fmt(order.total)}</div>
                        {/* Status badges */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', textAlign: 'center', background: served ? '#ECFDF5' : '#FFFBEB', color: served ? 'var(--green)' : 'var(--orange)', border: `1px solid ${served ? '#A7F3D0' : '#FDE68A'}` }}>
                            {served ? 'Sudah Disajikan' : 'Belum Disajikan'}
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', textAlign: 'center', background: paid ? '#ECFDF5' : '#FEF2F2', color: paid ? 'var(--green)' : 'var(--red)', border: `1px solid ${paid ? '#A7F3D0' : '#FECACA'}` }}>
                            {paid ? 'Lunas' : 'Belum Bayar'}
                          </span>
                        </div>
                      </div>
                      {/* Tombol sajikan */}
                      <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleServed(order.id, order.servedAt) }}
                          style={{ flex: 1, padding: '7px', border: 'none', background: served ? '#F0FDF4' : 'var(--accent)', color: served ? 'var(--green)' : '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                          {served ? 'Batal' : 'Sajikan'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteOrder(order.id) }}
                          style={{ width: '32px', padding: '7px', border: 'none', borderLeft: '1px solid var(--border)', background: '#FEF2F2', color: 'var(--red)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Category bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
            {[{ label: 'Semua', value: null }, ...categories.map((c) => ({ label: c, value: c }))].map(({ label, value }) => (
              <button key={label} onClick={() => setSelectedCat(value)}
                style={{ padding: '6px 16px', borderRadius: '20px', border: `1px solid ${selectedCat === value ? 'var(--accent)' : 'var(--border)'}`, background: selectedCat === value ? 'var(--accent)' : '#fff', color: selectedCat === value ? '#fff' : 'var(--text2)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Grid produk */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94A3B8' }}>Memuat produk...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                {filtered.map((p) => {
                  const qty = qtyOf(p.id)
                  const outOfStock = p.stock <= 0
                  return (
                    <div key={p.id} onClick={() => addToCart(p)}
                      style={{ background: '#fff', borderRadius: '12px', border: `2px solid ${qty > 0 ? 'var(--accent)' : 'var(--border)'}`, cursor: outOfStock ? 'not-allowed' : 'pointer', opacity: outOfStock ? 0.5 : 1, overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: qty > 0 ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 4px rgba(13,21,38,0.06)' }}>
                      <div style={{ height: '100px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} /> : <span style={{ fontSize: '28px' }}>☕</span>}
                      </div>
                      <div style={{ padding: '10px' }}>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {p.category && <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: '6px' }}>{p.category.name}</span>}
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', marginLeft: 'auto' }}>Rp {fmt(p.price)}</span>
                        </div>
                        {qty > 0 && <div style={{ marginTop: '6px', background: 'var(--accent)', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '700', padding: '2px 0' }}>{qty} dipilih</div>}
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: '#94A3B8' }}><div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>Tidak ada produk</div>}
              </div>
            )}
          </div>
        </div>

        {/* Tombol link self order */}
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 100 }}>
          <a href="/self-order" target="_blank" rel="noreferrer" title="Buka halaman Self Order" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', background: 'linear-gradient(135deg,#C8935A,#A0682F)', color: '#fff', textDecoration: 'none', fontSize: '12px', fontWeight: '700', boxShadow: '0 4px 16px rgba(200,147,90,0.4)' }}>
            🛎️ Self Order
          </a>
        </div>

        {/* Cart Overlay */}
        <div className={`cart-overlay${cartOpen ? ' open' : ''}`} onClick={() => setCartOpen(false)} />

        {/* Cart Drawer */}
        <div className={`cart-drawer${cartOpen ? ' open' : ''}`}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>Pesanan</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {cart.length > 0 && <button onClick={clearCart} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--red)', fontWeight: '600', fontFamily: 'inherit' }}>Kosongkan</button>}
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: '8px' }}>
                <span style={{ fontSize: '40px' }}>🛒</span>
                <span style={{ fontSize: '13px' }}>Belum ada pesanan</span>
              </div>
            ) : cart.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F1F5F9', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.product.imageUrl ? <img src={item.product.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} /> : <span style={{ fontSize: '18px' }}>☕</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>Rp {fmt(item.product.price)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => updateQty(item.product.id, -1)} style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontWeight: '800', fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} style={{ width: '26px', height: '26px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer cart */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <ManualItemButton categories={categories} onAdd={(item) => setCart((prev) => {
              const idx = prev.findIndex((i) => i.product.id === item.id)
              if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
              return [...prev, { product: item, qty: 1 }]
            })} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
              <span style={{ fontSize: '16px', fontWeight: '700' }}>Total</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)' }}>Rp {fmt(total)}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '0' }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
                disabled={cart.length === 0 || closed} onClick={() => setCheckoutOpen(true)}>
                {closed ? '🔒 Kasir Tutup' : 'Lanjutkan →'}
              </button>
            </div>
          </div>
        </div>

        {/* FAB Cart */}
        <button className="cart-fab" onClick={() => setCartOpen(!cartOpen)}>
          {cartOpen
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          }
          {!cartOpen && totalQty > 0 && (
            <span className="cart-badge">{totalQty > 99 ? '99+' : totalQty}</span>
          )}
        </button>
      </main>

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          total={total}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(newTx) => {
            clearCart(); setCheckoutOpen(false); setCartOpen(false)
            if (newTx?.id) setOrders((prev) => [newTx, ...prev.filter(o => o.id !== newTx.id)])
            load(true)
          }}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          products={products}
          onClose={() => setSelectedOrder(null)}
          onToggleServed={() => toggleServed(selectedOrder.id, selectedOrder.servedAt)}
          onPayNow={(order) => { setSelectedOrder(null); setPendingOrder(order) }}
          onRefresh={() => { loadOrders(); setSelectedOrder(null) }}
        />
      )}

      {pendingOrder && (
        <CheckoutModal
          cart={pendingOrder.items.map((i) => ({ product: { id: i.productId || `manual_${i.id}`, name: i.product?.name || 'Item Manual', price: i.price, stock: 999, imageUrl: i.product?.imageUrl || null, category: null }, qty: i.qty }))}
          total={pendingOrder.total}
          existingOrderId={pendingOrder.id}
          onClose={() => setPendingOrder(null)}
          onSuccess={() => { setPendingOrder(null); loadOrders() }}
        />
      )}

      {closingOpen && (
        <ClosingModal
          orders={orders}
          todayShifts={todayShifts}
          onClose={() => setClosingOpen(false)}
          onSaved={(shift) => {
            const newShifts = [...todayShifts, shift]
            setTodayShifts(newShifts)
            const allDone = ['SHIFT_1', 'SHIFT_2', 'SHIFT_3'].every(s => newShifts.includes(s))
            if (allDone) { localStorage.setItem('closing_date', todayKey); setClosed(true) }
            setClosingOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ── Order Detail Modal ──
function OrderDetailModal({ order, products = [], onClose, onToggleServed, onPayNow, onRefresh }) {
  const [printing, setPrinting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState(order.customerName || '')
  const [editNote, setEditNote] = useState(order.note || '')
  const [editItems, setEditItems] = useState(order.items.map(i => ({ productId: i.productId || null, name: i.product?.name || i.name || '', category: i.category || '', code: i.code || '', qty: i.qty, price: i.price })))
  const [productSearch, setProductSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code || '').toLowerCase().includes(productSearch.toLowerCase()))
  const served = !!order.servedAt
  const paid = order.status === 'COMPLETED'
  const editTotal = editItems.reduce((s, i) => s + i.price * i.qty, 0)

  async function handlePrint() {
    setPrinting(true)
    try { await printThermal(order) } catch (e) { alert('Gagal cetak: ' + e.message) }
    finally { setPrinting(false) }
  }

  function handleToggle() {
    setToggling(true)
    onToggleServed()
    setTimeout(() => setToggling(false), 500)
  }

  async function handleSaveEdit() {
    if (!editItems.length) return alert('Item pesanan tidak boleh kosong')
    setSaving(true)
    try {
      await api.patch(`/transactions/${order.id}`, {
        customerName: editName,
        note: editNote,
        items: editItems,
      })
      setEditing(false)
      onRefresh()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  function updateItem(i, field, val) {
    setEditItems(prev => prev.map((it, n) => n === i ? { ...it, [field]: field === 'qty' || field === 'price' ? Number(val) || 0 : val } : it))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '440px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{order.customerName || '(Tanpa Nama)'}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px' }}>{order.invoiceNo} · {fmtTime(order.createdAt)}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setEditing(!editing)}
              style={{ fontSize: '12px', fontWeight: '700', padding: '5px 12px', borderRadius: '7px', border: `1px solid ${editing ? '#FECACA' : 'var(--border)'}`, background: editing ? '#FEF2F2' : 'var(--surface2)', color: editing ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {editing ? 'Batal' : '✏️ Edit'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: served ? '#ECFDF5' : '#FFFBEB', borderRadius: '10px', padding: '12px', border: `1px solid ${served ? '#A7F3D0' : '#FDE68A'}` }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>STATUS SAJIAN</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: served ? 'var(--green)' : 'var(--orange)' }}>{served ? '✓ Sudah Disajikan' : 'Belum Disajikan'}</div>
            </div>
            <div style={{ background: paid ? '#ECFDF5' : '#FEF2F2', borderRadius: '10px', padding: '12px', border: `1px solid ${paid ? '#A7F3D0' : '#FECACA'}` }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>STATUS BAYAR</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: paid ? 'var(--green)' : 'var(--red)' }}>{paid ? 'Lunas' : 'Belum Bayar'}</div>
            </div>
          </div>

          {editing ? (
            <>
              {/* Edit nama & catatan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label className="label">Nama Pembeli</label>
                  <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama pelanggan" />
                </div>
                <div>
                  <label className="label">Catatan</label>
                  <input className="input" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Catatan..." />
                </div>
              </div>
              {/* Edit items */}
              <div className="section-label">Item Pesanan</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {editItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border)' }}>
                    <input className="input" style={{ flex: 2, fontSize: '12px', padding: '5px 8px' }} value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Nama item" />
                    <input className="input" type="number" style={{ flex: '0 0 48px', fontSize: '12px', padding: '5px 6px' }} value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} min="1" placeholder="Qty" />
                    <input className="input" type="number" style={{ flex: 2, fontSize: '12px', padding: '5px 8px' }} value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="Harga" />
                    <button onClick={() => setEditItems(prev => prev.filter((_, n) => n !== i))}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '5px 7px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => setShowPicker(!showPicker)}
                  style={{ padding: '7px', border: '1px dashed var(--border)', borderRadius: '8px', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', fontWeight: '600', fontFamily: 'inherit' }}>
                  + Tambah Item
                </button>
                {showPicker && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                    <input className="input" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', fontSize: '12px' }}
                      placeholder="Cari produk..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus />
                    <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                      <div onClick={() => { setEditItems(prev => [...prev, { productId: null, name: '', category: '', code: '', qty: 1, price: 0 }]); setShowPicker(false); setProductSearch('') }}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontStyle: 'italic' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        + Item manual (kosong)
                      </div>
                      {filteredProducts.map(p => (
                        <div key={p.id} onClick={() => { setEditItems(prev => [...prev, { productId: p.id, name: p.name, category: p.category?.name || '', code: p.code || '', qty: 1, price: p.price }]); setShowPicker(false); setProductSearch('') }}
                          style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.category?.name || ''}{p.code ? ` · ${p.code}` : ''}</div>
                          </div>
                          <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '12px' }}>Rp {fmt(p.price)}</span>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>Tidak ada produk</div>}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
                <span>Total Baru</span>
                <span style={{ color: 'var(--accent)' }}>Rp {fmt(editTotal)}</span>
              </div>
            </>
          ) : (
            <>
              {/* Catatan */}
              {order.note && (
                <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', marginBottom: '3px' }}>CATATAN</div>
                  <div style={{ fontSize: '13px', color: '#78350F' }}>{order.note}</div>
                </div>
              )}
              {/* Items */}
              <div style={{ marginBottom: '14px' }}>
                <div className="section-label">Item Pesanan</div>
                <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {order.items.length === 0
                    ? <div style={{ padding: '14px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>Tidak ada item</div>
                    : order.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{item.product?.name || item.name || 'Item Manual'}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{item.qty} × Rp {fmt(item.price)}</div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>Rp {fmt(item.subtotal)}</div>
                      </div>
                    ))}
                </div>
              </div>
              {/* Total */}
              <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)', marginBottom: paid ? '0' : '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: paid && order.payment > 0 ? '6px' : '0' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>Total</span>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent)' }}>Rp {fmt(order.total)}</span>
                </div>
                {paid && order.payment > 0 && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>
                    <span>Bayar ({order.payMethod})</span><span>Rp {fmt(order.payment)}</span>
                  </div>
                  {order.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: 'var(--green)' }}>
                    <span>Kembalian</span><span>Rp {fmt(order.change)}</span>
                  </div>}
                </>}
              </div>
              {!paid && (
                <button onClick={() => { onClose(); onPayNow(order) }}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', marginTop: '16px' }}>
                  💳 Proses Pembayaran
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          {editing ? (
            <button onClick={handleSaveEdit} disabled={saving}
              style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          ) : (
            <>
              <button onClick={handleToggle} disabled={toggling}
                style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${served ? '#FDE68A' : '#A7F3D0'}`, background: served ? '#FFFBEB' : '#ECFDF5', color: served ? 'var(--orange)' : 'var(--green)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                {toggling ? '...' : served ? 'Batalkan Sajian' : 'Tandai Disajikan'}
              </button>
              <button onClick={handlePrint} disabled={printing}
                style={{ flex: 1, padding: '10px', borderRadius: '9px', border: '1px solid #C7D4F0', background: '#EFF4FF', color: 'var(--accent)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                {printing ? '⏳ Mencetak...' : '🖨️ Print Ulang'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tambah Item Manual ──
function ManualItemButton({ onAdd, categories }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || !price) return
    onAdd({ id: `manual_${Date.now()}`, name: name.trim(), price: Number(price), stock: 999, imageUrl: null, category: category ? { name: category } : null })
    setName(''); setPrice(''); setCategory(''); setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '10px', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text2)', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        {t('tambahItemManual')}
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="card" style={{ width: '360px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>{t('tambahItemManual')}</div>
            <form onSubmit={submit}>
              <div style={{ marginBottom: '12px' }}>
                <input className="input" aria-label={t('namaItem')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namaItem')} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input className="input" type="number" aria-label={t('harga')} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('harga')} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <select className="input" aria-label={t('kategori')} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Tambah</button>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ── Closing Modal ──
const SHIFTS = [
  { key: 'SHIFT_1', label: 'Closing Shift 1', jam: '07.00 - 13.00' },
  { key: 'SHIFT_2', label: 'Closing Shift 2', jam: '13.00 - 18.00' },
  { key: 'SHIFT_3', label: 'Closing Shift 3', jam: '18.00 - 23.00' },
]

function ClosingModal({ orders, todayShifts = [], onClose, onSaved }) {
  const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)

  const availableShifts = SHIFTS.filter(s => !todayShifts.includes(s.key))
  const [shift, setShift] = useState(() => availableShifts[0]?.key || 'SHIFT_1')
  const activeShift = SHIFTS.find(s => s.key === shift)

  const [snapshot] = useState(() => {
    const completed = orders.filter(o => o.status === 'COMPLETED')
    return {
      completed,
      totalPenjualan: completed.reduce((s, o) => s + o.total, 0),
      totalCash: completed.filter(o => o.payMethod === 'CASH').reduce((s, o) => s + o.total, 0),
      totalQris: completed.filter(o => o.payMethod === 'QRIS').reduce((s, o) => s + o.total, 0),
      totalTransfer: completed.filter(o => o.payMethod === 'TRANSFER' || o.payMethod === 'NONTUNAI').reduce((s, o) => s + o.total, 0),
      pendingCount: orders.filter(o => o.status !== 'COMPLETED').length,
    }
  })
  const { completed, totalPenjualan, totalCash, totalQris, totalTransfer, pendingCount } = snapshot

  const [kasAwal, setKasAwal] = useState('')
  const [pengeluaran, setPengeluaran] = useState([])
  const [catatan, setCatatan] = useState('')
  const [closerName, setCloserName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalPengeluaran = pengeluaran.reduce((s, p) => s + (Number(p.harga) * Number(p.qty || 1)), 0)
  const kasAkhir = Number(kasAwal || 0) + totalCash - totalPengeluaran

  function addPengeluaran() { setPengeluaran(prev => [...prev, { barang: '', qty: 1, harga: 0 }]) }
  function updatePengeluaran(i, field, val) { setPengeluaran(prev => prev.map((p, n) => n === i ? { ...p, [field]: val } : p)) }

  async function handleSave() {
    setSaving(true)
    try {
      await api.post('/daily-reports', {
        shift, kasAwal: Number(kasAwal) || 0, penjualan: totalPenjualan, uangDisetor: totalCash,
        qris: totalQris, transfer: totalTransfer,
        pengeluaran: pengeluaran.filter(p => p.barang).map(p => ({ ...p, qty: Number(p.qty) || 1, harga: Number(p.harga) || 0 })),
        piutang: [], catatan, closerName,
      })
      setSaved(true)
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan laporan')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '820px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E2A3B' }}>Closing Kasir</div>
            <div style={{ fontSize: '11px', color: '#7A8FAF', marginTop: '1px' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(74,124,199,0.1)', border: '1px solid #C0D0E8', borderRadius: '8px', cursor: 'pointer', color: '#5A6E90', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {saved ? (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 18px', gap: '10px' }}>
              {/* Success header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '32px', background: 'var(--green-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #A7DFC8', flexShrink: 0, color: 'var(--green)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>Laporan Closing Tersimpan</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
                <button className="btn btn-primary" style={{ marginLeft: 'auto', justifyContent: 'center', padding: '7px 18px', fontSize: '12px' }} onClick={() => onSaved(shift)}>Tutup</button>
              </div>

              {/* Body 2 kolom */}
              <div style={{ display: 'flex', gap: '12px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                {/* Kolom kiri */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { label: 'Total Penjualan', value: totalPenjualan, color: '#4A7CC7', bg: '#EBF1FB', border: '#C0D0E8' },
                      { label: 'Cash', value: totalCash, color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
                      { label: 'QRIS', value: totalQris, color: '#6B5BAF', bg: '#EEEAF8', border: '#C8C0E8' },
                      { label: 'Transfer', value: totalTransfer, color: '#C47D1A', bg: '#FDF4E3', border: '#F0D090' },
                    ].map(({ label, value, color, bg, border }) => (
                      <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color }}>{fmt(value)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '2px' }}>
                    {completed.length} transaksi selesai &nbsp;&middot;&nbsp; {pendingCount} belum bayar
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', borderRadius: '10px', border: '1px solid #C0D0E8', padding: '10px 12px', flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#7A8FAF', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Kalkulasi Kas</div>
                    {[
                      ['Kas Awal', fmt(Number(kasAwal) || 0), 'var(--text2)'],
                      ['+ Penjualan Cash', `+${fmt(totalCash)}`, '#2A9D6E'],
                      ...(totalPengeluaran > 0 ? [['- Pengeluaran', `-${fmt(totalPengeluaran)}`, '#C95555']] : []),
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                        <span style={{ color: '#7A8FAF' }}>{label}</span>
                        <span style={{ fontWeight: '600', color }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #C0D0E8', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E2A3B' }}>Total Kas Akhir</span>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: kasAkhir >= 0 ? '#2A9D6E' : '#C95555' }}>{fmt(kasAkhir)}</span>
                    </div>
                  </div>
                </div>

                {/* Kolom kanan */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', background: '#F5F8FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Pengeluaran</div>
                      {totalPengeluaran > 0 && <span style={{ fontSize: '11px', fontWeight: '700', color: '#C95555' }}>-{fmt(totalPengeluaran)}</span>}
                    </div>
                    <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '120px' }}>
                      {pengeluaran.filter(p => p.barang).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada pengeluaran</div>
                      ) : pengeluaran.filter(p => p.barang).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < pengeluaran.filter(x => x.barang).length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{p.barang}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{p.qty} x {fmt(Number(p.harga))}</div>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#C95555' }}>-{fmt(Number(p.harga) * Number(p.qty || 1))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', background: '#F5F8FE' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Catatan</div>
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                      {catatan ? (
                        <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.5' }}>{catatan}</div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada catatan</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Kolom Kiri: Ringkasan + Kas Akhir */}
              <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Ringkasan Penjualan</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Total Penjualan', value: totalPenjualan, color: '#4A7CC7', bg: '#EBF1FB', border: '#C0D0E8' },
                    { label: 'Cash', value: totalCash, color: '#2A9D6E', bg: '#E8F7F1', border: '#A7DFC8' },
                    { label: 'QRIS', value: totalQris, color: '#6B5BAF', bg: '#EEEAF8', border: '#C8C0E8' },
                    { label: 'Transfer / Non-Tunai', value: totalTransfer, color: '#C47D1A', bg: '#FDF4E3', border: '#F0D090' },
                  ].map(({ label, value, color, bg, border }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color }}>{fmt(value)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '6px 10px', background: '#F5F8FE', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
                  {completed.length} transaksi selesai &nbsp;&middot;&nbsp; {pendingCount} belum bayar
                </div>
                <div style={{ background: 'linear-gradient(135deg, #D8E4F4, #E8EEF8)', borderRadius: '12px', padding: '12px 14px', marginTop: 'auto', border: '1px solid #C0D0E8' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#7A8FAF', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Kalkulasi Kas</div>
                  {[['Kas Awal', fmt(Number(kasAwal) || 0), '#4A5878'], ['+ Penjualan Cash', `+${fmt(totalCash)}`, '#2A9D6E'], ...(totalPengeluaran > 0 ? [['- Pengeluaran', `-${fmt(totalPengeluaran)}`, '#C95555']] : [])].map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#7A8FAF' }}>{label}</span>
                      <span style={{ fontSize: '12px', color }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #C0D0E8', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E2A3B' }}>Total Kas Akhir</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: kasAkhir >= 0 ? '#2A9D6E' : '#C95555' }}>{fmt(kasAkhir)}</span>
                  </div>
                </div>
              </div>
              {/* Kolom Kanan: Laporan Kas */}
              <div style={{ width: '310px', flexShrink: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Laporan Kas</div>
                {/* Pilih Shift */}
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>Shift</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {SHIFTS.map(s => {
                      const done = todayShifts.includes(s.key)
                      const active = shift === s.key
                      return (
                        <button key={s.key} onClick={() => !done && setShift(s.key)}
                          disabled={done}
                          style={{ flex: 1, padding: '7px 4px', borderRadius: '8px', border: `1.5px solid ${active ? 'var(--accent)' : done ? '#E2E8F0' : 'var(--border)'}`, background: active ? 'var(--accent)' : done ? '#F1F5F9' : '#fff', color: active ? '#fff' : done ? '#94A3B8' : 'var(--text2)', fontWeight: '700', fontSize: '11px', cursor: done ? 'not-allowed' : 'pointer', fontFamily: 'inherit', position: 'relative' }}>
                          {s.label.replace('Closing ', '')}
                          {done && <span style={{ display: 'block', fontSize: '9px', fontWeight: '600', color: '#94A3B8' }}>✓ Selesai</span>}
                        </button>
                      )
                    })}
                  </div>
                  {activeShift && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{activeShift.jam}</div>}
                </div>
                {/* Nama yang closing */}
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>Nama yang Closing</label>
                  <input className="input" placeholder="Nama kasir..." value={closerName} onChange={e => setCloserName(e.target.value)} style={{ fontSize: '13px' }} />
                </div>
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>{t('kasAwal')}</label>
                  <input className="input" type="number" placeholder="0" value={kasAwal} onChange={(e) => setKasAwal(e.target.value)} style={{ fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="label" style={{ margin: 0, fontSize: '11px' }}>{t('pengeluaran')}</label>
                    <button type="button" onClick={addPengeluaran} style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid #C7D4F0', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>+ Tambah</button>
                  </div>
                  {pengeluaran.length === 0 && <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '4px 0' }}>Belum ada pengeluaran</div>}
                  <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {pengeluaran.map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input className="input" placeholder="Nama barang" value={p.barang} onChange={(e) => updatePengeluaran(i, 'barang', e.target.value)} style={{ flex: 2, fontSize: '11px', padding: '6px 8px' }} />
                        <input className="input" type="number" placeholder="Qty" value={p.qty} onChange={(e) => updatePengeluaran(i, 'qty', e.target.value)} style={{ flex: '0 0 44px', fontSize: '11px', padding: '6px 6px' }} />
                        <input className="input" type="number" placeholder="Harga" value={p.harga} onChange={(e) => updatePengeluaran(i, 'harga', e.target.value)} style={{ flex: 2, fontSize: '11px', padding: '6px 8px' }} />
                        <button onClick={() => setPengeluaran(prev => prev.filter((_, n) => n !== i))} style={{ background: 'var(--red-light)', border: '1px solid #FECACA', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '6px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" style={{ fontSize: '11px' }}>{t('catatan')} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>{t('opsional')}</span></label>
                  <textarea className="input" rows={2} placeholder="Catatan tambahan..." value={catatan} onChange={(e) => setCatatan(e.target.value)} style={{ resize: 'none', fontSize: '12px' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div style={{ padding: '11px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Batal</button>
            <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Laporan Closing'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Checkout Modal ──
function CheckoutModal({ cart, total, onClose, onSuccess, existingOrderId }) {
  const [payMethod, setPayMethod] = useState('CASH')
  const [payment, setPayment] = useState('')
  const [payLater, setPayLater] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [tx, setTx] = useState(null)
  const [printing, setPrinting] = useState(false)

  const paid = Number(payment) || 0
  const change = payMethod === 'CASH' && !payLater ? paid - total : 0
  const methods = ['CASH', 'QRIS', 'TRANSFER']

  function numpadPress(val) {
    if (payLater) return
    if (val === 'C') { setPayment(''); return }
    if (val === '⌫') { setPayment((p) => p.slice(0, -1)); return }
    if (val === '000') { setPayment((p) => (p === '' ? '' : p + '000')); return }
    setPayment((p) => (p.length >= 10 ? p : p + val))
  }

  async function checkout(later = false) {
    if (!later && payMethod === 'CASH' && paid < total) return alert('Uang bayar kurang')
    // Optimistic: langsung tampil sukses
    const optimisticTx = {
      id: `opt_${Date.now()}`,
      invoiceNo: `BK-${Date.now()}`,
      total, change: payMethod === 'CASH' && !later ? paid - total : 0,
      payment: later ? 0 : (payMethod === 'CASH' ? paid : total),
      payMethod, status: later ? 'PENDING' : 'COMPLETED',
      servedAt: null, createdAt: new Date().toISOString(),
      customerName, note,
      cashier: { name: '' },
      items: cart.map((i) => ({ qty: i.qty, price: i.product.price, subtotal: i.product.price * i.qty, product: { name: i.product.name, imageUrl: i.product.imageUrl } })),
    }
    if (!existingOrderId) setTx(optimisticTx)
    setLoading(true)
    try {
      if (existingOrderId) {
        const res = await api.patch(`/transactions/${existingOrderId}`, {
          payment: later ? 0 : (payMethod === 'CASH' ? paid : total),
          payMethod, total,
        })
        setTx({ ...optimisticTx, invoiceNo: existingOrderId, ...res.data })
      } else {
        const items = cart.map((i) => {
          const o = { qty: i.qty, price: i.product.price }
          if (i.product.id.startsWith('manual_')) {
            o.name = i.product.name
            o.category = i.product.category?.name || ''
          } else {
            o.productId = i.product.id
            o.name = i.product.name
            o.category = i.product.category?.name || ''
          }
          return o
        })
        const res = await api.post('/transactions', {
          items,
          payment: later ? 0 : (payMethod === 'CASH' ? paid : total),
          payMethod, payLater: later, customerName, note,
        })
        setTx(res.data)
      }
    } catch (e) {
      setTx(null)
      alert(e.response?.data?.message || 'Gagal menyimpan transaksi')
    } finally { setLoading(false) }
  }

  async function handlePrint() {
    if (!tx) return
    setPrinting(true)
    try { await printThermal(tx) } catch (e) { alert('Gagal cetak: ' + e.message) }
    finally { setPrinting(false) }
  }

  const numKeys = ['7','8','9','4','5','6','1','2','3','000','0','⌫']

  if (tx) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="card fade-in" style={{ width: '400px', padding: '32px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: 'var(--green-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>✓</div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px' }}>Transaksi Berhasil!</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'monospace', marginBottom: '20px' }}>{tx.invoiceNo}</div>
        <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
          {cart.map((item) => (
            <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span>{item.product.name} ×{item.qty}</span>
              <span style={{ fontWeight: '600' }}>Rp {fmt(item.product.price * item.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
            <span>Total</span><span style={{ color: 'var(--accent)' }}>Rp {fmt(tx.total)}</span>
          </div>
          {payMethod === 'CASH' && tx.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px', color: 'var(--green)' }}><span>Kembalian</span><span style={{ fontWeight: '700' }}>Rp {fmt(tx.change)}</span></div>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSuccess(tx)}>Selesai</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={printing} onClick={handlePrint}>
            {printing ? '⏳ Mencetak...' : '🖨️ Print Struk'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,21,38,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '820px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', fontWeight: '800' }}>Checkout</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Body 2 kolom */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Kiri: Info + Items */}
          <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
            {/* Nama + Catatan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label className="label">{t('namaPembeli')}</label>
                <input className="input" placeholder="Nama pelanggan" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('catatan')}</label>
                <input className="input" placeholder="Tanpa es, extra shot..." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            {/* Items */}
            <div className="section-label">Pesanan</div>
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '14px', overflow: 'hidden' }}>
              {cart.map((item, i) => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < cart.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text2)' }}>{item.product.name} <span style={{ color: 'var(--muted)' }}>×{item.qty}</span></span>
                  <span style={{ fontWeight: '700' }}>Rp {fmt(item.product.price * item.qty)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>Total</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent)' }}>Rp {fmt(total)}</span>
              </div>
              {payMethod === 'CASH' && !payLater && paid > 0 && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>
                  <span>Bayar</span><span>Rp {fmt(paid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: change >= 0 ? 'var(--green)' : 'var(--red)', marginTop: '4px' }}>
                  <span>Kembalian</span><span>Rp {fmt(Math.max(0, change))}</span>
                </div>
              </>}
            </div>
          </div>

          {/* Kanan: Metode + Numpad + Tombol */}
          <div style={{ width: '300px', flexShrink: 0, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            {/* Metode */}
            <div>
              <div className="section-label">Metode Pembayaran</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {methods.map((m) => (
                  <button key={m} onClick={() => { setPayMethod(m); setPayment(''); setPayLater(false) }}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: '9px', border: `1.5px solid ${payMethod === m && !payLater ? 'var(--accent)' : 'var(--border)'}`, background: payMethod === m && !payLater ? 'var(--accent)' : '#fff', color: payMethod === m && !payLater ? '#fff' : 'var(--text2)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Display nominal */}
            <div style={{ background: '#0F172A', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>{payLater ? 'BAYAR NANTI' : 'NOMINAL BAYAR'}</div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: payLater ? '#F59E0B' : '#F1F5F9', letterSpacing: '1px', minHeight: '36px', textAlign: 'right' }}>
                {payLater ? 'Bon / Hutang' : (payment ? `Rp ${Number(payment).toLocaleString('id-ID')}` : 'Rp 0')}
              </div>
              {payMethod === 'CASH' && !payLater && paid > 0 && (
                <div style={{ fontSize: '13px', fontWeight: '700', color: change >= 0 ? '#10B981' : '#EF4444', textAlign: 'right', marginTop: '4px' }}>
                  Kembali: Rp {fmt(Math.max(0, change))}
                </div>
              )}
            </div>

            {/* Numpad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {numKeys.map((k) => (
                <button key={k} onClick={() => numpadPress(k)}
                  style={{ padding: '14px 0', borderRadius: '10px', border: '1px solid var(--border)', background: k === '⌫' ? '#FEF2F2' : k === 'C' ? '#FEF2F2' : '#fff', color: k === '⌫' || k === 'C' ? 'var(--red)' : 'var(--text)', fontSize: k === '⌫' ? '18px' : '16px', fontWeight: '700', cursor: payLater ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: payLater ? 0.4 : 1, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!payLater) e.currentTarget.style.background = '#F1F5F9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = k === '⌫' || k === 'C' ? '#FEF2F2' : '#fff' }}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Tombol aksi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => checkout(false)}
                disabled={(payMethod === 'CASH' && !payLater && paid < total) || payLater}
                style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', opacity: ((payMethod === 'CASH' && paid < total) || payLater) ? 0.5 : 1 }}>
                {`Bayar Rp ${fmt(total)}`}
              </button>
              <button
                onClick={() => checkout(true)}
                disabled={loading}
                style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1.5px solid #FDE68A', background: '#FFFBEB', color: '#92400E', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                ⏳ Bayar Nanti (Bon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

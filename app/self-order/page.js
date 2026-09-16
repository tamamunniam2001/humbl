'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

const fmt = (n) => Number(n).toLocaleString('id-ID')

// ── Design tokens ─────────────────────────────────────────────────────────────
// Brand ink & paper (kept close to the original brand brown so the checkout /
// tracker screens still feel like the same shop)
const A = '#6F4E37'       // coffee brown — primary buttons, price, active state
const AL = '#FDF6EF'      // pale wash of A
const AB = '#E8D5C0'      // border wash of A
const GRAY = '#9CA3AF'
const GRAY2 = '#6B7280'
const BORDER = '#F0EBE3'
const BG = '#FAFAFA'
const WHITE = '#FFFFFF'
const TEXT = '#1C1209'
const TEXT2 = '#4B3A2A'

// New tokens for the "roastery ticket" menu identity
const INK = '#241509'          // near-black espresso, headline ink
const PAPER = '#F6F0E6'        // warm kraft-paper background for the menu
const PAPER2 = '#FFFDF9'       // card/row surface, slightly warmer than white
const HAIRLINE = '#E4D8C6'     // dotted rule / divider colour
const GOLD = '#A9762F'         // brass accent — "new" + premium touches
const SERIF = "'Fraunces',Georgia,serif"
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace"

// Section identity — each sub-menu gets its own ink so the list reads like a
// set of stamped ticket sections rather than one flat catalogue
const SECTION_META = {
  new:       { label: 'Ada yang Baru',  caption: 'Baru ditambahkan',      color: '#2F7566' },
  best:      { label: 'Best Seller',    caption: 'Paling sering dipesan', color: GOLD },
  coffee:    { label: 'Coffee',         caption: 'Racikan kopi kami',     color: '#4A3222' },
  noncoffee: { label: 'Non Coffee',     caption: 'Susu, teh & segar-segar', color: '#3F6657' },
  snack:     { label: 'Snack',          caption: 'Teman ngobrol',         color: '#B5651D' },
  kenyang:   { label: 'Kenyang',        caption: 'Biar makin puas',       color: '#7A4B23' },
  lainnya:   { label: 'Lainnya',        caption: 'Menu lainnya',          color: TEXT2 },
}

// Classify a product's own category name into one of our four "kitchen"
// sections. Backend category names vary, so this matches loosely on keywords.
// "Ada yang Baru" / "Best Seller" are separate flags (see below) — a product
// can appear there *and* in its normal kitchen section at the same time.
function classifyCategory(p) {
  const raw = (p.category?.name || '').toLowerCase()
  const has = (arr) => arr.some(k => raw.includes(k))
  if (has(['non coffee', 'non-coffee', 'noncoffee', 'non kopi'])) return 'noncoffee'
  if (has(['coffee', 'kopi', 'espresso', 'latte', 'americano'])) return 'coffee'
  if (has(['snack', 'cemilan', 'gorengan', 'dessert', 'kue', 'roti', 'pastry', 'cookie'])) return 'snack'
  if (has(['kenyang', 'nasi', 'rice', 'main course', 'mie', 'noodle', 'pasta', 'berat'])) return 'kenyang'
  if (has(['tea', 'teh', 'juice', 'jus', 'squash', 'soda', 'milk', 'susu', 'chocolate', 'coklat', 'mocktail'])) return 'noncoffee'
  return 'lainnya'
}

// ── QR Code display component ────────────────────────────────────────────────
function QrisPanel({ orderId, total, onPaid }) {
  const [qris, setQris] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [checking, setChecking] = useState(false)
  const [countdown, setCountdown] = useState('')

  const loadQris = useCallback(async () => {
    setLoading(true)
    try {
      // Coba ambil QR yang sudah ada dulu, jika belum ada generate baru
      const r = await fetch(`/api/self-orders/${orderId}`)
      const orderData = await r.json()
      if (orderData.qrisUrl || orderData.qrisString || orderData.dokuPaymentUrl) {
        setQris({
          qrisUrl: orderData.qrisUrl,
          qrisString: orderData.qrisString,
          paymentUrl: orderData.dokuPaymentUrl,
          expiredAt: orderData.qrisExpiredAt,
        })
      } else {
        // Generate baru
        const pr = await fetch(`/api/self-orders/${orderId}/pay`, { method: 'POST' })
        const pdata = await pr.json()
        if (!pr.ok) throw new Error(pdata.message || 'Gagal generate QRIS')
        setQris({
          qrisUrl: pdata.qrisUrl || '',
          qrisString: pdata.qrisString || '',
          paymentUrl: pdata.paymentUrl || '',
          expiredAt: pdata.expiredAt,
        })
      }
    } catch (e) { alert('Gagal memuat QRIS: ' + e.message) }
    finally { setLoading(false) }
  }, [orderId])

  useEffect(() => { loadQris() }, [loadQris])

  // Countdown timer
  useEffect(() => {
    if (!qris?.expiredAt) return
    const iv = setInterval(() => {
      const diff = new Date(qris.expiredAt).getTime() - Date.now()
      if (diff <= 0) { setExpired(true); clearInterval(iv); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}:${String(s).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(iv)
  }, [qris?.expiredAt])

  // Auto-check status setiap 5 detik
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/self-orders/${orderId}/check`)
        const data = await r.json()
        if (data.paid) { clearInterval(iv); onPaid() }
      } catch {}
    }, 5000)
    return () => clearInterval(iv)
  }, [orderId, onPaid])

  async function handleCheckManual() {
    setChecking(true)
    try {
      const r = await fetch(`/api/self-orders/${orderId}/check`)
      const data = await r.json()
      if (data.paid) onPaid()
      else alert('Pembayaran belum diterima. Coba beberapa saat lagi.')
    } catch { alert('Gagal cek status') }
    finally { setChecking(false) }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontSize: '14px', color: GRAY2 }}>Memuat QRIS...</div>
    </div>
  )

  if (expired) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>QRIS Kadaluarsa</div>
      <button onClick={() => { setExpired(false); setQris(null); loadQris() }} style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: A, color: '#fff', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>Generate Ulang</button>
    </div>
  )

  return (
    <div style={{ textAlign: 'center' }}>
      {/* QR Image */}
      {qris?.qrisUrl ? (
        <div style={{ display: 'inline-block', padding: '12px', background: WHITE, borderRadius: '16px', border: `2px solid ${AB}`, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '14px' }}>
          <img src={qris.qrisUrl} alt="QRIS" style={{ width: '200px', height: '200px', display: 'block' }} />
        </div>
      ) : qris?.qrisString ? (
        <div style={{ display: 'inline-block', padding: '12px', background: WHITE, borderRadius: '16px', border: `2px solid ${AB}`, marginBottom: '14px' }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qris.qrisString)}`} alt="QRIS" style={{ width: '200px', height: '200px', display: 'block' }} />
        </div>
      ) : qris?.paymentUrl ? (
        <a href={qris.paymentUrl} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '14px', borderRadius: '14px', background: A, color: '#fff', fontWeight: '800', fontSize: '15px', textDecoration: 'none', marginBottom: '14px' }}>Buka Halaman Pembayaran →</a>
      ) : null}

      <div style={{ fontSize: '13px', color: GRAY2, marginBottom: '4px' }}>Scan QR dengan aplikasi apapun</div>
      <div style={{ fontSize: '22px', fontWeight: '900', color: A, marginBottom: '4px' }}>Rp {fmt(total)}</div>
      {countdown && <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '600', marginBottom: '14px' }}>Berlaku {countdown}</div>}

      <button onClick={handleCheckManual} disabled={checking} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: `1.5px solid ${AB}`, background: AL, color: A, fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {checking ? 'Mengecek...' : 'Cek Status Pembayaran'}
      </button>
      <div style={{ fontSize: '11px', color: GRAY, marginTop: '8px' }}>Status dicek otomatis setiap 5 detik</div>
    </div>
  )
}

// ── Order Tracker ────────────────────────────────────────────────────────────
function OrderTracker({ orderId, paymentMethod = 'QRIS', onBack }) {
  const [order, setOrder] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchOrder = useCallback(async () => {
    try { const r = await fetch(`/api/self-orders/${orderId}`); setOrder(await r.json()) } catch {}
  }, [orderId])

  useEffect(() => {
    fetchOrder()
    const iv = setInterval(() => { fetchOrder(); setTick(t => t + 1) }, 3000)
    return () => clearInterval(iv)
  }, [fetchOrder])

  const dots = '.'.repeat((tick % 3) + 1)
  const cfg = {
    PENDING:   { label: '···', title: 'Menunggu Konfirmasi', sub: `Pesananmu sedang ditinjau kasir${dots}`, accent: '#D97706', bg: '#FFFBEB', border: '#FDE68A', step: 0 },
    APPROVED:  { label: paymentMethod === 'QRIS' ? 'QR' : 'Rp', title: paymentMethod === 'QRIS' ? 'Scan & Bayar' : 'Bayar ke Kasir', sub: paymentMethod === 'QRIS' ? 'Scan QR code di bawah untuk menyelesaikan pembayaran' : 'Silakan bayar tunai ke kasir kami', accent: '#059669', bg: '#ECFDF5', border: '#6EE7B7', step: 1 },
    REJECTED:  { label: '×', title: 'Pesanan Ditolak', sub: 'Maaf, pesanan tidak bisa diproses. Silahkan order ulang.', accent: '#DC2626', bg: '#FEF2F2', border: '#FECACA', step: 1 },
    COMPLETED: { label: '✓', title: 'Pembayaran Berhasil!', sub: 'Terima kasih! Pesananmu sedang diproses.', accent: '#059669', bg: '#ECFDF5', border: '#6EE7B7', step: 2 },
  }
  const c = cfg[order?.status || 'PENDING']

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ping{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.8);opacity:0}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* Header */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${BORDER}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '800', color: TEXT }}>Humbl</div>
          <div style={{ fontSize: '11px', color: GRAY, marginTop: '1px' }}>Status Pesanan</div>
        </div>
      </div>

      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 20px', animation: 'fadeUp .5s cubic-bezier(0.22,1,0.36,1)' }}>
        {/* Status card */}
        <div style={{ background: WHITE, borderRadius: '24px', border: `1.5px solid ${c.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '28px 24px', textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ position: 'relative', width: '68px', height: '68px', margin: '0 auto 18px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c.border, animation: 'ping 2.4s cubic-bezier(0,0,.2,1) infinite' }} />
            <div style={{ position: 'relative', width: '68px', height: '68px', borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: c.accent, fontFamily: SERIF }}>{c.label}</div>
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: TEXT, marginBottom: '6px' }}>{c.title}</div>
          <div style={{ fontSize: '13px', color: GRAY2, lineHeight: 1.7 }}>{c.sub}</div>
          {order && <div style={{ marginTop: '10px', fontSize: '11px', color: A, fontFamily: 'monospace', letterSpacing: '2px', fontWeight: '600' }}>#{order.orderNo}</div>}
        </div>

        {/* Payment Section — tampil jika APPROVED */}
        {order?.status === 'APPROVED' && (
          <div style={{ background: WHITE, borderRadius: '20px', border: `1.5px solid ${AB}`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '14px' }}>
            {paymentMethod === 'QRIS' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: TEXT }}>Bayar dengan QRIS</div>
                  <div style={{ fontSize: '11px', color: GRAY }}>Scan & bayar dalam 10 menit</div>
                </div>
                <QrisPanel orderId={orderId} total={order.total} onPaid={fetchOrder} />
              </>
            )}
            {paymentMethod === 'CASH' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: TEXT, marginBottom: '6px' }}>Bayar Tunai ke Kasir</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: A, marginBottom: '8px' }}>Rp {fmt(order.total)}</div>
                <div style={{ fontSize: '12px', color: GRAY2, lineHeight: 1.7 }}>Tunjukkan nomor pesanan <strong style={{ color: A }}>#{order.orderNo}</strong> ke kasir dan lakukan pembayaran tunai.</div>
              </div>
            )}

          </div>
        )}

        {/* Detail order */}
        {order && (
          <div style={{ background: WHITE, borderRadius: '18px', border: `1px solid ${BORDER}`, padding: '16px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: GRAY, letterSpacing: '1px', textTransform: 'uppercase' }}>Detail Pesanan</span>
              {order.tableNo && <span style={{ fontSize: '11px', fontWeight: '700', color: A, background: AL, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${AB}` }}>Meja {order.tableNo}</span>}
            </div>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < order.items.length - 1 ? `1px solid ${BORDER}` : 'none', fontSize: '13px' }}>
                <span style={{ color: TEXT2 }}>{item.name} <span style={{ color: GRAY }}>×{item.qty}</span></span>
                <span style={{ fontWeight: '600', color: TEXT }}>Rp {fmt(item.subtotal)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: TEXT2 }}>Total</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: A }}>Rp {fmt(order.total)}</span>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          {['Order', 'Bayar', 'Selesai'].map((label, i) => {
            const done = i <= c.step
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: done ? A : '#F3F4F6', border: `1.5px solid ${done ? A : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s' }}>
                    {done ? <span style={{ fontSize: '11px', color: '#fff', fontWeight: '700' }}>✓</span>
                    : <span style={{ fontSize: '11px', color: GRAY, fontWeight: '700' }}>{i + 1}</span>}
                  </div>
                  <span style={{ fontSize: '10px', color: done ? A : GRAY, fontWeight: done ? '700' : '400' }}>{label}</span>
                </div>
                {i < 2 && <div style={{ width: '30px', height: '1.5px', background: i < c.step ? A : '#E5E7EB', margin: '0 4px', marginBottom: '18px', transition: 'background .3s' }} />}
              </div>
            )
          })}
        </div>

        {(order?.status === 'REJECTED' || order?.status === 'COMPLETED') && (
          <button onClick={onBack} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 6px 20px ${A}40` }}>
            {order.status === 'REJECTED' ? 'Order Ulang' : 'Order Lagi'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Item monogram (replaces product photo) ──────────────────────────────────
function ItemMonogram({ name, color, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '12px', flexShrink: 0,
      background: `${color}14`, border: `1.5px solid ${color}3D`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontFamily: SERIF, fontWeight: 600, fontSize: size * 0.42,
    }}>
      {initial}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SelfOrderPage() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [tableNo, setTableNo] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('QRIS')
  const [submitting, setSubmitting] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [splash, setSplash] = useState(true)
  const [activeNav, setActiveNav] = useState(null)
  const headerRef = useRef(null)
  const navRef = useRef(null)

  // Customer state
  const [customer, setCustomer] = useState(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [phoneStep, setPhoneStep] = useState('phone')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/public')
        const data = await r.json()
        const active = (Array.isArray(data) ? data : []).filter(p => p.isActive !== false)
        setProducts(active)
      } catch {}
      setLoading(false)
    }
    load()
    const t = setTimeout(() => setSplash(false), 1800)
    // Auto-login dari cache
    const cached = localStorage.getItem('so_phone')
    if (cached) {
      setPhoneInput(cached)
      fetch(`/api/customers/${cached.replace(/\D/g,'')}/orders`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setCustomer(data); if (data.name) setCustomerName(data.name) } })
        .catch(() => {})
    }
    return () => clearTimeout(t)
  }, [])

  async function refreshCustomer() {
    if (!customer?.phone) return
    try {
      const r = await fetch(`/api/customers/${customer.phone}/orders`)
      if (r.ok) setCustomer(await r.json())
    } catch {}
  }

  async function handlePhoneSubmit(e) {
    e.preventDefault()
    const digits = phoneInput.replace(/\D/g, '')
    if (digits.length < 9) { setPhoneError('Nomor telepon tidak valid'); return }
    setPhoneError('')
    setPhoneLoading(true)
    try {
      const r = await fetch(`/api/customers/${digits}/orders`)
      if (r.ok) {
        const data = await r.json()
        setCustomer(data)
        if (data.name) setCustomerName(data.name)
        localStorage.setItem('so_phone', digits)
      } else {
        setPhoneStep('name')
      }
    } catch { setPhoneError('Gagal terhubung, coba lagi') }
    finally { setPhoneLoading(false) }
  }

  async function handleNameSubmit(e) {
    e.preventDefault()
    setPhoneLoading(true)
    try {
      const r = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, name: nameInput }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.message)
      setCustomer(data)
      setCustomerName(nameInput)
      localStorage.setItem('so_phone', phoneInput.replace(/\D/g, ''))
    } catch (err) { setPhoneError(err.message || 'Gagal mendaftar') }
    finally { setPhoneLoading(false) }
  }

  const addToCart = useCallback((product) => {
    if (product.stock <= 0) return
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }, [])

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0))
  }, [])

  const qtyOf = (id) => cart.find(i => i.product.id === id)?.qty || 0
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const totalQty = cart.reduce((s, i) => s + i.qty, 0)

  // Search matches against name/code regardless of section
  const searched = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q))
  }, [products, search])

  // Build the 6 (or 7) sub-menus. "new" / "best" read explicit flags from the
  // product record (p.isNew / p.isBestSeller) — a product can live in one of
  // those *and* its kitchen section at the same time, which is normal for a
  // menu that wants to spotlight things.
  const sections = useMemo(() => {
    const buckets = { new: [], best: [], coffee: [], noncoffee: [], snack: [], kenyang: [], lainnya: [] }
    for (const p of products) {
      if (p.isNew) buckets.new.push(p)
      if (p.isBestSeller) buckets.best.push(p)
      buckets[classifyCategory(p)].push(p)
    }
    return Object.entries(buckets)
      .map(([key, items]) => ({ key, items, ...SECTION_META[key] }))
      .filter(s => s.items.length > 0)
  }, [products])

  function scrollToSection(key) {
    setActiveNav(key)
    const el = document.getElementById(`sec-${key}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmitOrder() {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/self-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, customerName, note, paymentMethod, customerId: customer?.id || null, items: cart.map(i => ({ productId: i.product.id, name: i.product.name, price: i.product.price, qty: i.qty, imageUrl: i.product.imageUrl || null })) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.message)

      // Generate QR langsung karena status sudah APPROVED
      if (paymentMethod === 'QRIS') {
        await fetch(`/api/self-orders/${data.id}/pay`, { method: 'POST' })
      }

      setActiveOrderId(data.id)
      setCart([]); setCheckoutOpen(false); setCartOpen(false)
    } catch (e) { alert(e.message || 'Gagal mengirim order') }
    finally { setSubmitting(false) }
  }

  if (activeOrderId) return <OrderTracker orderId={activeOrderId} paymentMethod={paymentMethod} onBack={() => {
    setActiveOrderId(null); setTableNo(''); setCustomerName(customer?.name || ''); setNote(''); setPaymentMethod('QRIS')
    refreshCustomer()
  }} />

  // Phone gate — tampil jika belum ada customer
  if (!customer) return (
    <div style={{ minHeight: '100dvh', background: PAPER, fontFamily: "'Inter',system-ui,sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;600;700;800;900&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}input:focus{outline:none;border-color:${A}!important;box-shadow:0 0 0 3px ${A}18}`}</style>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontFamily: SERIF, fontWeight: 600, color: INK }}>Humbl</div>
          <div style={{ fontSize: '11px', color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Self Order</div>
        </div>

        {phoneStep === 'phone' ? (
          <form onSubmit={handlePhoneSubmit}>
            <div style={{ marginBottom: '8px', fontSize: '15px', fontWeight: '700', color: INK }}>Masukkan nomor telepon kamu</div>
             <input
              type="tel" value={phoneInput} onChange={e => { setPhoneInput(e.target.value); setPhoneError('') }}
              placeholder="08xxxxxxxxxx" autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${phoneError ? '#EF4444' : HAIRLINE}`, background: PAPER2, color: INK, fontSize: '16px', fontFamily: 'inherit', marginBottom: '8px' }}
            />
            {phoneError && <div style={{ fontSize: '12px', color: '#EF4444', marginBottom: '8px' }}>{phoneError}</div>}
            <button type="submit" disabled={phoneLoading || !phoneInput.trim()}
              style={{ width: '100%', padding: '15px', borderRadius: '14px', border: 'none', background: phoneLoading || !phoneInput.trim() ? '#D1D5DB' : A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: phoneLoading || !phoneInput.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {phoneLoading ? 'Memproses...' : 'Lanjutkan →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleNameSubmit}>
            <div style={{ marginBottom: '8px', fontSize: '15px', fontWeight: '700', color: INK }}>Halo, pelanggan baru! 👋</div>
            <div style={{ fontSize: '12px', color: GRAY2, marginBottom: '20px' }}>Siapa nama panggilanmu?</div>
            <input
              type="text" value={nameInput} onChange={e => { setNameInput(e.target.value); setPhoneError('') }}
              placeholder="Nama panggilanmu" autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${phoneError ? '#EF4444' : HAIRLINE}`, background: PAPER2, color: INK, fontSize: '16px', fontFamily: 'inherit', marginBottom: '8px' }}
            />
            {phoneError && <div style={{ fontSize: '12px', color: '#EF4444', marginBottom: '8px' }}>{phoneError}</div>}
            <button type="submit" disabled={phoneLoading || !nameInput.trim()}
              style={{ width: '100%', padding: '15px', borderRadius: '14px', border: 'none', background: phoneLoading || !nameInput.trim() ? '#D1D5DB' : A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: phoneLoading || !nameInput.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {phoneLoading ? 'Mendaftar...' : 'Mulai Order →'}
            </button>
            <button type="button" onClick={() => { setPhoneStep('phone'); setPhoneError('') }}
              style={{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '14px', border: `1.5px solid ${HAIRLINE}`, background: 'transparent', color: GRAY2, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Ganti nomor
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // shared input style
  const inp = { width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1.5px solid ${HAIRLINE}`, background: PAPER2, color: INK, fontSize: '14px', fontFamily: 'inherit', outline: 'none' }

  // ── one menu row (used inside every section) ──
  function MenuRow({ p, accent }) {
    const qty = qtyOf(p.id)
    const oos = p.stock <= 0
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px',
        borderBottom: `1px dashed ${HAIRLINE}`, opacity: oos ? 0.5 : 1,
      }}>
        <ItemMonogram name={p.name} color={accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: INK, fontFamily: SERIF, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.name}</span>
            {p.isNew && <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: SECTION_META.new.color, background: `${SECTION_META.new.color}17`, padding: '2px 7px', borderRadius: '20px', textTransform: 'uppercase' }}>Baru</span>}
            {p.isBestSeller && <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: SECTION_META.best.color, background: `${SECTION_META.best.color}17`, padding: '2px 7px', borderRadius: '20px', textTransform: 'uppercase' }}>Best</span>}
          </div>
          {oos ? (
            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: '700', marginTop: '2px' }}>Stok habis</div>
          ) : (
            <div style={{ fontSize: '11px', color: GRAY2, marginTop: '2px' }}>{p.category?.name || '—'}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{ fontFamily: MONO, fontSize: '13px', fontWeight: '600', color: A }}>Rp {fmt(p.price)}</span>
          {oos ? null : qty === 0 ? (
            <button onClick={() => addToCart(p)} style={{ padding: '5px 12px', borderRadius: '8px', border: `1.3px solid ${AB}`, background: AL, color: A, fontSize: '11px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', background: AL, borderRadius: '8px', border: `1.3px solid ${AB}`, overflow: 'hidden' }}>
              <button onClick={() => removeFromCart(p.id)} style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', color: A, fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: '800', fontSize: '12px', color: TEXT }}>{qty}</span>
              <button onClick={() => addToCart(p)} style={{ width: '26px', height: '26px', border: 'none', background: A, color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: PAPER, fontFamily: "'Inter',system-ui,sans-serif", color: INK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes splashOut{0%{opacity:1;transform:scale(1)}85%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04);pointer-events:none}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:0;height:0}
        input:focus,textarea:focus{outline:none;border-color:${A}!important;box-shadow:0 0 0 3px ${A}18}
        .navchip{scroll-snap-align:start}
        section[id^="sec-"]{scroll-margin-top:118px}
      `}</style>

      {/* Splash */}
      {splash && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'splashOut 2s cubic-bezier(0.4,0,0.2,1) forwards', pointerEvents: 'none' }}>
          <div style={{ fontSize: '20px', fontFamily: SERIF, fontWeight: 600, letterSpacing: '1px', color: INK, marginBottom: '4px' }}>Humbl</div>
          <div style={{ fontSize: '11px', color: GOLD, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Self Order</div>
        </div>
      )}

      {/* Header */}
      <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(246,240,230,0.92)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${HAIRLINE}`, padding: '14px 20px 12px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '19px', fontWeight: 600, fontFamily: SERIF, color: INK, lineHeight: 1.1 }}>Humbl</div>
            <div style={{ fontSize: '10.5px', color: GOLD, marginTop: '2px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700 }}>Pilih menu favoritmu</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setHistoryOpen(true)} style={{ padding: '8px 13px', borderRadius: '12px', border: `1.5px solid ${HAIRLINE}`, background: PAPER2, color: TEXT2, fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>📋 Riwayat</button>
            <button onClick={() => setCartOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: totalQty > 0 ? '9px 16px' : '9px 13px', borderRadius: '14px', border: `1.5px solid ${totalQty > 0 ? AB : HAIRLINE}`, background: totalQty > 0 ? AL : PAPER2, cursor: 'pointer', color: totalQty > 0 ? A : GRAY2, transition: 'all .25s cubic-bezier(0.22,1,0.36,1)', fontFamily: 'inherit', boxShadow: totalQty > 0 ? `0 2px 12px ${A}20` : 'none' }}>
              {totalQty > 0 ? (
                <>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{totalQty} item</span>
                  <div style={{ width: '1px', height: '13px', background: AB }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', fontFamily: MONO }}>Rp {fmt(total)}</span>
                </>
              ) : (
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Keranjang</span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..." style={inp} />
        </div>

        {/* Section quick-nav */}
        {!searched && (
          <div ref={navRef} style={{ maxWidth: '640px', margin: '10px auto 0', display: 'flex', gap: '8px', overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: '2px' }}>
            {sections.map(s => (
              <button key={s.key} className="navchip" onClick={() => scrollToSection(s.key)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '20px',
                border: `1.4px solid ${activeNav === s.key ? s.color : HAIRLINE}`,
                background: activeNav === s.key ? `${s.color}12` : PAPER2,
                color: activeNav === s.key ? s.color : TEXT2,
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all .2s',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4px 20px 110px' }}>

        {loading ? (
          <div style={{ paddingTop: '18px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ borderRadius: '12px', height: '58px', marginBottom: '10px', background: 'linear-gradient(90deg,#EFE7D8 25%,#F8F2E8 50%,#EFE7D8 75%)', backgroundSize: '800px 100%', animation: `shimmer 1.6s ease-in-out infinite`, animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : searched ? (
          // ── Flat search results ──
          <div style={{ paddingTop: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: GRAY2, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
              {searched.length} hasil untuk "{search}"
            </div>
            {searched.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: GRAY }}>
                <div style={{ fontSize: '14px' }}>Menu tidak ditemukan</div>
              </div>
            ) : searched.map(p => (
              <MenuRow key={p.id} p={p} accent={SECTION_META[classifyCategory(p)].color} />
            ))}
          </div>
        ) : (
          // ── Sectioned menu ──
          sections.map(s => (
            <section key={s.key} id={`sec-${s.key}`} style={{ paddingTop: '22px' }}>
              <div style={{ marginBottom: '4px', paddingBottom: '8px', borderBottom: `1.5px solid ${s.color}40` }}>
                <div style={{ fontSize: '17px', fontWeight: 600, fontFamily: SERIF, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: GRAY2 }}>{s.caption} · {s.items.length} pilihan</div>
              </div>
              <div>
                {s.items.map(p => <MenuRow key={`${s.key}-${p.id}`} p={p} accent={s.color} />)}
              </div>
            </section>
          ))
        )}
      </div>

      {/* FAB */}
      {totalQty > 0 && !cartOpen && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, width: 'calc(100% - 40px)', maxWidth: '600px', animation: 'fadeUp .4s cubic-bezier(0.22,1,0.36,1)' }}>
          <button onClick={() => setCartOpen(true)} style={{ width: '100%', padding: '17px 24px', borderRadius: '18px', border: 'none', background: A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: `0 8px 28px ${A}45` }}>
            <span>{totalQty} item dipilih</span>
            <span style={{ fontFamily: MONO }}>Rp {fmt(total)} →</span>
          </button>
        </div>
      )}

      {/* Cart Sheet */}
      {cartOpen && (
        <>
          <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, backdropFilter: 'blur(4px)', animation: 'fadeIn .25s ease' }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 400, width: '100%', maxWidth: '640px', background: PAPER2, borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp .45s cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: '#E5E7EB' }} />
            </div>
            <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '17px', fontWeight: 600, fontFamily: SERIF, color: INK }}>Pesanan Saya</div>
              <button onClick={() => setCartOpen(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: GRAY2, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {cart.map((item) => (
                <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderBottom: `1px dashed ${HAIRLINE}` }}>
                  <ItemMonogram name={item.product.name} color={SECTION_META[classifyCategory(item.product)].color} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: INK, fontFamily: SERIF, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: A, marginTop: '2px', fontFamily: MONO }}>Rp {fmt(item.product.price)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', background: AL, borderRadius: '10px', border: `1.5px solid ${AB}`, overflow: 'hidden' }}>
                    <button onClick={() => removeFromCart(item.product.id)} style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', color: A, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ width: '28px', textAlign: 'center', fontSize: '14px', fontWeight: '800', color: TEXT }}>{item.qty}</span>
                    <button onClick={() => addToCart(item.product)} style={{ width: '32px', height: '32px', border: 'none', background: A, color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${HAIRLINE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '14px', color: GRAY2 }}>Total</span>
                <span style={{ fontSize: '22px', fontWeight: '900', color: A, fontFamily: MONO }}>Rp {fmt(total)}</span>
              </div>
              <button onClick={() => { setCartOpen(false); setCheckoutOpen(true) }} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 16px ${A}40` }}>
                Lanjutkan →
              </button>
            </div>
          </div>
        </>
      )}

      {/* History Sheet */}
      {historyOpen && (
        <>
          <div onClick={() => { setHistoryOpen(false); setReceiptOrder(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, backdropFilter: 'blur(4px)', animation: 'fadeIn .25s ease' }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 400, width: '100%', maxWidth: '640px', background: PAPER2, borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', maxHeight: '85dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp .45s cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: '#E5E7EB' }} />
            </div>
            <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 600, fontFamily: SERIF, color: INK }}>Riwayat Pesanan</div>
                <div style={{ fontSize: '11px', color: GRAY2, marginTop: '2px' }}>{customer?.name || ''} · {customer?.phone}</div>
              </div>
              <button onClick={() => { setHistoryOpen(false); setReceiptOrder(null) }} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: GRAY2, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            {receiptOrder ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <button onClick={() => setReceiptOrder(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: A, fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', padding: 0 }}>← Kembali ke Riwayat</button>
                <div style={{ background: WHITE, borderRadius: '18px', border: `1px solid ${HAIRLINE}`, overflow: 'hidden' }}>
                  <div style={{ background: A, padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', fontFamily: SERIF, letterSpacing: '1px' }}>HUMBL</div>
                    <div style={{ fontSize: '10px', color: '#fff', opacity: 0.8, marginTop: '2px', letterSpacing: '2px', textTransform: 'uppercase' }}>Struk Digital</div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ color: GRAY2 }}>No. Order</span>
                      <span style={{ fontWeight: '700', color: INK, fontFamily: MONO }}>#{receiptOrder.orderNo}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ color: GRAY2 }}>Tanggal</span>
                      <span style={{ fontWeight: '600', color: INK }}>{new Date(receiptOrder.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {receiptOrder.tableNo && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span style={{ color: GRAY2 }}>Meja</span>
                        <span style={{ fontWeight: '600', color: INK }}>{receiptOrder.tableNo}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px' }}>
                      <span style={{ color: GRAY2 }}>Nama</span>
                      <span style={{ fontWeight: '600', color: INK }}>{receiptOrder.customerName || '-'}</span>
                    </div>
                    <div style={{ borderTop: `1px dashed ${HAIRLINE}`, marginBottom: '12px' }} />
                    {receiptOrder.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: INK }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: GRAY2 }}>{item.qty} × Rp {fmt(item.price)}</div>
                        </div>
                        <span style={{ fontWeight: '700', color: INK, fontFamily: MONO }}>Rp {fmt(item.subtotal)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px dashed ${HAIRLINE}`, margin: '12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: INK }}>Total</span>
                      <span style={{ fontSize: '20px', fontWeight: '900', color: A, fontFamily: MONO }}>Rp {fmt(receiptOrder.total)}</span>
                    </div>
                    <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: GRAY2, lineHeight: 1.8 }}>
                      <div>Terima kasih sudah berkunjung! ☕</div>
                      <div style={{ color: GOLD, fontWeight: '700', marginTop: '2px' }}>Humbl</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                {!customer?.selfOrders?.length ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: GRAY }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
                    <div style={{ fontSize: '14px' }}>Belum ada riwayat pesanan</div>
                  </div>
                ) : customer.selfOrders.map((order) => (
                  <div key={order.id} onClick={() => setReceiptOrder(order)}
                    style={{ background: WHITE, borderRadius: '14px', border: `1px solid ${HAIRLINE}`, padding: '14px 16px', marginBottom: '10px', cursor: 'pointer', transition: 'box-shadow .15s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 16px ${A}18`}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: INK, fontFamily: MONO }}>#{order.orderNo}</div>
                        <div style={{ fontSize: '11px', color: GRAY2, marginTop: '2px' }}>{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: '900', color: A, fontFamily: MONO }}>Rp {fmt(order.total)}</div>
                        <div style={{ fontSize: '10px', color: '#059669', fontWeight: '700', marginTop: '2px' }}>✓ Lunas</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: GRAY2 }}>{order.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: A, fontWeight: '600' }}>Lihat struk →</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Checkout Sheet */}
      {checkoutOpen && (
        <>
          <div onClick={() => setCheckoutOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, backdropFilter: 'blur(4px)', animation: 'fadeIn .25s ease' }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 400, width: '100%', maxWidth: '640px', background: PAPER2, borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp .45s cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: '#E5E7EB' }} />
            </div>
            <div style={{ padding: '0 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '17px', fontWeight: 600, fontFamily: SERIF, color: INK }}>Konfirmasi Pesanan</div>
              <button onClick={() => setCheckoutOpen(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: GRAY2, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {/* Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label htmlFor="tableNo" style={{ fontSize: '11px', fontWeight: '600', color: GRAY2, display: 'block', marginBottom: '5px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Nomor Meja</label>
                  <input id="tableNo" value={tableNo} onChange={e => setTableNo(e.target.value)} placeholder="Cth: 5, A3..." style={inp} />
                </div>
                <div>
                  <label htmlFor="customerName" style={{ fontSize: '11px', fontWeight: '600', color: GRAY2, display: 'block', marginBottom: '5px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Nama Kamu</label>
                  <input id="customerName" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Panggilan kamu" style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="orderNote" style={{ fontSize: '11px', fontWeight: '600', color: GRAY2, display: 'block', marginBottom: '5px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Catatan</label>
                <textarea id="orderNote" value={note} onChange={e => setNote(e.target.value)} placeholder="Tanpa es, extra shot, less sugar..." rows={2} style={{ ...inp, resize: 'none' }} />
              </div>
              {/* Ringkasan */}
              <div style={{ background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: GRAY, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>{totalQty} Item</div>
                {cart.map((item, i) => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < cart.length - 1 ? `1px solid ${HAIRLINE}` : 'none', fontSize: '13px' }}>
                    <span style={{ color: TEXT2 }}>{item.product.name} <span style={{ color: GRAY }}>×{item.qty}</span></span>
                    <span style={{ fontWeight: '600', color: TEXT, fontFamily: MONO }}>Rp {fmt(item.product.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              {/* Pilihan metode pembayaran */}
              <div style={{ marginBottom: '8px' }}>
                <label htmlFor="paymentMethod" style={{ fontSize: '11px', fontWeight: '600', color: GRAY2, display: 'block', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Metode Pembayaran</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[{ value: 'QRIS', label: 'QRIS' }, { value: 'CASH', label: 'Tunai di Kasir' }].map(m => (
                    <button key={m.value} onClick={() => setPaymentMethod(m.value)} style={{ padding: '12px 6px', borderRadius: '12px', border: `1.5px solid ${paymentMethod === m.value ? A : HAIRLINE}`, background: paymentMethod === m.value ? AL : PAPER2, color: paymentMethod === m.value ? A : TEXT2, fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', boxShadow: paymentMethod === m.value ? `0 2px 10px ${A}25` : 'none' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'QRIS' && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '9px 12px', lineHeight: 1.6 }}>QR code akan langsung muncul setelah order dikirim.</div>
                )}
                {paymentMethod === 'CASH' && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#065F46', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '9px 12px', lineHeight: 1.6 }}>Bayar tunai ke kasir setelah pesanan selesai.</div>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${HAIRLINE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: GRAY2 }}>Total Pembayaran</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: A, fontFamily: MONO }}>Rp {fmt(total)}</span>
              </div>
              <button onClick={handleSubmitOrder} disabled={submitting} style={{ width: '100%', padding: '17px', borderRadius: '14px', border: 'none', background: submitting ? '#D1D5DB' : A, color: '#fff', fontSize: '15px', fontWeight: '800', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting ? 'none' : `0 6px 20px ${A}40`, transition: 'all .2s' }}>
                {submitting ? 'Mengirim...' : 'Kirim Pesanan'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import Cookies from 'js-cookie'

const fmt = (n) => Number(n || 0).toLocaleString('id-ID')
const PAY_METHODS = [
  { value: 'CASH', label: 'CASH' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'TRANSFER', label: 'TRANSFER' },
  { value: 'NONTUNAI', label: 'NON TUNAI' },
]

// Kemarin dalam WIB (server/browser bisa di timezone lain, jadi dihitung eksplisit).
function yesterdayKey() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  now.setUTCDate(now.getUTCDate() - 1)
  return now.toISOString().slice(0, 10)
}

export default function ManualTransactionPage() {
  const router = useRouter()
  const user = useMemo(() => {
    try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} }
  }, [])

  const [date, setDate] = useState(yesterdayKey())
  const [time, setTime] = useState('12:00')
  const [existing, setExisting] = useState([])
  const [existingTotal, setExistingTotal] = useState(0)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [payment, setPayment] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [decrementStock, setDecrementStock] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const isAdmin = user.role === 'ADMIN'

  useEffect(() => { if (!isAdmin) router.replace('/dashboard') }, [isAdmin, router])

  useEffect(() => {
    if (!isAdmin || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    api.get(`/transactions/manual?date=${date}`)
      .then((r) => {
        setExisting(r.data.transactions || [])
        setExistingTotal(r.data.total || 0)
      })
      .catch(() => { setExisting([]); setExistingTotal(0) })
  }, [date, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    api.get('/products?slim=1').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [isAdmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products.slice(0, 8)
    return products.filter((p) => (p.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [products, search])

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const disc = Math.max(0, Number(discountAmount) || 0)
  const tax = Math.max(0, Number(taxAmount) || 0)
  const total = Math.max(0, subtotal - disc + tax)
  const pay = Math.max(0, Number(payment) || 0)
  const change = pay > 0 ? pay - total : 0

  function addItem(item) {
    setCart((prev) => {
      const found = prev.find((i) => i.productId && i.productId === item.productId)
      if (found) return prev.map((i) => (i.productId && i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...item, qty: 1 }]
    })
  }

  function addManual() {
    const name = manualName.trim()
    const price = Math.round(Number(manualPrice) || 0)
    if (!name) return setMsg({ type: 'error', text: 'Nama item wajib diisi' })
    if (price <= 0) return setMsg({ type: 'error', text: 'Harga item harus lebih dari 0' })
    addItem({ productId: null, name, price, category: '' })
    setManualName(''); setManualPrice('')
    setMsg(null)
  }

  function setQty(idx, delta) {
    setCart((prev) => prev.map((i, n) => (n === idx ? { ...i, qty: Math.max(1, i.qty + delta) } : i)))
  }
  function removeItem(idx) { setCart((prev) => prev.filter((_, n) => n !== idx)) }

  async function handleSave() {
    if (!cart.length) return setMsg({ type: 'error', text: 'Tambahkan minimal 1 item' })
    setSaving(true); setMsg(null)
    try {
      const res = await api.post('/transactions/manual', {
        date, time, items: cart,
        payment: pay, payMethod,
        customerName, note,
        discountAmount: disc, taxAmount: tax,
        decrementStock,
      })
      setMsg({ type: 'ok', text: `Tersimpan: ${res.data.invoiceNo} (${fmt(res.data.total)})` })
      setCart([]); setPayment(''); setCustomerName(''); setNote('')
      setDiscountAmount(''); setTaxAmount('')
      const after = await api.get(`/transactions/manual?date=${date}`)
      setExisting(after.data.transactions || [])
      setExistingTotal(after.data.total || 0)
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || e.message || 'Gagal menyimpan' })
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return null

  const todayKey = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const card = { padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: '#fff', marginBottom: '16px' }
  const inp = { padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: '11px', fontWeight: '700', color: 'var(--muted)', display: 'block', marginBottom: '4px' }

  return (
    <div className="page">
      <Sidebar />
      <main className="main" style={{ overflow: 'auto' }}>
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>Input Transaksi Manual</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px' }}>
            Khusus ADMIN. Mencatat transaksi pada tanggal tertentu - berguna untuk rekonstruksi data
            setelah database direstore. Transaksi ini ikut terhitung di History Transaksi, Laporan Harian,
            dan semua rekap. Nomor invoice berawalan <b>BK-M</b> dan ditandai <b>MANUAL</b>.
          </p>

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2', color: msg.type === 'ok' ? '#047857' : '#B91C1C', border: `1px solid ${msg.type === 'ok' ? '#A7F3D0' : '#FECACA'}` }}>
              {msg.text}
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <span style={lbl}>Tanggal transaksi (WIB)</span>
                <input type="date" style={inp} value={date} max={todayKey} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Jam</span>
                <input type="time" style={inp} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
              Sudah tercatat tanggal {date}: {existing.length} transaksi · Rp {fmt(existingTotal)}
            </div>
            {existing.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Belum ada transaksi pada tanggal ini.</div>}
            {existing.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                <span>
                  {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {t.cashier?.name || '-'}
                  {t.isManual && <b style={{ color: '#B45309' }}> · MANUAL</b>}
                  {(t.items || []).length > 0 && <span style={{ color: 'var(--muted)' }}> · {(t.items || []).map((i) => `${i.qty}x ${i.name}`).join(', ')}</span>}
                </span>
                <b>Rp {fmt(t.total)}</b>
              </div>
            ))}
          </div>

          <div style={card}>
            <span style={lbl}>Cari produk</span>
            <input style={{ ...inp, marginBottom: '10px' }} placeholder="Ketik nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filtered.map((p) => (
                <button key={p.id} onClick={() => addItem({ productId: p.id, name: p.name, price: p.price, category: p.category?.name || '' })}
                  style={{ padding: '7px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: '#F8FAFC', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {p.name} · Rp {fmt(p.price)}
                </button>
              ))}
              {filtered.length === 0 && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Produk tidak ditemukan.</span>}
            </div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />
            <span style={lbl}>Item tanpa produk (mis. barang yang sudah tidak ada di daftar produk)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px' }}>
              <input style={inp} placeholder="Nama item" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <input style={inp} type="number" placeholder="Harga" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
              <button onClick={addManual} style={{ padding: '9px 14px', borderRadius: '9px', border: '1px solid var(--border)', background: '#F1F5F9', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>Tambah</button>
            </div>
          </div>

          <div style={card}>
            <span style={lbl}>Item transaksi ({cart.length})</span>
            {cart.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Belum ada item.</div>}
            {cart.map((i, idx) => (
              <div key={`${i.productId || i.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, fontSize: '13px' }}>
                  {i.name} <span style={{ color: 'var(--muted)', fontSize: '11px' }}>· {fmt(i.price)}</span>
                  {i.productId ? '' : <span style={{ color: '#B45309', fontSize: '10px' }}> · tanpa produk</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => setQty(idx, -1)} style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
                  <b style={{ minWidth: '22px', textAlign: 'center', fontSize: '13px' }}>{i.qty}</b>
                  <button onClick={() => setQty(idx, 1)} style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
                </div>
                <b style={{ width: '110px', textAlign: 'right', fontSize: '13px' }}>Rp {fmt(i.price * i.qty)}</b>
                <button onClick={() => removeItem(idx)} style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}>×</button>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={lbl}>Metode pembayaran</span>
                <select style={inp} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <span style={lbl}>Uang dibayar (kosong = belum bayar)</span>
                <input style={inp} type="number" value={payment} onChange={(e) => setPayment(e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Nama pelanggan (opsional)</span>
                <input style={inp} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Catatan (opsional)</span>
                <input style={inp} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Potongan / diskon (Rp)</span>
                <input style={inp} type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Pajak (Rp)</span>
                <input style={inp} type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={decrementStock} onChange={(e) => setDecrementStock(e.target.checked)} />
              Kurangi stok produk (hanya berlaku untuk item yang terhubung ke produk)
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Subtotal Rp {fmt(subtotal)}</span>
              {disc > 0 && <span style={{ fontSize: '12px', color: '#B91C1C' }}>−{fmt(disc)}</span>}
              {tax > 0 && <span style={{ fontSize: '12px', color: '#047857' }}>+{fmt(tax)}</span>}
              <span style={{ fontSize: '17px', fontWeight: '800' }}>Total Rp {fmt(total)}</span>
              {pay > 0 && <span style={{ fontSize: '13px', color: change < 0 ? '#B91C1C' : '#047857' }}>Kembali Rp {fmt(change)}</span>}
              <button onClick={handleSave} disabled={saving || cart.length === 0}
                style={{ padding: '11px 22px', borderRadius: '10px', border: 'none', background: saving || cart.length === 0 ? '#CBD5E1' : '#1A0F00', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}



'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'
import { resetSettingsCache } from '@/lib/thermal'

const DEFAULTS = {
  storeName: 'HUMBL',
  tagline: 'Struk Pembayaran',
  footer: 'Terima kasih sudah berkunjung!\nHumbl',
  printWidth: 32,
  lineSpacing: 1,
}

export default function ReceiptSettingsPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/admin/receipt-settings').then(r => {
      setForm({ ...DEFAULTS, ...r.data })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/admin/receipt-settings', form)
      resetSettingsCache()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const w = Math.max(24, Math.min(48, form.printWidth))
  const hr = '-'.repeat(w)
  const fmtDemo = (n) => Number(n).toLocaleString('id-ID')
  const demoItems = [
    { name: 'Kopi Susu', qty: 2, price: 18000, subtotal: 36000 },
    { name: 'Matcha Latte', qty: 1, price: 22000, subtotal: 22000 },
  ]
  const demoTotal = 58000

  function padRow(left, right) {
    const gap = w - left.length - right.length
    return left + ' '.repeat(Math.max(1, gap)) + right
  }

  function center(str) {
    if (!str) return ''
    return str.padStart(Math.floor((w + str.length) / 2)).padEnd(w)
  }

  const footerLines = (form.footer || '').split('\n').map(l => l.trim()).filter(Boolean)

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Pengaturan Struk</div>
            <div className="topbar-sub">Kustomisasi tampilan struk kasir</div>
          </div>
        </div>

        <div className="content">
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>

              {/* Form */}
              <div className="card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                  <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#2563EB,#60A5FA)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1526' }}>Pengaturan Struk</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>Perubahan langsung terlihat di preview</div>
                  </div>
                </div>

                <form onSubmit={handleSave}>
                  {/* Header */}
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Header Struk</div>
                  <div className="form-grid" style={{ marginBottom: '20px' }}>
                    <div>
                      <label className="label">Nama Toko</label>
                      <input className="input" value={form.storeName} onChange={set('storeName')} placeholder="HUMBL" maxLength={24} />
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Tampil besar di bagian atas struk</div>
                    </div>
                    <div>
                      <label className="label">Tagline / Sub-judul</label>
                      <input className="input" value={form.tagline} onChange={set('tagline')} placeholder="Struk Pembayaran" maxLength={32} />
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Tampil di bawah nama toko</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Footer Struk</div>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="label">Teks Footer</label>
                    <textarea
                      className="input"
                      rows={5}
                      value={form.footer}
                      onChange={set('footer')}
                      placeholder={'Terima kasih sudah berkunjung!\nHumbl\nIG: @humbl'}
                      style={{ resize: 'vertical', fontSize: '13px', lineHeight: '1.6', fontFamily: 'inherit' }}
                    />
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Tekan Enter untuk baris baru. Setiap baris dicetak di tengah struk.</div>
                  </div>

                  {/* Jarak Baris */}
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Jarak Baris</div>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="label">Spasi antar baris item (0 = rapat, 3 = longgar)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="range" min="0" max="3" value={form.lineSpacing ?? 1}
                        onChange={e => setForm(prev => ({ ...prev, lineSpacing: Number(e.target.value) }))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)', minWidth: '20px', textAlign: 'center' }}>{form.lineSpacing ?? 1}</span>
                    </div>
                  </div>

                  {/* Lebar kertas */}
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Ukuran Kertas</div>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="label">Lebar Kertas (karakter)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="range" min="24" max="48" value={form.printWidth}
                        onChange={e => setForm(prev => ({ ...prev, printWidth: Number(e.target.value) }))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }} />
                      <input type="number" className="input" min="24" max="48" value={form.printWidth}
                        onChange={e => setForm(prev => ({ ...prev, printWidth: Number(e.target.value) || 32 }))}
                        style={{ width: '70px' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Printer 58mm ≈ 32 karakter · 80mm ≈ 42 karakter</div>
                  </div>

                  <div className="divider" />
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                    {saved && <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: '600' }}>✓ Tersimpan</span>}
                  </div>
                </form>
              </div>

              {/* Preview */}
              <div className="card" style={{ padding: '20px', position: 'sticky', top: '80px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Preview Struk</div>
                <div style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  background: '#FAFAFA',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '16px',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  color: '#1A202C',
                }}>
                  {[
                    center(form.storeName.toUpperCase()),
                    center(form.tagline),
                    hr,
                    `Invoice : 20250101-001`,
                    `Kasir   : Admin`,
                    `Pembeli : Pelanggan`,
                    `Waktu   : 01/01/2025 10:00`,
                    hr,
                    ...demoItems.flatMap(item => [
                      item.name,
                      padRow(`  ${item.qty} x Rp ${fmtDemo(item.price)}`, `Rp ${fmtDemo(item.subtotal)}`),
                      ...Array.from({ length: form.lineSpacing ?? 1 }, () => ''),
                    ]),
                    hr,
                    padRow('TOTAL', `Rp ${fmtDemo(demoTotal)}`),
                    ...Array.from({ length: form.lineSpacing ?? 1 }, () => ''),
                    padRow('Bayar (CASH)', `Rp ${fmtDemo(60000)}`),
                    padRow('Kembalian', `Rp ${fmtDemo(2000)}`),
                    hr,
                    ...footerLines.map(f => center(f)),
                  ].join('\n')}
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                  {footerLines.length} baris footer · spasi {form.lineSpacing ?? 1}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}

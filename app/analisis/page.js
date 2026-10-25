'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtK = n => { const v = Number(n || 0); if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'jt'; if (v >= 1000) return 'Rp ' + (v / 1000).toFixed(0) + 'rb'; return fmt(v) }
const pct = n => (n === null || n === undefined) ? null : Number(n).toFixed(1)
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const PIE_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#84CC16','#EC4899','#14B8A6']

function GrowthBadge({ value }) {
  if (value === null || value === undefined) return null
  const up = value >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: up ? '#ECFDF5' : '#FEF2F2', color: up ? '#10B981' : '#EF4444' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, sub, growth, color = '#6366F1', bg = '#EFF4FF', icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F8', boxShadow: '0 2px 12px rgba(15,23,41,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{icon}</div>
        <GrowthBadge value={growth} />
      </div>
      <div style={{ fontSize: '22px', fontWeight: '800', color: '#0F1729', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#8896B3' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#B0BCCC' }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, sub, children, action }) {
  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.05)', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F1729' }}>{title}</div>
          {sub && <div style={{ fontSize: '11px', color: '#8896B3', marginTop: '2px' }}>{sub}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: '18px 22px' }}>{children}</div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F1729', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', minWidth: '180px' }}>
      <p style={{ fontSize: '11px', color: '#8896B3', marginBottom: '6px', fontWeight: '600' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: i < payload.length - 1 ? '4px' : 0 }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.color }} />
          <span style={{ fontSize: '11px', color: '#CBD5E1' }}>{p.name}:</span>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── AI Panel ──
function AIPanel({ period, kpi, topProducts, expCat, payMethod }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const SUGGESTIONS = [
    'Analisis performa bulan ini secara menyeluruh',
    'Produk mana yang paling menguntungkan?',
    'Bagaimana efisiensi pengeluaran bulan ini?',
    'Berikan rekomendasi untuk meningkatkan laba',
    'Bandingkan performa bulan ini vs bulan lalu',
  ]

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const res = await api.post('/ai', { mode: 'chat', payload: { messages, question: q } })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.result }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e.response?.data?.message || 'Gagal mendapat respons.' }])
    } finally { setLoading(false) }
  }

  function renderMd(text) {
    const html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<div style="font-weight:700;color:#0F1729;margin:10px 0 4px;font-size:13px">$1</div>')
      .replace(/^[-•] (.+)$/gm, '<div style="display:flex;gap:7px;margin:2px 0"><span style="color:#6366F1;flex-shrink:0;margin-top:6px;width:5px;height:5px;border-radius:50%;background:#6366F1;display:inline-block"></span><span>$1</span></div>')
      .replace(/\n/g, '<br/>')
    return <div style={{ fontSize: '13px', lineHeight: '1.75', color: '#374151' }} dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F8', boxShadow: '0 2px 16px rgba(15,23,41,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '520px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#EFF4FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F1729' }}>AI Analyst</div>
          <div style={{ fontSize: '11px', color: '#8896B3' }}>Tanya tentang data analisis ini</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ECFDF5', padding: '4px 10px', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#10B981' }}>GPT-4o</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid #E2E8F8', background: '#F8FAFF', color: '#8896B3', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <div style={{ fontSize: '12px', color: '#8896B3', marginBottom: '4px', fontWeight: '600' }}>Pertanyaan cepat:</div>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{ padding: '9px 13px', borderRadius: '9px', border: '1px solid #E2E8F8', background: '#F8FAFF', color: '#374151', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F8'; e.currentTarget.style.color = '#374151' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '14px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#EFF4FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
            )}
            <div style={{ maxWidth: '80%', padding: '10px 13px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? '#6366F1' : '#F8FAFF', color: msg.role === 'user' ? '#fff' : '#374151', fontSize: '13px', border: msg.role === 'assistant' ? '1px solid #E2E8F8' : 'none', lineHeight: '1.6' }}>
              {msg.role === 'user' ? msg.content : renderMd(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#EFF4FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ padding: '10px 13px', borderRadius: '12px 12px 12px 4px', background: '#F8FAFF', border: '1px solid #E2E8F8', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8896B3', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', background: '#F8FAFF', border: '1.5px solid #E2E8F8', borderRadius: '12px', padding: '8px 8px 8px 13px' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Tanya tentang data analisis..."
            rows={1}
            disabled={loading}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#0F1729', fontFamily: 'inherit', resize: 'none', lineHeight: '1.5' }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{ width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: loading || !input.trim() ? '#E2E8F8' : '#6366F1', color: loading || !input.trim() ? '#8896B3' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  )
}

export default function AnalisisPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(null)
  const [year, setYear] = useState(null)
  const [tab, setTab] = useState('overview')

  const load = useCallback((m, y) => {
    setLoading(true)
    api.get(`/admin/analisis?month=${m}&year=${y}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.get('/admin/dashboard').then(r => {
      const m = r.data.currentMonthIndex
      const y = r.data.currentYear
      setMonth(m)
      setYear(y)
      load(m, y)
    }).catch(console.error)
  }, [])

  function changeMonth(m) {
    setMonth(m)
    load(m, year)
  }

  if (!data || month === null) return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8896B3', fontSize: '13px' }}>Memuat data analisis...</div>
      </main>
    </div>
  )

  const { kpi, kas, dailyChart, monthlyChart, topProductsMonth, topProductsYear,
    expCatMonth, expCatYear, payMethodMonth, payMethodYear,
    salesCatMonth, salesCatYear, absensiSummary, waste, voucher, memberTx,
    kasirPerformance, period } = data

  const prevMonthName = MONTHS[month === 0 ? 11 : month - 1]
  const periodLabel = `20 ${prevMonthName} – 20 ${period.monthName} ${year}`

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'penjualan', label: 'Penjualan' },
    { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'produk', label: 'Produk' },
    { key: 'operasional', label: 'Operasional' },
    { key: 'ai', label: '✦ AI Analyst' },
  ]

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">Analisis</div>
            <div className="topbar-sub">{periodLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={month} onChange={e => changeMonth(Number(e.target.value))}
              style={{ padding: '6px 28px 6px 10px', borderRadius: '9px', border: '1.5px solid #E2E8F8', background: '#F8FAFF', color: '#374151', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', WebkitAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236366F1' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
            </select>
            {loading && <span style={{ fontSize: '11px', color: '#8896B3' }}>Memuat...</span>}
          </div>
        </div>

        <div className="content">
          {/* Tab nav */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', borderRadius: '12px', padding: '4px', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#6366F1' : '#8896B3', fontSize: '12px', fontWeight: tab === t.key ? '700' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <>
              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Total Penjualan" value={fmtK(kpi.revenue.month)} sub={`vs ${fmtK(kpi.revenue.prev)} bulan lalu`} growth={kpi.revenue.growth} color="#6366F1" bg="#EFF4FF" icon="💰" />
                <KpiCard label="Total Pengeluaran" value={fmtK(kpi.expense.month)} sub={`vs ${fmtK(kpi.expense.prev)} bulan lalu`} growth={kpi.expense.growth} color="#EF4444" bg="#FEF2F2" icon="📤" />
                <KpiCard label="Laba Bersih" value={fmtK(kpi.laba.month)} sub={`Net margin ${pct(kpi.netMarginMonth)}%`} growth={kpi.laba.growth} color={kpi.laba.month >= 0 ? '#10B981' : '#EF4444'} bg={kpi.laba.month >= 0 ? '#ECFDF5' : '#FEF2F2'} icon="📈" />
                <KpiCard label="Total Transaksi" value={kpi.transactions.month.toLocaleString('id-ID')} sub={`Rata-rata ${fmtK(kpi.avgTxValue)}/transaksi`} growth={kpi.transactions.prev > 0 ? ((kpi.transactions.month - kpi.transactions.prev) / kpi.transactions.prev * 100) : null} color="#F59E0B" bg="#FFFBEB" icon="🧾" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Rata-rata/Hari" value={fmtK(kpi.avgDailySales)} sub={`${kpi.daysWithSales} hari aktif`} color="#8B5CF6" bg="#F5F3FF" icon="📅" />
                <KpiCard label="Kas Akhir Bulan" value={fmtK(kas.kasAkhir)} sub={`Kas awal ${fmtK(kas.kasAwal)}`} color={kas.kasAkhir >= 0 ? '#10B981' : '#EF4444'} bg={kas.kasAkhir >= 0 ? '#ECFDF5' : '#FEF2F2'} icon="🏦" />
                <KpiCard label="Transaksi Member" value={memberTx.count.toLocaleString('id-ID')} sub={fmtK(memberTx.total)} color="#06B6D4" bg="#ECFEFF" icon="👥" />
                <KpiCard label="Waste Bulan Ini" value={fmtK(waste.total)} sub={`${waste.count} catatan`} color="#F97316" bg="#FFF7ED" icon="🗑️" />
              </div>

              {/* Daily Chart */}
              <SectionCard title="Tren Penjualan Harian" sub={periodLabel}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Penjualan" stroke="#6366F1" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Monthly Chart */}
              <SectionCard title="Perbandingan Bulanan" sub={`Penjualan vs Pengeluaran — ${year}`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#8896B3' }} />
                    <Bar dataKey="revenue" name="Penjualan" fill="#6366F1" radius={[5,5,0,0]} maxBarSize={24} />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#F97316" radius={[5,5,0,0]} maxBarSize={24} />
                    <Bar dataKey="laba" name="Laba" fill="#10B981" radius={[5,5,0,0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Metode Bayar + Kas Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Metode Pembayaran" sub="Bulan ini">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {payMethodMonth.map((p, i) => {
                      const pct = kpi.revenue.month > 0 ? (p.total / kpi.revenue.month * 100) : 0
                      const colors = { CASH: '#10B981', QRIS: '#6366F1', TRANSFER: '#F59E0B', NONTUNAI: '#8B5CF6' }
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{p.method}</span>
                            <span style={{ fontSize: '12px', color: '#8896B3' }}>{fmt(p.total)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: colors[p.method] || '#6366F1', borderRadius: '3px', transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Ringkasan Kas" sub={`Periode ${periodLabel}`}>
                  {[
                    { label: 'Kas Awal Bulan', value: kas.kasAwal, color: '#10B981' },
                    { label: 'Total Penjualan', value: kas.totalRevMonth, color: '#6366F1' },
                    { label: 'Total Pengeluaran', value: kas.totalExpMonth, color: '#EF4444' },
                    { label: 'Kas Akhir Bulan', value: kas.kasAkhir, color: kas.kasAkhir >= 0 ? '#10B981' : '#EF4444', bold: true },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 3 ? '1px solid #F1F5F9' : 'none' }}>
                      <span style={{ fontSize: '12px', color: '#374151', fontWeight: row.bold ? '700' : '500' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: row.color }}>{fmt(row.value)}</span>
                    </div>
                  ))}
                </SectionCard>
              </div>
            </>
          )}

          {/* ── PENJUALAN TAB ── */}
          {tab === 'penjualan' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Total Penjualan" value={fmt(kpi.revenue.month)} sub={`${kpi.transactions.month} transaksi`} growth={kpi.revenue.growth} color="#6366F1" bg="#EFF4FF" icon="💰" />
                <KpiCard label="Rata-rata/Hari" value={fmt(Math.round(kpi.avgDailySales))} sub={`${kpi.daysWithSales} hari aktif`} color="#8B5CF6" bg="#F5F3FF" icon="📅" />
                <KpiCard label="Rata-rata/Transaksi" value={fmt(Math.round(kpi.avgTxValue))} sub={`Net margin ${pct(kpi.netMarginMonth)}%`} color="#10B981" bg="#ECFDF5" icon="🧾" />
              </div>

              <SectionCard title="Tren Penjualan Harian" sub={periodLabel}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                    <defs>
                      <linearGradient id="gRev2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Penjualan" stroke="#6366F1" strokeWidth={2.5} fill="url(#gRev2)" dot={{ r: 3, fill: '#6366F1', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Penjualan per Kategori" sub="Bulan ini">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={salesCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {salesCatMonth.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="Metode Pembayaran" sub="Bulan ini">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {payMethodMonth.map((p, i) => {
                      const pctVal = kpi.revenue.month > 0 ? (p.total / kpi.revenue.month * 100) : 0
                      const colors = { CASH: '#10B981', QRIS: '#6366F1', TRANSFER: '#F59E0B', NONTUNAI: '#8B5CF6' }
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{p.method}</span>
                            <span style={{ fontSize: '12px', color: '#8896B3' }}>{fmt(p.total)} · {p.count}x · {pctVal.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9' }}>
                            <div style={{ height: '100%', width: `${pctVal}%`, background: colors[p.method] || '#6366F1', borderRadius: '3px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Perbandingan Bulanan — Penjualan" sub={`Tahun ${year}`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Penjualan" fill="#6366F1" radius={[5,5,0,0]} maxBarSize={28} />
                    <Bar dataKey="laba" name="Laba" fill="#10B981" radius={[5,5,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Diskon & Voucher */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Total Diskon Diberikan" value={fmt(kpi.discountTotal)} sub="Diskon manual" color="#F59E0B" bg="#FFFBEB" icon="🏷️" />
                <KpiCard label="Diskon Voucher" value={fmt(kpi.voucherDiscount)} sub={`${voucher.count} transaksi pakai voucher`} color="#8B5CF6" bg="#F5F3FF" icon="🎟️" />
                <KpiCard label="Diskon Member" value={fmt(kpi.memberDiscount)} sub={`${memberTx.count} transaksi member`} color="#06B6D4" bg="#ECFEFF" icon="👥" />
              </div>
            </>
          )}

          {/* ── PENGELUARAN TAB ── */}
          {tab === 'pengeluaran' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Total Pengeluaran" value={fmt(kpi.expense.month)} sub={`${kpi.expense.count || 0} nota`} growth={kpi.expense.growth} color="#EF4444" bg="#FEF2F2" icon="📤" />
                <KpiCard label="Pengeluaran Bulan Lalu" value={fmt(kpi.expense.prev)} color="#F97316" bg="#FFF7ED" icon="📊" />
                <KpiCard label="Pengeluaran Tahun Ini" value={fmtK(kpi.expense.year)} sub={`Net margin tahunan ${pct(kpi.netMarginYear)}%`} color="#8B5CF6" bg="#F5F3FF" icon="📆" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Pengeluaran per Kategori" sub="Bulan ini">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {expCatMonth.map((c, i) => {
                      const pctVal = kpi.expense.month > 0 ? (c.total / kpi.expense.month * 100) : 0
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{c.category || 'Lainnya'}</span>
                            <span style={{ fontSize: '12px', color: '#8896B3' }}>{fmt(c.total)} ({pctVal.toFixed(1)}%)</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9' }}>
                            <div style={{ height: '100%', width: `${pctVal}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: '3px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Distribusi Pengeluaran" sub="Bulan ini">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={expCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ category, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                        {expCatMonth.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </SectionCard>
              </div>

              <SectionCard title="Pengeluaran per Kategori — Tahun Ini" sub={`${year}`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expCatYear.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={95} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="total" name="Total" fill="#EF4444" radius={[0,5,5,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Perbandingan Pengeluaran Bulanan" sub={`Tahun ${year}`}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#F97316" radius={[5,5,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </>
          )}

          {/* ── PRODUK TAB ── */}
          {tab === 'produk' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Top 10 Produk Terlaris" sub={`Bulan ini — ${periodLabel}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {topProductsMonth.map((p, i) => {
                      const maxRev = topProductsMonth[0]?.revenue || 1
                      const pctVal = (p.revenue / maxRev * 100)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '20px', fontSize: '11px', fontWeight: '700', color: i < 3 ? '#F59E0B' : '#8896B3', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: '#8896B3', flexShrink: 0, marginLeft: '8px' }}>{p.qty}x · {fmtK(p.revenue)}</span>
                            </div>
                            <div style={{ height: '5px', borderRadius: '3px', background: '#F1F5F9' }}>
                              <div style={{ height: '100%', width: `${pctVal}%`, background: i < 3 ? '#F59E0B' : '#6366F1', borderRadius: '3px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Top 10 Produk Terlaris" sub={`Tahun ${year}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {topProductsYear.map((p, i) => {
                      const maxRev = topProductsYear[0]?.revenue || 1
                      const pctVal = (p.revenue / maxRev * 100)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '20px', fontSize: '11px', fontWeight: '700', color: i < 3 ? '#F59E0B' : '#8896B3', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: '#8896B3', flexShrink: 0, marginLeft: '8px' }}>{p.qty}x · {fmtK(p.revenue)}</span>
                            </div>
                            <div style={{ height: '5px', borderRadius: '3px', background: '#F1F5F9' }}>
                              <div style={{ height: '100%', width: `${pctVal}%`, background: i < 3 ? '#10B981' : '#6366F1', borderRadius: '3px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Penjualan per Kategori Produk" sub="Bulan ini">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={salesCatMonth} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => percent > 0.05 ? `${category} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                        {salesCatMonth.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="Penjualan per Kategori Produk" sub={`Tahun ${year}`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesCatYear.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 90 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FF" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#8896B3' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={85} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="total" name="Penjualan" fill="#6366F1" radius={[0,5,5,0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              </div>
            </>
          )}

          {/* ── OPERASIONAL TAB ── */}
          {tab === 'operasional' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Waste Bulan Ini" value={fmt(waste.total)} sub={`${waste.count} catatan waste`} color="#F97316" bg="#FFF7ED" icon="🗑️" />
                <KpiCard label="Transaksi Member" value={memberTx.count.toLocaleString('id-ID')} sub={fmt(memberTx.total)} color="#06B6D4" bg="#ECFEFF" icon="👥" />
                <KpiCard label="Voucher Digunakan" value={voucher.count.toLocaleString('id-ID')} sub={`Hemat ${fmt(voucher.discount)}`} color="#8B5CF6" bg="#F5F3FF" icon="🎟️" />
              </div>

              {/* Performa Kasir */}
              <SectionCard title="Performa Kasir" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {kasirPerformance.map((k, i) => {
                    const maxTotal = kasirPerformance[0]?.total || 1
                    const pctVal = (k.total / maxTotal * 100)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: i === 0 ? '#FEF3C7' : '#F1F5F9', color: i === 0 ? '#F59E0B' : '#8896B3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{k.name}</span>
                            <span style={{ fontSize: '12px', color: '#8896B3' }}>{k.count} transaksi · {fmtK(k.total)}</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9' }}>
                            <div style={{ height: '100%', width: `${pctVal}%`, background: i === 0 ? '#F59E0B' : '#6366F1', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>

              {/* Absensi */}
              <SectionCard title="Rekap Absensi Karyawan" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        {['Karyawan','Opening','Closing 1','Closing 2','Closing 3','Total Shift'].map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', fontWeight: '700', color: '#8896B3', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(absensiSummary).map(([name, v], i) => {
                        const total = (v.OPENING || 0) + (v.CLOSING_1 || 0) + (v.CLOSING_2 || 0) + (v.CLOSING_3 || 0)
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '600', color: '#374151' }}>{name}</td>
                            {[v.OPENING || 0, v.CLOSING_1 || 0, v.CLOSING_2 || 0, v.CLOSING_3 || 0].map((val, j) => (
                              <td key={j} style={{ padding: '9px 12px', textAlign: 'center', color: val > 0 ? '#6366F1' : '#CBD5E1', fontWeight: val > 0 ? '700' : '400' }}>{val > 0 ? val : '-'}</td>
                            ))}
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '800', color: '#0F1729' }}>{total}</td>
                          </tr>
                        )
                      })}
                      {Object.keys(absensiSummary).length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#CBD5E1' }}>Belum ada data absensi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Metode Bayar Tahunan */}
              <SectionCard title="Metode Pembayaran Tahunan" sub={`Tahun ${year}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {payMethodYear.map((p, i) => {
                    const totalYear = payMethodYear.reduce((s, x) => s + x.total, 0)
                    const pctVal = totalYear > 0 ? (p.total / totalYear * 100) : 0
                    const colors = { CASH: '#10B981', QRIS: '#6366F1', TRANSFER: '#F59E0B', NONTUNAI: '#8B5CF6' }
                    return (
                      <div key={i} style={{ background: '#F8FAFF', borderRadius: '12px', padding: '14px 16px', border: '1px solid #E2E8F8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: colors[p.method] || '#6366F1' }}>{p.method}</span>
                          <span style={{ fontSize: '11px', color: '#8896B3' }}>{pctVal.toFixed(1)}%</span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F1729', marginBottom: '2px' }}>{fmtK(p.total)}</div>
                        <div style={{ fontSize: '11px', color: '#8896B3' }}>{p.count} transaksi</div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            </>
          )}

          {/* ── AI TAB ── */}
          {tab === 'ai' && (
            <AIPanel period={period} kpi={kpi} topProducts={topProductsMonth} expCat={expCatMonth} payMethod={payMethodMonth} />
          )}

        </div>
      </main>
    </div>
  )
}

          {/* ── OPERASIONAL TAB ── */}
          {tab === 'operasional' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <KpiCard label="Waste Bulan Ini" value={fmt(waste.total)} sub={`${waste.count} catatan waste`} color="#F97316" bg="#FFF7ED" icon="🗑️" />
                <KpiCard label="Transaksi Member" value={memberTx.count.toLocaleString('id-ID')} sub={fmt(memberTx.total)} color="#06B6D4" bg="#ECFEFF" icon="👥" />
                <KpiCard label="Voucher Digunakan" value={voucher.count.toLocaleString('id-ID')} sub={`Hemat ${fmt(voucher.discount)}`} color="#8B5CF6" bg="#F5F3FF" icon="🎟️" />
              </div>

              <SectionCard title="Performa Kasir" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {kasirPerformance.map((k, i) => {
                    const maxTotal = kasirPerformance[0]?.total || 1
                    const pctVal = (k.total / maxTotal * 100)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: i === 0 ? '#FEF3C7' : '#F1F5F9', color: i === 0 ? '#F59E0B' : '#8896B3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{k.name}</span>
                            <span style={{ fontSize: '12px', color: '#8896B3' }}>{k.count} transaksi · {fmtK(k.total)}</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9' }}>
                            <div style={{ height: '100%', width: `${pctVal}%`, background: i === 0 ? '#F59E0B' : '#6366F1', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Rekap Absensi Karyawan" sub={`Bulan ini — ${periodLabel}`}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        {['Karyawan','Opening','Closing 1','Closing 2','Closing 3','Total'].map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', fontWeight: '700', color: '#8896B3', borderBottom: '1px solid #F1F5F9', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(absensiSummary).map(([name, v], i) => {
                        const total = (v.OPENING||0)+(v.CLOSING_1||0)+(v.CLOSING_2||0)+(v.CLOSING_3||0)
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '600', color: '#374151' }}>{name}</td>
                            {[v.OPENING||0, v.CLOSING_1||0, v.CLOSING_2||0, v.CLOSING_3||0].map((val, j) => (
                              <td key={j} style={{ padding: '9px 12px', textAlign: 'center', color: val > 0 ? '#6366F1' : '#CBD5E1', fontWeight: val > 0 ? '700' : '400' }}>{val > 0 ? val : '-'}</td>
                            ))}
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '800', color: '#0F1729' }}>{total}</td>
                          </tr>
                        )
                      })}
                      {Object.keys(absensiSummary).length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#CBD5E1' }}>Belum ada data absensi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Metode Pembayaran Tahunan" sub={`Tahun ${year}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {payMethodYear.map((p, i) => {
                    const totalYear = payMethodYear.reduce((s, x) => s + x.total, 0)
                    const pctVal = totalYear > 0 ? (p.total / totalYear * 100) : 0
                    const colors = { CASH: '#10B981', QRIS: '#6366F1', TRANSFER: '#F59E0B', NONTUNAI: '#8B5CF6' }
                    return (
                      <div key={i} style={{ background: '#F8FAFF', borderRadius: '12px', padding: '14px 16px', border: '1px solid #E2E8F8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: colors[p.method] || '#6366F1' }}>{p.method}</span>
                          <span style={{ fontSize: '11px', color: '#8896B3' }}>{pctVal.toFixed(1)}%</span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F1729', marginBottom: '2px' }}>{fmtK(p.total)}</div>
                        <div style={{ fontSize: '11px', color: '#8896B3' }}>{p.count} transaksi</div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            </>
          )}

          {/* ── AI TAB ── */}
          {tab === 'ai' && (
            <AIPanel period={period} kpi={kpi} topProducts={topProductsMonth} expCat={expCatMonth} payMethod={payMethodMonth} />
          )}

        </div>
      </main>
    </div>
  )
}

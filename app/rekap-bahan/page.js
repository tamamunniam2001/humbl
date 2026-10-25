'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function RekapBahanPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  async function load(overrideFrom, overrideTo) {
    setLoading(true)
    try {
      const f = overrideFrom !== undefined ? overrideFrom : from
      const t = overrideTo !== undefined ? overrideTo : to
      const params = f && t ? `?from=${f}&to=${t}` : ''
      const res = await api.get(`/admin/ingredient-usage${params}`)
      setRows(res.data)
    } catch (_) {}
    setLoading(false)
  }

  function handleClickMonth(i) {
    // Cut-off bulanan per tanggal 20: mis. Okt (i=9) -> 20 Sep s/d 19 Okt
    const pad = n => String(n).padStart(2, '0')
    const prevM = i === 0 ? 12 : i
    const prevY = i === 0 ? filterYear - 1 : filterYear
    const currM = i + 1
    const f = `${prevY}-${pad(prevM)}-20`
    const t = `${filterYear}-${pad(currM)}-19`
    setFrom(f)
    setTo(t)
    load(f, t)
  }

  useEffect(() => { load() }, [])

  const totalItems = rows.length

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Rekap Bahan Baku</div>
            <div className="topbar-sub">Total pemakaian bahan dari produk terjual</div>
          </div>
          {totalItems > 0 && (
            <span className="badge badge-blue" style={{ fontSize: '12px', padding: '5px 12px' }}>{totalItems} jenis bahan</span>
          )}
        </div>

        <div className="content">
          {/* Quick Month Filter Cut-Off Tanggal 20 */}
          <div className="card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                Filter Bulan <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)' }}>(Cut-Off 20 s/d 19)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button type="button" onClick={() => setFilterYear(y => y - 1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px', color: 'var(--text2)' }}>‹</button>
                <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>{filterYear}</span>
                <button type="button" onClick={() => setFilterYear(y => y + 1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px', color: 'var(--text2)' }}>›</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px' }}>
              {MONTHS.map((m, i) => {
                const pad = n => String(n).padStart(2, '0')
                const prevM = i === 0 ? 12 : i
                const prevY = i === 0 ? filterYear - 1 : filterYear
                const expectedFrom = `${prevY}-${pad(prevM)}-20`
                const isActive = from === expectedFrom
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleClickMonth(i)}
                    title={`Cut-Off: 20 ${MONTHS[i === 0 ? 11 : i - 1]} - 19 ${m}`}
                    style={{
                      padding: '7px 2px',
                      borderRadius: '8px',
                      border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'var(--accent)' : 'var(--surface2)',
                      color: isActive ? '#fff' : 'var(--text2)',
                      fontSize: '11px',
                      fontWeight: isActive ? '800' : '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filter Custom */}
          <div className="card" style={{ padding: '18px 24px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="label">Dari Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai Tanggal</label>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => load()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              Tampilkan
            </button>
            {(from || to) && (
              <button className="btn btn-ghost" onClick={() => { setFrom(''); setTo(''); load('', '') }}>Reset</button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94A3B8', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Memuat data...
            </div>
          ) : rows.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
              <div>Tidak ada data pemakaian bahan pada periode ini</div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bahan Baku</th>
                    <th>Satuan Dasar</th>
                    <th style={{ textAlign: 'right' }}>Total Terpakai</th>
                    <th>Satuan Kemasan</th>
                    <th style={{ textAlign: 'right' }}>Setara Kemasan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: '600', color: '#0D1526' }}>{r.name}</td>
                      <td><span className="badge badge-gray">{r.unit}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#2563EB' }}>
                        {r.totalUsed.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {r.unit}
                      </td>
                      <td>
                        {r.packSize > 1 ? (
                          <span style={{ fontSize: '12px', color: '#64748B' }}>1 pack = {r.packSize} {r.unit}</span>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                        {r.packSize > 1 ? (
                          `${(r.totalUsed / r.packSize).toLocaleString('id-ID', { maximumFractionDigits: 2 })} pack`
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

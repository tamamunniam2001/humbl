'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const TABS = [
  { key: 'OPENING',   label: 'Opening',    jam: '' },
  { key: 'CLOSING_1', label: 'Closing 1',  jam: '07.00 – 13.00' },
  { key: 'CLOSING_2', label: 'Closing 2',  jam: '13.00 – 18.00' },
  { key: 'CLOSING_3', label: 'Closing 3',  jam: '18.00 – 23.00' },
]

export default function AbsensiPage() {
  const [tab, setTab] = useState('OPENING')
  const [employees, setEmployees] = useState([])
  const [sopItems, setSopItems] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [helperId, setHelperId] = useState('')
  const [kasAwal, setKasAwal] = useState('')
  const [checklist, setChecklist] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/admin/employees'), api.get('/admin/sop')]).then(([e, s]) => {
      setEmployees(e.data.filter(x => x.isActive))
      setSopItems(s.data)
    }).catch(() => {})
  }, [])

  const filtered = sopItems.filter(s => s.type === tab)
  const activeTab = TABS.find(t => t.key === tab)
  const isOpening = tab === 'OPENING'

  function toggleCheck(id) {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function reset() {
    setEmployeeId(''); setHelperId(''); setKasAwal(''); setChecklist({})
  }

  async function handleSave() {
    if (!employeeId) return alert('Pilih nama staff terlebih dahulu')
    setSaving(true)
    try {
      await api.post('/attendance', {
        employeeId, helperId: helperId || null, type: tab,
        kasAwal: isOpening ? (Number(kasAwal) || 0) : 0,
        checklist: filtered.map(s => ({ id: s.id, text: s.text, checked: !!checklist[s.id] })),
      })
      setSavedData({
        type: tab,
        label: activeTab.label,
        jam: activeTab.jam,
        staff1: employees.find(e => e.id === employeeId)?.name || '-',
        staff2: helperId ? employees.find(e => e.id === helperId)?.name : null,
        kasAwal: isOpening ? (Number(kasAwal) || 0) : null,
        checklist: filtered.map(s => ({ text: s.text, checked: !!checklist[s.id] })),
      })
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menyimpan absensi')
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">Absensi</div>
          <div className="topbar-sub">Checklist SOP harian</div>
        </div>

        <div className="content">
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>

            {/* Tab */}
            <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '12px', padding: '4px', marginBottom: '24px', border: '1px solid var(--border)', gap: '2px' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setChecklist({}) }}
                  style={{ flex: 1, padding: '9px 4px', borderRadius: '9px', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: tab === t.key ? 'var(--surface)' : 'transparent',
                    color: tab === t.key ? 'var(--text)' : 'var(--muted)',
                    boxShadow: tab === t.key ? '0 1px 4px rgba(13,21,38,0.08)' : 'none',
                  }}>
                  <div>{t.label}</div>
                  {t.jam && <div style={{ fontSize: '10px', fontWeight: '400', marginTop: '1px', opacity: 0.7 }}>{t.jam}</div>}
                </button>
              ))}
            </div>

            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Staff 1 */}
              <div>
                <label className="label">Nama Staff 1</label>
                <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                  <option value="">Pilih staff bertugas...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Staff 2 */}
              <div>
                <label className="label">Nama Staff 2 <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                <select className="input" value={helperId} onChange={e => setHelperId(e.target.value)}>
                  <option value="">Pilih staff bertugas...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Kas Awal — hanya Opening */}
              {isOpening && (
                <div>
                  <label className="label">Kas Awal di Dompet</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>Rp</span>
                    <input className="input" type="number" placeholder="0" value={kasAwal}
                      onChange={e => setKasAwal(e.target.value)}
                      style={{ paddingLeft: '40px' }} />
                  </div>
                </div>
              )}

              {/* Checklist SOP */}
              <div>
                <label className="label">
                  Checklist SOP{' '}
                  <span style={{ color: isOpening ? 'var(--accent)' : 'var(--red)', fontWeight: '700' }}>
                    {activeTab.label}{activeTab.jam ? ` (${activeTab.jam})` : ''}
                  </span>
                </label>
                {filtered.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    Belum ada item SOP. Tambahkan di menu Pengaturan Absensi.
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--surface)' }}>
                    {filtered.map((item, i) => (
                      <div key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: checklist[item.id] ? 'var(--accent-light)' : 'transparent', transition: 'background 0.1s' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${checklist[item.id] ? 'var(--accent)' : 'var(--border)'}`, background: checklist[item.id] ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {checklist[item.id] && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: '13px', color: checklist[item.id] ? 'var(--accent)' : 'var(--text)', fontWeight: checklist[item.id] ? '600' : '400', flex: 1 }}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {filtered.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                    {Object.values(checklist).filter(Boolean).length} / {filtered.length} item selesai
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Simpan */}
            <button
              onClick={handleSave} disabled={saving || !employeeId}
              style={{ width: '100%', marginTop: '20px', padding: '15px', borderRadius: '12px', border: 'none', background: saving || !employeeId ? '#94A3B8' : 'var(--text)', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: saving || !employeeId ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px', transition: 'all 0.15s' }}>
              {saving ? 'Menyimpan...' : 'SIMPAN LAPORAN ABSEN'}
            </button>
          </div>
        </div>
      </main>

      {/* Popup Ringkasan */}
      {savedData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,42,59,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ width: '680px', maxWidth: '96vw', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 28px', background: 'linear-gradient(135deg, #2A9D6E, #34D399)', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#fff' }}>Absensi Tersimpan!</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                  {savedData.label}{savedData.jam ? ` · ${savedData.jam}` : ''} · {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

              {/* Info Staff + Kas Awal */}
              <div style={{ display: 'grid', gridTemplateColumns: savedData.kasAwal !== null ? '1fr 1fr 1fr' : savedData.staff2 ? '1fr 1fr' : '1fr', gap: '12px', flexShrink: 0 }}>
                <div style={{ background: 'var(--accent-light)', borderRadius: '10px', padding: '14px 16px', border: '1px solid #C7D4F0' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '700', letterSpacing: '0.5px' }}>STAFF 1</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>{savedData.staff1}</div>
                </div>
                {savedData.staff2 && (
                  <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '700', letterSpacing: '0.5px' }}>STAFF 2</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>{savedData.staff2}</div>
                  </div>
                )}
                {savedData.kasAwal !== null && (
                  <div style={{ background: 'var(--green-light)', borderRadius: '10px', padding: '14px 16px', border: '1px solid #A7DFC8' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '700', letterSpacing: '0.5px' }}>KAS AWAL</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)' }}>Rp {Number(savedData.kasAwal).toLocaleString('id-ID')}</div>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Checklist SOP {savedData.label}</div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: savedData.checklist.filter(c => c.checked).length === savedData.checklist.length ? 'var(--green)' : 'var(--accent)', background: savedData.checklist.filter(c => c.checked).length === savedData.checklist.length ? 'var(--green-light)' : 'var(--accent-light)', padding: '3px 10px', borderRadius: '20px', border: `1px solid ${savedData.checklist.filter(c => c.checked).length === savedData.checklist.length ? '#A7DFC8' : '#C7D4F0'}` }}>
                    {savedData.checklist.filter(c => c.checked).length}/{savedData.checklist.length} selesai
                  </span>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  {savedData.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: i < savedData.checklist.length - 1 ? '1px solid var(--border)' : 'none', background: item.checked ? 'var(--accent-light)' : 'transparent' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: item.checked ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                      </div>
                      <span style={{ fontSize: '13px', color: item.checked ? 'var(--accent)' : 'var(--text2)', fontWeight: item.checked ? '600' : '400' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={() => { setSavedData(null); reset() }}>
                Absensi Lagi
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={() => { setSavedData(null); reset() }}>
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

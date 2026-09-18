'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const TABS = [
  { key: 'CLOSING_1', label: 'Shift 1', jam: '07.00 – 13.00' },
  { key: 'CLOSING_2', label: 'Shift 2', jam: '13.00 – 18.00' },
  { key: 'CLOSING_3', label: 'Shift 3', jam: '18.00 – 23.00' },
]

export default function AbsensiPage() {
  const [tab, setTab] = useState('CLOSING_1')
  const [employees, setEmployees] = useState([])
  const [sopItems, setSopItems] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [kasAwal, setKasAwal] = useState('')
  const [checklist, setChecklist] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null)
  const [selfieUrl, setSelfieUrl] = useState('')
  const [selfiePreview, setSelfiePreview] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [uploading, setUploading] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  async function openCamera() {
    setCameraError('')
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraError('Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan.')
    }
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
    setCameraError('')
  }

  async function takeSelfie() {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    canvas.toBlob(async (blob) => {
      const preview = URL.createObjectURL(blob)
      setSelfiePreview(preview)
      closeCamera()
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', blob, 'selfie.jpg')
        const res = await fetch('/api/attendance/selfie', { method: 'POST', body: form })
        const data = await res.json()
        setSelfieUrl(data.url || '')
      } catch { setSelfieUrl('') }
      finally { setUploading(false) }
    }, 'image/jpeg', 0.85)
  }

  useEffect(() => {
    Promise.all([api.get('/admin/employees'), api.get('/admin/sop')]).then(([e, s]) => {
      setEmployees(e.data.filter(x => x.isActive))
      setSopItems(s.data)
    }).catch(() => {})
  }, [])

  const filtered = sopItems.filter(s => s.type === tab)
  const activeTab = TABS.find(t => t.key === tab)

  function toggleCheck(id) {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function reset() {
    setEmployeeId(''); setKasAwal(''); setChecklist({})
    setSelfieUrl(''); setSelfiePreview('')
  }

  async function handleSave() {
    if (!employeeId) return alert('Pilih nama staff terlebih dahulu')
    if (!kasAwal) return alert('Kas Awal di Laci Kasir wajib diisi')
    setSaving(true)
    try {
      await api.post('/attendance', {
        employeeId, type: tab,
        kasAwal: Number(kasAwal) || 0,
        checklist: filtered.map(s => ({ id: s.id, text: s.text, checked: !!checklist[s.id] })),
        selfieUrl,
      })
      setSavedData({
        type: tab, label: activeTab.label, jam: activeTab.jam,
        staff: employees.find(e => e.id === employeeId)?.name || '-',
        kasAwal: Number(kasAwal) || 0,
        checklist: filtered.map(s => ({ text: s.text, checked: !!checklist[s.id] })),
        selfieUrl, selfiePreview,
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
              {/* Staff */}
              <div>
                <label className="label">Nama Staff</label>
                <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                  <option value="">Pilih staff bertugas...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Kas Awal */}
              <div>
                <label className="label">Kas Awal di Laci Kasir</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>Rp</span>
                  <input className="input" type="number" placeholder="0" value={kasAwal}
                    onChange={e => setKasAwal(e.target.value)}
                    style={{ paddingLeft: '40px' }} />
                </div>
              </div>

              {/* Foto Selfie */}
              <div>
                <label className="label">Foto Selfie <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional)</span></label>
                {selfiePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={selfiePreview} alt="selfie" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', border: '2px solid var(--accent)', display: 'block' }} />
                    {uploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      </div>
                    )}
                    <button onClick={() => { setSelfiePreview(''); setSelfieUrl('') }}
                      style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                  </div>
                ) : (
                  <button type="button" onClick={openCamera}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1.5px dashed var(--border)', borderRadius: '10px', background: 'var(--surface2)', cursor: 'pointer', fontSize: '13px', color: 'var(--text2)', fontFamily: 'inherit', fontWeight: '600' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Ambil Foto Selfie
                  </button>
                )}
              </div>

              {/* Checklist SOP */}
              <div>
                <label className="label">
                  Checklist SOP{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: '700' }}>
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
              onClick={handleSave} disabled={saving || !employeeId || uploading}
              style={{ width: '100%', marginTop: '20px', padding: '15px', borderRadius: '12px', border: 'none', background: saving || !employeeId || uploading ? '#94A3B8' : 'var(--text)', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: saving || !employeeId || uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px', transition: 'all 0.15s' }}>
              {saving ? 'Menyimpan...' : uploading ? 'Mengunggah foto...' : 'SIMPAN LAPORAN ABSEN'}
            </button>
          </div>
        </div>
      </main>

      {/* Modal Kamera */}
      {cameraOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#1E2A3B', borderRadius: '16px', overflow: 'hidden', width: '360px', maxWidth: '96vw' }}>
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>📸 Ambil Foto Selfie</span>
              <button onClick={closeCamera} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>×</button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              {cameraError ? (
                <div style={{ color: '#FCA5A5', fontSize: '13px', textAlign: 'center', padding: '20px' }}>{cameraError}</div>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ width: '100%', borderRadius: '10px', background: '#000', maxHeight: '280px', objectFit: 'cover' }} />
              )}
              {!cameraError && (
                <button onClick={takeSelfie}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid #fff', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#2563EB' }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

              {/* Foto Selfie */}
              {(savedData.selfiePreview || savedData.selfieUrl) && (
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={savedData.selfiePreview || savedData.selfieUrl} alt="selfie"
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%', border: '3px solid #34D399', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }} />
                </div>
              )}

              {/* Info Staff + Kas Awal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0 }}>
                <div style={{ background: 'var(--accent-light)', borderRadius: '10px', padding: '14px 16px', border: '1px solid #C7D4F0' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '700', letterSpacing: '0.5px' }}>STAFF</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>{savedData.staff}</div>
                </div>
                <div style={{ background: 'var(--green-light)', borderRadius: '10px', padding: '14px 16px', border: '1px solid #A7DFC8' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '700', letterSpacing: '0.5px' }}>KAS AWAL LACI</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)' }}>Rp {Number(savedData.kasAwal).toLocaleString('id-ID')}</div>
                </div>
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

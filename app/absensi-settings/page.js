'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

export default function AbsensiSettingsPage() {
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [sopItems, setSopItems] = useState([])
  const [empForm, setEmpForm] = useState('')
  const [empEditId, setEmpEditId] = useState(null)
  const [sopForm, setSopForm] = useState({ text: '', type: 'OPENING' })
  const [sopEditId, setSopEditId] = useState(null)

  async function loadAll() {
    const [e, s] = await Promise.all([api.get('/admin/employees'), api.get('/admin/sop')])
    setEmployees(e.data)
    setSopItems(s.data)
  }

  useEffect(() => { loadAll() }, [])

  async function saveEmployee(e) {
    e.preventDefault()
    if (!empForm.trim()) return
    if (empEditId) await api.put(`/admin/employees/${empEditId}`, { name: empForm.trim(), isActive: true })
    else await api.post('/admin/employees', { name: empForm.trim() })
    setEmpForm(''); setEmpEditId(null); loadAll()
  }

  async function deleteEmployee(id) {
    if (!confirm('Nonaktifkan karyawan ini?')) return
    await api.delete(`/admin/employees/${id}`); loadAll()
  }

  async function saveSop(e) {
    e.preventDefault()
    if (!sopForm.text.trim()) return
    if (sopEditId) await api.put(`/admin/sop/${sopEditId}`, sopForm)
    else await api.post('/admin/sop', { ...sopForm, order: sopItems.filter(s => s.type === sopForm.type).length })
    setSopForm({ text: '', type: sopForm.type }); setSopEditId(null); loadAll()
  }

  async function deleteSop(id) {
    if (!confirm('Hapus item SOP ini?')) return
    await api.delete(`/admin/sop/${id}`); loadAll()
  }

  const openingSop  = sopItems.filter(s => s.type === 'OPENING')
  const closing1Sop  = sopItems.filter(s => s.type === 'CLOSING_1')
  const closing2Sop  = sopItems.filter(s => s.type === 'CLOSING_2')
  const closing3Sop  = sopItems.filter(s => s.type === 'CLOSING_3')

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Pengaturan Absensi</div>
            <div className="topbar-sub">Kelola karyawan dan SOP checklist</div>
          </div>
        </div>

        <div className="content">
          {/* Tab */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[['employees', 'Karyawan'], ['sop', 'SOP Checklist']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'employees' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
              {/* Form */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>
                  {empEditId ? 'Edit Karyawan' : 'Tambah Karyawan'}
                </div>
                <form onSubmit={saveEmployee}>
                  <label className="label">Nama Karyawan</label>
                  <input className="input" placeholder="Nama lengkap" value={empForm}
                    onChange={e => setEmpForm(e.target.value)} required style={{ marginBottom: '12px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      {empEditId ? 'Simpan' : 'Tambah'}
                    </button>
                    {empEditId && <button type="button" className="btn btn-ghost" onClick={() => { setEmpForm(''); setEmpEditId(null) }}>Batal</button>}
                  </div>
                </form>
              </div>

              {/* List */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table">
                  <thead><tr><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td style={{ fontWeight: '600' }}>{emp.name}</td>
                        <td><span className={`badge ${emp.isActive ? 'badge-green' : 'badge-red'}`}>{emp.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }}
                              onClick={() => { setEmpForm(emp.name); setEmpEditId(emp.id) }}>Edit</button>
                            <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }}
                              onClick={() => deleteEmployee(emp.id)}>Nonaktifkan</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Belum ada karyawan</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'sop' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
              {/* Form */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>
                  {sopEditId ? 'Edit Item SOP' : 'Tambah Item SOP'}
                </div>
                <form onSubmit={saveSop}>
                  <label className="label">Tipe</label>
                  <select className="input" value={sopForm.type} onChange={e => setSopForm({ ...sopForm, type: e.target.value })} style={{ marginBottom: '12px' }}>
                    <option value="OPENING">Opening</option>
                    <option value="CLOSING_1">Closing Shift 1 (07.00 – 13.00)</option>
                    <option value="CLOSING_2">Closing Shift 2 (13.00 – 18.00)</option>
                    <option value="CLOSING_3">Closing Shift 3 (18.00 – 23.00)</option>
                  </select>
                  <label className="label">Isi SOP</label>
                  <textarea className="input" rows={3} placeholder="Contoh: Membersihkan area kasir" value={sopForm.text}
                    onChange={e => setSopForm({ ...sopForm, text: e.target.value })} required style={{ marginBottom: '12px', resize: 'none' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      {sopEditId ? 'Simpan' : 'Tambah'}
                    </button>
                    {sopEditId && <button type="button" className="btn btn-ghost" onClick={() => { setSopForm({ text: '', type: 'OPENING' }); setSopEditId(null) }}>Batal</button>}
                  </div>
                </form>
              </div>

              {/* List SOP */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[['OPENING', openingSop, 'var(--accent)', ''], ['CLOSING_1', closing1Sop, 'var(--red)', '07.00 – 13.00'], ['CLOSING_2', closing2Sop, 'var(--red)', '13.00 – 18.00'], ['CLOSING_3', closing3Sop, 'var(--red)', '18.00 – 23.00']].map(([type, items, color, jam]) => (
                  <div key={type} className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color }}>{type === 'OPENING' ? 'Opening' : type.replace('_', ' ')}</span>
                      {jam && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{jam}</span>}
                      <span className="badge badge-blue">{items.length} item</span>
                    </div>
                    <table className="table">
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={item.id}>
                            <td style={{ width: '32px', color: 'var(--muted)', fontSize: '12px' }}>{i + 1}</td>
                            <td style={{ color: 'var(--text)' }}>{item.text}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => { setSopForm({ text: item.text, type: item.type }); setSopEditId(item.id) }}>Edit</button>
                                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => deleteSop(item.id)}>Hapus</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Belum ada item {type === 'OPENING' ? 'Opening' : type.replace('_', ' ')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

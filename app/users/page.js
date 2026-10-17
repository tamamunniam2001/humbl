'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import api from '@/lib/api'

const PAGE_GROUPS = [
  {
    group: 'Utama', icon: '🏠',
    pages: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/kasir', label: 'Kasir' },
      { path: '/kasir/laporan', label: 'Laporan Harian' },
      { path: '/print-resi', label: 'Print Resi' },
    ]
  },
  {
    group: 'SDM & Operasional', icon: '👥',
    pages: [
      { path: '/absensi', label: 'Absensi' },
      { path: '/pengeluaran', label: 'Pengeluaran Toko' },
      { path: '/belanja', label: 'Belanja Operasional' },
      { path: '/saldo', label: 'Saldo Operasional' },
    ]
  },
  {
    group: 'Produk & Bahan', icon: '📦',
    pages: [
      { path: '/products', label: 'Produk' },
      { path: '/ingredients', label: 'Bahan Baku' },
      { path: '/inventaris', label: 'Inventaris' },
      { path: '/stock-opname', label: 'Stock Opname' },
      { path: '/waste', label: 'Catatan Waste' },
      { path: '/waste/rekap', label: 'Rekap Waste' },
      { path: '/pantau-bahan', label: 'Pantau Bahan Baku' },
    ]
  },
  {
    group: 'Laporan & Rekap', icon: '📊',
    pages: [
      { path: '/transaction-history', label: 'History Transaksi' },
      { path: '/rekap-produk', label: 'Rekap Produk Terjual' },
      { path: '/rekap-bahan', label: 'Rekap Bahan' },
      { path: '/rekap-absensi', label: 'Rekap Absensi' },
      { path: '/rekap-pengeluaran', label: 'Rekap Pengeluaran' },
    ]
  },
  {
    group: 'Pengaturan', icon: '⚙️',
    pages: [
      { path: '/absensi-settings', label: 'Pengaturan Absensi' },
      { path: '/expense-settings', label: 'Item Pengeluaran' },
      { path: '/receipt-settings', label: 'Pengaturan Struk' },
      { path: '/users', label: 'Pengguna' },
      { path: '/ai', label: 'AI Assistant' },
    ]
  },
]
const ALL_PAGES = PAGE_GROUPS.flatMap(g => g.pages)

const emptyUser = { name: '', email: '', password: '', role: 'CASHIER', customRoleId: '' }
const emptyRole = { name: '', allowedPaths: [] }

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [customRoles, setCustomRoles] = useState([])
  const [form, setForm] = useState(emptyUser)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [roleForm, setRoleForm] = useState(emptyRole)
  const [editRoleId, setEditRoleId] = useState(null)
  const [showRoleForm, setShowRoleForm] = useState(false)

  async function load() {
    const [uRes, rRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/custom-roles')])
    setUsers(uRes.data)
    setCustomRoles(rRes.data)
  }
  useEffect(() => { load() }, [])

  async function handleSubmitUser(e) {
    e.preventDefault()
    try {
      if (editId) await api.put(`/admin/users/${editId}`, form)
      else await api.post('/admin/users', form)
      setForm(emptyUser); setEditId(null); setShowForm(false); load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menyimpan') }
  }

  async function toggleActive(user) {
    await api.put(`/admin/users/${user.id}`, { isActive: !user.isActive }); load()
  }

  async function handleDeleteUser(u) {
    if (!confirm(`Hapus pengguna "${u.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    try { await api.delete(`/admin/users/${u.id}`); load() }
    catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
  }

  async function handleSubmitRole(e) {
    e.preventDefault()
    try {
      if (editRoleId) await api.put(`/admin/custom-roles/${editRoleId}`, roleForm)
      else await api.post('/admin/custom-roles', roleForm)
      setRoleForm(emptyRole); setEditRoleId(null); setShowRoleForm(false); load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menyimpan') }
  }

  async function handleDeleteRole(id, name) {
    if (!confirm(`Hapus role "${name}"? Semua user dengan role ini akan direset ke CASHIER.`)) return
    try { await api.delete(`/admin/custom-roles/${id}`); load() }
    catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
  }

  function togglePath(path) {
    setRoleForm(prev => ({
      ...prev,
      allowedPaths: prev.allowedPaths.includes(path)
        ? prev.allowedPaths.filter(p => p !== path)
        : [...prev.allowedPaths, path],
    }))
  }

  function toggleGroup(groupPages) {
    const paths = groupPages.map(p => p.path)
    const allChecked = paths.every(p => roleForm.allowedPaths.includes(p))
    setRoleForm(prev => ({
      ...prev,
      allowedPaths: allChecked
        ? prev.allowedPaths.filter(p => !paths.includes(p))
        : [...new Set([...prev.allowedPaths, ...paths])],
    }))
  }

  const roleGradient = { ADMIN: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', CASHIER: 'linear-gradient(135deg, #2563EB, #60A5FA)' }
  const getRoleLabel = (u) => u.customRole?.name || u.role

  return (
    <div className="page">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Pengguna & Role</div>
            <div className="topbar-sub">{users.length} pengguna · {customRoles.length} custom role</div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            if (activeTab === 'users') { setForm(emptyUser); setEditId(null); setShowForm(!showForm) }
            else { setRoleForm(emptyRole); setEditRoleId(null); setShowRoleForm(!showRoleForm) }
          }}>
            {(activeTab === 'users' ? showForm : showRoleForm) ? '× Tutup' : '+ Tambah'}
          </button>
        </div>

        <div className="content">
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--border)' }}>
            {[['users', 'Pengguna', users.length], ['roles', 'Custom Role', customRoles.length]].map(([key, label, count]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: activeTab === key ? 'var(--surface)' : 'transparent',
                  color: activeTab === key ? 'var(--accent)' : 'var(--muted)',
                  boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {label}
                <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '10px' }}>{count}</span>
              </button>
            ))}
          </div>

          {/* ── Tab Pengguna ── */}
          {activeTab === 'users' && (
            <>
              {showForm && (
                <div className="card slide-down" style={{ padding: '28px', marginBottom: '24px' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px' }}>{editId ? 'Edit User' : 'Tambah User Baru'}</div>
                  <form onSubmit={handleSubmitUser}>
                    <div className="form-grid" style={{ marginBottom: '20px' }}>
                      <div>
                        <label className="label">Nama Lengkap</label>
                        <input className="input" placeholder="Nama kasir" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div>
                        <label className="label">Email</label>
                        <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                      </div>
                      <div>
                        <label className="label">{editId ? 'Password Baru' : 'Password'} {editId && <span style={{ color: '#94A3B8', fontWeight: '400' }}>(kosongkan jika tidak diubah)</span>}</label>
                        <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editId} />
                      </div>
                      <div>
                        <label className="label">Role Sistem</label>
                        <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                          <option value="CASHIER">Kasir</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      {form.role === 'CASHIER' && customRoles.length > 0 && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label className="label">Custom Role <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(opsional — override akses halaman)</span></label>
                          <select className="input" value={form.customRoleId} onChange={e => setForm({ ...form, customRoleId: e.target.value })}>
                            <option value="">— Gunakan akses default Kasir —</option>
                            {customRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({(r.allowedPaths || []).length} halaman)</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn btn-primary">Simpan</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
                    </div>
                  </form>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {users.map(u => (
                  <div key={u.id} className="card fade-in" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', background: roleGradient[u.role] || roleGradient.CASHIER, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', color: '#fff', fontWeight: '700', flexShrink: 0 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '14px' }}>{u.name}</div>
                          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{u.email}</div>
                        </div>
                      </div>
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border)', marginBottom: '14px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge ${u.role === 'ADMIN' ? 'badge-purple' : 'badge-blue'}`}>{u.role}</span>
                        {u.customRole && <span className="badge" style={{ background: '#FDF4E3', color: '#C47D1A', border: '1px solid #F0D090' }}>{u.customRole.name}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => { setForm({ name: u.name, email: u.email, password: '', role: u.role, customRoleId: u.customRoleId || '' }); setEditId(u.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          Edit
                        </button>
                        <button className={`btn ${u.isActive ? 'btn-danger' : 'btn-success'}`} style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => toggleActive(u)}>
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleDeleteUser(u)}>Hapus</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tab Custom Role ── */}
          {activeTab === 'roles' && (
            <div style={{ display: 'grid', gridTemplateColumns: showRoleForm ? '360px 1fr' : '1fr', gap: '20px' }}>
              {showRoleForm && (
                <div className="card slide-down" style={{ padding: '24px', alignSelf: 'start' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>{editRoleId ? 'Edit Role' : 'Tambah Custom Role'}</div>
                  <form onSubmit={handleSubmitRole}>
                    <label className="label">Nama Role</label>
                    <input className="input" placeholder="Contoh: Supervisor, Barista..." value={roleForm.name}
                      onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} required style={{ marginBottom: '16px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="label" style={{ margin: 0 }}>Halaman yang Dapat Diakses</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setRoleForm(prev => ({ ...prev, allowedPaths: ALL_PAGES.map(p => p.path) }))}
                          style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', border: '1px solid #C7D4F0', background: '#EFF4FF', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
                          Pilih Semua
                        </button>
                        <button type="button" onClick={() => setRoleForm(prev => ({ ...prev, allowedPaths: [] }))}
                          style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
                          Hapus Semua
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', marginBottom: '12px', paddingRight: '2px' }}>
                      {PAGE_GROUPS.map(group => {
                        const allChecked = group.pages.every(p => roleForm.allowedPaths.includes(p.path))
                        const someChecked = group.pages.some(p => roleForm.allowedPaths.includes(p.path))
                        return (
                          <div key={group.group}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <button type="button" onClick={() => toggleGroup(group.pages)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                                <span style={{ fontSize: '13px' }}>{group.icon}</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: allChecked ? 'var(--accent)' : someChecked ? 'var(--orange)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group.group}</span>
                                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>({group.pages.filter(p => roleForm.allowedPaths.includes(p.path)).length}/{group.pages.length})</span>
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
                              {group.pages.map(page => {
                                const checked = roleForm.allowedPaths.includes(page.path)
                                return (
                                  <label key={page.path} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${checked ? '#C7D4F0' : 'var(--border)'}`, background: checked ? '#EFF4FF' : 'var(--surface2)', cursor: 'pointer', userSelect: 'none' }}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePath(page.path)}
                                      style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '12px', fontWeight: checked ? '700' : '500', color: checked ? 'var(--accent)' : 'var(--text)' }}>{page.label}</div>
                                      <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'monospace' }}>{page.path}</div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '14px', padding: '6px 10px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      ✅ {roleForm.allowedPaths.length} dari {ALL_PAGES.length} halaman dipilih
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Simpan</button>
                      <button type="button" className="btn btn-ghost" onClick={() => { setShowRoleForm(false); setRoleForm(emptyRole); setEditRoleId(null) }}>Batal</button>
                    </div>
                  </form>
                </div>
              )}

              <div>
                {customRoles.length === 0 ? (
                  <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔑</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Belum ada custom role</div>
                    <div style={{ fontSize: '12px' }}>Klik "+ Tambah" untuk membuat role baru dengan akses halaman tertentu</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {customRoles.map(r => (
                      <div key={r.id} className="card fade-in" style={{ padding: '20px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🔑</div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>{r.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                <span style={{ marginRight: '10px' }}>👤 {r._count?.users || 0} pengguna</span>
                                <span>📄 {(r.allowedPaths || []).length} halaman</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn" style={{ background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', padding: '5px 12px', fontSize: '12px' }}
                              onClick={() => { setRoleForm({ name: r.name, allowedPaths: r.allowedPaths || [] }); setEditRoleId(r.id); setShowRoleForm(true) }}>
                              Edit
                            </button>
                            <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => handleDeleteRole(r.id, r.name)}>Hapus</button>
                          </div>
                        </div>

                        {/* Pengguna yang memakai role ini */}
                        {(r._count?.users || 0) > 0 && (() => {
                          const roleUsers = users.filter(u => u.customRoleId === r.id)
                          return roleUsers.length > 0 ? (
                            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pengguna</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {roleUsers.map(u => (
                                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '20px', background: u.isActive ? '#EFF4FF' : '#F1F5F9', border: `1px solid ${u.isActive ? '#C7D4F0' : 'var(--border)'}` }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: '700', flexShrink: 0 }}>
                                      {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: u.isActive ? 'var(--accent)' : 'var(--muted)' }}>{u.name}</span>
                                    {!u.isActive && <span style={{ fontSize: '9px', color: 'var(--muted)' }}>(nonaktif)</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null
                        })()}

                        {/* Akses halaman per grup */}
                        {(r.allowedPaths || []).length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>Tidak ada akses halaman</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {PAGE_GROUPS.map(group => {
                              const grantedPages = group.pages.filter(p => (r.allowedPaths || []).includes(p.path))
                              if (grantedPages.length === 0) return null
                              return (
                                <div key={group.group}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                    {group.icon} {group.group} ({grantedPages.length}/{group.pages.length})
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {grantedPages.map(page => (
                                      <span key={page.path} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#EFF4FF', color: 'var(--accent)', border: '1px solid #C7D4F0', fontWeight: '600' }}>
                                        {page.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

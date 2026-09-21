'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'

const allNavGroups = [
  {
    label: 'Utama',
    roles: ['ADMIN', 'CASHIER'],
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <IconGrid />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/ai', label: 'AI Assistant', icon: <IconAI />, roles: ['ADMIN'] },
    ]
  },
  {
    label: 'Operasional',
    roles: ['ADMIN', 'CASHIER'],
    items: [
      { href: '/kasir', label: 'Kasir', icon: <IconCashier />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/kasir/laporan', label: 'Laporan Harian', icon: <IconReport />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/absensi', label: 'Absensi', icon: <IconAbsensi />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/pengeluaran', label: 'Pengeluaran', icon: <IconReceipt />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/print-resi', label: 'Print Resi', icon: <IconPrinter />, roles: ['ADMIN', 'CASHIER'] },
    ]
  },
  {
    label: 'Produk, Bahan, & Inventaris',
    roles: ['ADMIN', 'CASHIER'],
    items: [
      { href: '/products', label: 'Produk', icon: <IconBox />, roles: ['ADMIN'] },
      { href: '/ingredients', label: 'Bahan Baku', icon: <IconFlask />, roles: ['ADMIN'] },
      { href: '/inventaris', label: 'Inventaris', icon: <IconInventory />, roles: ['ADMIN', 'CASHIER'] },
      { href: '/stock-opname', label: 'Stock Opname', icon: <IconOpname />, roles: ['ADMIN', 'CASHIER'] },
    ]
  },
  {
    label: 'Laporan',
    roles: ['ADMIN'],
    items: [
      { href: '/transaction-history', label: 'History Transaksi', icon: <IconHistory />, roles: ['ADMIN'] },
      { href: '/rekap-produk', label: 'Produk Terjual', icon: <IconBarChart />, roles: ['ADMIN'] },
      { href: '/rekap-bahan', label: 'Rekap Bahan', icon: <IconChart />, roles: ['ADMIN'] },
      { href: '/rekap-absensi', label: 'Rekap Absensi', icon: <IconClipboard />, roles: ['ADMIN'] },
      { href: '/rekap-pengeluaran', label: 'Rekap Pengeluaran', icon: <IconMoney />, roles: ['ADMIN'] },
    ]
  },
  {
    label: 'Pengaturan',
    roles: ['ADMIN'],
    items: [
      { href: '/self-order-settings', label: 'Pengaturan Self Order', icon: <IconSelfOrder />, roles: ['ADMIN'] },
      { href: '/absensi-settings', label: 'Pengaturan Absensi', icon: <IconSettings />, roles: ['ADMIN'] },
      { href: '/expense-settings', label: 'Item Pengeluaran', icon: <IconTag />, roles: ['ADMIN'] },
      { href: '/receipt-settings', label: 'Pengaturan Struk', icon: <IconPrinter />, roles: ['ADMIN'] },
      { href: '/users', label: 'Pengguna', icon: <IconUsers />, roles: ['ADMIN'] },
    ]
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [dark, setDark] = useState(false)
  const user = (() => { try { return JSON.parse(Cookies.get('user') || '{}') } catch { return {} } })()
  const role = user.role || 'CASHIER'
  const allowedPaths = user.allowedPaths || null
  const navGroups = allNavGroups
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (allowedPaths) return allowedPaths.some(p => i.href === p || i.href.startsWith(p + '/'))
        return i.roles.includes(role)
      })
    }))
    .filter(g => g.items.length > 0)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved !== null) setCollapsed(saved === 'true')
    const initial = {}
    allNavGroups.forEach(g => {
      if (g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/')))
        initial[g.label] = true
    })
    setOpenGroups(initial)
    // sync dark state
    setDark(document.documentElement.classList.contains('dark'))
  }, [pathname])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  function toggleGroup(label) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function logout() {
    Cookies.remove('token')
    Cookies.remove('user')
    router.push('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      <div className={`cart-overlay${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)} style={{ zIndex: 49 }} />

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mobile-menu-btn"
        style={{
          display: 'none', position: 'fixed', top: '14px', left: '14px',
          zIndex: 60, background: '#0F172A', border: 'none', borderRadius: '9px',
          width: '36px', height: '36px', cursor: 'pointer',
          alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
        }}
      >
        <IconMenu />
      </button>

      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Logo + toggle */}
        <div style={{ padding: '16px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden', boxShadow: 'var(--shadow-accent)' }}><img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>Hambl</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>Admin Panel</div>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all 0.15s', marginLeft: collapsed ? 'auto' : '0' }}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* Nav */}
        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => {
            const isOpen = !!openGroups[group.label]
            const hasActive = group.items.some(i => pathname === i.href || (i.href !== '/kasir' && pathname.startsWith(i.href + '/')))
            return (
              <div key={group.label} style={{ marginBottom: gi < navGroups.length - 1 ? '2px' : '0' }}>
                {collapsed ? (
                  <>
                    {gi > 0 && <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '6px 8px' }} />}
                    {group.items.map((item) => {
                      const active = pathname === item.href || (item.href !== '/kasir' && pathname.startsWith(item.href + '/'))
                      return (
                        <div key={item.href} className="sidebar-tooltip-wrap">
                          <Link href={item.href} className={`sidebar-item${active ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
                            <span className="item-icon">{item.icon}</span>
                          </Link>
                          <span className="tooltip">{item.label}</span>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', marginTop: gi > 0 ? '4px' : '0',
                        background: 'none', border: 'none', cursor: 'pointer', borderRadius: '7px',
                        color: hasActive ? 'var(--sidebar-active-color)' : 'var(--muted)',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{group.label}</span>
                      <span style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
                        <IconChevronDown />
                      </span>
                    </button>
                    {isOpen && group.items.map((item) => {
                      const active = pathname === item.href || (item.href !== '/kasir' && pathname.startsWith(item.href + '/'))
                      return (
                        <Link key={item.href} href={item.href} className={`sidebar-item${active ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
                          <span className="item-icon">{item.icon}</span>
                          <span className="item-label">{item.label}</span>
                          {active && <span className="item-dot" />}
                        </Link>
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Dark mode toggle */}
          <div className="sidebar-tooltip-wrap" style={{ marginBottom: '6px' }}>
            <button
              onClick={toggleDark}
              className="sidebar-logout"
              style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
            >
              {dark ? <IconSun /> : <IconMoon />}
              <span className="logout-label">{dark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            {collapsed && <span className="tooltip">{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </div>
          <div className="sidebar-tooltip-wrap">
            <button className="sidebar-logout" onClick={logout}>
              <IconLogout />
              <span className="logout-label">Keluar</span>
            </button>
            {collapsed && <span className="tooltip">Keluar</span>}
          </div>
        </div>
      </aside>
    </>
  )
}

function IconMoon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function IconSun() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function IconSelfOrder() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> }
function IconGrid() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> }
function IconAI() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg> }
function IconCashier() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> }
function IconBox() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> }
function IconFlask() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.45h10.2A1 1 0 0 0 18 18l-4-9V3"/></svg> }
function IconChart() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IconBarChart() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="12" width="4" height="10"/><rect x="9" y="7" width="4" height="15"/><rect x="16" y="3" width="4" height="19"/></svg> }
function IconReceipt() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg> }
function IconReport() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> }
function IconUsers() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconLogout() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IconChevronLeft() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg> }
function IconChevronRight() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg> }
function IconChevronDown() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg> }
function IconMenu() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
function IconAbsensi() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg> }
function IconClipboard() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> }
function IconSettings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function IconMoney() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> }
function IconTag() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> }
function IconInventory() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM19 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0zM3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M10 12h4"/></svg> }
function IconPrinter() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function IconHistory() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="15"/></svg> }
function IconOpname() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> }

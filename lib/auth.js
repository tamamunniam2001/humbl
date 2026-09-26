import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

export function verifyAuth(request) {
  const token = request.headers.get('authorization')?.split(' ')[1]
  if (!token) return { error: NextResponse.json({ message: 'Token tidak ada' }, { status: 401 }) }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    return { user }
  } catch {
    return { error: NextResponse.json({ message: 'Token tidak valid' }, { status: 401 }) }
  }
}

export function adminOnly(user) {
  if (user.role !== 'ADMIN') return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  return null
}

// Akses mengikuti halaman: ADMIN selalu boleh, selain itu user harus punya
// halaman tersebut di allowedPaths custom role-nya (logika sama dengan Sidebar & middleware)
export function pageAccessOnly(user, pagePath) {
  if (user.role === 'ADMIN') return null
  const allowed = Array.isArray(user.allowedPaths) ? user.allowedPaths : []
  const ok = allowed.some(p => pagePath === p || pagePath.startsWith(p + '/'))
  return ok ? null : NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
}

// Izin operasional halaman /kasir. Meniru middleware.js supaya tidak ada
// selisih antara yang bisa dibuka di browser dan yang bisa dipakai lewat API:
// - ADMIN → selalu boleh
// - CASHIER biasa (tanpa custom role) → boleh, seperti aturan middleware
// - CASHIER dengan custom role → hanya boleh bila /kasir ada di allowedPaths
export function canUseKasir(user) {
  if (user?.role === 'ADMIN') return true
  if (Array.isArray(user?.allowedPaths))
    return user.allowedPaths.some(p => p === '/kasir' || p.startsWith('/kasir/'))
  return user?.role === 'CASHIER'
}

import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/setup', '/self-order', '/api/self-orders', '/api/public', '/api/webhooks/doku', '/api/customers']

// Halaman yang hanya boleh diakses ADMIN
const ADMIN_ONLY_PATHS = [
  '/products',
  '/ingredients',
  '/rekap-bahan',
  '/rekap-produk',
  '/users',
  '/rekap-absensi',
  '/absensi-settings',
  '/rekap-pengeluaran',
  '/expense-settings',
]

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // Lewati public paths dan static files
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const token = req.cookies.get('token')?.value

  // Belum login → redirect ke login
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // Custom role → akses dikontrol penuh oleh allowedPaths
    if (payload.allowedPaths) {
      const allowed = payload.allowedPaths
      // /dashboard selalu boleh diakses sebagai landing page
      if (pathname === '/dashboard') return NextResponse.next()
      const isAllowed = allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!isAllowed) return NextResponse.redirect(new URL('/dashboard', req.url))
      return NextResponse.next()
    }

    // Kasir biasa → blokir halaman admin-only
    if (payload.role === 'CASHIER' && ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  } catch {
    // Token invalid → redirect ke login
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}

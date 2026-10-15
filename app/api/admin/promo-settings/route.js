import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

const DEFAULTS = {
  memberDiscountActive: false,
  memberDiscountType: 'PERCENT',
  memberDiscountValue: 0,
  memberDiscountMax: 0,
  memberDiscountMin: 0,
}

// GET /api/admin/promo-settings — dibaca kasir (butuh tahu diskon member aktif)
// maupun admin. Semua role login boleh membaca.
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  let settings = null
  try {
    settings = await prisma.promoSettings.findUnique({ where: { id: 'singleton' } })
  } catch { settings = null }
  if (!settings) settings = { id: 'singleton', ...DEFAULTS }
  return NextResponse.json(settings)
}

// PUT /api/admin/promo-settings — hanya admin.
export async function PUT(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  let body = {}
  try { body = await req.json() } catch { body = {} }

  const type = body.memberDiscountType === 'NOMINAL' ? 'NOMINAL' : 'PERCENT'
  let value = Math.round(Number(body.memberDiscountValue) || 0)
  let max = Math.max(0, Math.round(Number(body.memberDiscountMax) || 0))
  let min = Math.max(0, Math.round(Number(body.memberDiscountMin) || 0))
  value = Math.max(0, value)
  if (type === 'PERCENT' && value > 100) {
    return NextResponse.json({ message: 'Diskon member persen maksimal 100' }, { status: 400 })
  }
  if (type === 'NOMINAL') max = 0 // max hanya relevan untuk persen
  const active = !!body.memberDiscountActive && value > 0

  const data = {
    memberDiscountActive: active,
    memberDiscountType: type,
    memberDiscountValue: value,
    memberDiscountMax: max,
    memberDiscountMin: min,
  }

  try {
    const settings = await prisma.promoSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    })
    return NextResponse.json(settings)
  } catch (e) {
    return NextResponse.json({ message: 'Gagal menyimpan pengaturan promo' }, { status: 500 })
  }
}

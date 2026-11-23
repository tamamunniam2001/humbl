import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// GET ?year=2026 — ambil semua kas awal tahun ini
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year') || new Date().getFullYear())

  const rows = await prisma.monthlyKas.findMany({ where: { year } })
  // Return array index 0-11
  const result = Array.from({ length: 12 }, (_, m) => {
    const row = rows.find(r => r.month === m)
    return { month: m, year, kasAwal: row?.kasAwal ?? null, id: row?.id || null }
  })
  return NextResponse.json(result)
}

// PUT { year, month, kasAwal } — upsert
export async function PUT(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { year, month, kasAwal } = await req.json()
  const row = await prisma.monthlyKas.upsert({
    where: { year_month: { year, month } },
    update: { kasAwal: Number(kasAwal) },
    create: { year, month, kasAwal: Number(kasAwal) },
  })
  return NextResponse.json(row)
}

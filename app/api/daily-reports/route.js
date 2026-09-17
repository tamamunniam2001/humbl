import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') || 1)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const where = {}
  if (from && to) where.date = { gte: new Date(from), lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }
  const [reports, total] = await Promise.all([
    prisma.dailyReport.findMany({ where, include: { cashier: { select: { name: true } } }, orderBy: { date: 'desc' }, take: 20, skip: (page - 1) * 20 }),
    prisma.dailyReport.count({ where }),
  ])
  return NextResponse.json({ reports, total, page, totalPages: Math.ceil(total / 20) })
}

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { shift, kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName } = await req.json()
  // Cek apakah shift ini sudah ada hari ini
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
  const existing = await prisma.dailyReport.findFirst({ where: { shift, date: { gte: today, lte: endOfDay } } })
  if (existing) return NextResponse.json({ message: `${shift} sudah pernah di-closing hari ini` }, { status: 400 })
  const report = await prisma.dailyReport.create({
    data: { shift, kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, cashierId: user.id, closerName: closerName || null },
    include: { cashier: { select: { name: true } } },
  })
  return NextResponse.json(report, { status: 201 })
}

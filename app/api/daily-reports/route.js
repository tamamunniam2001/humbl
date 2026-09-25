import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { wibDayRange } from '@/lib/wib'

export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') || 1)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const where = {}
  if (from || to) {
    const range = {}
    if (from) range.gte = wibDayRange(from).gte
    if (to) range.lte = wibDayRange(to).lte
    where.date = { ...(where.date || {}), ...range }
  }
  const last = searchParams.get('last')
  if (last) {
    const report = await prisma.dailyReport.findFirst({ where, include: { cashier: { select: { name: true } } }, orderBy: { date: 'desc' } })
    return NextResponse.json({ reports: report ? [report] : [] })
  }
  const [reports, total] = await Promise.all([
    prisma.dailyReport.findMany({ where, include: { cashier: { select: { name: true } } }, orderBy: { date: 'desc' }, take: 100, skip: (page - 1) * 100 }),
    prisma.dailyReport.count({ where }),
  ])
  return NextResponse.json({ reports, total, page, totalPages: Math.ceil(total / 100) })
}

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { shift, kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName, kasAkhirDisetor, date } = await req.json()

  // Tentukan tanggal laporan — bisa di-override untuk closing shift yang terlewat
  const reportDate = date ? new Date(date) : new Date()

  // Cek duplikat: shift yang sama pada hari kalender WIB yang sama
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(reportDate.getTime() + wibOffset)
  const wibDateStr = wibDate.toISOString().slice(0, 10)
  const dayStart = new Date(`${wibDateStr}T00:00:00+07:00`)
  const dayEnd   = new Date(`${wibDateStr}T23:59:59.999+07:00`)

  const existing = await prisma.dailyReport.findFirst({ where: { shift, date: { gte: dayStart, lte: dayEnd } } })
  if (existing) return NextResponse.json({ message: `${shift} sudah pernah di-closing pada tanggal tersebut` }, { status: 400 })

  const report = await prisma.dailyReport.create({
    data: { shift, date: reportDate, kasAwal: kasAwal || 0, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, cashierId: user.id, closerName: closerName || null, kasAkhirDisetor: kasAkhirDisetor || 0 },
    include: { cashier: { select: { name: true } } },
  })
  return NextResponse.json(report, { status: 201 })
}

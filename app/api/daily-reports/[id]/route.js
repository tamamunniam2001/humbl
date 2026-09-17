import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, include: { cashier: { select: { name: true } } } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  return NextResponse.json(report)
}

export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, select: { cashierId: true } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  const { kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName, kasAkhirDisetor } = await req.json()
  const updated = await prisma.dailyReport.update({
    where: { id },
    data: { kasAwal, penjualan, uangDisetor, qris, transfer, pengeluaran, piutang, catatan, closerName: closerName ?? undefined, kasAkhirDisetor: kasAkhirDisetor ?? undefined },
    include: { cashier: { select: { name: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const report = await prisma.dailyReport.findUnique({ where: { id }, select: { cashierId: true } })
  if (!report) return NextResponse.json({ message: 'Laporan tidak ditemukan' }, { status: 404 })
  if (user.role !== 'ADMIN' && report.cashierId !== user.id)
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 })
  await prisma.dailyReport.delete({ where: { id } })
  return NextResponse.json({ message: 'Laporan dihapus' })
}

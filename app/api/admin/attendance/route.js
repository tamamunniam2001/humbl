import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employeeId')
  const page = Number(searchParams.get('page') || 1)
  const where = {}
  if (from && to) where.date = { gte: new Date(from), lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }
  if (employeeId) where.employeeId = employeeId
  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where, orderBy: { date: 'desc' }, take: 30, skip: (page - 1) * 30,
      include: { employee: { select: { name: true } } },
    }),
    prisma.attendance.count({ where }),
  ])
  return NextResponse.json({ records, total, page, totalPages: Math.ceil(total / 30) })
}

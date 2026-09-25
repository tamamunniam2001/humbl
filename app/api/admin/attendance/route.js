import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const PAGE_SIZE = 30

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employeeId')
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const where = {}

  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(`${from}T00:00:00`)
    if (to) where.date.lte = new Date(`${to}T23:59:59.999`)
  }
  if (employeeId) where.employeeId = employeeId

  const [records, summaryRecords] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { employee: { select: { name: true } } },
    }),
    prisma.attendance.findMany({
      where,
      select: {
        date: true,
        clockOut: true,
        isActive: true,
        employeeId: true,
        checklist: true,
      },
    }),
  ])

  const durations = summaryRecords
    .filter(record => record.clockOut)
    .map(record => Math.max(0, Math.floor((new Date(record.clockOut).getTime() - new Date(record.date).getTime()) / 1000)))
  const totalDurationSeconds = durations.reduce((sum, seconds) => sum + seconds, 0)
  const checklistTotal = summaryRecords.reduce((sum, record) => sum + (Array.isArray(record.checklist) ? record.checklist.length : 0), 0)
  const checklistDone = summaryRecords.reduce((sum, record) => sum + (Array.isArray(record.checklist) ? record.checklist.filter(item => item.checked).length : 0), 0)
  const total = summaryRecords.length
  const active = summaryRecords.filter(record => record.isActive).length
  const completed = total - active

  return NextResponse.json({
    records,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    summary: {
      total,
      active,
      completed,
      staffCount: new Set(summaryRecords.map(record => record.employeeId)).size,
      averageDurationSeconds: durations.length ? Math.round(totalDurationSeconds / durations.length) : null,
      totalDurationSeconds,
      checklistDone,
      checklistTotal,
      checklistPercent: checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0,
    },
  })
}

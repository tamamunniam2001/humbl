import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const records = await prisma.attendance.findMany({
    where: { isActive: true },
    orderBy: { date: 'desc' },
    include: { employee: { select: { name: true } } },
  })
  return NextResponse.json(records)
}

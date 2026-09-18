import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function POST(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { employeeId, type, kasAwal, checklist, selfieUrl } = await req.json()
  if (!employeeId || !type) return NextResponse.json({ message: 'employeeId dan type wajib diisi' }, { status: 400 })
  const attendance = await prisma.attendance.create({
    data: { employeeId, type, kasAwal: kasAwal || 0, checklist, selfieUrl: selfieUrl || '' },
    include: { employee: { select: { name: true } } },
  })
  return NextResponse.json(attendance, { status: 201 })
}

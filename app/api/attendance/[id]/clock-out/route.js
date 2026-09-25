import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

const attendanceInclude = { employee: { select: { name: true } } }

export async function PATCH(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { id } = await params
  if (!id) return NextResponse.json({ message: 'ID absensi tidak valid' }, { status: 400 })

  const result = await prisma.attendance.updateMany({
    where: { id, isActive: true },
    data: { clockOut: new Date(), isActive: false },
  })

  if (result.count === 0) {
    const attendance = await prisma.attendance.findUnique({ where: { id }, include: attendanceInclude })
    if (!attendance) return NextResponse.json({ message: 'Absensi tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ message: 'Absensi sudah selesai.', attendance }, { status: 409 })
  }

  const attendance = await prisma.attendance.findUnique({ where: { id }, include: attendanceInclude })
  return NextResponse.json(attendance)
}

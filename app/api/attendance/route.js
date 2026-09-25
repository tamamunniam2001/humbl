import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function POST(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { employeeId, type, checklist, selfieUrl } = await req.json()
  if (!employeeId || !type) return NextResponse.json({ message: 'employeeId dan type wajib diisi' }, { status: 400 })

  const activeAttendance = await prisma.attendance.findFirst({
    where: { employeeId, isActive: true },
    include: { employee: { select: { name: true } } },
  })
  if (activeAttendance) {
    return NextResponse.json({
      message: `${activeAttendance.employee.name} masih memiliki absensi aktif. Selesaikan absensi sebelumnya terlebih dahulu.`,
      attendance: activeAttendance,
    }, { status: 409 })
  }

  const attendance = await prisma.attendance.create({
    data: { employeeId, type, checklist, selfieUrl: selfieUrl || '', isActive: true },
    include: { employee: { select: { name: true } } },
  })
  return NextResponse.json(attendance, { status: 201 })
}

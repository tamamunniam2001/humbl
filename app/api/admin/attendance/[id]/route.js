import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

const attendanceInclude = { employee: { select: { name: true } } }

export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ message: 'ID absensi tidak valid' }, { status: 400 })

  try {
    const body = await req.json()
    if (!body.employeeId || !body.type) {
      return NextResponse.json({ message: 'employeeId dan type wajib diisi' }, { status: 400 })
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        employeeId: body.employeeId,
        type: body.type,
        checklist: body.checklist ?? [],
      },
      include: attendanceInclude,
    })
    return NextResponse.json(attendance)
  } catch (error) {
    if (error.code === 'P2025') return NextResponse.json({ message: 'Absensi tidak ditemukan' }, { status: 404 })
    if (error.code === 'P2003') return NextResponse.json({ message: 'Staff tidak valid' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal memperbarui absensi' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ message: 'ID absensi tidak valid' }, { status: 400 })

  try {
    await prisma.attendance.delete({ where: { id } })
    return NextResponse.json({ message: 'Absensi dihapus' })
  } catch (error) {
    if (error.code === 'P2025') return NextResponse.json({ message: 'Absensi tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ message: 'Gagal menghapus absensi' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PATCH(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  const { employeeId, type, kasAwal, checklist } = await req.json()
  const updated = await prisma.attendance.update({
    where: { id },
    data: { employeeId, type, kasAwal: Number(kasAwal) || 0, checklist },
    include: { employee: { select: { name: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { id } = await params
  await prisma.attendance.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

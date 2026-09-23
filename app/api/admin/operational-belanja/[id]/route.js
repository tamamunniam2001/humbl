import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PATCH(req, context) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = context.params
  const body = await req.json()
  const { status, adminNote } = body

  const belanja = await prisma.operationalBelanja.findUnique({ where: { id } })
  if (!belanja) return Response.json({ message: 'ItemNotFound' }, { status: 404 })
  if (belanja.status !== 'PENDING') return Response.json({ message: 'OnlyPending' }, { status: 400 })

  const updated = await prisma.operationalBelanja.update({
    where: { id },
    data: { status, adminNote: adminNote || null },
  })

  return Response.json({ success: true, data: updated })
}

export async function GET(req, context) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = context.params
  const belanja = await prisma.operationalBelanja.findUnique({ where: { id }, include: { items: true, requester: { select: { id: true, name: true, email: true } } } })

  if (!belanja) return Response.json({ message: 'ItemNotFound' }, { status: 404 })

  return Response.json(belanja)
}
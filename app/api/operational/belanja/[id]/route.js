import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function PATCH(req, context) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const { id } = context.params
  const body = await req.json()
  const belanja = await prisma.operationalBelanja.findUnique({ where: { id }, include: { items: true } })
  if (!belanja) return Response.json({ message: 'ErrorNotFound' }, { status: 404 })
  const { action } = body
  if (action === 'submit') {
    if (belanja.status !== 'DRAFT' && belanja.status !== 'REJECTED') return Response.json({ message: 'OnlyDraft' }, { status: 400 })
    const updated = await prisma.operationalBelanja.update({ where: { id }, data: { status: 'PENDING' } })
    return Response.json({ success: true, status: updated.status })
  }
  if (action === 'cancel') {
    if (belanja.status !== 'PENDING') return Response.json({ message: 'OnlyPending' }, { status: 400 })
    const updated = await prisma.operationalBelanja.update({ where: { id }, data: { status: 'DRAFT', adminNote: null } })
    return Response.json({ success: true, status: updated.status })
  }
  return Response.json({ message: 'BadRequest' }, { status: 400 })
}
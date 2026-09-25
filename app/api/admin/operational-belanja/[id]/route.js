import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function PATCH(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = await params
  const body = await req.json()
  const { status, adminNote } = body

  const belanja = await prisma.operationalBelanja.findUnique({ where: { id }, include: { items: true } })
  if (!belanja) return NextResponse.json({ message: 'Pengajuan belanja tidak ditemukan' }, { status: 404 })
  if (belanja.status !== 'PENDING') return NextResponse.json({ message: 'Hanya pengajuan ber-status PENDING yang bisa di-ACC atau ditolak' }, { status: 400 })

  if (status === 'REJECTED') {
    const updated = await prisma.operationalBelanja.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: adminNote || null, approvedById: user.id || null, approvedAt: new Date() },
    })
    return NextResponse.json({ success: true, data: updated })
  }

  if (status === 'APPROVED') {
    const result = await prisma.$transaction(async (tx) => {
      const updatedBelanja = await tx.operationalBelanja.update({
        where: { id },
        data: { status: 'APPROVED', adminNote: adminNote || null, approvedById: user.id || null, approvedAt: new Date() },
      })

      await tx.expense.create({
        data: {
          date: belanja.tanggal || new Date(),
          total: belanja.total,
          catatan: `[Belanja Operasional] ${belanja.keterangan || ''} (Diajukan: ${belanja.requesterName})`.trim(),
          cashierId: user.id,
          items: {
            create: belanja.items.map(item => ({
              expenseItemId: item.isManual ? null : item.itemId,
              name: item.itemName,
              category: 'Operasional',
              keterangan: item.keterangan || '',
              satuan: item.satuan || '',
              harga: item.harga,
              isi: item.isi,
              qty: item.qty,
              subtotal: item.subtotal,
            })),
          },
        },
      })

      const lastLedger = await tx.operationalSaldoLedger.findFirst({
        where: { roleKey: 'operasional' },
        orderBy: { createdAt: 'desc' },
      })
      const lastBalance = lastLedger ? lastLedger.balanceAfter : 0
      const balanceAfter = lastBalance - belanja.total

      const newLedger = await tx.operationalSaldoLedger.create({
        data: {
          roleKey: 'operasional',
          type: 'EXPENSE',
          amount: belanja.total,
          balanceAfter,
          note: `Belanja Operasional ACC (${belanja.requesterName}) - ${belanja.keterangan || 'Tanpa Catatan'}`,
          createdBy: user.name || user.email || 'Admin',
        },
      })

      return { belanja: updatedBelanja, ledger: newLedger, saldo: balanceAfter }
    })
    return NextResponse.json({ success: true, data: result })
  }

  return NextResponse.json({ message: 'Status tidak valid' }, { status: 400 })
}

export async function DELETE(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = await params

  try {
    const belanja = await prisma.operationalBelanja.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!belanja) {
      return NextResponse.json({ message: 'Pengajuan belanja tidak ditemukan' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.operationalBelanjaItem.deleteMany({ where: { belanjaId: id } })
      await tx.operationalBelanja.delete({ where: { id } })
    })

    return NextResponse.json({
      success: true,
      message: `Riwayat pengajuan belanja berhasil dihapus`,
    })
  } catch (err) {
    console.error('Error DELETE /api/admin/operational-belanja/[id]:', err)
    return NextResponse.json({ message: 'Gagal menghapus riwayat pengajuan belanja' }, { status: 500 })
  }
}

export async function GET(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = await params
  const belanja = await prisma.operationalBelanja.findUnique({
    where: { id },
    include: { items: true, requester: { select: { id: true, name: true, email: true } } },
  })

  if (!belanja) return NextResponse.json({ message: 'ItemNotFound' }, { status: 404 })

  return NextResponse.json(belanja)
}
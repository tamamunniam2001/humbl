import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req, context) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  const { id } = context.params

  try {
    const belanja = await prisma.operationalBelanja.findUnique({
      where: { id },
      include: {
        items: true,
        requester: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!belanja) {
      return NextResponse.json({ message: 'Pengajuan belanja tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(belanja)
  } catch (err) {
    console.error('Error GET /api/operational/belanja/[id]:', err)
    return NextResponse.json({ message: 'Gagal memuat detail belanja' }, { status: 500 })
  }
}

export async function PATCH(req, context) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = context.params

  try {
    const body = await req.json()
    const { status, adminNote } = body

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Status tidak valid' }, { status: 400 })
    }

    const belanja = await prisma.operationalBelanja.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!belanja) {
      return NextResponse.json({ message: 'Pengajuan belanja tidak ditemukan' }, { status: 404 })
    }

    if (belanja.status !== 'PENDING') {
      return NextResponse.json({ message: 'Hanya pengajuan ber-status PENDING yang bisa di-ACC atau ditolak' }, { status: 400 })
    }

    if (status === 'REJECTED') {
      const updated = await prisma.operationalBelanja.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote || null,
          approvedById: user.id || null,
          approvedAt: new Date(),
        },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    // Status is APPROVED:
    // 1. Transaction to update Belanja status
    // 2. Add entry to main Expense table (Store Expenses)
    // 3. Deduct from Operational Saldo Ledger
    const result = await prisma.$transaction(async (tx) => {
      const updatedBelanja = await tx.operationalBelanja.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNote: adminNote || null,
          approvedById: user.id || null,
          approvedAt: new Date(),
        },
      })

      // Catat ke Pengeluaran Toko (Expense & ExpenseDetail)
      const newExpense = await tx.expense.create({
        data: {
          date: belanja.tanggal || new Date(),
          total: belanja.total,
          catatan: `[Belanja Operasional] ${belanja.keterangan || ''} (Diajukan: ${belanja.requesterName})`.trim(),
          cashierId: user.id, // Admin id yang meng-ACC
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

      // Potong Saldo Operasional
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

      return { belanja: updatedBelanja, expense: newExpense, ledger: newLedger, saldo: balanceAfter }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('Error PATCH /api/operational/belanja/[id]:', err)
    return NextResponse.json({ message: 'Gagal memperbarui status pengajuan belanja' }, { status: 500 })
  }
}

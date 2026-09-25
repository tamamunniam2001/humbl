import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly, pageAccessOnly } from '@/lib/auth'

const detailInclude = {
  items: true,
  requester: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
}

// Normalisasi rincian item dari body request (dipakai aksi EDIT)
function normalizeItems(items) {
  return items.map(i => {
    const harga = Number(i.harga) || 0
    const qty = Number(i.qty) || 1
    const isi = Number(i.isi) > 0 ? Number(i.isi) : null
    return {
      itemId: i.itemId || null,
      itemName: String(i.name || i.itemName || '').trim(),
      harga,
      isi,
      qty,
      satuan: i.satuan || '',
      keterangan: i.keterangan || '',
      subtotal: harga * qty,
      isManual: !i.itemId,
    }
  })
}

// Hak ubah pengajuan: ADMIN selalu boleh, selain itu pembuat pengajuan atau
// user yang memang diberi akses halaman /belanja (custom role "operasional").
function canEditBelanja(user, belanja) {
  if (user?.role === 'ADMIN') return true
  if (belanja.requesterId && user?.id && belanja.requesterId === user.id) return true
  return !pageAccessOnly(user, '/belanja')
}

export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { id } = await params

  try {
    const belanja = await prisma.operationalBelanja.findUnique({
      where: { id },
      include: detailInclude,
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

// Aksi EDIT: ubah tanggal, catatan, dan rincian item pengajuan yang masih PENDING
// Boleh dipakai Admin maupun user Operasional (pembuat pengajuan / pemegang akses halaman /belanja)
async function handleEdit(user, id, body) {
  try {
    const { tanggal, keterangan, items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Item belanja tidak boleh kosong' }, { status: 400 })
    }

    const newItems = normalizeItems(items)
    if (newItems.some(i => !i.itemName)) {
      return NextResponse.json({ message: 'Nama item belanja wajib diisi' }, { status: 400 })
    }

    const belanja = await prisma.operationalBelanja.findUnique({ where: { id }, include: { items: true } })
    if (!belanja) {
      return NextResponse.json({ message: 'Pengajuan belanja tidak ditemukan' }, { status: 404 })
    }

    if (!canEditBelanja(user, belanja)) {
      return NextResponse.json({ message: 'Anda tidak berhak mengubah pengajuan belanja ini' }, { status: 403 })
    }

    if (belanja.status !== 'PENDING') {
      return NextResponse.json({ message: 'Hanya pengajuan ber-status PENDING yang bisa diedit' }, { status: 400 })
    }

    const total = newItems.reduce((acc, i) => acc + i.subtotal, 0)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.operationalBelanjaItem.deleteMany({ where: { belanjaId: id } })
      return tx.operationalBelanja.update({
        where: { id },
        data: {
          tanggal: tanggal ? new Date(tanggal) : belanja.tanggal,
          keterangan: typeof keterangan === 'string' ? keterangan : (belanja.keterangan || ''),
          total,
          items: { create: newItems },
        },
        include: detailInclude,
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Error PATCH (EDIT) /api/operational/belanja/[id]:', err)
    return NextResponse.json({ message: 'Gagal memperbarui data pengajuan belanja' }, { status: 500 })
  }
}

export async function PATCH(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  const { id } = await params

  try {
    const body = await req.json()
    const { action, status, adminNote } = body

    // Aksi ubah rincian pengajuan (Admin & Operasional)
    if (action === 'EDIT') return await handleEdit(user, id, body)

    const adminCheck = adminOnly(user)
    if (adminCheck) return adminCheck

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

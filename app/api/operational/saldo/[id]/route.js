import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// Hitung ulang balanceAfter seluruh ledger sebuah roleKey berdasarkan urutan waktu.
// RESTOCK menambah saldo; EXPENSE & ADJUST mengurangi saldo.
// Mengembalikan saldo terbaru setelah perhitungan ulang.
async function recomputeLedger(tx, roleKey) {
  const entries = await tx.operationalSaldoLedger.findMany({
    where: { roleKey },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  let balance = 0
  // Update berurutan (bukan paralel) agar aman di dalam interactive transaction
  for (const e of entries) {
    balance = e.type === 'RESTOCK' ? balance + e.amount : balance - e.amount
    if (Math.abs((e.balanceAfter || 0) - balance) > 0.000001) {
      await tx.operationalSaldoLedger.update({ where: { id: e.id }, data: { balanceAfter: balance } })
    }
  }

  return balance
}

// PATCH /api/operational/saldo/[id] — ubah tanggal riwayat mutasi saldo (Admin)
export async function PATCH(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = await params
  try {
    const body = await req.json()
    const tanggal = body?.tanggal ? new Date(body.tanggal) : null
    if (!tanggal || isNaN(tanggal.getTime())) {
      return NextResponse.json({ message: 'Tanggal tidak valid' }, { status: 400 })
    }

    const existing = await prisma.operationalSaldoLedger.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: 'Riwayat saldo tidak ditemukan' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.operationalSaldoLedger.update({ where: { id }, data: { createdAt: tanggal } })
      // Urutan ledger bisa berubah setelah tanggal diedit → saldo dihitung ulang
      const saldo = await recomputeLedger(tx, existing.roleKey)
      return { updated, saldo }
    })

    return NextResponse.json({
      success: true,
      message: 'Tanggal riwayat saldo berhasil diperbarui',
      saldo: result.saldo,
      ledger: result.updated,
    })
  } catch (err) {
    console.error('Error PATCH /api/operational/saldo/[id]:', err)
    return NextResponse.json({ message: 'Gagal memperbarui tanggal riwayat saldo' }, { status: 500 })
  }
}

// DELETE /api/operational/saldo/[id] — hapus riwayat mutasi saldo (Admin)
// Saldo operasional otomatis dikembalikan/dihitung ulang dari riwayat yang tersisa.
export async function DELETE(req, { params }) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const adminCheck = adminOnly(user)
  if (adminCheck) return adminCheck

  const { id } = await params
  try {
    const existing = await prisma.operationalSaldoLedger.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: 'Riwayat saldo tidak ditemukan' }, { status: 404 })

    const saldo = await prisma.$transaction(async (tx) => {
      await tx.operationalSaldoLedger.delete({ where: { id } })
      // Saldo "kembali" mengikuti penghapusan riwayat
      return recomputeLedger(tx, existing.roleKey)
    })

    return NextResponse.json({
      success: true,
      message: 'Riwayat saldo dihapus, saldo operasional telah dihitung ulang',
      saldo,
      deleted: id,
    })
  } catch (err) {
    console.error('Error DELETE /api/operational/saldo/[id]:', err)
    return NextResponse.json({ message: 'Gagal menghapus riwayat saldo' }, { status: 500 })
  }
}

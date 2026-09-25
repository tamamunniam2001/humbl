import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  try {
    const ledger = await prisma.operationalSaldoLedger.findMany({
      where: { roleKey: 'operasional' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Ambil balanceAfter dari entry ledger terbaru, atau 0 jika belum ada
    const currentSaldo = ledger.length > 0 ? ledger[0].balanceAfter : 0

    return NextResponse.json({
      saldo: currentSaldo,
      ledger,
    })
  } catch (err) {
    console.error('Error GET /api/operational/saldo:', err)
    return NextResponse.json({ message: 'Gagal mengambil data saldo' }, { status: 500 })
  }
}

export async function POST(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  // Hanya Admin yang bisa mengisi saldo
  const adminCheck = adminOnly(user)
  if (adminCheck) {
    return NextResponse.json({ message: 'Hanya Admin yang memiliki akses untuk mengisi saldo operasional' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { amount, note } = body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ message: 'Nominal saldo tidak valid' }, { status: 400 })
    }

    // Hitung saldo terkini dari ledger terakhir
    const lastLedger = await prisma.operationalSaldoLedger.findFirst({
      where: { roleKey: 'operasional' },
      orderBy: { createdAt: 'desc' },
    })

    const lastBalance = lastLedger ? lastLedger.balanceAfter : 0
    const balanceAfter = lastBalance + numAmount

    const newLedger = await prisma.operationalSaldoLedger.create({
      data: {
        roleKey: 'operasional',
        type: 'RESTOCK',
        amount: numAmount,
        balanceAfter,
        note: note || 'Pengisian Saldo Operasional oleh Admin',
        createdBy: user.name || user.email || 'Admin',
      },
    })

    return NextResponse.json({
      success: true,
      saldo: balanceAfter,
      ledger: newLedger,
    })
  } catch (err) {
    console.error('Error POST /api/operational/saldo:', err)
    return NextResponse.json({ message: 'Gagal menambah saldo' }, { status: 500 })
  }
}

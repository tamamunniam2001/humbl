import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

// POST /api/vouchers/validate — validasi kode voucher & hitung potongan.
// Body: { code, subtotal }
// Dipakai halaman Kasir sebelum checkout. Tidak menambah usedCount di sini —
// usedCount baru bertambah saat transaksi benar-benar dibuat (di /api/transactions).
export async function POST(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { code, subtotal } = await req.json()
  const clean = String(code || '').trim().toUpperCase()
  const sub = Math.max(0, Math.round(Number(subtotal) || 0))

  if (!clean) return NextResponse.json({ message: 'Kode voucher wajib diisi' }, { status: 400 })

  const voucher = await prisma.voucher.findUnique({ where: { code: clean } })
  if (!voucher) return NextResponse.json({ message: 'Kode voucher tidak ditemukan' }, { status: 404 })

  // Cek aktif
  if (!voucher.isActive) {
    return NextResponse.json({ message: 'Voucher tidak aktif' }, { status: 400 })
  }

  // Cek masa berlaku
  const now = new Date()
  if (voucher.startDate && now < voucher.startDate) {
    return NextResponse.json({ message: 'Voucher belum mulai berlaku' }, { status: 400 })
  }
  if (voucher.endDate && now > voucher.endDate) {
    return NextResponse.json({ message: 'Voucher sudah kedaluwarsa' }, { status: 400 })
  }

  // Cek kuota (0 = tanpa batas)
  if (voucher.quota > 0 && voucher.usedCount >= voucher.quota) {
    return NextResponse.json({ message: 'Kuota voucher sudah habis' }, { status: 400 })
  }

  // Cek minimal belanja
  if (sub < (voucher.minSpend || 0)) {
    return NextResponse.json({
      message: `Minimal belanja Rp ${Number(voucher.minSpend).toLocaleString('id-ID')} untuk menggunakan voucher ini`,
    }, { status: 400 })
  }

  // Hitung potongan
  let discount = 0
  if (voucher.type === 'PERCENT') {
    discount = Math.round(sub * voucher.value / 100)
    if (voucher.maxDiscount > 0) discount = Math.min(discount, voucher.maxDiscount)
  } else {
    discount = voucher.value
  }
  // Potongan tidak boleh melebihi subtotal
  discount = Math.min(discount, sub)

  return NextResponse.json({
    success: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      value: voucher.value,
      maxDiscount: voucher.maxDiscount,
    },
    discount,
    totalAfter: sub - discount,
  })
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'
import { wibDayRange } from '@/lib/wib'

// Hanya ADMIN boleh memakai endpoint ini (rekonstruksi transaksi, mis. setelah restore DB).
// Endpoint POST transaksi biasa (/api/transactions) tetap terbuka untuk kasir dan tidak
// mengizinkan createdAt kustom, supaya tanggal transaksi normal tidak bisa dimanipulasi.
const PAY_METHODS = new Set(['CASH', 'QRIS', 'TRANSFER', 'NONTUNAI'])
const MAX_ITEMS = 50

function isSameOrigin(req) {
  const host = req.headers.get('host')
  if (!host) return false
  const origin = req.headers.get('origin')
  if (origin) {
    try { return new URL(origin).host === host } catch { return false }
  }
  const referer = req.headers.get('referer')
  if (referer) {
    try { return new URL(referer).host === host } catch { return false }
  }
  return req.headers.get('x-requested-with') === 'XMLHttpRequest'
}

// 'YYYY-MM-DD' + 'HH:mm' (WIB) -> Date. Default jam 12:00 bila waktu tidak diisi.
function parseWhen(date, time) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const t = /^\d{2}:\d{2}$/.test(String(time || '')) ? String(time) : '12:00'
  const d = new Date(`${date}T${t}:00.000+07:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

// GET /api/transactions/manual?date=YYYY-MM-DD
// Daftar transaksi pada tanggal tersebut - dipakai admin untuk mengecek apa saja
// yang sudah tercatat sebelum menambahkan transaksi.
export async function GET(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const date = new URL(req.url).searchParams.get('date')
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: 'Tanggal tidak valid (format YYYY-MM-DD)' }, { status: 400 })
  }
  const { gte, lte } = wibDayRange(date)
  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte, lte }, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, invoiceNo: true, createdAt: true, total: true, payment: true,
      payMethod: true, customerName: true, note: true, isManual: true,
      discountAmount: true, taxAmount: true,
      cashier: { select: { name: true } },
      items: { select: { name: true, qty: true, price: true, subtotal: true } },
    },
  })
  return NextResponse.json({
    transactions,
    total: transactions.reduce((s, t) => s + t.total, 0),
  })
}

// POST /api/transactions/manual - membuat transaksi dengan tanggal pilihan admin.
export async function POST(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  try {
    const {
      date, time = '12:00', items, payment = 0, payMethod,
      customerName = '', note = '',
      discountAmount = 0, taxAmount = 0, decrementStock = true,
    } = await req.json()

    const when = parseWhen(date, time)
    if (!when) return NextResponse.json({ message: 'Tanggal/jam tidak valid' }, { status: 400 })
    if (when.getTime() > Date.now() + 60_000) {
      return NextResponse.json({ message: 'Tanggal transaksi tidak boleh di masa depan' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Items tidak boleh kosong' }, { status: 400 })
    }
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ message: `Maksimal ${MAX_ITEMS} item per transaksi` }, { status: 400 })
    }
    if (!PAY_METHODS.has(payMethod)) {
      return NextResponse.json({ message: 'Metode pembayaran tidak valid' }, { status: 400 })
    }

    const orderItems = []
    for (const raw of items) {
      const name = String(raw?.name || '').trim()
      const qty = Math.floor(Number(raw?.qty))
      const price = Math.max(0, Math.round(Number(raw?.price) || 0))
      if (!name) return NextResponse.json({ message: 'Nama item wajib diisi' }, { status: 400 })
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ message: `Qty item "${name}" tidak valid` }, { status: 400 })
      }
      orderItems.push({
        productId: raw?.productId || null,
        name,
        code: String(raw?.code || ''),
        category: String(raw?.category || ''),
        qty, price, subtotal: qty * price,
      })
    }

    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
    const disc = Math.max(0, Math.round(Number(discountAmount) || 0))
    const tax = Math.max(0, Math.round(Number(taxAmount) || 0))
    const total = Math.max(0, subtotal - disc + tax)
    const pay = Math.max(0, Math.round(Number(payment) || 0))
    // Prefix M = manual, supaya mudah dibedakan dari transaksi kasir biasa (BK-<timestamp>)
    const invoiceNo = `BK-M${Date.now()}`

    const created = await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.create({
        data: {
          invoiceNo,
          createdAt: when,
          total,
          payment: pay,
          change: pay > 0 ? pay - total : 0,
          payMethod,
          cashierId: user.id,
          status: 'COMPLETED',
          customerName: String(customerName || ''),
          note: String(note || ''),
          discountAmount: disc,
          taxAmount: tax,
          isManual: true,
          items: { create: orderItems },
        },
        select: {
          id: true, invoiceNo: true, createdAt: true, total: true, payment: true,
          change: true, payMethod: true, status: true, customerName: true,
          note: true, discountAmount: true, taxAmount: true, isManual: true,
        },
      })
      if (decrementStock) {
        for (const i of orderItems) {
          if (!i.productId) continue
          await tx.product.update({ where: { id: i.productId }, data: { stock: { decrement: i.qty } } })
        }
      }
      return trx
    })

    return NextResponse.json(
      { ...created, subtotal, items: orderItems, stockDecremented: !!decrementStock },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan transaksi' }, { status: 500 })
  }
}

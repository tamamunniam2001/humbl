import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, pageAccessOnly } from '@/lib/auth'

const STATUSES = ['BELUM_DIBELI', 'DIPESAN', 'SELESAI']

function mapItem(i) {
  const expenseItem = i.expenseItem
  return {
    id: i.id,
    name: i.inventoryItem?.name || expenseItem?.name || i.itemName || '',
    category: i.inventoryItem?.category || expenseItem?.category || '',
    satuan: i.inventoryItem?.satuan || expenseItem?.satuan || i.satuan || '',
    satuanOpname: expenseItem?.satuanOpname || '',
    konversi: Number(expenseItem?.konversi) || 1,
    qty: i.requestQty != null ? i.requestQty : i.qtyActual,
    qtyActual: i.qtyActual,
    status: i.requestStatus,
    note: i.note || '',
    opnameId: i.opnameId,
    opnameDate: i.opname?.date || null,
    opnameStatus: i.opname?.status || null,
  }
}

// GET /admin/material-requests
// Daftar bahan baku yang di-request (restock) dari stock opname, untuk halaman "Pantau Bahan Baku"
export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/pantau-bahan')
  if (denied) return denied

  const items = await prisma.stockOpnameItem.findMany({
    where: { isRequested: true },
    include: {
      opname: { select: { id: true, date: true, status: true } },
      inventoryItem: { select: { name: true, satuan: true, category: true } },
      expenseItem: { select: { name: true, satuan: true, category: true } },
    },
    orderBy: [{ opname: { date: 'desc' } }, { itemName: 'asc' }],
  })

  return NextResponse.json(items.map(mapItem))
}

// PATCH /admin/material-requests  { id, status }
// Pindahkan item antar section: BELUM_DIBELI → DIPESAN → SELESAI (dan sebaliknya)
export async function PATCH(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/pantau-bahan')
  if (denied) return denied

  const { id, status } = await req.json()
  if (!id) return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 400 })
  if (!STATUSES.includes(status)) return NextResponse.json({ message: 'Status tidak valid' }, { status: 400 })

  const item = await prisma.stockOpnameItem.findUnique({ where: { id }, select: { isRequested: true } })
  if (!item) return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 404 })
  if (!item.isRequested) return NextResponse.json({ message: 'Item ini tidak sedang direquest' }, { status: 400 })

  const updated = await prisma.stockOpnameItem.update({ where: { id }, data: { requestStatus: status } })
  return NextResponse.json({ id: updated.id, status: updated.requestStatus })
}

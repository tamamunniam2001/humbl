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
    qty: i.qtyActual, // dalam satuan dasar — frontend konversi ke satuan opname
    minimalStok: expenseItem?.minimalStok ?? null, // dalam satuan opname
    status: i.requestStatus,
    note: i.note || '',
    opnameId: i.opnameId,
    opnameDate: i.opname?.date || null,
    opnameStatus: i.opname?.status || null,
  }
}

// GET /admin/material-requests
// Otomatis (tanpa tombol request): entri opname terkini per bahan dengan stok ≤ minimal stok
// (ExpenseItem.minimalStok, dalam satuan opname) → tampil di halaman "Pantau Bahan Baku"
export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/pantau-bahan')
  if (denied) return denied

  const rows = await prisma.stockOpnameItem.findMany({
    where: { expenseItem: { minimalStok: { not: null } } },
    include: {
      opname: { select: { id: true, date: true, status: true } },
      inventoryItem: { select: { name: true, satuan: true, category: true } },
      expenseItem: { select: { name: true, satuan: true, category: true, satuanOpname: true, konversi: true, minimalStok: true } },
    },
    orderBy: [{ opname: { date: 'desc' } }, { itemName: 'asc' }],
  })

  // Satu entri terkini per bahan; entri DRAFT yang belum diisi (qty 0) dilewati
  // agar tidak dianggap stok kosong → entri opname sebelumnya yang dipakai
  const seen = new Set()
  const latest = []
  for (const row of rows) {
    const key = row.expenseItemId || row.inventoryItemId || row.itemName.trim().toLowerCase()
    if (seen.has(key)) continue
    const terisi = row.qtyActual > 0 || row.opname.status === 'SELESAI'
    if (!terisi) continue
    seen.add(key)
    latest.push(row)
  }

  // Stok dalam satuan opname ≤ minimal stok → muncul otomatis di Pantau Bahan Baku
  const low = latest.filter(row => {
    const k = Number(row.expenseItem?.konversi) || 0
    const qtyOpname = row.expenseItem?.satuanOpname && k > 0 ? row.qtyActual / k : row.qtyActual
    const min = Number(row.expenseItem?.minimalStok)
    return !isNaN(min) && qtyOpname <= min
  })

  return NextResponse.json(low.map(mapItem))
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

  const item = await prisma.stockOpnameItem.findUnique({ where: { id }, select: { id: true } })
  if (!item) return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 404 })

  const updated = await prisma.stockOpnameItem.update({ where: { id }, data: { requestStatus: status } })
  return NextResponse.json({ id: updated.id, status: updated.requestStatus })
}

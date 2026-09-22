import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  const opname = await prisma.stockOpname.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      items: {
        include: { expenseItem: true },
        orderBy: { itemName: 'asc' },
      },
    },
  })
  if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })

  // Ambil harga terakhir & stok opname sebelumnya per expenseItemId
  const expenseItemIds = opname.items.map(i => i.expenseItemId).filter(Boolean)

  // Kumpulkan semua nama item untuk matching ke Ingredient
  const allItemNames = opname.items.map(i => i.itemName.trim())

  const [lastPrices, prevOpname, allIngredients] = await Promise.all([
    // Harga terakhir dari ExpenseDetail per item (harga per satuan beli)
    prisma.expenseDetail.findMany({
      where: { expenseItemId: { in: expenseItemIds } },
      orderBy: { expense: { date: 'desc' } },
      distinct: ['expenseItemId'],
      select: { expenseItemId: true, harga: true, satuan: true },
    }),
    // Opname SELESAI terakhir sebelum opname ini
    prisma.stockOpname.findFirst({
      where: { status: 'SELESAI', date: { lt: opname.date } },
      orderBy: { date: 'desc' },
      include: { items: { select: { expenseItemId: true, itemName: true, qtyActual: true } } },
    }),
    // Semua ingredient — untuk fallback harga berdasarkan nama
    prisma.ingredient.findMany({
      select: { name: true, price: true, packSize: true, unit: true },
    }),
  ])

  // priceMap: expenseItemId → harga per satuan beli (dari ExpenseDetail)
  const priceMap = Object.fromEntries(lastPrices.map(p => [p.expenseItemId, p.harga]))

  // ingredientMap: nama (lowercase) → harga per unit dasar (price / packSize)
  const ingredientMap = Object.fromEntries(
    allIngredients
      .filter(ig => ig.price != null && ig.packSize != null && ig.packSize > 0)
      .map(ig => [ig.name.trim().toLowerCase(), {
        hargaPerUnit: ig.price / ig.packSize,
        unit: ig.unit,
      }])
  )

  const prevMap = Object.fromEntries(
    (prevOpname?.items || []).map(i => [i.expenseItemId || i.itemName, i.qtyActual])
  )

  const items = opname.items.map(i => {
    const konversi = i.expenseItem?.konversi || null
    const satuanOpname = i.expenseItem?.satuanOpname || null
    const satuanBeli = i.expenseItem?.satuan || i.satuan || null

    // hargaTerakhir: harga per satuan beli (dari ExpenseDetail atau hargaManual)
    let hargaTerakhir = null
    if (i.isManual) {
      hargaTerakhir = i.hargaManual ?? null
    } else {
      hargaTerakhir = i.expenseItemId ? (priceMap[i.expenseItemId] ?? null) : null
    }

    // hargaPerSatuanDasar: harga per unit dasar (gram/ml/pcs)
    // Prioritas:
    //   1. Harga dari ExpenseDetail / hargaManual → bagi konversi
    //   2. Fallback: harga dari Ingredient (price/packSize) — sudah per unit dasar
    let hargaPerSatuanDasar = null
    if (hargaTerakhir != null) {
      if (konversi && konversi > 0) {
        hargaPerSatuanDasar = hargaTerakhir / konversi
      } else {
        hargaPerSatuanDasar = hargaTerakhir
      }
    }
    // Fallback ke Ingredient untuk semua item yang belum dapat harga
    if (hargaPerSatuanDasar == null) {
      const ig = ingredientMap[i.itemName.trim().toLowerCase()]
      if (ig) {
        hargaPerSatuanDasar = ig.hargaPerUnit
        // Gunakan juga sebagai hargaTerakhir jika belum ada
        if (hargaTerakhir == null) hargaTerakhir = ig.hargaPerUnit
      }
    }

    return {
      ...i,
      hargaTerakhir,          // harga per satuan beli (untuk ditampilkan sebagai referensi)
      hargaPerSatuanDasar,    // harga per satuan dasar → dipakai untuk kalkulasi nilaiStok
      satuanBeli,             // satuan pembelian (untuk label keterangan)
      qtySebelumnya: i.expenseItemId
        ? (prevMap[i.expenseItemId] ?? null)
        : (prevMap[i.itemName] ?? null),
      satuanOpname,
      konversi,
    }
  })

  return NextResponse.json({ ...opname, items })
}

export async function PATCH(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params
  const body = await req.json()

  // Sync item manual dari opname sebelumnya
  if (body.action === 'sync-manual') {
    const opname = await prisma.stockOpname.findUnique({ where: { id }, select: { date: true } })
    if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })

    const prev = await prisma.stockOpname.findFirst({
      where: { date: { lt: opname.date }, id: { not: id } },
      orderBy: { date: 'desc' },
      include: { items: { where: { isManual: true }, select: { itemName: true, satuan: true, hargaManual: true } } },
    })
    if (!prev?.items?.length) return NextResponse.json({ message: 'Tidak ada item manual di opname sebelumnya' }, { status: 404 })

    // Ambil item manual yang belum ada di opname ini
    const existing = await prisma.stockOpnameItem.findMany({ where: { opnameId: id, isManual: true }, select: { itemName: true } })
    const existingNames = new Set(existing.map(i => i.itemName.toLowerCase()))
    const toAdd = prev.items.filter(i => !existingNames.has(i.itemName.toLowerCase()))
    if (!toAdd.length) return NextResponse.json({ message: 'Semua item manual sudah ada di opname ini' }, { status: 400 })

    const created = await Promise.all(toAdd.map(item => prisma.stockOpnameItem.create({
      data: { opnameId: id, itemName: item.itemName, satuan: item.satuan || '', isManual: true, hargaManual: item.hargaManual, qtySystem: 0, qtyActual: 0, selisih: 0 },
      include: { expenseItem: true },
    })))
    return NextResponse.json(created.map(i => ({ ...i, hargaTerakhir: i.hargaManual, qtySebelumnya: null })))
  }

  // Tambah item manual
  if (body.action === 'add-item') {
    const { itemName, satuan, hargaTerakhir } = body
    if (!itemName?.trim()) return NextResponse.json({ message: 'Nama item wajib diisi' }, { status: 400 })
    const item = await prisma.stockOpnameItem.create({
      data: {
        opnameId: id,
        itemName: itemName.trim(),
        satuan: satuan || '',
        isManual: true,
        qtySystem: 0,
        qtyActual: 0,
        selisih: 0,
        hargaManual: hargaTerakhir ? Number(hargaTerakhir) : null,
      },
      include: { expenseItem: true },
    })
    return NextResponse.json({ ...item, hargaTerakhir: item.hargaManual, qtySebelumnya: null }, { status: 201 })
  }

  // Buka kembali opname SELESAI untuk diedit
  if (body.action === 'reopen') {
    const opname = await prisma.stockOpname.findUnique({ where: { id }, select: { status: true } })
    if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })
    await prisma.stockOpname.update({ where: { id }, data: { status: 'DRAFT' } })
    return NextResponse.json({ success: true })
  }

  // Toggle request item
  if (body.action === 'request-item') {
    const { itemId, isRequested, requestQty } = body
    const updated = await prisma.stockOpnameItem.update({
      where: { id: itemId },
      data: { isRequested: Boolean(isRequested), requestQty: requestQty != null ? Number(requestQty) : null },
    })
    return NextResponse.json(updated)
  }

  // Update satu item opname
  if (body.itemId !== undefined) {
    const { itemId, qtyActual, note, hargaTerakhir } = body
    const data = { qtyActual: Number(qtyActual), selisih: 0, note: note ?? '' }
    if (hargaTerakhir != null) data.hargaManual = Number(hargaTerakhir)
    const updated = await prisma.stockOpnameItem.update({ where: { id: itemId }, data })
    return NextResponse.json({ ...updated, hargaTerakhir: updated.hargaManual ?? body.hargaTerakhir ?? null })
  }

  // Selesaikan opname
  if (body.action === 'selesai') {
    const opname = await prisma.stockOpname.findUnique({ where: { id }, select: { status: true } })
    if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })
    if (opname.status === 'SELESAI') return NextResponse.json({ message: 'Opname sudah selesai' }, { status: 400 })
    await prisma.stockOpname.update({ where: { id }, data: { status: 'SELESAI' } })
    return NextResponse.json({ success: true })
  }

  // Update note opname
  const updated = await prisma.stockOpname.update({
    where: { id },
    data: { note: body.note ?? '' },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req, { params }) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { id } = await params

  // Cek apakah delete item manual (body ada itemId)
  let body = {}
  try { body = await req.json() } catch { }
  if (body.itemId) {
    const item = await prisma.stockOpnameItem.findUnique({ where: { id: body.itemId }, select: { isManual: true, opnameId: true } })
    if (!item || item.opnameId !== id) return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 404 })
    if (!item.isManual) return NextResponse.json({ message: 'Hanya item manual yang bisa dihapus' }, { status: 400 })
    await prisma.stockOpnameItem.delete({ where: { id: body.itemId } })
    return NextResponse.json({ success: true })
  }

  const opname = await prisma.stockOpname.findUnique({ where: { id }, select: { status: true } })
  if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })

  await prisma.stockOpname.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

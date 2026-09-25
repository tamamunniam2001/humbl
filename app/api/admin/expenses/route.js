import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function DELETE(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { ids } = await req.json()
  if (!ids?.length) return NextResponse.json({ message: 'Tidak ada ID' }, { status: 400 })
  await prisma.expenseDetail.deleteMany({ where: { expenseId: { in: ids } } })
  await prisma.expense.deleteMany({ where: { id: { in: ids } } })
  return NextResponse.json({ success: true, deleted: ids.length })
}

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Number(searchParams.get('page') || 1)
  const monthly = searchParams.get('monthly')
  const year = Number(searchParams.get('year') || new Date().getFullYear())

  const where = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(`${from}T00:00:00`)
    if (to) where.date.lte = new Date(`${to}T23:59:59`)
  }

  if (monthly) {
    const rows = await prisma.expense.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } },
      select: { date: true, total: true },
    })
    const months = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, total: 0 }))
    rows.forEach(r => { months[new Date(r.date).getMonth()].total += r.total })
    return NextResponse.json({ monthly: months })
  }

  if (searchParams.get('bykategori')) {
    const details = await prisma.expenseDetail.findMany({
      where: { expense: { ...(Object.keys(where).length ? where : {}) } },
      select: { category: true, subtotal: true, expenseItem: { select: { category: true } } },
    })
    const map = {}
    details.forEach(d => {
      const cat = d.category || d.expenseItem?.category || ''
      const key = cat || '(Tanpa Kategori)'
      map[key] = (map[key] || 0) + d.subtotal
    })
    const byKategori = Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
    return NextResponse.json({ byKategori })
  }

  const LIMIT = 50
  const kategori = searchParams.get('kategori')
  if (kategori) where['items'] = {
    some: {
      OR: [
        { category: kategori },
        { category: '', expenseItem: { category: kategori } },
      ]
    }
  }
  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where, orderBy: { date: 'desc' }, take: LIMIT, skip: (page - 1) * LIMIT,
      include: { cashier: { select: { name: true } }, items: { include: { expenseItem: { select: { code: true, category: true, satuan: true } } } } },
    }),
    prisma.expense.count({ where }),
  ])

  // Flatten ke per-item rows
  const rows = []
  expenses.forEach(e => {
    e.items
      .filter(item => !kategori || (item.category || item.expenseItem?.category || '') === kategori)
      .forEach(item => {
      rows.push({
        expenseId: e.id,
        detailId: item.id,
        date: e.date,
        cashier: e.cashier?.name || '',
        catatan: e.catatan || '',
        category: item.category || item.expenseItem?.category || '',
        name: item.name,
        satuan: item.satuan || item.expenseItem?.satuan || '',
        code: item.expenseItem?.code || '',
        keterangan: item.keterangan || '',
        harga: item.harga,
        isi: item.isi,
        qty: item.qty,
        subtotal: item.subtotal,
        expenseItemId: item.expenseItemId,
      })
    })
  })

  return NextResponse.json({ rows, total, page, totalPages: Math.ceil(total / LIMIT), expenses })
}

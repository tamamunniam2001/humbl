import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  const items = await prisma.expenseItem.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  const avgs = await prisma.expenseDetail.groupBy({
    by: ['expenseItemId'],
    where: { expenseItemId: { not: null } },
    _avg: { harga: true },
    _count: { id: true },
  })
  const avgMap = Object.fromEntries(avgs.map(a => [a.expenseItemId, { avg: Math.round(a._avg.harga || 0), count: a._count.id }]))
  return NextResponse.json(items.map(i => ({ ...i, avgHarga: avgMap[i.id]?.avg || null, totalPembelian: avgMap[i.id]?.count || 0 })))
}

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied
  const { code, name, category, satuan, satuanOpname, konversi, minimalStok } = await req.json()
  try {
    const item = await prisma.expenseItem.create({ data: { code: code || null, name, category: category || '', satuan: satuan || '', satuanOpname: satuanOpname || '', konversi: konversi !== '' && konversi != null ? Number(konversi) : null, minimalStok: minimalStok !== '' && minimalStok != null ? Number(minimalStok) : null } })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Kode sudah digunakan' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan' }, { status: 500 })
  }
}

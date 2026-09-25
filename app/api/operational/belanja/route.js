import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
    const where = { roleKey: 'operasional' }
    if (status) {
      where.status = status
    }

    const belanjaList = await prisma.operationalBelanja.findMany({
      where,
      include: {
        items: true,
        requester: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(belanjaList)
  } catch (err) {
    console.error('Error GET /api/operational/belanja:', err)
    return NextResponse.json({ message: 'Gagal mengambil data pengajuan belanja' }, { status: 500 })
  }
}

export async function POST(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error

  try {
    const body = await req.json()
    const { tanggal, keterangan, items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Item belanja tidak boleh kosong' }, { status: 400 })
    }

    const total = items.reduce((acc, item) => {
      const h = Number(item.harga) || 0
      const q = Number(item.qty) || 1
      return acc + h * q
    }, 0)

    const dateVal = tanggal ? new Date(tanggal) : new Date()

    const belanja = await prisma.operationalBelanja.create({
      data: {
        roleKey: 'operasional',
        requesterId: user.id || null,
        requesterName: user.name || user.email || 'Operasional',
        tanggal: dateVal,
        keterangan: keterangan || '',
        total,
        status: 'PENDING',
        items: {
          create: items.map(i => ({
            itemId: i.itemId || null,
            itemName: i.name,
            harga: Number(i.harga) || 0,
            isi: i.isi ? Number(i.isi) : null,
            qty: Number(i.qty) || 1,
            satuan: i.satuan || '',
            keterangan: i.keterangan || '',
            subtotal: (Number(i.harga) || 0) * (Number(i.qty) || 1),
            isManual: !!i.isManual,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ success: true, data: belanja })
  } catch (err) {
    console.error('Error POST /api/operational/belanja:', err)
    return NextResponse.json({ message: 'Gagal mengajukan belanja' }, { status: 500 })
  }
}

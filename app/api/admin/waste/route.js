import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, canAccessPage } from '@/lib/auth'

// ── Catatan Waste ──
// Satu catatan = satu kejadian (tanggal + kategori + catatan tambahan) yang bisa
// berisi beberapa bahan baku sekaligus (mis. 1 batch "salah buat" memakai 3 bahan).
// Harga bahan diambil dari data Bahan Baku (Ingredient.price / packSize) lalu
// disimpan sebagai snapshot supaya nilai historis tidak berubah saat harga naik.
const PAGE_PATH = '/waste'
const PAGE_SIZE = 20

const CATEGORIES = ['RND', 'BUSUK', 'TIDAK_TERPAKAI', 'DIPAKAI_SENDIRI', 'SALAH_BUAT', 'LAINNYA']

const toNum = (v) => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

// Tanggal disimpan sebagai jam 12:00 WIB agar tidak bergeser hari saat dibaca
// di zona waktu lain (pola sama dengan /api/admin/stock-opname).
const tanggalWIB = (ymd) => new Date(`${ymd}T12:00:00+07:00`)
const awalHariWIB = (ymd) => new Date(`${ymd}T00:00:00+07:00`)
const akhirHariWIB = (ymd) => new Date(`${ymd}T23:59:59.999+07:00`)
const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

function normalisasiItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && (i.ingredientId || String(i.ingredientName || '').trim()))
    .map(i => {
      const qty = toNum(i.qty)
      const hargaSatuan = toNum(i.hargaSatuan)
      return {
        ingredientId: i.ingredientId || null,
        ingredientName: String(i.ingredientName || '').trim(),
        code: i.code ? String(i.code) : null,
        unit: i.unit ? String(i.unit) : '',
        qty,
        hargaSatuan,
        hargaPack: i.hargaPack != null && i.hargaPack !== '' ? toNum(i.hargaPack) : null,
        packSize: i.packSize != null && i.packSize !== '' ? toNum(i.packSize) : null,
        subtotal: Math.round(qty * hargaSatuan * 100) / 100,
        note: i.note ? String(i.note) : null,
      }
    })
}

function whereFromParams(searchParams) {
  const conditions = []
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')
  const q = (searchParams.get('q') || '').trim()

  if (isYmd(from) || isYmd(to)) {
    const tanggal = {}
    if (isYmd(from)) tanggal.gte = awalHariWIB(from)
    if (isYmd(to)) tanggal.lte = akhirHariWIB(to)
    conditions.push({ tanggal })
  }
  if (CATEGORIES.includes(category)) conditions.push({ category })
  if (q) {
    conditions.push({
      OR: [
        { note: { contains: q, mode: 'insensitive' } },
        { createdByName: { contains: q, mode: 'insensitive' } },
        { items: { some: { ingredientName: { contains: q, mode: 'insensitive' } } } },
      ],
    })
  }
  return conditions.length ? { AND: conditions } : {}
}

function mapNote(note) {
  const items = note.items || []
  return {
    id: note.id,
    tanggal: note.tanggal,
    category: note.category,
    note: note.note || '',
    total: Number(note.total) || 0,
    createdByName: note.createdByName || note.createdBy?.name || '',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    items: items.map(i => ({
      id: i.id,
      ingredientId: i.ingredientId,
      ingredientName: i.ingredientName,
      code: i.code || '',
      unit: i.unit || '',
      qty: Number(i.qty) || 0,
      hargaSatuan: Number(i.hargaSatuan) || 0,
      hargaPack: i.hargaPack == null ? null : Number(i.hargaPack),
      packSize: i.packSize == null ? null : Number(i.packSize),
      subtotal: Number(i.subtotal) || 0,
      note: i.note || '',
    })),
  }
}

// GET /admin/waste?from=&to=&category=&q=&page=
// Mengembalikan daftar catatan (terpaginasi) + ringkasan seluruh hasil filter
// (total nilai, jumlah catatan/item, dan nilai per kategori).
export async function GET(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = canAccessPage(user, PAGE_PATH)
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || PAGE_SIZE))
  const where = whereFromParams(searchParams)

  const [notes, total, agregat, itemCount, perKategori] = await Promise.all([
    prisma.wasteNote.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
      include: {
        items: { orderBy: { ingredientName: 'asc' } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.wasteNote.count({ where }),
    prisma.wasteNote.aggregate({ where, _sum: { total: true } }),
    prisma.wasteNoteItem.count({ where: { wasteNote: where } }),
    prisma.wasteNote.groupBy({
      by: ['category'],
      where,
      _sum: { total: true },
      _count: { _all: true },
    }),
  ])

  const byCategory = {}
  CATEGORIES.forEach(c => { byCategory[c] = { nilai: 0, catatan: 0 } })
  perKategori.forEach(row => {
    byCategory[row.category] = {
      nilai: Number(row._sum.total) || 0,
      catatan: row._count?._all || 0,
    }
  })

  return NextResponse.json({
    notes: notes.map(mapNote),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      nilai: Number(agregat._sum.total) || 0,
      catatan: total,
      item: itemCount,
      byCategory,
    },
  })
}

// POST /admin/waste  { tanggal, category, note, items: [...] }
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = canAccessPage(user, PAGE_PATH)
  if (denied) return denied

  let body
  try { body = await req.json() } catch { return NextResponse.json({ message: 'Format data tidak valid' }, { status: 400 }) }

  const { tanggal, category, note } = body
  if (!isYmd(tanggal)) return NextResponse.json({ message: 'Tanggal wajib diisi' }, { status: 400 })
  if (!CATEGORIES.includes(category)) return NextResponse.json({ message: 'Kategori tidak valid' }, { status: 400 })

  const items = normalisasiItems(body.items)
  if (!items.length) return NextResponse.json({ message: 'Tambahkan minimal satu bahan baku' }, { status: 400 })
  if (items.some(i => !(i.qty > 0))) return NextResponse.json({ message: 'Qty bahan harus lebih dari 0' }, { status: 400 })

  const created = await prisma.wasteNote.create({
    data: {
      tanggal: tanggalWIB(tanggal),
      category,
      note: note ? String(note).trim() : null,
      total: items.reduce((s, i) => s + i.subtotal, 0),
      createdById: user.id || null,
      createdByName: user.name || '',
      items: { create: items },
    },
    include: { items: { orderBy: { ingredientName: 'asc' } }, createdBy: { select: { name: true } } },
  })

  return NextResponse.json(mapNote(created), { status: 201 })
}

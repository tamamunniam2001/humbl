import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, canAccessPage } from '@/lib/auth'

const PAGE_PATH = '/waste'

const CATEGORIES = ['RND', 'BUSUK', 'TIDAK_TERPAKAI', 'DIPAKAI_SENDIRI', 'SALAH_BUAT', 'LAINNYA']

const toNum = (v) => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

// Tanggal jam 12:00 WIB — konsisten dengan POST /admin/waste
const tanggalWIB = (ymd) => new Date(`${ymd}T12:00:00+07:00`)
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

// PUT /admin/waste/[id]  { tanggal, category, note, items: [...] }
// Item lama diganti seluruhnya (delete + create ulang) supaya hasil edit sama
// dengan yang tampil di form.
export async function PUT(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = canAccessPage(user, PAGE_PATH)
  if (denied) return denied

  const { id } = await params
  const existing = await prisma.wasteNote.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ message: 'Catatan tidak ditemukan' }, { status: 404 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ message: 'Format data tidak valid' }, { status: 400 }) }

  const { tanggal, category, note } = body
  if (!isYmd(tanggal)) return NextResponse.json({ message: 'Tanggal wajib diisi' }, { status: 400 })
  if (!CATEGORIES.includes(category)) return NextResponse.json({ message: 'Kategori tidak valid' }, { status: 400 })

  const items = normalisasiItems(body.items)
  if (!items.length) return NextResponse.json({ message: 'Tambahkan minimal satu bahan baku' }, { status: 400 })
  if (items.some(i => !(i.qty > 0))) return NextResponse.json({ message: 'Qty bahan harus lebih dari 0' }, { status: 400 })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.wasteNoteItem.deleteMany({ where: { wasteNoteId: id } })
    return tx.wasteNote.update({
      where: { id },
      data: {
        tanggal: tanggalWIB(tanggal),
        category,
        note: note ? String(note).trim() : null,
        total: items.reduce((s, i) => s + i.subtotal, 0),
        items: { create: items },
      },
      include: { items: { orderBy: { ingredientName: 'asc' } }, createdBy: { select: { name: true } } },
    })
  })

  return NextResponse.json({
    id: updated.id,
    tanggal: updated.tanggal,
    category: updated.category,
    note: updated.note || '',
    total: Number(updated.total) || 0,
    items: updated.items.map(i => ({
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
  })
}

// DELETE /admin/waste/[id] — hapus catatan beserta itemnya (cascade)
export async function DELETE(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = canAccessPage(user, PAGE_PATH)
  if (denied) return denied

  const { id } = await params
  const existing = await prisma.wasteNote.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ message: 'Catatan tidak ditemukan' }, { status: 404 })

  await prisma.wasteNote.delete({ where: { id } })
  return NextResponse.json({ message: 'Catatan dihapus' })
}

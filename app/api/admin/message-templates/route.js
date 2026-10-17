import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly, pageAccessOnly } from '@/lib/auth'

function validate(body) {
  const name = String(body.name || '').trim()
  const text = String(body.body || '').trim()
  const inputType = body.inputType === 'VOUCHER_CODE' ? 'VOUCHER_CODE' : 'NONE'
  if (!name) return { message: 'Nama template wajib diisi' }
  if (!text) return { message: 'Isi pesan wajib diisi' }
  return { name, body: text, inputType }
}

// GET /api/admin/message-templates — daftar template pesan WhatsApp.
// ?active=1 → hanya template aktif (dipakai popup kirim pesan di Daftar Member).
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === '1'

  const templates = await prisma.messageTemplate.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(templates)
}

// POST /api/admin/message-templates — buat template baru
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/wa-message-settings')
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const v = validate(body)
  if (v.message) return NextResponse.json({ message: v.message }, { status: 400 })

  try {
    const template = await prisma.messageTemplate.create({
      data: { name: v.name, body: v.body, inputType: v.inputType },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002')
      return NextResponse.json({ message: 'Nama template sudah dipakai' }, { status: 400 })
    return NextResponse.json({ message: 'Gagal menyimpan template' }, { status: 500 })
  }
}
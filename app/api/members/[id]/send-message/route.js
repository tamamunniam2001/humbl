import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'
import { sendFonnte } from '@/lib/fonnte'
import { phoneCandidates } from '@/lib/wa-bot'
import { isVoucherAvailable, renderTemplate, templateNeedsVoucher } from '@/lib/wa-templates'

// POST /api/members/[id]/send-message — kirim pesan WhatsApp (Fonnte) ke satu
// member memakai template dari Pengaturan > Pesan WhatsApp.
// Body: { templateId, voucherId? } — voucherId wajib bila template membutuhkan
// kode voucher (inputType VOUCHER_CODE atau body memuat {kode_voucher}).
export async function POST(req, { params }) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const member = await prisma.member.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, isActive: true },
  })
  if (!member) return NextResponse.json({ message: 'Member tidak ditemukan' }, { status: 404 })
  if (!member.phone)
    return NextResponse.json({ message: 'Member tidak memiliki nomor telepon' }, { status: 400 })

  const template = body.templateId
    ? await prisma.messageTemplate.findUnique({ where: { id: String(body.templateId) } })
    : null
  if (!template) return NextResponse.json({ message: 'Pilih template pesan terlebih dahulu' }, { status: 400 })
  if (!template.isActive) return NextResponse.json({ message: 'Template pesan sedang nonaktif' }, { status: 400 })

  // Nomor tujuan Fonnte harus format 628xx (dari kandidat "08xx"/"628xx"/"+62xx")
  const target = phoneCandidates(member.phone).find(c => c.startsWith('62'))
  if (!target)
    return NextResponse.json({ message: `Nomor member (${member.phone}) tidak valid untuk WhatsApp` }, { status: 400 })

  // Voucher — wajib bila template membutuhkan kode voucher
  let voucher = null
  if (templateNeedsVoucher(template)) {
    if (!body.voucherId)
      return NextResponse.json({ message: 'Pilih kode voucher terlebih dahulu' }, { status: 400 })
    voucher = await prisma.voucher.findUnique({ where: { id: String(body.voucherId) } })
    if (!voucher) return NextResponse.json({ message: 'Voucher tidak ditemukan' }, { status: 400 })
    if (!isVoucherAvailable(voucher))
      return NextResponse.json({
        message: `Voucher ${voucher.code} tidak tersedia (nonaktif, kuota habis, atau kedaluwarsa)`,
      }, { status: 400 })
  }

  const message = renderTemplate(template.body, { memberName: member.name, voucher })
  if (!message)
    return NextResponse.json({ message: 'Isi pesan kosong setelah placeholder diisi' }, { status: 400 })

  // Mode uji (smoke test) — jangan kirim sungguhan
  if (process.env.WA_DRY_RUN === '1')
    return NextResponse.json({ success: true, dryRun: true, target, template: template.name, message })

  if (!process.env.FONNTE_TOKEN)
    return NextResponse.json({ message: 'FONNTE_TOKEN belum diset' }, { status: 500 })

  try {
    const result = await sendFonnte({ target, message })
    return NextResponse.json({ success: true, target, template: template.name, message, result })
  } catch (e) {
    return NextResponse.json({ message: `Gagal mengirim pesan: ${e.message}` }, { status: 502 })
  }
}
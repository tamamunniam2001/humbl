import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, pageAccessOnly } from '@/lib/auth'
import { sendFonnte } from '@/lib/fonnte'
import { phoneCandidates } from '@/lib/wa-bot'
import { isVoucherAvailable, renderTemplate, templateNeedsVoucher } from '@/lib/wa-templates'

// POST /api/members/broadcast — kirim pesan ke semua member aktif
// Body: { templateId, voucherId? }
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = pageAccessOnly(user, '/members')
  if (denied) return denied

  const body = await req.json().catch(() => ({}))

  const template = body.templateId
    ? await prisma.messageTemplate.findUnique({ where: { id: String(body.templateId) } })
    : null
  if (!template) return NextResponse.json({ message: 'Pilih template pesan terlebih dahulu' }, { status: 400 })
  if (!template.isActive) return NextResponse.json({ message: 'Template pesan sedang nonaktif' }, { status: 400 })

  let voucher = null
  if (templateNeedsVoucher(template)) {
    if (!body.voucherId)
      return NextResponse.json({ message: 'Pilih kode voucher terlebih dahulu' }, { status: 400 })
    voucher = await prisma.voucher.findUnique({ where: { id: String(body.voucherId) } })
    if (!voucher) return NextResponse.json({ message: 'Voucher tidak ditemukan' }, { status: 400 })
    if (!isVoucherAvailable(voucher))
      return NextResponse.json({ message: `Voucher ${voucher.code} tidak tersedia` }, { status: 400 })
  }

  if (!process.env.FONNTE_TOKEN)
    return NextResponse.json({ message: 'FONNTE_TOKEN belum diset' }, { status: 500 })

  const members = await prisma.member.findMany({
    where: { isActive: true },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  })

  let sent = 0, failed = 0, skipped = 0

  for (const m of members) {
    const target = phoneCandidates(m.phone).find(c => c.startsWith('62'))
    if (!target) { skipped++; continue }
    const message = renderTemplate(template.body, { memberName: m.name, voucher })
    if (!message) { skipped++; continue }
    try {
      await sendFonnte({ target, message })
      sent++
      await new Promise(r => setTimeout(r, 1000))
    } catch {
      failed++
    }
  }

  return NextResponse.json({ success: true, sent, failed, skipped, total: members.length })
}

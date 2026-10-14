import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendFonnte } from '@/lib/fonnte'
import {
  phoneCandidates,
  parseCommand,
  formatMenu,
  formatMember,
  formatMemberNotFound,
  formatRiwayat,
  formatStruk,
  formatStrukNeedCode,
} from '@/lib/wa-bot'

// ---------------------------------------------------------------------------
// Webhook bot WhatsApp — Fonnte memanggil endpoint ini saat ada pesan masuk.
// Cara pasang: dashboard Fonnte → Device → Edit → Webhook URL isi
//   https://<domain-app>/api/webhooks/fonnte?secret=<WA_WEBHOOK_SECRET>
// (secret opsional — Fonnte tidak menandatangani request, jadi kunci URL
//  dengan WA_WEBHOOK_SECRET bila sudah diset). Aktifkan juga "autoread" dan
//  "inbox" agar inboxid untuk membalas thread tersedia.
//
// Perintah bot: MENU, MEMBER, RIWAYAT, STRUK <kode> (lihat lib/wa-bot.js).
// ---------------------------------------------------------------------------

// Fonnte mengirim JSON; fallback form-data untuk jaga-jaga.
async function parsePayload(req) {
  try {
    return await req.json()
  } catch {}
  try {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  } catch {}
  return {}
}

// Nama toko dari ReceiptSettings (singleton) untuk branding pesan bot.
async function getStoreName() {
  try {
    const s = await prisma.receiptSettings.findFirst({ select: { storeName: true } })
    return s?.storeName || 'Hambl'
  } catch {
    return 'Hambl'
  }
}

// Lookup member dengan kandidat nomor — Member.phone disimpan apa adanya
// ("08xx"/"628xx"/"+62xx"), pengirim Fonnte selalu format 628xx.
async function findMember(sender) {
  const candidates = phoneCandidates(sender)
  if (!candidates.length) return null
  return prisma.member.findFirst({ where: { OR: candidates.map(phone => ({ phone })) } })
}

// Susun balasan sesuai perintah. Query mengikuti pola API yang sudah ada
// (GET /api/members untuk agregat; filter status COMPLETED & deletedAt null).
async function buildReply(text, sender, senderName) {
  const store = await getStoreName()
  const { cmd, arg } = parseCommand(text)

  if (cmd === 'menu') return formatMenu({ storeName: store, senderName })

  if (cmd === 'member') {
    const member = await findMember(sender)
    if (!member) return formatMemberNotFound(store)
    const [countRow, aggRows] = await Promise.all([
      prisma.member.findUnique({
        where: { id: member.id },
        select: { _count: { select: { transactions: { where: { status: 'COMPLETED', deletedAt: null } } } } },
      }),
      prisma.transaction.groupBy({
        by: ['memberId'],
        where: { memberId: member.id, status: 'COMPLETED', deletedAt: null },
        _sum: { total: true },
        _max: { createdAt: true },
      }),
    ])
    const agg = aggRows.find(x => x.memberId === member.id)
    return formatMember(member, {
      purchaseCount: countRow?._count.transactions || 0,
      totalSpent: agg?._sum.total || 0,
      lastPurchase: agg?._max.createdAt || null,
    })
  }

  if (cmd === 'riwayat') {
    const member = await findMember(sender)
    if (!member) return formatMemberNotFound(store)
    const txs = await prisma.transaction.findMany({
      where: { memberId: member.id, status: 'COMPLETED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        invoiceNo: true,
        total: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    })
    return formatRiwayat(txs)
  }

  if (cmd === 'struk') {
    const code = String(arg || '').trim()
    if (!code) return formatStrukNeedCode()
    const tx = await prisma.transaction.findFirst({
      where: { invoiceNo: { equals: code, mode: 'insensitive' }, deletedAt: null },
      include: {
        items: true,
        cashier: { select: { name: true } },
        member: { select: { name: true } },
      },
    })
    if (!tx) {
      return `Struk dengan kode *${code}* tidak ditemukan.\nCek lagi kode di struk Anda, atau ketik *MENU* untuk perintah lain.`
    }
    return formatStruk(tx)
  }

  return formatMenu({ storeName: store, senderName, unknown: true })
}

export async function POST(req) {
  try {
    // 1) Kunci webhook opsional (lihat catatan di atas).
    const secret = process.env.WA_WEBHOOK_SECRET
    if (secret) {
      const q = new URL(req.url).searchParams.get('secret')
      const h = req.headers.get('x-webhook-secret')
      if (q !== secret && h !== secret) {
        return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
      }
    }

    const payload = await parsePayload(req)
    const sender = String(payload.sender || '').trim()
    const text = String(payload.message || payload.text || '').trim()

    // 2) Abaikan: tanpa pengirim, pesan kosong/media-only, pesan grup
    //    (payload.member terisi) dan pesan keluar (fromMe) agar bot hanya
    //    menjawab chat pribadi pelanggan.
    const isOwn = payload.fromMe === true || payload.fromMe === 'true'
    if (!sender || !text || payload.member || isOwn) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const reply = await buildReply(text, sender, String(payload.name || '').trim())

    // 3) Mode test: balasan di-log & dikembalikan di response tanpa kirim asli.
    if (process.env.WA_DRY_RUN === '1') {
      console.log(`[wa-bot dry-run] → ${sender}\n${reply}`)
      return NextResponse.json({ ok: true, dry: true, reply })
    }

    await sendFonnte({
      target: sender,
      message: reply,
      inboxid: payload.inboxid || undefined,
      typing: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Balas 200 juga saat gagal agar Fonnte tidak retry berulang; error tetap
    // tercatat di log server.
    console.error('fonnte webhook error:', e)
    return NextResponse.json({ ok: false, message: e.message })
  }
}

// Health-check sederhana (verifikasi URL webhook secara manual).
export async function GET() {
  return NextResponse.json({ ok: true, service: 'hambl-wa-bot' })
}

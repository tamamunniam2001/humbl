// lib/wa-bot.js — logika murni bot WhatsApp Hambl (tanpa I/O: tidak ada
// Prisma/fetch, semuanya murni fungsi) supaya mudah diuji oleh
// scripts/test-wa-bot.cjs. Route app/api/webhooks/fonnte/route.js bertugas
// query database dan mengirim balasan memakai fungsi-fungsi di sini.

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })

const fmtDate = d => (d
  ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  : '-')
const fmtDateTime = d => (d
  ? new Date(d).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    })
  : '-')

const TX_STATUS_LABEL = { COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan', PENDING: 'Tertunda' }
const PAY_METHOD_LABEL = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', NONTUNAI: 'Non-tunai' }

// ---------------------------------------------------------------------------
// Normalisasi nomor telepon
// ---------------------------------------------------------------------------

// Member.phone disimpan apa adanya saat input kasir (POST /api/members hanya
// membuang spasi/tanda hubung), jadi bisa "08xx", "628xx", atau "+62xx".
// Kembalikan semua kandidat format agar lookup dari nomor WhatsApp pengirim
// (format Fonnte: 628xx) selalu cocok.
export function phoneCandidates(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return []
  const set = new Set([digits])
  if (digits.startsWith('0')) set.add('62' + digits.slice(1))
  else if (digits.startsWith('62')) set.add('0' + digits.slice(2))
  else if (digits.startsWith('8')) {
    set.add('62' + digits)
    set.add('0' + digits)
  }
  return [...set]
}

// ---------------------------------------------------------------------------
// Parsing perintah
// ---------------------------------------------------------------------------

const MENU_WORDS = ['menu', 'help', 'bantuan', '0', 'hi', 'hai', 'halo', 'hello', 'ping']
const MEMBER_WORDS = ['member', 'memberku', 'info', 'profil', 'anggota', '1']
const RIWAYAT_WORDS = ['riwayat', 'transaksi', 'history', '2']

// Deteksi kasar kode struk yang dikirim tanpa perintah (mis. "INV-12345" atau
// "123456"): kombinasi alfanumerik 4–40 karakter yang mengandung angka, dengan
// pola kode faktur yang umum (angka murni, berpisah "-", atau huruf+angka).
function looksLikeInvoice(v) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]{3,39}$/.test(v) || !/\d/.test(v)) return false
  return /^\d+$/.test(v) || /[-_/]/.test(v) || /^[A-Za-z]+\d+$/.test(v)
}

/**
 * Terjemahkan teks pesan menjadi perintah bot.
 * @returns {{ cmd: 'menu'|'member'|'riwayat'|'struk'|'unknown', arg: string }}
 *   `arg` untuk struk mempertahankan huruf besar/kecil asli kode.
 */
export function parseCommand(text) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ')
  if (!clean) return { cmd: 'unknown', arg: '' }

  const first = clean.split(' ')[0].toLowerCase()
  const restOriginal = clean.includes(' ') ? clean.slice(clean.indexOf(' ') + 1).trim() : ''

  if (MENU_WORDS.includes(first)) return { cmd: 'menu', arg: restOriginal }
  if (MEMBER_WORDS.includes(first)) return { cmd: 'member', arg: restOriginal }
  if (RIWAYAT_WORDS.includes(first)) return { cmd: 'riwayat', arg: restOriginal }
  if (first === 'struk' || first === 'cek') return { cmd: 'struk', arg: restOriginal }
  if (looksLikeInvoice(clean)) return { cmd: 'struk', arg: clean }
  return { cmd: 'unknown', arg: clean }
}

// ---------------------------------------------------------------------------
// Format balasan (gaya WhatsApp: *bold*, daftar pakai "•")
// ---------------------------------------------------------------------------

export function formatMenu({ storeName, senderName, unknown = false } = {}) {
  const who = senderName ? `, ${senderName}` : ''
  const lines = []
  if (unknown) lines.push('Maaf, perintah tidak dikenali.', '')
  lines.push(
    `Halo${who} 👋`,
    `Selamat datang di *${storeName || 'Hambl'}*.`,
    '',
    'Ketik salah satu perintah:',
    '• *MENU* — tampilkan menu ini',
    '• *MEMBER* — info & total belanja member Anda',
    '• *RIWAYAT* — 5 transaksi terakhir Anda',
    '• *STRUK <kode>* — detail struk (contoh: STRUK INV-12345)',
  )
  return lines.join('\n')
}

export function formatMemberNotFound(storeName) {
  return [
    `Nomor ini belum terdaftar sebagai member di *${storeName || 'Hambl'}*.`,
    'Silakan daftar di kasir terlebih dahulu.',
    '',
    'Ketik *MENU* untuk perintah lain.',
  ].join('\n')
}

// @param {object} member  baris prisma.member
// @param {object} agg     { purchaseCount, totalSpent, lastPurchase }
export function formatMember(member, agg = {}) {
  const lines = [
    '👤 *INFO MEMBER*',
    `Nama: ${member.name}`,
    `Nomor: ${member.phone}`,
    `Terdaftar: ${fmtDate(member.createdAt)}`,
  ]
  if (member.isActive === false) lines.push('Status: Nonaktif')
  lines.push(
    `Jumlah transaksi: ${agg.purchaseCount || 0}x`,
    `Total belanja: ${rp(agg.totalSpent || 0)}`,
    `Transaksi terakhir: ${agg.lastPurchase ? fmtDate(agg.lastPurchase) : '-'}`,
  )
  return lines.join('\n')
}

// @param {Array} txs  transaksi terakhir (orderBy createdAt desc, max 5)
export function formatRiwayat(txs = []) {
  if (!txs.length) {
    return [
      'Belum ada riwayat transaksi atas nomor ini.',
      '',
      'Ketik *MENU* untuk perintah lain.',
    ].join('\n')
  }
  const lines = ['🧾 *RIWAYAT TRANSAKSI*']
  txs.forEach((tx, i) => {
    const itemCount = tx._count?.items
    lines.push(`${i + 1}. ${fmtDate(tx.createdAt)} • ${tx.invoiceNo}`)
    lines.push(`   ${rp(tx.total)}${itemCount ? ` (${itemCount} item)` : ''}`)
  })
  lines.push('', `Ketik *STRUK ${txs[0].invoiceNo}* untuk detail struk.`)
  return lines.join('\n')
}

export function formatStrukNeedCode() {
  return [
    'Format: *STRUK <kode struk>*',
    'Contoh: *STRUK INV-12345*',
    '',
    'Kode tercetak di struk belanja Anda.',
  ].join('\n')
}

// @param {object} tx  prisma.transaction + items + cashier + member (lihat route webhook)
export function formatStruk(tx) {
  const items = tx.items || []
  const subtotal = items.reduce((s, it) => s + Number(it.subtotal || 0), 0)
  const diskon = Number(tx.discountAmount || 0) + Number(tx.voucherDiscount || 0)

  const lines = [
    `🧾 *STRUK ${tx.invoiceNo}*`,
    `Tanggal: ${fmtDateTime(tx.createdAt)}`,
  ]
  if (tx.cashier?.name) lines.push(`Kasir: ${tx.cashier.name}`)
  if (tx.customerName) lines.push(`Pelanggan: ${tx.customerName}`)
  if (tx.member?.name) lines.push(`Member: ${tx.member.name}`)
  lines.push('', 'Item:')
  items.forEach(it => lines.push(`• ${it.qty}x ${it.name || it.product?.name || '-'} — ${rp(it.subtotal)}`))
  if (!items.length) lines.push('(tidak ada detail item)')
  lines.push('', `Subtotal: ${rp(subtotal)}`)
  if (diskon > 0) lines.push(`Diskon${tx.voucherCode ? ` (${tx.voucherCode})` : ''}: -${rp(diskon)}`)
  if (Number(tx.taxAmount || 0) > 0) lines.push(`Pajak: ${rp(tx.taxAmount)}`)
  lines.push(
    `*Total: ${rp(tx.total)}*`,
    `Bayar (${PAY_METHOD_LABEL[tx.payMethod] || tx.payMethod || '-'}): ${rp(tx.payment)}`,
    `Kembalian: ${rp(tx.change)}`,
    `Status: ${TX_STATUS_LABEL[tx.status] || tx.status}`,
  )
  return lines.join('\n')
}

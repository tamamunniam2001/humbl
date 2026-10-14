// lib/wa-templates.js — logika murni template pesan WhatsApp (tanpa I/O:
// tidak ada Prisma/fetch) supaya mudah diuji oleh scripts/test-wa-bot.cjs dan
// bisa dipakai bersamaan oleh route kirim pesan (server) dan popup kirim pesan
// di halaman Daftar Member (client) untuk preview.

const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })

const fmtDate = d => (d
  ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  : '-')

// Placeholder yang didukung di body template.
export const TEMPLATE_PLACEHOLDERS = ['{nama}', '{kode_voucher}', '{detail_voucher}']

/**
 * Teks ringkasan voucher untuk placeholder {detail_voucher}.
 * Contoh: "Diskon 10% (maks. Rp 20.000) · min. belanja Rp 50.000 · berlaku s/d 31 Oct 2026"
 */
export function voucherDetailText(v) {
  if (!v) return ''
  const parts = []
  if (v.type === 'NOMINAL') parts.push(`Potongan ${rp(v.value)}`)
  else parts.push(`Diskon ${v.value}%${Number(v.maxDiscount) > 0 ? ` (maks. ${rp(v.maxDiscount)})` : ''}`)
  if (Number(v.minSpend) > 0) parts.push(`min. belanja ${rp(v.minSpend)}`)
  if (v.startDate && v.endDate) parts.push(`berlaku ${fmtDate(v.startDate)}–${fmtDate(v.endDate)}`)
  else if (v.endDate) parts.push(`berlaku s/d ${fmtDate(v.endDate)}`)
  else if (v.startDate) parts.push(`berlaku mulai ${fmtDate(v.startDate)}`)
  return parts.join(' · ')
}

/**
 * Voucher boleh dipilih/dikirim: aktif, kuota masih ada, sudah mulai berlaku
 * dan belum kedaluwarsa. (Aturan sama dengan pemakaian voucher di kasir.)
 */
export function isVoucherAvailable(v, now = new Date()) {
  if (!v || !v.isActive) return false
  if (v.startDate && now < new Date(v.startDate)) return false
  if (v.endDate && now > new Date(v.endDate)) return false
  if (v.quota > 0 && v.usedCount >= v.quota) return false
  return true
}

/**
 * Template membutuhkan pilihan kode voucher? true bila inputType-nya
 * VOUCHER_CODE atau body-nya memuat placeholder {kode_voucher}.
 */
export function templateNeedsVoucher(t) {
  if (!t) return false
  return t.inputType === 'VOUCHER_CODE' || String(t.body || '').includes('{kode_voucher}')
}

/**
 * Isi placeholder template dengan data member + voucher (voucher boleh null
 * untuk template tanpa input voucher). Kembalikan teks siap kirim.
 */
export function renderTemplate(body, { memberName = '', voucher = null } = {}) {
  let text = String(body || '')
  text = text.replaceAll('{nama}', memberName || '-')
  if (voucher) {
    text = text.replaceAll('{kode_voucher}', String(voucher.code || ''))
    text = text.replaceAll('{detail_voucher}', voucherDetailText(voucher))
  } else {
    // {detail_voucher} tanpa voucher → buang supaya tidak menyisakan teks
    // placeholder; {kode_voucher} dibiarkan agar route bisa menolak dengan
    // pesan jelas ("pilih kode voucher") lewat templateNeedsVoucher().
    text = text.replaceAll('{detail_voucher}', '')
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
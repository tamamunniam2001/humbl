// lib/fonnte.js — pengirim pesan WhatsApp via Fonnte API (gateway yang sudah
// dipakai aplikasi ini untuk kirim laporan stock opname). Semua pengiriman
// lewat satu tempat ini agar perilaku (auth, format, penanganan error) konsisten.

const FONNTE_SEND_URL = 'https://api.fonnte.com/send'

/**
 * Kirim satu pesan WhatsApp lewat Fonnte.
 *
 * @param {object} opts
 * @param {string} opts.target              nomor tujuan (628xx) atau group id
 * @param {string} opts.message             isi pesan (mendukung *bold* WhatsApp)
 * @param {string} [opts.url]               URL lampiran (opsional)
 * @param {string} [opts.filename]          nama file lampiran (opsional)
 * @param {boolean} [opts.typing]           tampilkan indikator mengetik (default true)
 * @param {number|string} [opts.inboxid]    inboxid hasil webhook → balasan masuk
 *                                          ke thread yang sama (docs Fonnte)
 * @returns {Promise<object>}               respons JSON Fonnte ({ status: true, ... })
 * @throws {Error} bila token kosong / Fonnte membalas gagal
 */
export async function sendFonnte({ target, message, url, filename, typing = true, inboxid }) {
  const token = process.env.FONNTE_TOKEN
  if (!token) throw new Error('FONNTE_TOKEN belum diset')

  const body = { target, message }
  if (typing) body.typing = true
  if (url) body.url = url
  if (filename) body.filename = filename
  if (inboxid !== undefined && inboxid !== null && inboxid !== '') body.inboxid = Number(inboxid) || inboxid

  const res = await fetch(FONNTE_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))

  // Fonnte memakai field `status` di body, bukan hanya HTTP status code.
  // Auth token mentah tanpa prefix "Bearer" (dokumentasi Fonnte).
  if (!res.ok || data.status !== true) {
    throw new Error(data.reason || data.detail || `Fonnte HTTP ${res.status}`)
  }
  return data
}

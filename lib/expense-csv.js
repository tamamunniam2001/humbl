// Parser CSV pengeluaran / belanja operasional.
// Format kolom: Tanggal, Kode, Kategori, Nama, Keterangan, Satuan, Harga, Isi, Qty
// Pemisah kolom otomatis: Tab, ';' (Excel Eropa), atau ','

function parseDate(str) {
  if (!str) return null
  const s = String(str).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseLine(line, sep) {
  if (sep === '\t') return line.split('\t').map(c => c.trim())
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim()); current = ''
    } else { current += ch }
  }
  result.push(current.trim())
  return result
}

/**
 * Parse isi file CSV menjadi kelompok item per tanggal.
 *
 * @param {string} text        isi file CSV (boleh ada BOM)
 * @param {Array}  expenseItems master ExpenseItem ({ id, code, name, category, satuan })
 * @param {Object} opts
 * @param {boolean} opts.matchByName  bila kode kosong/tidak ditemukan, coba cocokkan
 *                                    nama item ke ExpenseItem supaya `expenseItemId`
 *                                    (dan kategorinya) tetap tersimpan
 * @returns {{ byDate: Record<string, Array>, errors: string[], skipped: number } | null}
 *          `null` bila file kosong / tidak valid
 */
export function parseExpenseCsv(text, expenseItems = [], opts = {}) {
  const { matchByName = false } = opts

  const clean = String(text ?? '').replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/)
  const dataLines = lines.slice(1)

  if (dataLines.filter(l => l.trim()).length === 0) return null

  const header = lines[0] || ''
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ','

  const itemByCode = Object.fromEntries(
    expenseItems.filter(i => i.code).map(i => [String(i.code).trim().toLowerCase(), i])
  )
  const itemByName = matchByName
    ? Object.fromEntries(expenseItems.filter(i => i.name).map(i => [String(i.name).trim().toLowerCase(), i]))
    : {}

  let skipped = 0
  const errors = []

  // Group rows by date
  const byDate = {}
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim()
    if (!line) continue
    const rowNum = i + 2
    let cols
    try { cols = parseLine(line, sep) } catch {
      errors.push(`Baris ${rowNum}: Gagal parse`); skipped++; continue
    }
    if (cols.length < 5) {
      errors.push(`Baris ${rowNum}: Kolom tidak lengkap (${cols.length} kolom)`); skipped++; continue
    }

    const [dateStr, codeRaw, kategoriRaw, nameRaw, keterangan, satuanRaw, hargaStr, isiStr, qtyStr] = cols
    const date = parseDate(dateStr)
    const harga = parseFloat(String(hargaStr || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
    const isiRaw = parseFloat(String(isiStr || '').replace(/[^0-9.,]/g, '').replace(',', '.'))
    const isi = isNaN(isiRaw) || isiRaw <= 0 ? null : isiRaw
    const qty = parseFloat(String(qtyStr || '1').replace(/[^0-9.,]/g, '').replace(',', '.')) || 1
    const codeStr = (codeRaw?.trim() === '-' || !codeRaw?.trim()) ? '' : codeRaw.trim()

    if (!date || isNaN(date.getTime())) {
      errors.push(`Baris ${rowNum}: Tanggal tidak valid "${dateStr}"`); skipped++; continue
    }

    let name, satuan, category = '', expenseItemId = null
    const byCode = codeStr ? itemByCode[codeStr.toLowerCase()] : null
    if (byCode) {
      name = byCode.name
      satuan = byCode.satuan || ''
      category = byCode.category || ''
      expenseItemId = byCode.id
    } else {
      name = nameRaw?.trim() || ''
      satuan = satuanRaw || ''
      category = kategoriRaw || ''
      // Fallback: cocokkan nama ke master ExpenseItem agar item tetap terhubung
      const byName = matchByName && name ? itemByName[name.toLowerCase()] : null
      if (byName) expenseItemId = byName.id
    }

    if (!name) {
      errors.push(`Baris ${rowNum}: Nama item kosong (kode "${codeStr}" tidak ditemukan di database)`); skipped++; continue
    }
    if (harga <= 0) {
      errors.push(`Baris ${rowNum}: Harga tidak valid "${hargaStr}"`); skipped++; continue
    }

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (!byDate[dateKey]) byDate[dateKey] = []
    byDate[dateKey].push({ expenseItemId, name, category, keterangan: keterangan || '', satuan, harga, isi, qty })
  }

  return { byDate, errors, skipped }
}

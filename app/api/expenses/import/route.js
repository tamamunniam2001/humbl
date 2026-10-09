import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

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

export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file) return NextResponse.json({ message: 'File tidak ditemukan' }, { status: 400 })

  const text = await file.text()
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/)
  const dataLines = lines.slice(1)

  if (dataLines.filter(l => l.trim()).length === 0)
    return NextResponse.json({ message: 'File kosong atau tidak valid' }, { status: 400 })

  const header = lines[0] || ''
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ','

  // Pre-load all expense items for code lookup
  const expenseItems = await prisma.expenseItem.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, category: true, satuan: true } })
  const itemByCode = Object.fromEntries(expenseItems.filter(i => i.code).map(i => [i.code.trim().toLowerCase(), i]))

  let created = 0, skipped = 0
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

    // Format: Tanggal, Kode, Kategori, Nama, Keterangan, Satuan, Harga, Isi, Qty
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
    if (codeStr) {
      const found = itemByCode[codeStr.toLowerCase()]
      if (found) {
        name = found.name
        satuan = found.satuan || ''
        category = found.category || ''
        expenseItemId = found.id
      } else {
        name = nameRaw?.trim() || ''
        satuan = satuanRaw || ''
        category = kategoriRaw || ''
      }
    } else {
      name = nameRaw?.trim() || ''
      satuan = satuanRaw || ''
      category = kategoriRaw || ''
    }

    if (!name) {
      errors.push(`Baris ${rowNum}: Nama item kosong (kode "${codeStr}" tidak ditemukan di database)`); skipped++; continue
    }
    if (harga <= 0) {
      errors.push(`Baris ${rowNum}: Harga tidak valid "${hargaStr}"`); skipped++; continue
    }

    const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    if (!byDate[dateKey]) byDate[dateKey] = []
    byDate[dateKey].push({ expenseItemId, name, category, keterangan: keterangan || '', satuan, harga, isi, qty })
  }

  // Create one Expense per date
  for (const [dateKey, items] of Object.entries(byDate)) {
    const details = items.map(i => ({
      expenseItemId: i.expenseItemId,
      name: i.name, category: i.category, keterangan: i.keterangan, satuan: i.satuan,
      harga: i.harga, isi: i.isi ?? null, qty: i.qty, subtotal: i.harga * i.qty,
    }))
    const total = details.reduce((s, d) => s + d.subtotal, 0)
    try {
      await prisma.expense.create({
        data: {
          date: new Date(`${dateKey}T00:00:00`), total, catatan: 'Import CSV', cashierId: user.id,
          items: { create: details },
        },
      })
      created += items.length
    } catch (e) {
      errors.push(`Tanggal ${dateKey}: ${e.message}`)
      skipped += items.length
    }
  }

  return NextResponse.json({ created, skipped, total: created + skipped, errors, debug: Object.keys(byDate) }, { status: 201 })
}

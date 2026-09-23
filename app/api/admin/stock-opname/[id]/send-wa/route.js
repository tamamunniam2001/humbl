import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { jsPDF } from 'jspdf'
import { put, del } from '@vercel/blob'

const fmtRp = n => 'Rp ' + Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const fmt = n => Number(n) % 1 !== 0 ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: 4 }) : Number(n).toLocaleString('id-ID')
const fmtDate = d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })

function generatePDFBuffer(opname, items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = 515
  const ML = 40

  // Header
  doc.setFillColor(30, 42, 59)
  doc.rect(ML, 40, W, 55, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('LAPORAN STOCK OPNAME', ML + 15, 68)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Tanggal: ${fmtDate(opname.date)}  |  Oleh: ${opname.user?.name}  |  Status: ${opname.status}`, ML + 15, 84)
  if (opname.note) doc.text(`Catatan: ${opname.note}`, ML + 15, 96)

  // Summary bar
  const totalItem = items.length
  const sudahDiisi = items.filter(i => i.qtyActual > 0).length
  const belumDiisi = items.filter(i => i.qtyActual === 0).length
  const totalNilai = items.reduce((s, i) => s + (i.qtyActual * (i.hargaTerakhir || 0)), 0)

  const summaries = [
    { label: 'Total Item', val: String(totalItem), r: 74, g: 124, b: 199 },
    { label: 'Sudah Diisi', val: String(sudahDiisi), r: 16, g: 185, b: 129 },
    { label: 'Belum Diisi', val: String(belumDiisi), r: 245, g: 158, b: 11 },
    { label: 'Total Nilai', val: fmtRp(totalNilai), r: 139, g: 92, b: 246 },
  ]
  const boxW = W / 4
  summaries.forEach((s, i) => {
    const x = ML + i * boxW
    doc.setFillColor(i % 2 === 0 ? 248 : 241, i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 252 : 249)
    doc.rect(x, 105, boxW, 40, 'F')
    doc.setTextColor(s.r, s.g, s.b)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(s.val, x + 8, 122, { maxWidth: boxW - 16 })
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(s.label, x + 8, 136)
  })

  // Tabel
  const cols = { no: ML, nama: ML + 20, kategori: ML + 158, qty: ML + 266, harga: ML + 334, nilai: ML + 407 }
  const colW = { no: 18, nama: 136, kategori: 106, qty: 66, harga: 71, nilai: 108 }
  let y = 158

  const drawHeader = (y) => {
    doc.setFillColor(30, 42, 59)
    doc.rect(ML, y, W, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('No', cols.no + 2, y + 12)
    doc.text('Nama Barang', cols.nama, y + 12)
    doc.text('Kategori', cols.kategori, y + 12)
    doc.text('Qty Aktual', cols.qty + colW.qty / 2, y + 12, { align: 'center' })
    doc.text('Harga', cols.harga + colW.harga, y + 12, { align: 'right' })
    doc.text('Nilai Stok', cols.nilai + colW.nilai, y + 12, { align: 'right' })
  }

  drawHeader(y)
  y += 18

  items.forEach((item, idx) => {
    const rowH = 15
    if (y + rowH > 800) {
      doc.addPage(); y = 40
      drawHeader(y); y += 18
    }
    const isZero = item.qtyActual === 0
    if (isZero) doc.setFillColor(255, 251, 235)
    else if (idx % 2 === 0) doc.setFillColor(255, 255, 255)
    else doc.setFillColor(248, 250, 252)
    doc.rect(ML, y, W, rowH, 'F')

    const nama = item.inventoryItem?.name || item.itemName || ''
    const kategori = item.inventoryItem?.category || item.expenseItem?.category || ''
    const satuanTampil = (item.satuanOpname && item.konversi) ? item.satuanOpname : (item.inventoryItem?.satuan || item.satuan || '')
    const qtyTampil = (item.satuanOpname && item.konversi) ? item.qtyActual / item.konversi : item.qtyActual
    const harga = item.hargaTerakhir || 0
    const nilai = item.qtyActual * harga

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(String(idx + 1), cols.no + 2, y + 10)
    doc.text(doc.splitTextToSize(nama, colW.nama - 4)[0], cols.nama, y + 10)
    doc.setTextColor(100, 116, 139)
    doc.text(doc.splitTextToSize(kategori, colW.kategori - 4)[0], cols.kategori, y + 10)
    doc.setTextColor(isZero ? 245 : 30, isZero ? 158 : 41, isZero ? 11 : 59)
    doc.text(`${fmt(qtyTampil)} ${satuanTampil}`, cols.qty + colW.qty / 2, y + 10, { align: 'center' })
    doc.setTextColor(100, 116, 139)
    doc.text(harga > 0 ? fmtRp(harga) : '-', cols.harga + colW.harga, y + 10, { align: 'right' })
    doc.setTextColor(139, 92, 246)
    doc.text(nilai > 0 ? fmtRp(nilai) : '-', cols.nilai + colW.nilai, y + 10, { align: 'right' })

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(ML, y + rowH, ML + W, y + rowH)
    y += rowH
  })

  // Footer total
  y += 4
  doc.setFillColor(30, 42, 59)
  doc.rect(ML, y, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL NILAI STOK', ML + 15, y + 14)
  doc.text(fmtRp(totalNilai), cols.nilai + colW.nilai, y + 14, { align: 'right' })

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, ML + W, doc.internal.pageSize.height - 20, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}

export async function POST(req, { params }) {
  try {
    const { error } = verifyAuth(req)
    if (error) return error

    const { id } = await params
    const { targets, caption } = await req.json()

    if (!targets?.length) return NextResponse.json({ message: 'Pilih minimal satu tujuan' }, { status: 400 })

    const token = process.env.FONNTE_TOKEN
    if (!token) return NextResponse.json({ message: 'FONNTE_TOKEN belum diset' }, { status: 500 })

    const opname = await prisma.stockOpname.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        items: { include: { expenseItem: true, inventoryItem: true } },
      },
    })
    if (!opname) return NextResponse.json({ message: 'Opname tidak ditemukan' }, { status: 404 })

    const expenseItemIds = opname.items.map(i => i.expenseItemId).filter(Boolean)
    const lastPrices = await prisma.expenseDetail.findMany({
      where: { expenseItemId: { in: expenseItemIds } },
      orderBy: { expense: { date: 'desc' } },
      distinct: ['expenseItemId'],
      select: { expenseItemId: true, harga: true },
    })
    const priceMap = Object.fromEntries(lastPrices.map(p => [p.expenseItemId, Number(p.harga)]))

    const items = opname.items.map(i => ({
      ...i,
      hargaTerakhir: i.isManual ? (i.hargaManual ?? null) : (i.expenseItemId ? (priceMap[i.expenseItemId] ?? null) : null),
      satuanOpname: i.expenseItem?.satuanOpname || null,
      konversi: i.expenseItem?.konversi || null,
    })).sort((a, b) => (a.inventoryItem?.name || a.itemName || '').localeCompare(b.inventoryItem?.name || b.itemName || ''))

    let pdfBuffer
    try {
      pdfBuffer = generatePDFBuffer(opname, items)
    } catch (pdfErr) {
      console.error('PDF error:', pdfErr)
      return NextResponse.json({ message: `Gagal generate PDF: ${pdfErr.message}` }, { status: 500 })
    }

    // Upload PDF ke Vercel Blob (public URL sementara)
    const filename = `opname-${id}-${Date.now()}.pdf`
    const blob = await put(filename, pdfBuffer, { access: 'public', contentType: 'application/pdf' })
    const pdfUrl = blob.url
    console.log('PDF URL:', pdfUrl)

    const results = []
    for (const target of targets) {
      try {
        const form = new FormData()
        form.append('target', target)
        form.append('message', caption || 'Laporan Stock Opname')
        form.append('file', pdfUrl)

        const res = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: token },
          body: form,
        })
        const result = await res.json()
        console.log('Fonnte response:', JSON.stringify(result))

        results.push({ target, success: result.status === true, detail: result })
      } catch (sendErr) {
        results.push({ target, success: false, detail: { reason: sendErr.message } })
      }
    }

    const allFailed = results.every(r => !r.success)
    if (allFailed) {
      return NextResponse.json({
        message: results[0]?.detail?.reason || results[0]?.detail?.message || 'Gagal mengirim',
        debug: results
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, results, pdfUrl })
  } catch (e) {
    console.error('send-wa error:', e)
    return NextResponse.json({ message: e.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * analyze-kategori.cjs — ANALISIS READ-ONLY (hanya SELECT, tidak mengubah data).
 *
 * Masalah: pengeluaran yang berasal dari "Belanja Operasional" yang di-ACC admin
 * menjadi Expense/ExpenseDetail. Untuk item manual (tanpa ExpenseItem), kategori
 * di-hardcode jadi 'Operasional' padahal user sudah memilih kategori spesifik
 * (mis. Listrik, Gas, Kebersihan, ATK, dll).
 *
 * Script ini menghitung berapa ExpenseDetail yang kategorinya 'Operasional',
 * lalu memisahkan mana yang bisa dikoreksi otomatis (punya expenseItemId →
 * ambil kategori terkini dari ExpenseItem) dan mana yang manual (perlu review).
 *
 * Jalankan dari folder project:
 *   node --env-file=.env scripts/analyze-kategori.cjs
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const pad = (s, n) => String(s).padEnd(n)

;(async () => {
  try {
    let host = '(tidak terbaca)'
    try { host = new URL(process.env.DATABASE_URL).host } catch {}
    console.log('DB host : ' + host)
    console.log('')

    // 1) Semua ExpenseDetail yang kategorinya tepat 'Operasional'
    const opDetails = await prisma.expenseDetail.findMany({
      where: { category: 'Operasional' },
      select: {
        id: true,
        name: true,
        category: true,
        expenseItemId: true,
        expenseItem: { select: { category: true, name: true } },
        expense: { select: { catatan: true, date: true } },
      },
    })

    console.log('ExpenseDetail dengan category = "Operasional": ' + opDetails.length)

    // 2) Yang berasal dari Belanja Operasional (catatan Expense diawali "[Belanja Operasional]")
    const fromBelanja = opDetails.filter(d => (d.expense?.catatan || '').startsWith('[Belanja Operasional]'))
    console.log('  - dari Belanja Operasional  : ' + fromBelanja.length)
    console.log('  - dari sumber lain          : ' + (opDetails.length - fromBelanja.length))

    // 3) Yang punya expenseItemId → bisa dikoreksi otomatis pakai kategori ExpenseItem terkini
    const withItem = opDetails.filter(d => d.expenseItemId)
    const withItemHasCat = withItem.filter(d => d.expenseItem && d.expenseItem.category)
    console.log('')
    console.log('Bisa dikoreksi OTOMATIS (punya expenseItemId dgn kategori ExpenseItem): ' + withItemHasCat.length)
    console.log('Manual (expenseItemId null) → butuh review kategori: ' + (opDetails.length - withItem.length))
    console.log('')

    // 4) Rincian distribusi kategori ExpenseItem terkini untuk yang bisa dikoreksi
    const byNewCat = {}
    withItemHasCat.forEach(d => {
      const c = d.expenseItem.category
      byNewCat[c] = (byNewCat[c] || 0) + 1
    })
    if (Object.keys(byNewCat).length) {
      console.log('Distribusi kategori tujuan (auto-fix):')
      Object.entries(byNewCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
        console.log('  ' + pad(c, 24) + n)
      })
      console.log('')
    }

    // 5) Contoh item manual (untuk review) — maks 30 baris
    const manual = opDetails.filter(d => !d.expenseItemId)
    if (manual.length) {
      console.log('Contoh item MANUAL (perlu review kategori, tampil ' + Math.min(30, manual.length) + ' dari ' + manual.length + '):')
      manual.slice(0, 30).forEach(d => {
        const date = d.expense?.date ? new Date(d.expense.date).toISOString().slice(0, 10) : '?'
        console.log('  ' + pad(date, 12) + pad(d.name || '', 28) + '(catatan: ' + (d.expense?.catatan || '').slice(0, 40) + ')')
      })
      console.log('')
    }

    // 6) Total ExpenseDetail keseluruhan (untuk konteks)
    const totalDetail = await prisma.expenseDetail.count()
    console.log('Total ExpenseDetail di DB: ' + totalDetail)
    console.log('Selesai (READ-ONLY, tidak ada data yang diubah).')
  } catch (e) {
    console.log('GAGAL: ' + e.code + ' :: ' + String(e.message).split('\n').pop())
  } finally {
    await prisma.$disconnect()
  }
})()

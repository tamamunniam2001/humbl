/**
 * check-db.cjs — PEMERIKSAAN DATABASE READ-ONLY (hanya SELECT, tidak menulis apa pun).
 *
 * Jalankan dari folder project:
 *   node --env-file=.env scripts/check-db.cjs
 *   atau:  npm run check:db
 *
 * Untuk memeriksa branch Neon lain (mis. hasil Instant restore),
 * set DATABASE_URL lebih dulu di shell:
 *   $env:DATABASE_URL='postgresql://...' ; node scripts/check-db.cjs
 *
 * Gunanya: memastikan data sudah kembali setelah restore Neon,
 * tanpa perlu mengetik query manual di SQL Editor.
 */
/**
 * check-db.cjs — PEMERIKSAAN DATABASE READ-ONLY (hanya SELECT, tidak menulis apa pun).
 *
 * Jalankan dari folder project:
 *   node --env-file=.env scripts/check-db.cjs
 *   atau:  npm run check:db
 *
 * Untuk memeriksa branch Neon lain (mis. hasil Instant restore),
 * set DATABASE_URL lebih dulu di shell:
 *   $env:DATABASE_URL='postgresql://...' ; node scripts/check-db.cjs
 *
 * Gunanya: memastikan data sudah kembali setelah restore Neon,
 * tanpa perlu mengetik query manual di SQL Editor.
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const pad = (s, n) => String(s).padEnd(n)

const TABEL_INTI = [
  'User', 'CustomRole', 'Category', 'Product', 'Ingredient', 'ProductIngredient',
  'Transaction', 'OrderItem', 'DailyReport', 'Employee', 'SopItem',
  'ExpenseItem', 'ExpenseCategory', 'Expense', 'ExpenseDetail', 'Attendance',
  'MonthlyKas', 'InventoryItem', 'StockOpname', 'StockOpnameItem',
  'ReceiptSettings', 'Resi', 'Customer',
]

;(async () => {
  try {
    let host = '(tidak terbaca)'
    try { host = new URL(process.env.DATABASE_URL).host } catch {}
    console.log('DB host : ' + host)
    console.log('')

    const tabel = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    )
    const nama = tabel.map((t) => t.table_name)
    console.log('TABEL (' + nama.length + '): ' + (nama.join(', ') || '(tidak ada sama sekali)'))
    console.log('')

    if (nama.length === 0 || nama.every((n) => n.startsWith('_'))) {
      console.log('!! Database kosong — hanya tabel internal Prisma.')
      console.log('   Tidak ada tabel aplikasi. Perlu restore (Neon → Branches → Restore).')
    }

    console.log('JUMLAH BARIS:')
    for (const t of nama) {
      if (t.startsWith('_')) continue
      try {
        const r = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`)
        console.log('  ' + pad(t, 26) + r[0].n)
      } catch (e) {
        console.log('  ' + pad(t, 26) + 'ERR ' + e.code)
      }
    }

    const kurang = TABEL_INTI.filter((t) => !nama.includes(t))
    console.log('')
    if (kurang.length === 0) console.log('OK  Semua tabel inti sudah ada.')
    else console.log('Tabel inti belum ada: ' + kurang.join(', '))

    try {
      const r = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS n, min("createdAt") AS oldest, max("createdAt") AS newest FROM "Transaction"`
      )
      console.log('')
      console.log('TRANSAKSI : ' + r[0].n + '  |  terlama: ' + r[0].oldest + '  |  terbaru: ' + r[0].newest)
    } catch {}

    try {
      const u = await prisma.$queryRawUnsafe(`SELECT "email", "role", "isActive" FROM "User" ORDER BY "email"`)
      console.log('')
      console.log('USER (' + u.length + '):')
      for (const x of u) console.log('  ' + x.email + '  |  ' + x.role + '  |  active=' + x.isActive)
    } catch {}

    console.log('')
    console.log('Selesai. Tidak ada data yang diubah.')
  } catch (e) {
    console.log('GAGAL: ' + e.code + ' :: ' + String(e.message).split('\n').pop())
  } finally {
    await prisma.$disconnect()
  }
})()

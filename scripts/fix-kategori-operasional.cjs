/**
 * fix-kategori-operasional.cjs — KOREKSI KATEGORI PENGELUARAN DARI BELANJA OPERASIONAL
 *
 * Pengeluaran dari "Belanja Operasional" yang di-ACC dulu di-hardcode jadi kategori
 * 'Operasional'. Script ini mengoreksi data LAMA yang sudah terlanjur masuk.
 *
 * Aturan koreksi (HANYA yang aman/otomatis):
 *   - ExpenseDetail category='Operasional' dari Belanja Operasional:
 *       * punya expenseItemId -> pakai kategori terkini dari ExpenseItem itu.
 *       * item manual -> cocokkan NAMA ke ExpenseItem aktif (case-insensitive,
 *         cocok tepat). Jika cocok unik, pakai kategori ExpenseItem tersebut.
 *   - Item yang TIDAK bisa dicocokkan otomatis DILEWATI (tidak diubah) untuk
 *     ditinjau manual — supaya tidak salah kategori.
 *
 * expenseItemId pada detail juga diisi bila cocok (agar riwayat harga terhubung).
 * Set env ONLY_CATEGORY=1 bila hanya ingin mengubah kolom category saja.
 *
 * Mode:
 *   Default = DRY-RUN (tidak menulis apa pun). Tambahkan --apply untuk menerapkan.
 *
 * Jalankan dari folder project:
 *   node --env-file=.env scripts/fix-kategori-operasional.cjs
 *   node --env-file=.env scripts/fix-kategori-operasional.cjs --apply
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const ONLY_CATEGORY = process.env.ONLY_CATEGORY === '1'
const pad = (s, n) => String(s ?? '').padEnd(n)

// Normalisasi nama: lowercase, rapikan spasi & tanda baca.
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Jarak Levenshtein (untuk mencocokkan typo ringan, mis. "Tissu" vs "Tissue").
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

// Cari ExpenseItem terbaik untuk sebuah nama. Mengembalikan { item, reason } hanya
// bila kecocokannya UNIK & yakin (exact / contains / typo ringan). Jika ambigu -> null.
function findBestItem(rawName, byNorm, byExactName) {
  const k = norm(rawName)
  if (!k) return null

  // 1) Exact (nama ternormalisasi identik)
  if (byNorm.has(k)) return { item: byNorm.get(k), reason: 'nama cocok persis' }

  // 2) Contains (salah satu memuat yang lain), harus unik
  const contains = byExactName.filter(x => {
    const nk = norm(x.name)
    return nk.includes(k) || k.includes(nk)
  })
  if (contains.length === 1) return { item: contains[0], reason: 'nama mirip (contains)' }

  // 3) Typo ringan (Levenshtein <= 2 & panjang >= 5), harus unik
  const close = byExactName.filter(x => levenshtein(norm(x.name), k) <= 2 && norm(x.name).length >= 5)
  if (close.length === 1) return { item: close[0], reason: 'typo ringan (levenshtein)' }

  return null
}



;(async () => {
  try {
    let host = '(tidak terbaca)'
    try { host = new URL(process.env.DATABASE_URL).host } catch {}
    console.log('DB host : ' + host)
    console.log('Mode    : ' + (APPLY ? 'APPLY (akan mengubah data)' : 'DRY-RUN (tidak mengubah apa pun)'))
    console.log('')

    const items = await prisma.expenseItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
    })
    const byNorm = new Map()
    for (const it of items) {
      const k = norm(it.name)
      if (k && !byNorm.has(k)) byNorm.set(k, it)
    }
    const byExactName = items // daftar penuh untuk pencocokan contains/levenshtein

    const opDetails = await prisma.expenseDetail.findMany({
      where: { category: 'Operasional' },
      select: {
        id: true, name: true, category: true, expenseItemId: true,
        expenseItem: { select: { id: true, name: true, category: true } },
        expense: { select: { catatan: true, date: true } },
      },
      orderBy: { expense: { date: 'asc' } },
    })

    console.log('ExpenseDetail category="Operasional": ' + opDetails.length)
    if (opDetails.length === 0) {
      console.log('Tidak ada yang perlu dikoreksi.')
      await prisma.$disconnect()
      return
    }

    const toFix = []
    const skipped = []

    for (const d of opDetails) {
      const fromBelanja = (d.expense?.catatan || '').startsWith('[Belanja Operasional]')

      if (d.expenseItemId && d.expenseItem) {
        const cat = (d.expenseItem.category || '').trim()
        if (cat && cat !== 'Operasional') {
          toFix.push({ detail: d, newCategory: cat, matchedItem: d.expenseItem, reason: 'kategori terkini dari ExpenseItem' })
        } else {
          skipped.push({ detail: d, reason: 'ExpenseItem terkini tidak punya kategori / masih "Operasional"' })
        }
        continue
      }

      const found = findBestItem(d.name, byNorm, byExactName)
      const cat = found ? (found.item.category || '').trim() : ''
      if (found && cat && cat !== 'Operasional') {
        toFix.push({ detail: d, newCategory: cat, matchedItem: found.item, reason: found.reason })
      } else {
        const base = found
          ? 'nama cocok tapi kategori ExpenseItem kosong/Operasional'
          : 'item manual, nama tidak cocok ExpenseItem manapun (perlu review manual)'
        skipped.push({ detail: d, reason: base + (fromBelanja ? '' : ' (bukan dari Belanja Operasional)') })
      }
    }

    console.log('')
    console.log('=== RENCANA PERUBAHAN (' + toFix.length + ' item) ===')
    toFix.forEach((f, i) => {
      const date = f.detail.expense?.date ? new Date(f.detail.expense.date).toISOString().slice(0, 10) : '?'
      console.log('  ' + String(i + 1).padStart(2) + '. ' + pad(date, 12) + pad(f.detail.name, 26) +
        '"Operasional" -> "' + f.newCategory + '"  (' + f.reason + ')')
    })

    console.log('')
    console.log('=== DILEWATI / PERLU REVIEW (' + skipped.length + ' item) ===')
    skipped.forEach((s, i) => {
      const date = s.detail.expense?.date ? new Date(s.detail.expense.date).toISOString().slice(0, 10) : '?'
      console.log('  ' + String(i + 1).padStart(2) + '. ' + pad(date, 12) + pad(s.detail.name, 26) + '— ' + s.reason)
    })

    if (!APPLY) {
      console.log('')
      console.log('DRY-RUN: tidak ada perubahan yang diterapkan. Untuk menerapkan: --apply')
      await prisma.$disconnect()
      return
    }
    if (toFix.length === 0) {
      console.log('')
      console.log('Tidak ada perubahan aman untuk diterapkan.')
      await prisma.$disconnect()
      return
    }

    const n = await prisma.$transaction(async (tx) => {
      let count = 0
      for (const f of toFix) {
        const data = { category: f.newCategory }
        if (!ONLY_CATEGORY && !f.detail.expenseItemId && f.matchedItem) {
          data.expenseItemId = f.matchedItem.id
        }
        await tx.expenseDetail.update({ where: { id: f.detail.id }, data })
        count++
      }
      return count
    })

    console.log('')
    console.log('SELESAI. ' + n + ' ExpenseDetail berhasil dikoreksi kategorinya.')
  } catch (e) {
    console.log('GAGAL: ' + e.code + ' :: ' + String(e.message).split('\n').pop())
  } finally {
    await prisma.$disconnect()
  }
})()


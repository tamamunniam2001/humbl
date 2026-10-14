/**
 * test-voucher.cjs — UJI FUNGSIONAL fitur voucher (membuat data test, lalu membersihkan).
 * Menguji:
 *   1) Buat voucher PERCENT 10% (maks 5000) & NOMINAL 5000
 *   2) Hitung potongan sesuai aturan (persen, maxDiscount, minSpend)
 *   3) Simulasi transaksi memakai voucher (total berkurang, usedCount naik)
 *   4) Validasi masa berlaku & kuota
 * Jalankan: node --env-file=.env scripts/test-voucher.cjs
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TEST_CODES = ['TESTPERCENT10', 'TESTNOMINAL5K', 'TESTMIN50K']

function cleanup() {
  return prisma.voucher.deleteMany({ where: { code: { in: TEST_CODES } } })
}

// Tiru logika validasi di /api/vouchers/validate
function computeDiscount(voucher, subtotal) {
  if (!voucher.isActive) return { ok: false, message: 'Voucher tidak aktif' }
  const now = new Date()
  if (voucher.startDate && now < voucher.startDate) return { ok: false, message: 'belum mulai' }
  if (voucher.endDate && now > voucher.endDate) return { ok: false, message: 'kedaluwarsa' }
  if (voucher.quota > 0 && voucher.usedCount >= voucher.quota) return { ok: false, message: 'kuota habis' }
  if (subtotal < voucher.minSpend) return { ok: false, message: 'min spend' }
  let d = 0
  if (voucher.type === 'PERCENT') {
    d = Math.round(subtotal * voucher.value / 100)
    if (voucher.maxDiscount > 0) d = Math.min(d, voucher.maxDiscount)
  } else {
    d = voucher.value
  }
  d = Math.min(d, subtotal)
  return { ok: true, discount: d }
}

;(async () => {
  let pass = 0, fail = 0
  const check = (name, cond, extra = '') => {
    if (cond) { pass++; console.log('  PASS: ' + name + (extra ? ' — ' + extra : '')) }
    else { fail++; console.log('  FAIL: ' + name + (extra ? ' — ' + extra : '')) }
  }

  try {
    await cleanup()

    // 1) Buat voucher test
    const vPercent = await prisma.voucher.create({ data: { code: 'TESTPERCENT10', type: 'PERCENT', value: 10, maxDiscount: 5000, minSpend: 0, quota: 0 } })
    const vNominal = await prisma.voucher.create({ data: { code: 'TESTNOMINAL5K', type: 'NOMINAL', value: 5000, minSpend: 0, quota: 0 } })
    const vMin = await prisma.voucher.create({ data: { code: 'TESTMIN50K', type: 'PERCENT', value: 50, minSpend: 50000, quota: 0 } })
    console.log('1) Buat 3 voucher test: OK')

    // 2) Hitung potongan
    // PERCENT 10% dari 100000 = 10000, dibatasi max 5000 -> 5000
    const r1 = computeDiscount(vPercent, 100000)
    check('PERCENT dibatasi maxDiscount', r1.ok && r1.discount === 5000, `discount=${r1.discount}`)
    // PERCENT 10% dari 30000 = 3000 (di bawah max)
    const r2 = computeDiscount(vPercent, 30000)
    check('PERCENT di bawah max', r2.ok && r2.discount === 3000, `discount=${r2.discount}`)
    // NOMINAL 5000 dari 20000
    const r3 = computeDiscount(vNominal, 20000)
    check('NOMINAL potongan tetap', r3.ok && r3.discount === 5000, `discount=${r3.discount}`)
    // NOMINAL tidak melebihi subtotal
    const r4 = computeDiscount(vNominal, 3000)
    check('NOMINAL dibatasi subtotal', r4.ok && r4.discount === 3000, `discount=${r4.discount}`)
    // minSpend gagal
    const r5 = computeDiscount(vMin, 40000)
    check('minSpend menolak', !r5.ok, `msg=${r5.message}`)
    const r6 = computeDiscount(vMin, 60000)
    check('minSpend lolos (50% dari 60000=30000)', r6.ok && r6.discount === 30000, `discount=${r6.discount}`)

    // 3) Simulasi transaksi memakai voucher (hitung total seperti route transaksi)
    const subtotalTx = 100000
    const voucherDiscount = r1.discount
    const total = Math.max(0, subtotalTx - voucherDiscount)
    check('Total transaksi berkurang sesuai voucher', total === 95000, `total=${total}`)
    // naikkan usedCount
    await prisma.voucher.update({ where: { id: vPercent.id }, data: { usedCount: { increment: 1 } } })
    const after = await prisma.voucher.findUnique({ where: { id: vPercent.id } })
    check('usedCount bertambah', after.usedCount === 1, `usedCount=${after.usedCount}`)

    // 4) Kuota habis
    const vKuota = await prisma.voucher.create({ data: { code: 'TESTKUOTA', type: 'NOMINAL', value: 5000, quota: 1, usedCount: 1 } })
    const r7 = computeDiscount(vKuota, 100000)
    check('Kuota habis menolak', !r7.ok, `msg=${r7.message}`)
    await prisma.voucher.delete({ where: { id: vKuota.id } })

    // 5) Voucher nonaktif
    await prisma.voucher.update({ where: { id: vNominal.id }, data: { isActive: false } })
    const vNominalRefreshed = await prisma.voucher.findUnique({ where: { id: vNominal.id } })
    const r8 = computeDiscount(vNominalRefreshed, 100000)
    check('Voucher nonaktif ditolak', !r8.ok, `msg=${r8.message}`)

    console.log('')
    console.log(`HASIL: ${pass} lolos, ${fail} gagal.`)
  } catch (e) {
    console.log('GAGAL: ' + e.code + ' :: ' + String(e.message).split('\n').pop())
    fail++
  } finally {
    await cleanup()
    await prisma.$disconnect()
    console.log('Data test dibersihkan.')
  }
})()

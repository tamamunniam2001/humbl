/**
 * test-member.cjs — UJI FUNGSIONAL sistem member (membuat data test, lalu membersihkan).
 * Menguji:
 *   1) Create member (nama + telepon unik, isActive default)
 *   2) Nomor telepon duplikat ditolak (unique constraint)
 *   3) Transaksi tercatat dengan memberId
 *   4) Agregat pembelian member (pola GET /api/members)
 *   5) Filter member aktif (pola ?active=1 untuk autocomplete kasir)
 *   6) Riwayat pembelian per member (pola GET /api/members/[id]/transactions)
 *   7) Hapus member → relasi SetNull, snapshot customerName tetap aman
 * Jalankan: node --env-file=.env scripts/test-member.cjs
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PHONE = '0899000111222'
const EMAIL = 'test-member-system@test.local'

let pass = 0, fail = 0
function ok(cond, label) {
  if (cond) { pass++; console.log('  \u2713 ' + label) }
  else { fail++; console.log('  \u2717 ' + label) }
}

async function cleanup() {
  await prisma.transaction.deleteMany({ where: { cashier: { email: EMAIL } } })
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  await prisma.member.deleteMany({ where: { phone: PHONE } })
}

async function main() {
  await cleanup()

  console.log('1. Create member')
  const m = await prisma.member.create({ data: { name: 'Member Test', phone: PHONE } })
  ok(m && m.isActive === true, 'member dibuat & aktif secara default')

  console.log('2. Nomor telepon duplikat ditolak (unique)')
  try {
    await prisma.member.create({ data: { name: 'Duplikat', phone: PHONE } })
    ok(false, 'seharusnya gagal karena phone unique')
  } catch (e) {
    ok(e.code === 'P2002', 'P2002 unique constraint pada phone')
  }

  console.log('3. Transaksi tercatat atas member')
  const user = await prisma.user.create({
    data: { name: 'Cashier Test', email: EMAIL, password: 'x', role: 'CASHIER' },
  })
  const tx = await prisma.transaction.create({
    data: {
      invoiceNo: `TEST-MEMBER-${Date.now()}`,
      total: 50000, payment: 50000, change: 0,
      cashierId: user.id, memberId: m.id, customerName: m.name,
    },
  })
  ok(tx.memberId === m.id, 'memberId tercatat di transaksi')

  console.log('4. Agregat pembelian member (pola GET /api/members)')
  const mRow = await prisma.member.findUnique({
    where: { id: m.id },
    select: {
      _count: { select: { transactions: { where: { status: 'COMPLETED', deletedAt: null } } } },
    },
  })
  ok(mRow._count.transactions === 1, 'purchaseCount = 1')
  const agg = await prisma.transaction.groupBy({
    by: ['memberId'],
    where: { memberId: m.id, status: 'COMPLETED', deletedAt: null },
    _sum: { total: true },
    _max: { createdAt: true },
  })
  const g = agg.find(x => x.memberId === m.id)
  ok(g && g._sum.total === 50000, 'totalSpent = 50000')
  ok(g && g._max.createdAt instanceof Date, 'lastPurchase terisi')

  console.log('5. Filter member aktif (pola ?active=1 untuk kasir)')
  const active1 = await prisma.member.findMany({ where: { isActive: true, id: m.id } })
  ok(active1.length === 1, 'member aktif muncul di autocomplete')
  await prisma.member.update({ where: { id: m.id }, data: { isActive: false } })
  const active2 = await prisma.member.findMany({ where: { isActive: true, id: m.id } })
  ok(active2.length === 0, 'member nonaktif tidak ditawarkan ke kasir')
  await prisma.member.update({ where: { id: m.id }, data: { isActive: true } })

  console.log('6. Riwayat pembelian per member (pola GET /members/[id]/transactions)')
  const list = await prisma.transaction.findMany({
    where: { memberId: m.id, status: 'COMPLETED', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })
  ok(list.length === 1, 'riwayat berisi 1 transaksi')

  console.log('7. Hapus member → SetNull, snapshot nama tetap aman')
  await prisma.member.delete({ where: { id: m.id } })
  const after = await prisma.transaction.findUnique({ where: { id: tx.id } })
  ok(after.memberId === null, 'memberId menjadi null (onDelete: SetNull)')
  ok(after.customerName === 'Member Test', 'customerName snapshot tetap tersimpan')

  console.log('')
  console.log(`Hasil: ${pass} pass, ${fail} fail`)
  if (fail > 0) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERROR:', e); process.exitCode = 1 })
  .finally(async () => { await cleanup(); await prisma.$disconnect() })

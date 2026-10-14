/**
 * test-wa-bot.cjs — UJI BOT WHATSAPP (Fonnte webhook).
 * Menguji:
 *   1) phoneCandidates — deteksi format nomor 0xx / 628xx / +62
 *   2) parseCommand — routing menu/member/riwayat/struk + auto-detect kode struk
 *   3) Format pesan — menu/member/riwayat/struk (gaya WhatsApp)
 *   4) Query DB (pola persis yang dipakai route webhook):
 *      - lookup member by kandidat nomor pengirim Fonnte
 *      - agregat pembelian member (pola GET /api/members)
 *      - riwayat transaksi terakhir (COMPLETED, belum dihapus)
 *      - lookup struk invoiceNo case-insensitive
 *   5) Template pesan WhatsApp (lib/wa-templates + tabel MessageTemplate):
 *      - render placeholder {nama}/{kode_voucher}/{detail_voucher}
 *      - ketersediaan voucher (aktif/kuota/periode) & templateNeedsVoucher
 *      - CRUD tabel MessageTemplate (pola route /api/admin/message-templates)
 * Jalankan: node --env-file=.env scripts/test-wa-bot.cjs
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PHONE = '0899555666777'
const EMAIL = 'test-wa-bot@test.local'

let pass = 0, fail = 0
function ok(cond, label) {
  if (cond) { pass++; console.log('  \u2713 ' + label) }
  else { fail++; console.log('  \u2717 ' + label) }
}

async function cleanup() {
  // OrderItem harus dihapus sebelum Transaction (FK RESTRICT, tanpa cascade).
  await prisma.orderItem.deleteMany({ where: { transaction: { cashier: { email: EMAIL } } } })
  await prisma.transaction.deleteMany({ where: { cashier: { email: EMAIL } } })
  await prisma.member.deleteMany({ where: { phone: PHONE } })
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  await prisma.messageTemplate.deleteMany({ where: { name: { startsWith: 'TEST-TPL' } } })
}

async function main() {
  await cleanup()
  const bot = await import('../lib/wa-bot.js')

  console.log('1. phoneCandidates (nomor pengirim Fonnte vs input kasir)')
  ok(bot.phoneCandidates('0899-555-666-777').includes('0899555666777'), 'format 0xx dinormalkan')
  ok(bot.phoneCandidates('62899555666777').includes('0899555666777'), '628xx menghasilkan kandidat 0xx')
  ok(bot.phoneCandidates('0899555666777').includes('62899555666777'), '0xx menghasilkan kandidat 628xx')
  ok(bot.phoneCandidates('+62 899-5556-66777').includes('62899555666777'), '+62 dinormalkan')
  ok(bot.phoneCandidates('abc').length === 0, 'input tanpa digit -> kosong')

  console.log('2. parseCommand')
  ok(bot.parseCommand('MENU').cmd === 'menu', 'MENU -> menu')
  ok(bot.parseCommand('halo').cmd === 'menu', 'halo -> menu')
  ok(bot.parseCommand('1').cmd === 'member', '1 -> member')
  ok(bot.parseCommand('Riwayat').cmd === 'riwayat', 'Riwayat -> riwayat')
  const s1 = bot.parseCommand('STRUK inv-123')
  ok(s1.cmd === 'struk' && s1.arg === 'inv-123', 'STRUK inv-123 -> struk, case asli utuh')
  ok(bot.parseCommand('cek INV-99').cmd === 'struk', 'cek INV-99 -> struk')
  const s2 = bot.parseCommand('INV-12345')
  ok(s2.cmd === 'struk' && s2.arg === 'INV-12345', 'kode struk polos terdeteksi otomatis')
  ok(bot.parseCommand('asdfgh').cmd === 'unknown', 'teks acak -> unknown')
  ok(bot.parseCommand('').cmd === 'unknown', 'pesan kosong -> unknown')

  console.log('3. Format pesan')
  const menu = bot.formatMenu({ storeName: 'Toko Uji', senderName: 'Budi' })
  ok(menu.includes('Budi') && menu.includes('Toko Uji'), 'menu menyapa & branding nama toko')
  ok(menu.includes('RIWAYAT') && menu.includes('STRUK'), 'menu memuat semua perintah')
  ok(bot.formatMemberNotFound('Toko Uji').includes('belum terdaftar'), 'balasan member tidak terdaftar')
  const m = bot.formatMember(
    { name: 'Budi', phone: '0899555666777', createdAt: new Date(), isActive: true },
    { purchaseCount: 3, totalSpent: 125000, lastPurchase: new Date() },
  )
  ok(m.includes('INFO MEMBER') && m.includes('Rp 125.000') && m.includes('3x'), 'format member: total belanja & jumlah transaksi')
  const r = bot.formatRiwayat([
    { invoiceNo: 'INV-2', total: 75000, createdAt: new Date(), _count: { items: 2 } },
    { invoiceNo: 'INV-1', total: 50000, createdAt: new Date(), _count: { items: 1 } },
  ])
  ok(r.includes('INV-2') && r.includes('Rp 75.000') && r.includes('2 item'), 'format riwayat berisi transaksi')
  ok(bot.formatRiwayat([]).includes('Belum ada'), 'riwayat kosong punya pesan ramah')
  ok(bot.formatStrukNeedCode().includes('STRUK'), 'hint format STRUK <kode>')

  console.log('4. Query DB (pola persis route webhook)')
  const member = await prisma.member.create({ data: { name: 'Member WA Test', phone: PHONE } })
  const user = await prisma.user.create({ data: { name: 'Kasir WA', email: EMAIL, password: 'x', role: 'CASHIER' } })

  // 4a. Lookup member dari nomor format Fonnte (628xx) walau tersimpan 0xx
  const candidates = bot.phoneCandidates('62899555666777')
  const found = await prisma.member.findFirst({ where: { OR: candidates.map(phone => ({ phone })) } })
  ok(found && found.id === member.id, 'member ketemu dari nomor format Fonnte')

  const ts = Date.now()
  const INV_OLD = `TEST-WA-${ts}`
  const INV_NEW = `TEST-WA-${ts}-2`
  const INV_CANCEL = `TEST-WA-${ts}-C`
  const txOld = await prisma.transaction.create({
    data: {
      invoiceNo: INV_OLD, total: 50000, payment: 50000, change: 0,
      cashierId: user.id, memberId: member.id, customerName: member.name,
      createdAt: new Date(Date.now() - 120000),
      items: { create: [{ qty: 2, price: 25000, subtotal: 50000, name: 'Item WA' }] },
    },
  })
  await prisma.transaction.create({
    data: {
      invoiceNo: INV_NEW, total: 75000, payment: 100000, change: 25000,
      cashierId: user.id, memberId: member.id,
      createdAt: new Date(Date.now() - 60000),
    },
  })
  await prisma.transaction.create({
    data: {
      invoiceNo: INV_CANCEL, total: 999999, payment: 0, change: 0,
      status: 'CANCELLED', cashierId: user.id, memberId: member.id,
    },
  })

  // 4b. Riwayat terbaru (pola route: COMPLETED + deletedAt null, desc, take 5)
  const txs = await prisma.transaction.findMany({
    where: { memberId: member.id, status: 'COMPLETED', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { invoiceNo: true, total: true, createdAt: true, _count: { select: { items: true } } },
  })
  ok(txs.length === 2, 'riwayat hanya transaksi COMPLETED (2 dari 3)')
  ok(txs[0].invoiceNo === INV_NEW, 'riwayat terurut terbaru dulu')
  ok(txs.find(t => t.invoiceNo === INV_OLD)._count.items === 1, 'jumlah item per transaksi ikut terhitung')

  // 4c. Agregat member (pola GET /api/members)
  const countRow = await prisma.member.findUnique({
    where: { id: member.id },
    select: { _count: { select: { transactions: { where: { status: 'COMPLETED', deletedAt: null } } } } },
  })
  ok(countRow._count.transactions === 2, 'purchaseCount = 2 (yang dibatalkan tidak dihitung)')
  const agg = await prisma.transaction.groupBy({
    by: ['memberId'],
    where: { memberId: member.id, status: 'COMPLETED', deletedAt: null },
    _sum: { total: true },
    _max: { createdAt: true },
  })
  const g = agg.find(x => x.memberId === member.id)
  ok(g && g._sum.total === 125000, 'totalSpent = 125000 (hanya yang lunas)')

  // 4d. Struk case-insensitive (pola route)
  const struk = await prisma.transaction.findFirst({
    where: { invoiceNo: { equals: INV_OLD.toLowerCase(), mode: 'insensitive' }, deletedAt: null },
    include: { items: true, cashier: { select: { name: true } }, member: { select: { name: true } } },
  })
  ok(struk && struk.id === txOld.id, 'struk ketemu walau beda huruf besar/kecil')
  ok(struk.items.length === 1 && struk.cashier.name === 'Kasir WA', 'struk include items & kasir')
  const strukText = bot.formatStruk(struk)
  ok(strukText.includes('Item WA') && strukText.includes('Rp 50.000') && strukText.includes('Selesai'), 'format struk lengkap (item, total, status)')
  const notFound = await prisma.transaction.findFirst({
    where: { invoiceNo: { equals: 'TIDAK-ADA-999', mode: 'insensitive' }, deletedAt: null },
  })
  ok(!notFound, 'struk tidak ada -> null (balasan "tidak ditemukan")')

  // 5. Template pesan WhatsApp (lib/wa-templates + tabel MessageTemplate)
  const tpl = await import('../lib/wa-templates.js')

  console.log('5. lib/wa-templates (placeholder & ketersediaan voucher)')
  const voucher = {
    code: 'HEMAT10', type: 'PERCENT', value: 10, maxDiscount: 20000, minSpend: 50000,
    startDate: null, endDate: null, isActive: true, quota: 0, usedCount: 0,
  }
  const rendered = tpl.renderTemplate('Halo {nama}, kode {kode_voucher} — {detail_voucher}', { memberName: 'Budi', voucher })
  ok(rendered === 'Halo Budi, kode HEMAT10 — Diskon 10% (maks. Rp 20.000) · min. belanja Rp 50.000', 'render {nama}/{kode_voucher}/{detail_voucher}')
  ok(tpl.renderTemplate('Halo {nama}!', { memberName: 'Budi' }) === 'Halo Budi!', 'render {nama} tanpa voucher')
  ok(tpl.renderTemplate('Halo {nama} {detail_voucher}', { memberName: 'Budi' }) === 'Halo Budi', '{detail_voucher} tanpa voucher dibersihkan')
  ok(tpl.isVoucherAvailable(voucher), 'voucher aktif tanpa kuota -> tersedia')
  ok(!tpl.isVoucherAvailable({ ...voucher, isActive: false }), 'voucher nonaktif -> tidak tersedia')
  ok(!tpl.isVoucherAvailable({ ...voucher, quota: 2, usedCount: 2 }), 'kuota habis -> tidak tersedia')
  ok(!tpl.isVoucherAvailable({ ...voucher, endDate: new Date(Date.now() - 86400000) }), 'kedaluwarsa -> tidak tersedia')
  ok(!tpl.isVoucherAvailable({ ...voucher, startDate: new Date(Date.now() + 86400000) }), 'belum mulai berlaku -> tidak tersedia')
  ok(tpl.templateNeedsVoucher({ inputType: 'VOUCHER_CODE', body: 'x' }), 'inputType VOUCHER_CODE -> butuh voucher')
  ok(tpl.templateNeedsVoucher({ inputType: 'NONE', body: 'kode {kode_voucher}' }), 'body memuat {kode_voucher} -> butuh voucher')
  ok(!tpl.templateNeedsVoucher({ inputType: 'NONE', body: 'Halo {nama}' }), 'template teks biasa -> tanpa voucher')

  // 5b. Tabel MessageTemplate (pola CRUD /api/admin/message-templates)
  console.log('5b. Tabel MessageTemplate (DB)')
  const created = await prisma.messageTemplate.create({
    data: { name: 'TEST-TPL', body: 'Halo {nama}', inputType: 'NONE' },
  })
  ok(created && created.isActive === true && created.inputType === 'NONE', 'create template: default isActive=true & inputType=NONE')
  const dup = await prisma.messageTemplate.create({ data: { name: 'TEST-TPL', body: 'x' } }).catch(e => e)
  ok(dup && dup.code === 'P2002', 'nama template unik (duplikat -> P2002)')
  const updated = await prisma.messageTemplate.update({
    where: { id: created.id },
    data: { inputType: 'VOUCHER_CODE', isActive: false },
  })
  ok(updated.inputType === 'VOUCHER_CODE' && updated.isActive === false, 'update inputType & isActive')
  await prisma.messageTemplate.delete({ where: { id: created.id } })
  const gone = await prisma.messageTemplate.findUnique({ where: { id: created.id } })
  ok(gone === null, 'delete template')
}

main()
  .catch(e => { fail++; console.error('ERROR:', e) })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
    console.log(`\n${pass} pass, ${fail} fail`)
    process.exit(fail ? 1 : 0)
  })

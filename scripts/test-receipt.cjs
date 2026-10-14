'use strict'
// Test struk thermal (lib/thermal.js -> buildReceipt):
// memastikan keterangan potongan (Diskon manual + Voucher + Pajak) tercetak.
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const root = path.join(__dirname, '..')
const tmp = path.join(__dirname, '_thermal_copy.mjs')

async function main() {
  const src = fs.readFileSync(path.join(root, 'lib', 'thermal.js'), 'utf8')
  fs.writeFileSync(tmp, src, 'utf8')
  const { buildReceipt } = await import(pathToFileURL(tmp).href)

  const decode = (bytes) => new TextDecoder().decode(Uint8Array.from(bytes))

  const baseTx = {
    invoiceNo: 'BK-1001',
    createdAt: new Date('2026-10-14T10:00:00+07:00'),
    customerName: 'Budi',
    cashier: { name: 'Ayu' },
    items: [
      { qty: 2, price: 50000, subtotal: 100000, product: { name: 'Es Kopi Susu' } },
    ],
    payment: 100000,
    change: 15000,
    payMethod: 'CASH',
    status: 'COMPLETED',
  }

  let pass = 0
  let fail = 0
  const check = (label, ok) => { if (ok) { pass++; console.log(`  ✓ ${label}`) } else { fail++; console.log(`  ✗ ${label}`) } }

  console.log('1. Transaksi dengan diskon + voucher + pajak')
  const tx1 = {
    ...baseTx,
    subtotal: 100000,
    discount: 10, discountAmount: 10000,
    voucherCode: 'HEMAT10', voucherDiscount: 5000,
    tax: 0, taxAmount: 0,
    total: 85000,
  }
  const out1 = decode(buildReceipt(tx1))
  check('baris Subtotal tampil', out1.includes('Subtotal'))
  check('baris Diskon (10%) tampil', out1.includes('Diskon (10%)'))
  check('baris Voucher (HEMAT10) tampil', out1.includes('Voucher (HEMAT10)'))
  check('nilai potongan voucher - Rp 5.000 tampil', out1.includes('- Rp 5.000'))
  check('TOTAL tetap tampil', out1.includes('TOTAL'))

  console.log('2. Transaksi tanpa field subtotal (slim select) — fallback tetap benar')
  const tx2 = { ...tx1 }
  delete tx2.subtotal
  const out2 = decode(buildReceipt(tx2))
  check('Subtotal dihitung via fallback (100.000)', out2.includes('Rp 100.000'))
  check('Voucher tetap tampil', out2.includes('Voucher (HEMAT10)'))

  console.log('3. Transaksi tanpa potongan apa pun')
  const tx3 = {
    ...baseTx,
    discount: 0, discountAmount: 0,
    voucherCode: '', voucherDiscount: 0,
    tax: 0, taxAmount: 0,
    total: 100000, subtotal: 100000,
  }
  const out3 = decode(buildReceipt(tx3))
  check('tidak ada baris Voucher', !out3.includes('Voucher'))
  check('tidak ada baris Diskon', !out3.includes('Diskon'))
  check('TOTAL tetap tampil', out3.includes('TOTAL'))

  console.log('4. Transaksi dengan pajak')
  const tx4 = {
    ...baseTx,
    subtotal: 100000,
    discount: 0, discountAmount: 0,
    voucherCode: 'HEMAT10', voucherDiscount: 5000,
    tax: 10, taxAmount: 9500,
    total: 104500,
  }
  const out4 = decode(buildReceipt(tx4))
  check('baris Pajak (10%) tampil', out4.includes('Pajak (10%)'))
  check('baris Voucher tampil', out4.includes('Voucher (HEMAT10)'))

  console.log(`\nHasil: ${pass} pass, ${fail} fail`)
  if (fail > 0) process.exitCode = 1
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exitCode = 1 })
  .finally(() => { try { fs.unlinkSync(tmp) } catch {} })

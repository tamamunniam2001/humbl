const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

function effectiveTotal(itemSubtotal, txTotal, txSubtotalSum) {
  if (!txSubtotalSum || txSubtotalSum === 0) return itemSubtotal
  if (txSubtotalSum === txTotal) return itemSubtotal
  return itemSubtotal * txTotal / txSubtotalSum
}

async function main() {
  const kat = 'Clasic Espresso Based'

  // === GRAFIK (bykategori mode) ===
  const allItems = await p.orderItem.findMany({
    where: { transaction: { status: 'COMPLETED', deletedAt: null } },
    select: {
      category: true, subtotal: true, qty: true,
      product: { select: { category: { select: { name: true } } } },
      transaction: { select: { total: true, items: { select: { subtotal: true } } } }
    }
  })
  let grafTotal = 0, grafQty = 0
  for (const item of allItems) {
    const k = item.product?.category?.name || (item.category && item.category.trim()) || 'Lainnya'
    if (k !== kat) continue
    const txSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
    grafTotal += effectiveTotal(item.subtotal, item.transaction.total, txSum)
    grafQty += item.qty
  }
  console.log('=== GRAFIK (bykategori) ===')
  console.log('Total:', grafTotal, '| Qty:', grafQty)

  // === TABEL DETAIL (filter mode) ===
  const filtered = await p.orderItem.findMany({
    where: {
      transaction: { status: 'COMPLETED', deletedAt: null },
      OR: [
        { product: { category: { name: { equals: kat, mode: 'insensitive' } } } },
        { category: { equals: kat, mode: 'insensitive' } }
      ]
    },
    select: {
      subtotal: true, qty: true, category: true,
      product: { select: { category: { select: { name: true } } } },
      transaction: { select: { total: true, items: { select: { subtotal: true } } } }
    }
  })
  let detTotal = 0, detQty = 0
  for (const item of filtered) {
    const txSum = item.transaction.items.reduce((s, i) => s + i.subtotal, 0)
    detTotal += effectiveTotal(item.subtotal, item.transaction.total, txSum)
    detQty += item.qty
  }
  console.log('\n=== TABEL DETAIL (filter) ===')
  console.log('Total:', detTotal, '| Qty:', detQty)

  console.log('\n=== MATCH ===')
  console.log('Nominal sama:', Math.round(grafTotal) === Math.round(detTotal) ? '✅' : '❌')
  console.log('Qty sama:', grafQty === detQty ? '✅' : '❌')

  // Cek apakah ada item yang masuk filter tapi TIDAK masuk grafik
  const grafIds = new Set()
  for (const item of allItems) {
    const k = item.product?.category?.name || (item.category && item.category.trim()) || 'Lainnya'
    if (k === kat) grafIds.add(JSON.stringify({ sub: item.subtotal, qty: item.qty }))
  }
  console.log('\nGrafik count:', grafIds.size, '| Filter count:', filtered.length)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })

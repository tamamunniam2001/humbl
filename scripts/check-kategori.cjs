const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const items = await p.orderItem.findMany({
    where: { transaction: { status: 'COMPLETED', deletedAt: null } },
    select: { category: true, product: { select: { category: { select: { name: true } } } } }
  })

  const map = {}
  for (const item of items) {
    const kat = item.product?.category?.name || (item.category && item.category.trim()) || 'Lainnya'
    map[kat] = (map[kat] || 0) + 1
  }

  console.log('=== KATEGORI DI GRAFIK ===')
  Object.entries(map).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(k + ': ' + v))

  console.log('\n=== MATCH GRAFIK vs FILTER DETAIL ===')
  for (const kat of Object.keys(map)) {
    let where
    if (kat === 'Lainnya') {
      where = {
        transaction: { status: 'COMPLETED', deletedAt: null },
        OR: [
          { productId: null, OR: [{ category: null }, { category: '' }] },
          { product: { categoryId: null } }
        ]
      }
    } else {
      where = {
        transaction: { status: 'COMPLETED', deletedAt: null },
        OR: [
          { product: { category: { name: { equals: kat, mode: 'insensitive' } } } },
          { category: { equals: kat, mode: 'insensitive' } }
        ]
      }
    }
    const n = await p.orderItem.count({ where })
    const status = n === map[kat] ? '✅' : '❌'
    console.log(status + ' ' + kat + ' | grafik: ' + map[kat] + ' | filter: ' + n)
  }

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })

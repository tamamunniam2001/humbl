import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

// POST /admin/expense-items/sync-ingredients
// Sinkronkan SEMUA bahan ke tabel ExpenseItem dengan kategori "Persediaan":
// - "Bahan Baku Biasa" (isComposite=false) maupun "Bahan Baku Jadi" (isComposite=true)
// - Bahan yang sudah punya item pengeluaran aktif -> dilewati (skipped)
// - Bahan yang itemnya pernah dihapus (soft delete/isActive=false) -> diaktifkan kembali (restored)
export async function POST(req) {
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  // Semua bahan ikut disinkronkan: "Bahan Baku Biasa" (isComposite=false)
  // maupun "Bahan Baku Jadi" (isComposite=true / sub-resep)
  const [ingredients, existingItems] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseItem.findMany({ select: { id: true, name: true, isActive: true } }),
  ])

  const byName = new Map(existingItems.map(i => [i.name.trim().toLowerCase(), i]))
  let created = 0, restored = 0, skipped = 0

  for (const ing of ingredients) {
    const key = ing.name.trim().toLowerCase()
    const found = byName.get(key)

    if (found) {
      // Item pernah dihapus (soft delete: isActive=false) -> aktifkan kembali
      // supaya muncul lagi di daftar item pengeluaran
      if (!found.isActive) {
        await prisma.expenseItem.update({
          where: { id: found.id },
          data: { isActive: true, category: 'Persediaan', satuan: ing.unit || '' },
        })
        restored++
      } else {
        skipped++
      }
      continue
    }

    await prisma.expenseItem.create({
      data: {
        code: ing.code || null,
        name: ing.name,
        category: 'Persediaan',
        satuan: ing.unit || '',
      },
    })
    created++
  }

  return NextResponse.json({ created, restored, skipped, total: ingredients.length })
}

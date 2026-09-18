import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'

const DEFAULTS = {
  storeName: 'BUMI KOPI',
  tagline: 'Struk Pembayaran',
  footer: 'Terima kasih sudah berkunjung!\nBumi Kopi',
  printWidth: 32,
  lineSpacing: 1,
  footerLineSpacing: 1,
}

// GET boleh diakses semua role (kasir perlu untuk print struk)
export async function GET(req) {
  const { error } = verifyAuth(req)
  if (error) return error
  let settings = await prisma.receiptSettings.findUnique({ where: { id: 'singleton' } })
  if (!settings) settings = { id: 'singleton', ...DEFAULTS }
  return NextResponse.json(settings)
}

// PUT hanya admin
export async function PUT(req) {
  const { user, error } = verifyAuth(req)
  if (error) return error
  const deny = adminOnly(user)
  if (deny) return deny
  const body = await req.json()
  const data = {
    storeName: body.storeName ?? DEFAULTS.storeName,
    tagline: body.tagline ?? DEFAULTS.tagline,
    footer: body.footer ?? DEFAULTS.footer,
    printWidth: Number(body.printWidth) || DEFAULTS.printWidth,
    lineSpacing: Number(body.lineSpacing) ?? DEFAULTS.lineSpacing,
    footerLineSpacing: Number(body.footerLineSpacing) ?? DEFAULTS.footerLineSpacing,
  }
  const settings = await prisma.receiptSettings.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  })
  return NextResponse.json(settings)
}

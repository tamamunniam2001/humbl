import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  try {
    const { phone } = await params
    const normalized = phone.replace(/\D/g, '').replace(/^0/, '62')

    const customer = await prisma.customer.findUnique({ where: { phone: normalized } })

    if (!customer) return NextResponse.json({ message: 'Customer tidak ditemukan' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (e) {
    return NextResponse.json({ message: e.message }, { status: 500 })
  }
}

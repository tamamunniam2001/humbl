import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ message: 'File tidak ditemukan' }, { status: 400 })
    const blob = await put(`selfie/${Date.now()}.jpg`, file, { access: 'public' })
    return NextResponse.json({ url: blob.url })
  } catch (e) {
    return NextResponse.json({ message: e.message || 'Gagal upload' }, { status: 500 })
  }
}

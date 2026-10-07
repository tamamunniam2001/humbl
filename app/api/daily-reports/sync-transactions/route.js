import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, adminOnly } from '@/lib/auth'
import { wibDateKey, wibDayRange, shiftForTransaction, SHIFT_ORDER, SHIFT_HOURS } from '@/lib/wib'

function isSameOrigin(req) {
  const host = req.headers.get('host')
  if (!host) return false
  const origin = req.headers.get('origin')
  if (origin) {
    try { return new URL(origin).host === host } catch { return false }
  }
  const referer = req.headers.get('referer')
  if (referer) {
    try { return new URL(referer).host === host } catch { return false }
  }
  return req.headers.get('x-requested-with') === 'XMLHttpRequest'
}

function calcTotalPengeluaran(report) {
  return (report.pengeluaran || []).reduce((s, p) => s + (Number(p.harga) || 0) * (Number(p.qty) || 1), 0)
}

function calcKasAkhir(report) {
  return (Number(report.kasAwal) || 0) + (Number(report.uangDisetor) || 0) - calcTotalPengeluaran(report)
}

// POST /api/daily-reports/sync-transactions
// Body: { date: 'YYYY-MM-DD', syncForwardKas: true }
// Menyinkronkan transaksi (baik dari POS kasir maupun transaksi manual) ke Laporan Harian.
// Jika pada tanggal tersebut belum ada laporan closing:
// Otomatis membuatkan draft / laporan harian awal untuk shift-shift yang memiliki transaksi
// (dengan status belum closing / catatan rekonstruksi otomatis), sehingga langsung masuk ke laporan harian.
export async function POST(req) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { error, user } = verifyAuth(req)
  if (error) return error
  const denied = adminOnly(user)
  if (denied) return denied

  try {
    const { date, syncForwardKas = true } = await req.json()
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ message: 'Parameter date tidak valid (format YYYY-MM-DD)' }, { status: 400 })
    }

    const dayRange = wibDayRange(date)

    // Ambil transaksi COMPLETED pada hari tersebut
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        createdAt: { gte: dayRange.gte, lte: dayRange.lte },
      },
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        payMethod: true,
        createdAt: true,
        originalCreatedAt: true,
        discountAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Ambil laporan yang sudah ada pada hari tersebut
    let dayReports = await prisma.dailyReport.findMany({
      where: { date: { gte: dayRange.gte, lte: dayRange.lte } },
      orderBy: { date: 'asc' },
    })

    // Cari kas awal shift pertama: dari laporan closing terakhir SEBELUM hari ini
    const prevReport = await prisma.dailyReport.findFirst({
      where: { date: { lt: dayRange.gte } },
      orderBy: { date: 'desc' },
    })
    const baseKasAwal = prevReport ? calcKasAkhir(prevReport) : 0

    // JIKA BELUM ADA LAPORAN DI HARI INI:
    // Buat laporan harian otomatis (status belum closing manual / hasil sinkronisasi transaksi manual)
    if (dayReports.length === 0) {
      if (transactions.length === 0) {
        return NextResponse.json({
          message: `Tidak ada transaksi yang tercatat pada tanggal ${date}.`,
        }, { status: 400 })
      }

      // Deteksi shift mana saja yang memiliki transaksi pada hari ini
      const dummyReports = SHIFT_ORDER.map(s => ({ shift: s, date: new Date(`${date}T12:00:00+07:00`) }))
      const shiftsWithTrx = new Set()
      for (const tx of transactions) {
        const s = shiftForTransaction(tx, dummyReports) || 'SHIFT_1'
        shiftsWithTrx.add(s)
      }

      // Buat minimal SHIFT_1 atau shift-shift yang punya transaksi
      const shiftsToCreate = SHIFT_ORDER.filter(s => shiftsWithTrx.has(s) || s === 'SHIFT_1')

      let currentKas = baseKasAwal
      const createdReports = []

      for (let i = 0; i < shiftsToCreate.length; i++) {
        const sKey = shiftsToCreate[i]
        const owned = transactions.filter(tx => shiftForTransaction(tx, dummyReports) === sKey)
        const sum = method => owned.filter(tx => tx.payMethod === method).reduce((s, tx) => s + tx.total, 0)

        const totalPenjualan = owned.reduce((s, tx) => s + tx.total, 0)
        const cash = sum('CASH')
        const qris = sum('QRIS')
        const transfer = sum('TRANSFER') + sum('NONTUNAI')

        const startHour = SHIFT_HOURS[sKey]?.startHour || 12
        const reportDate = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00.000+07:00`)

        const rep = await prisma.dailyReport.create({
          data: {
            date: reportDate,
            shift: sKey,
            kasAwal: currentKas,
            penjualan: totalPenjualan,
            uangDisetor: cash,
            qris,
            transfer,
            pengeluaran: [],
            piutang: [],
            catatan: 'Otomatis dari sinkronisasi transaksi',
            closerName: 'Admin (Sinkron)',
            cashierId: user.id,
          },
        })

        currentKas = calcKasAkhir(rep)
        createdReports.push(rep)
      }

      dayReports = createdReports
    }

    // JIKA LAPORAN SUDAH ADA (atau baru saja dibuat): SINKRONKAN ULANG
    const sortedReports = [...dayReports].sort((a, b) => {
      const idxA = SHIFT_ORDER.indexOf(a.shift)
      const idxB = SHIFT_ORDER.indexOf(b.shift)
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99)
    })

    let runningKasAwal = baseKasAwal
    const updatedReports = []

    for (let i = 0; i < sortedReports.length; i++) {
      const report = sortedReports[i]
      const owned = transactions.filter(tx => shiftForTransaction(tx, sortedReports) === report.shift)
      const sum = method => owned.filter(tx => tx.payMethod === method).reduce((s, tx) => s + tx.total, 0)

      const penjualan = owned.reduce((s, tx) => s + tx.total, 0)
      const cash = sum('CASH')
      const qris = sum('QRIS')
      const transfer = sum('TRANSFER') + sum('NONTUNAI')

      const currentKasAwal = i === 0 ? (prevReport ? baseKasAwal : report.kasAwal) : runningKasAwal

      const updated = await prisma.dailyReport.update({
        where: { id: report.id },
        data: {
          kasAwal: currentKasAwal,
          penjualan,
          uangDisetor: cash,
          qris,
          transfer,
        },
      })

      runningKasAwal = calcKasAkhir(updated)
      updatedReports.push(updated)
    }

    // Merambatkan kas awal ke hari-hari berikutnya jika diminta
    let forwardUpdatedCount = 0
    if (syncForwardKas) {
      const futureReports = await prisma.dailyReport.findMany({
        where: { date: { gt: dayRange.lte } },
        orderBy: { date: 'asc' },
      })

      let carryKas = runningKasAwal
      for (const fut of futureReports) {
        if (fut.kasAwal !== carryKas) {
          const upFut = await prisma.dailyReport.update({
            where: { id: fut.id },
            data: { kasAwal: carryKas },
          })
          carryKas = calcKasAkhir(upFut)
          forwardUpdatedCount++
        } else {
          carryKas = calcKasAkhir(fut)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan laporan tanggal ${date} (${updatedReports.length} shift, total penjualan: Rp ${updatedReports.reduce((s, r) => s + r.penjualan, 0).toLocaleString('id-ID')})` + (forwardUpdatedCount > 0 ? ` serta menyesuaikan kas pada ${forwardUpdatedCount} shift berikutnya.` : '.'),
      updatedCount: updatedReports.length,
      forwardUpdatedCount,
      reports: updatedReports,
    })
  } catch (err) {
    return NextResponse.json({ message: err.message || 'Gagal menyinkronkan data' }, { status: 500 })
  }
}


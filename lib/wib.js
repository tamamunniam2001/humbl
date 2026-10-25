export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export const SHIFT_HOURS = {
  SHIFT_1: { startHour: 7, endHour: 13, label: 'Shift 1' },
  SHIFT_2: { startHour: 12, endHour: 18, label: 'Shift 2' },
  SHIFT_3: { startHour: 17, endHour: 23, label: 'Shift 3' },
}

export const SHIFT_ORDER = ['SHIFT_1', 'SHIFT_2', 'SHIFT_3']

function pad(value) {
  return String(value).padStart(2, '0')
}

// ── Cut-off Bulanan per Tanggal 20 ──
// Contoh: Bulan Oktober (month = 10, atau index 9) -> 20 September s/d 20 Oktober
export function getMonthlyCutoffRange(year, month) {
  const m = Number(month)
  const y = Number(year)
  const prevMonth = m === 1 ? 12 : m - 1
  const prevYear = m === 1 ? y - 1 : y
  const from = `${prevYear}-${pad(prevMonth)}-20`
  const to = `${y}-${pad(m)}-20`
  return {
    from,
    to,
    gte: new Date(`${from}T00:00:00.000+07:00`),
    lte: new Date(`${to}T23:59:59.999+07:00`),
  }
}

// Ambil periode cut-off aktif untuk waktu tertentu (default: sekarang WIB)
// Jika tanggal sekarang > 20, periode aktif adalah bulan berikutnya (mis. 25 Okt -> periode Nov: 20 Okt - 20 Nov)
export function getCurrentCutoffPeriod(date = new Date()) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS)
  const year = wib.getUTCFullYear()
  const month = wib.getUTCMonth() + 1 // 1..12
  const day = wib.getUTCDate()
  let cutoffMonth = month
  let cutoffYear = year
  if (day > 20) {
    if (month === 12) {
      cutoffMonth = 1
      cutoffYear = year + 1
    } else {
      cutoffMonth = month + 1
    }
  }
  return {
    year: cutoffYear,
    month: cutoffMonth, // 1..12
    monthIndex: cutoffMonth - 1, // 0..11
    ...getMonthlyCutoffRange(cutoffYear, cutoffMonth),
  }
}

export function wibDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

export function wibDayRange(value) {
  const key = wibDateKey(value)
  return {
    gte: new Date(`${key}T00:00:00.000+07:00`),
    lte: new Date(`${key}T23:59:59.999+07:00`),
  }
}

export function wibShiftRange(value, shift) {
  const key = wibDateKey(value)
  const hours = SHIFT_HOURS[shift] || SHIFT_HOURS.SHIFT_1
  return {
    gte: new Date(`${key}T${pad(hours.startHour)}:00:00.000+07:00`),
    lte: new Date(`${key}T${pad(hours.endHour)}:59:59.999+07:00`),
  }
}

export function wibShiftForTransaction(value, reports = []) {
  const time = new Date(value).getTime()
  const reportsByShift = new Map(reports.map(report => [report.shift, report]))

  const stillOpen = shift => {
    const report = reportsByShift.get(shift)
    if (!report) return true
    return new Date(report.closedAt || report.createdAt || report.date).getTime() >= time
  }

  for (const shift of SHIFT_ORDER) {
    const range = wibShiftRange(value, shift)
    if (time < range.gte.getTime() || time > range.lte.getTime()) continue
    if (stillOpen(shift)) return shift
  }

  const firstRange = wibShiftRange(value, SHIFT_ORDER[0])
  if (time < firstRange.gte.getTime()) return SHIFT_ORDER[0]
  return SHIFT_ORDER[SHIFT_ORDER.length - 1]
}

export function isSameWibDay(left, right) {
  return wibDateKey(left) === wibDateKey(right)
}

function anchorShift(value) {
  const time = new Date(value).getTime()
  return SHIFT_ORDER.find(shift => {
    const range = wibShiftRange(value, shift)
    return range.gte.getTime() === time || range.lte.getTime() === time
  }) || null
}

export function shiftForTransaction(tx, reports = []) {
  if (tx.originalCreatedAt) {
    const matched = anchorShift(tx.createdAt)
    if (matched) return matched
  }
  return wibShiftForTransaction(tx.createdAt, reports)
}

export function nextShiftForTime(value, originalCreatedAt = null) {
  const current = shiftForTransaction({ createdAt: value, originalCreatedAt })
  const index = current ? SHIFT_ORDER.indexOf(current) : -1
  if (index < 0) return null
  return SHIFT_ORDER[index + 1] || null
}

export function shiftAnchorTime(value, shift) {
  const range = wibShiftRange(value, shift)
  return new Date(range.gte.getTime())
}

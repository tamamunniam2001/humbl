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

// Shift ranges overlap (07-13, 12-18, 17-23), so a transaction could match
// more than one shift. Assign it to the first shift in order that was not
// closed before the transaction was created. Shifts without a report yet are
// treated as still open, which makes the rule work for pending closings too.
export function wibShiftForTransaction(value, reports = []) {
  const time = new Date(value).getTime()
  const reportsByShift = new Map(reports.map(report => [report.shift, report]))

  for (const shift of SHIFT_ORDER) {
    const range = wibShiftRange(value, shift)
    if (time < range.gte.getTime() || time > range.lte.getTime()) continue

    const report = reportsByShift.get(shift)
    if (!report) return shift
    if (new Date(report.closedAt || report.createdAt || report.date).getTime() >= time) return shift
  }

  return null
}

export function isSameWibDay(left, right) {
  return wibDateKey(left) === wibDateKey(right)
}

// Tentukan shift berikutnya dari sebuah waktu (WIB), memakai urutan shift.
// Contoh: order jam 16:30 (masih SHIFT_2 menurut jam 12-18) → otomatis SHIFT_3.
export function nextShiftForTime(value) {
  const current = wibShiftForTransaction(value)
  const index = current ? SHIFT_ORDER.indexOf(current) : -1
  if (index < 0) return null
  return SHIFT_ORDER[index + 1] || null
}

// Titik waktu representatif di dalam sebuah shift — dipakai saat memindahkan
// open bill agar transaksinya masuk ke laporan shift tujuan.
// Dipakai ujung akhir shift tujuan (bukan awal) karena jam shift saling
// tumpang tindih: contoh Shift 2 mulai 12:00, jadi titik 12:01 masih terhitung
// Shift 1. Ujung akhir dipakai juga karena seluruh shift tujuan berada di
// belakang titik tutup shift sebelumnya.
export function shiftAnchorTime(value, shift) {
  const range = wibShiftRange(value, shift)
  return new Date(range.lte.getTime())
}

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
//
// Transaksi tetap harus milik tepat satu shift: kalau waktunya jatuh di luar
// semua jam shift (mis. transaksi pukul 03.00 atau 23.59.30), sebelumnya
// fungsi ini mengembalikan null sehingga transaksi tersebut hilang dari
// laporan harian padahal masih tercatat di History Transaksi. Karena itu
// di sini dikembalikan shift terdekat (sebelum jam shift pertama -> SHIFT_1,
// sesudah jam shift terakhir -> SHIFT_3) agar rekap harian tidak pernah
// menghitung lebih sedikit daripada transaksi yang benar-benar terjadi.
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

  // Di luar seluruh jam shift: ambil shift terdekat. Baik shift itu sudah
  // closing atau belum, transaksinya tetap harus tercatat di salah satu
  // laporan hari itu.
  const firstRange = wibShiftRange(value, SHIFT_ORDER[0])
  if (time < firstRange.gte.getTime()) return SHIFT_ORDER[0]
  return SHIFT_ORDER[SHIFT_ORDER.length - 1]
}

export function isSameWibDay(left, right) {
  return wibDateKey(left) === wibDateKey(right)
}

// Cocokkan timestamp hasil pindah shift ke shift tujuan. Timestamp pindahan
// selalu jatuh tepat di batas sebuah shift: awal shift (07:00:00.000 /
// 12:00:00.000 / 17:00:00.000) untuk data baru, ujung shift
// (13:59:59.999 / 18:59:59.999 / 23:59:59.999) untuk data lama. Tiap shift
// punya batas unik, jadi hasilnya deterministik tanpa harus melihat apakah
// shift sudah closing. Tanpa cek ini, awal shift tujuan jatuh di dalam rentang
// shift sebelumnya (jam shift saling tumpang tindih) dan transaksi yang
// dipindahkan malah dihitung di shift lama.
function anchorShift(value) {
  const time = new Date(value).getTime()
  return SHIFT_ORDER.find(shift => {
    const range = wibShiftRange(value, shift)
    return range.gte.getTime() === time || range.lte.getTime() === time
  }) || null
}

// Shift milik sebuah transaksi. `originalCreatedAt` hanya terisi pada
// transaksi yang pernah dipindahkan — untuk itu pencocokan anchor diprioritaskan
// agar transaksi tetap dihitung di shift tujuan, bukan shift yang kebetulan
// memuat waktunya.
export function shiftForTransaction(tx, reports = []) {
  if (tx.originalCreatedAt) {
    const matched = anchorShift(tx.createdAt)
    if (matched) return matched
  }
  return wibShiftForTransaction(tx.createdAt, reports)
}

// Tentukan shift berikutnya dari sebuah waktu (WIB), memakai urutan shift.
// Contoh: order jam 16:30 (masih SHIFT_2 menurut jam 12-18) → otomatis SHIFT_3.
// `originalCreatedAt` diteruskan bila transaksi sudah pernah dipindahkan, supaya
// hitungan "shift saat ini" tidak salah akibat timestamp yang sudah diganti.
export function nextShiftForTime(value, originalCreatedAt = null) {
  const current = shiftForTransaction({ createdAt: value, originalCreatedAt })
  const index = current ? SHIFT_ORDER.indexOf(current) : -1
  if (index < 0) return null
  return SHIFT_ORDER[index + 1] || null
}

// Titik waktu representatif di dalam sebuah shift — dipakai saat memindahkan
// open bill agar transaksinya tercatat di shift tujuan.
// Dipakai AWAL shift tujuan supaya jam yang tampil wajar (17.00 untuk Shift 3,
// bukan 23.59). Karena jam shift tumpang tindih, awal shift tujuan sebenarnya
// masih berada di rentang shift sebelumnya — karena itu penentuan shift untuk
// transaksi terpindah tidak boleh berdasar waktu semata, melainkan lewat
// shiftForTransaction() di atas yang mencocokkan timestamp anchor ini.
export function shiftAnchorTime(value, shift) {
  const range = wibShiftRange(value, shift)
  return new Date(range.gte.getTime())
}

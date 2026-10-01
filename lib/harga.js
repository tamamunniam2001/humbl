// Perhitungan harga persediaan (Stock Opname & Pantau Bahan Baku).
//
// Konteksnya sering keliru: `harga` pada pembelian (ExpenseDetail.harga) adalah
// harga SATU KEMASAN, sedangkan `isi` adalah isi kemasan dalam satuan dasar
// (mis. Rp20.000 per kemasan berisi 200 gram). Harga per satuan dasar harus
// didapat dengan membagi `harga` dengan `isi`, bukan dengan `konversi`.
//
//   konversi = 1 satuanOpname = berapa satuan dasar (mis. 1 porsi = 5 gram)
//
// Pemakaian rumus `harga / konversi` membuat harga per satuan dasar jadi ikut
// ukuran porsi (Rp20.000 / 5 = Rp4.000 per gram) — jauh di atas nilai
// sebenarnya (Rp20.000 / 200 = Rp100 per gram).

/**
 * Harga per satuan dasar (gram / ml / pcs).
 * Prioritas:
 *   1. harga beli ÷ isi kemasan  → paling akurat
 *   2. fallback lama: harga beli ÷ konversi (dipakai bila `isi` kosong)
 *   3. harga apa adanya (bila `isi` dan `konversi` sama-sama kosong)
 * Mengembalikan null bila harga tidak valid.
 */
export function hitungHargaDasar({ harga, isi, konversi } = {}) {
  const h = Number(harga)
  if (!Number.isFinite(h) || h <= 0) return null

  const i = Number(isi)
  if (Number.isFinite(i) && i > 0) return h / i

  const k = Number(konversi)
  if (Number.isFinite(k) && k > 0) return h / k

  return h
}

/**
 * Harga untuk ditampilkan pada satuan opname (mis. per porsi).
 * Rumus lama membagi dengan konversi, lalu tampilan mengalikannya kembali —
 * dua operasi itu saling menghapus sehingga yang tampil selalu harga kemasan.
 * Fungsi ini hanya mengalikan satu arah: harga dasar × konversi.
 */
export function hitungHargaTampil(hargaDasar, konversi) {
  if (hargaDasar == null) return null
  const k = Number(konversi)
  return Number.isFinite(k) && k > 0 ? hargaDasar * k : hargaDasar
}

/**
 * Nilai stok = qty dalam satuan dasar × harga per satuan dasar.
 */
export function hitungNilaiStok(qtyDasar, hargaDasar) {
  const q = Number(qtyDasar)
  const h = Number(hargaDasar)
  if (!Number.isFinite(q) || !Number.isFinite(h)) return 0
  return q * h
}

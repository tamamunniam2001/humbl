const ESC = 0x1b
const GS = 0x1d

function encode(str) {
  return Array.from(new TextEncoder().encode(str))
}

const DEFAULT_SETTINGS = {
  storeName: 'BUMI KOPI',
  tagline: 'Struk Pembayaran',
  footer: 'Terima kasih sudah berkunjung!\nBumi Kopi',
  printWidth: 32,
  lineSpacing: 1,
  footerLineSpacing: 1,
  barCategories: [],
  kitchenCategories: [],
}

let _cachedSettings = null
let _cacheTime = 0
const CACHE_TTL = 60000 // 1 menit

async function getReceiptSettings() {
  // Invalidate cache setiap 1 menit agar perubahan setting langsung terpakai
  if (_cachedSettings && Date.now() - _cacheTime < CACHE_TTL) return _cachedSettings
  try {
    const token = document.cookie.match(/token=([^;]+)/)?.[1] ?? ''
    const res = await fetch('/api/admin/receipt-settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      _cachedSettings = await res.json()
      _cacheTime = Date.now()
    }
  } catch {}
  return _cachedSettings ?? DEFAULT_SETTINGS
}

function buildReceipt(tx, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const w = Math.max(24, Math.min(48, s.printWidth))
  const fmt = (n) => Number(n).toLocaleString('id-ID')
  const date = new Date(tx.createdAt).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const bytes = []
  const push = (...args) => bytes.push(...args)
  const text = (str) => push(...encode(str + '\n'))
  const hr = () => text('-'.repeat(w))

  const row = (left, right) => {
    const gap = w - left.length - right.length
    text(left + ' '.repeat(Math.max(1, gap)) + right)
  }

  const lineGap = Math.max(0, Math.min(5, s.lineSpacing ?? 1))
  const blank = () => { for (let i = 0; i < lineGap; i++) text('') }

  // Init + center
  push(ESC, 0x40)
  push(ESC, 0x61, 0x01)                    // center
  push(ESC, 0x21, 0x30)                    // double height+width bold
  text(s.storeName)
  push(ESC, 0x21, 0x00)                    // normal
  if (s.tagline) text(s.tagline)
  push(ESC, 0x61, 0x00)                    // left

  hr()
  text(`Invoice : ${tx.invoiceNo.replace(/^BK-/, '')}`)
  text(`Kasir   : ${tx.cashier?.name ?? '-'}`)
  if (tx.customerName) text(`Pembeli : ${tx.customerName.substring(0, w - 10)}`)
  if (tx.note) text(`Catatan : ${tx.note.substring(0, w - 10)}`)
  text(`Waktu   : ${date}`)
  hr()
  blank()

  for (const item of tx.items ?? []) {
    const name = item.product?.name ?? item.name ?? '-'
    text(name.substring(0, w))
    row(`  ${item.qty} x Rp ${fmt(item.price)}`, `Rp ${fmt(item.subtotal)}`)
    blank()
  }

  hr()
  push(ESC, 0x45, 0x01)                    // bold on
  row('TOTAL', `Rp ${fmt(tx.total)}`)
  push(ESC, 0x45, 0x00)                    // bold off
  blank()
  row(`Bayar (${tx.payMethod})`, `Rp ${fmt(tx.payment)}`)
  if (tx.change > 0) row('Kembalian', `Rp ${fmt(tx.change)}`)
  hr()

  // Footer
  const footerLines = (s.footer || '').split('\n').map(l => l.trim()).filter(Boolean)
  const footerGap = Math.max(0, Math.min(5, s.footerLineSpacing ?? 1))
  push(ESC, 0x61, 0x01)                    // center
  footerLines.forEach(f => {
    text(f)
    for (let i = 0; i < footerGap; i++) text('')
  })
  push(ESC, 0x61, 0x00)

  // Feed + cut
  push(ESC, 0x64, 0x01)
  push(GS, 0x56, 0x41, 0x00)

  return new Uint8Array(bytes)
}

function buildStationReceipt(tx, label, items, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const w = Math.max(24, Math.min(48, s.printWidth))
  const date = new Date(tx.createdAt).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const bytes = []
  const push = (...args) => bytes.push(...args)
  const text = (str) => push(...encode(str + '\n'))
  const hr = () => text('-'.repeat(w))
  const lineGap = Math.max(0, Math.min(5, s.lineSpacing ?? 1))
  const blank = () => { for (let i = 0; i < lineGap; i++) text('') }

  push(ESC, 0x40)
  push(ESC, 0x61, 0x01)                    // center
  push(ESC, 0x21, 0x30)                    // double height+width bold
  text(label)                              // "DAPUR" atau "BAR"
  push(ESC, 0x21, 0x00)
  push(ESC, 0x61, 0x00)                    // left

  hr()
  text(`Invoice : ${tx.invoiceNo.replace(/^BK-/, '')}`)
  if (tx.customerName) text(`Pembeli : ${tx.customerName.substring(0, w - 10)}`)
  if (tx.note) text(`Catatan : ${tx.note.substring(0, w - 10)}`)
  text(`Waktu   : ${date}`)
  hr()
  blank()

  for (const item of items) {
    const name = item.product?.name ?? item.name ?? '-'
    push(ESC, 0x45, 0x01)                  // bold on
    text(name.substring(0, w))
    push(ESC, 0x45, 0x00)                  // bold off
    text(`  Qty: ${item.qty}`)
    blank()
  }

  hr()
  push(ESC, 0x64, 0x01)
  push(GS, 0x56, 0x41, 0x00)

  return new Uint8Array(bytes)
}

// Cache device & characteristic
let _device = null
let _characteristic = null

async function _getCharacteristic() {
  if (_characteristic && _device?.gatt?.connected) return _characteristic

  if (_device) {
    try {
      const server = await _device.gatt.connect()
      _characteristic = await _findCharacteristic(server)
      return _characteristic
    } catch {
      _device = null
      _characteristic = null
    }
  }

  if (!navigator.bluetooth) throw new Error('Browser tidak mendukung Web Bluetooth')

  let device
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
    })
  } catch {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
    })
  }

  _device = device
  _device.addEventListener('gattserverdisconnected', () => { _characteristic = null })

  const server = await _device.gatt.connect()
  _characteristic = await _findCharacteristic(server)
  return _characteristic
}

async function _findCharacteristic(server) {
  try {
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
    return await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')
  } catch {
    const services = await server.getPrimaryServices()
    for (const svc of services) {
      const chars = await svc.getCharacteristics()
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) return c
      }
    }
  }
  throw new Error('Karakteristik printer tidak ditemukan')
}

async function _sendData(data) {
  const characteristic = await _getCharacteristic()
  const useAck = characteristic.properties.write
  const chunkSize = 128
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    if (useAck) await characteristic.writeValue(chunk)
    else { await characteristic.writeValueWithoutResponse(chunk); await new Promise(r => setTimeout(r, 50)) }
  }
}

async function printThermal(tx) {
  await _sendData(buildReceipt(tx, await getReceiptSettings()))
  return _device?.name ?? _device?.id ?? 'Printer'
}

async function printAll(tx) {
  const settings = await getReceiptSettings()
  const barCats = new Set((settings.barCategories || []).map(c => c.toLowerCase()))
  const kitchenCats = new Set((settings.kitchenCategories || []).map(c => c.toLowerCase()))
  const getCategory = (item) => (item.product?.category?.name ?? item.category ?? '').toLowerCase()
  const kitchenItems = (tx.items ?? []).filter(i => kitchenCats.has(getCategory(i)))
  const barItems = (tx.items ?? []).filter(i => barCats.has(getCategory(i)))

  await _sendData(buildReceipt(tx, settings))
  if (kitchenItems.length > 0) { await new Promise(r => setTimeout(r, 300)); await _sendData(buildStationReceipt(tx, 'DAPUR', kitchenItems, settings)) }
  if (barItems.length > 0) { await new Promise(r => setTimeout(r, 300)); await _sendData(buildStationReceipt(tx, 'BAR', barItems, settings)) }

  return _device?.name ?? _device?.id ?? 'Printer'
}

async function printKitchen(tx) {
  const settings = await getReceiptSettings()
  const kitchenCats = new Set((settings.kitchenCategories || []).map(c => c.toLowerCase()))
  const getCategory = (item) => (item.product?.category?.name ?? item.category ?? '').toLowerCase()
  const items = (tx.items ?? []).filter(i => kitchenCats.has(getCategory(i)))
  if (!items.length) throw new Error('Tidak ada item dapur di transaksi ini')
  await _sendData(buildStationReceipt(tx, 'DAPUR', items, settings))
}

async function printBar(tx) {
  const settings = await getReceiptSettings()
  const barCats = new Set((settings.barCategories || []).map(c => c.toLowerCase()))
  const getCategory = (item) => (item.product?.category?.name ?? item.category ?? '').toLowerCase()
  const items = (tx.items ?? []).filter(i => barCats.has(getCategory(i)))
  if (!items.length) throw new Error('Tidak ada item bar di transaksi ini')
  await _sendData(buildStationReceipt(tx, 'BAR', items, settings))
}

function disconnectPrinter() {
  if (_device?.gatt?.connected) _device.gatt.disconnect()
  _device = null
  _characteristic = null
}

function resetSettingsCache() {
  _cachedSettings = null
  _cacheTime = 0
}

async function connectPrinter() {
  await _getCharacteristic()
  return _device?.name || _device?.id || 'Printer'
}

function getPrinterStatus() {
  return {
    connected: !!(_device?.gatt?.connected && _characteristic),
    name: _device?.name || _device?.id || null,
  }
}

export { printThermal, printAll, printKitchen, printBar, buildReceipt, disconnectPrinter, resetSettingsCache, connectPrinter, getPrinterStatus }

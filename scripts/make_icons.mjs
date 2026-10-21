// Генерация иконок PWA без внешних зависимостей: растеризация простых фигур + PNG через zlib.
// Иконка приложения «Тренировки»: гантель в фиолетовой гамме эталона.
// Запуск: node scripts/make_icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [21, 19, 29] // --bg тёмной темы
const FG = [179, 166, 255] // --accent тёмной темы

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// фигуры в координатах 0..1
const rrect = (x, y, cx, cy, w, h, r) => {
  const dx = Math.max(Math.abs(x - cx) - w / 2 + r, 0)
  const dy = Math.max(Math.abs(y - cy) - h / 2 + r, 0)
  return Math.hypot(dx, dy) <= r
}
/** Гантель: гриф и два блина. */
function dumbbell(u, v, scale) {
  const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale
  if (rrect(x, y, 0.5, 0.5, 0.46, 0.075, 0.03)) return true // гриф
  if (rrect(x, y, 0.265, 0.5, 0.14, 0.46, 0.06)) return true // левый блин
  if (rrect(x, y, 0.735, 0.5, 0.14, 0.46, 0.06)) return true // правый блин
  return false
}
function icon(size, { maskable = false, rounded = true } = {}) {
  const S = 4
  return png(size, (px, py) => {
    let bg = 0, fg = 0
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const u = (px + (i + 0.5) / S) / size, v = (py + (j + 0.5) / S) / size
      const inBg = maskable || !rounded || rrect(u, v, 0.5, 0.5, 1, 1, 0.22)
      if (!inBg) continue
      bg++
      if (dumbbell(u, v, maskable ? 0.7 : 0.88)) fg++
    }
    const a = bg / (S * S)
    if (a === 0) return [0, 0, 0, 0]
    const t = fg / bg
    return [0, 1, 2].map((k) => Math.round(BG[k] * (1 - t) + FG[k] * t)).concat([Math.round(a * 255)])
  })
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', icon(192))
writeFileSync('public/icons/icon-512.png', icon(512))
writeFileSync('public/icons/icon-maskable-512.png', icon(512, { maskable: true }))
writeFileSync('public/icons/apple-touch-icon.png', icon(180, { rounded: false }))
writeFileSync('public/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#15131d"/><g fill="#b3a6ff"><rect x="27" y="46.5" width="46" height="7" rx="3"/><rect x="19.5" y="27" width="14" height="46" rx="6"/><rect x="66.5" y="27" width="14" height="46" rx="6"/></g></svg>`)
console.log('icons written')

// Иконки PWA из public/icons/icon.svg (женщина-берсерк). Исходник — сам SVG, PNG рендерит headless Chrome/Edge.
// Фон SVG занимает весь квадрат, а значимое — в центральных 80 %, поэтому одна картинка годится и как maskable (Android).
// Запуск: node scripts/make_icons.mjs   (путь к браузеру можно задать переменной CHROME)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const chrome = candidates.find((p) => existsSync(p))
if (!chrome) throw new Error('Не найден Chrome/Edge — задайте путь в переменной CHROME')

const svg = readFileSync(resolve('public/icons/icon.svg'), 'utf8').replace(/<svg /, '<svg style="display:block;width:100vw;height:100vh" ')
const tmp = mkdtempSync(join(tmpdir(), 'icons-'))
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]
try {
  for (const [name, size] of targets) {
    const page = join(tmp, `${size}.html`)
    writeFileSync(page, `<!doctype html><html><body style="margin:0">${svg}</body></html>`)
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=3000',
      `--screenshot=${resolve('public/icons', name)}`, `--window-size=${size},${size}`, pathToFileURL(page).href], { stdio: 'ignore' })
    console.log('готово:', name)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

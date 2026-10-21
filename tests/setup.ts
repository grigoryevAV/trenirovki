import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest запускается без глобальных API, поэтому автоочистка DOM не включается — включаем явно.
afterEach(() => {
  cleanup()
})

// jsdom может не реализовывать structuredClone — Dexie его требует.
const g = globalThis as unknown as { structuredClone?: (v: unknown) => unknown }
if (typeof g.structuredClone !== 'function') {
  g.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v))
}

// jsdom не умеет прокручивать страницу — приложение дёргает scrollTo при смене экрана.
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}

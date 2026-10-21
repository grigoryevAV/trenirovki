/** Черновик ввода: слияние загруженного черновика с тем, что уже введено в этой сессии. */
import type { Draft, DraftType } from './types'

/** Ключи «что изменено в этой сессии». */
export const touch = {
  feel: 'feel',
  note: (t: 'A' | 'B'): string => `note:${t}`,
  set: (t: 'A' | 'B', exId: string, i: number, field: 'w' | 'r'): string => `set:${t}:${exId}:${i}:${field}`,
}

/**
 * Слияние черновиков: загруженный из базы не перетирает то, что уже введено в этой сессии.
 * Если в этой сессии ничего не меняли — берётся загруженный черновик целиком.
 */
export function mergeDraft(current: Draft, loaded: Draft, touched: ReadonlySet<string>): Draft {
  if (!touched.size) return loaded
  const merged: Draft = {
    date: loaded.date,
    feel: touched.has(touch.feel) ? current.feel : loaded.feel,
  }
  for (const t of ['A', 'B'] as const) {
    const curT = current[t]
    const loadedT = loaded[t]
    if (!curT && !loadedT) continue
    if (!curT) {
      merged[t] = loadedT
      continue
    }
    if (!loadedT) {
      merged[t] = curT
      continue
    }
    const ex: DraftType['ex'] = { ...loadedT.ex }
    for (const [exId, arr] of Object.entries(curT.ex)) {
      const base = ex[exId] ? [...ex[exId]] : []
      arr.forEach((item, i) => {
        if (!item) return
        base[i] = { ...(base[i] ?? {}), ...item }
      })
      ex[exId] = base
    }
    merged[t] = { ex, note: touched.has(touch.note(t)) ? curT.note : loadedT.note }
  }
  return merged
}

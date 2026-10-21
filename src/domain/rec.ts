/** Рекомендации по весу — все ветки дословно из эталона. */
import { fmtKg, fmtShort, num } from './format'
import type { ExerciseDef, Mode, Session, SetEntry } from './types'

export interface Rec {
  /** Рекомендованный вес: число (кг), строка (резинка) или '' (подобрать самой). */
  w: number | string
  tone: 'first' | 'up' | 'down' | 'same'
  text: string
}

export interface LastSet {
  date: string
  sets: SetEntry[]
}

/**
 * Рекомендация по следующей тренировке.
 * @param def упражнение
 * @param last предыдущие подходы по этому упражнению (null — первый раз)
 * @param mode режим (progress / hold / light)
 * @param early этап освоения (первые 4 тренировки)
 */
export function rec(def: ExerciseDef, last: LastSet | null, mode: Mode, early: boolean): Rec {
  if (!last) {
    if (def.kind === 'band') return { w: '', tone: 'first', text: 'Первый раз: подберите резинку, с которой получается 5–8 чистых повторений.' }
    if (def.id === 'squat') return { w: '', tone: 'first', text: 'Первый раз: пустой гриф, запас 4–5 повторов. Задача — техника.' }
    if (def.kind === 'bw') return { w: 0, tone: 'first', text: 'Первый раз: без веса, плавно, без переразгибания в пояснице.' }
    return { w: '', tone: 'first', text: 'Первый раз: лёгкий вес с запасом 4–5 повторов.' }
  }
  const sets = last.sets
  const allTop = sets.length >= def.sets && sets.every((s) => num(s.r) >= def.hi)
  if (def.kind === 'band') {
    const band = sets[sets.length - 1].w || ''
    if (mode === 'light') return { w: band, tone: 'down', text: 'Та же или более толстая резинка, без отказа.' }
    if (allTop && mode === 'progress') return { w: band, tone: 'up', text: `Все подходы на ${def.hi}+ — возьмите резинку тоньше и начните с ${def.lo} повторов.` }
    if (allTop) return { w: band, tone: 'same', text: 'Верхняя граница взята. Резинку тоньше — только если сегодня легко.' }
    return { w: band, tone: 'same', text: `Та же резинка, добирайте повторения до ${def.hi}.` }
  }
  const lastW = Math.max(...sets.map((s) => num(s.w)))
  const incText = def.kind === 'db' ? 'берите следующие по весу гантели' : def.id === 'hip' ? '+2,5–5 кг' : def.kind === 'bw' ? '+2,5 кг (блин у груди)' : '+2,5 кг'
  if (mode === 'light') {
    if (def.kind === 'db' || def.kind === 'bw') return { w: lastW, tone: 'down', text: 'Вес прошлого раза или легче, запас 3–4 повтора.' }
    const w = Math.max(0, Math.round((lastW * 0.9) / 2.5) * 2.5)
    return { w, tone: 'down', text: `Облегчённо: около ${fmtKg(w)} кг (−10%), запас 3–4 повтора. Можно на 1 подход меньше.` }
  }
  if (early) {
    if (def.kind === 'bar') return { w: lastW + 2.5, tone: 'up', text: 'Этап освоения: если в прошлый раз было легко и чисто — +2,5–5 кг. Запас 4–5 повторов.' }
    return { w: lastW, tone: 'same', text: 'Этап освоения: запас 4–5 повторов, техника важнее веса.' }
  }
  if (allTop && mode === 'progress') {
    return { w: def.kind === 'db' ? lastW : lastW + 2.5, tone: 'up', text: `Все подходы на верхней границе — ${incText}, начинайте с ${def.lo} повторов.` }
  }
  if (allTop) return { w: lastW, tone: 'same', text: `Верхняя граница взята. ${incText[0].toUpperCase() + incText.slice(1)} — только если сегодня легко.` }
  return { w: lastW, tone: 'same', text: `Тот же вес, добирайте повторения до ${def.hi} во всех подходах.` }
}

/** Тренировки по убыванию времени. */
export function sortedDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** Последние подходы по упражнению в тренировке данного типа (null — не найдено). */
export function lastFor(sessions: Session[], type: string, id: string): LastSet | null {
  for (const s of sortedDesc(sessions)) {
    if (s.type === type && s.ex && Array.isArray(s.ex[id]) && s.ex[id].length) return { date: s.date, sets: s.ex[id] }
  }
  return null
}

/** Следующая тренировка по очереди — противоположная последней сохранённой. */
export function nextType(sessions: Session[]): 'A' | 'B' {
  const s = sortedDesc(sessions)[0]
  return s ? (s.type === 'A' ? 'B' : 'A') : 'A'
}

/** Строка «Прошлый раз, 21.10: 40×8 · 40×7». */
export function lastLine(def: ExerciseDef, last: LastSet): string {
  const parts = last.sets.map((s) => (def.kind === 'band' ? String(s.w || '—') : fmtKg(s.w)) + '×' + s.r)
  return `Прошлый раз, ${fmtShort(last.date)}: ${parts.join(' · ')}`
}

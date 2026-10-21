/** Рекомендации по упражнениям: thinly обёртка над правилами прогрессии. */
import { fmtKg, fmtShort } from './format'
import { type ExerciseHistoryItem, planProgression, type ProgressionPlan } from './progression'
import type { ExerciseDef, Mode, Session, SetEntry } from './types'

export type { ExerciseHistoryItem, ProgressionPlan }

export interface RecInput {
  def: ExerciseDef
  /** Тренировки этого упражнения (того же типа), новые сверху. */
  history: ExerciseHistoryItem[]
  mode: Mode
  /** Этап освоения: первые 4 тренировки. */
  early: boolean
  /** Шаги прибавки из настроек. */
  steps?: Record<string, number>
  /** Подпись запаса повторений. */
  rir?: string
}

/**
 * Рекомендация по упражнению на сегодня: вес, цели повторений, короткий текст и строка цели.
 * Вся логика — в src/domain/progression.ts.
 */
export function rec(input: RecInput): ProgressionPlan {
  return planProgression(input)
}

export interface LastSet {
  date: string
  sets: SetEntry[]
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

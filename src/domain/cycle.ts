/** Логика цикла: фазы, режим, расчёт дня цикла — 1:1 с эталоном. */
import { addDays, diffDays, isDate } from './format'
import type { CycleConfig, Mode, Phase } from './types'

export const CYCLE_LEN_MIN = 20
export const CYCLE_LEN_MAX = 45
export const PERIOD_LEN_MIN = 2
export const PERIOD_LEN_MAX = 9

/** Значения по умолчанию. Дата начала менструации намеренно НЕ зашита — её указывает пользователь. */
export const DEFAULT_CYCLE_LEN = 28
export const DEFAULT_PERIOD_LEN = 5

/** Тексты ошибок расчёта — как в эталоне. */
export const ERR_NO_START = 'Укажите дату начала менструации во вкладке «Цикл».'
export const ERR_FUTURE_START = 'Дата начала менструации позже сегодняшней — проверьте её во вкладке «Цикл».'

/**
 * Фаза по дню цикла (day — с 1).
 * men — дни 1..P, fol — до овуляции, ovu — овуляция ±1, lut — до последних 5 дней, pms — последние 5 дней,
 * late — цикл длиннее расчётного.
 */
export function phaseForDay(d: number, L: number, P: number): Phase {
  if (d <= P) return 'men'
  const ov = Math.max(P + 2, L - 14)
  if (d < ov - 1) return 'fol'
  if (d <= ov + 1) return 'ovu'
  if (d <= L - 5) return 'lut'
  if (d <= L) return 'pms'
  return 'late'
}

/** Режим тренировки по фазе и дню цикла. */
export function modeFor(phase: Phase, d: number): Mode {
  if (phase === 'men') return d <= 2 ? 'light' : 'hold'
  if (phase === 'fol' || phase === 'ovu') return 'progress'
  if (phase === 'pms') return 'light'
  return 'hold'
}

export interface CycleInfoOk {
  ok: true
  /** День цикла, с 1. */
  day: number
  L: number
  P: number
  phase: Phase
  mode: Mode
  /** Дата начала текущего (возможно, спрогнозируемого) цикла. */
  cycleStart: string
  /** true — цикл спрогнозирован, реальное начало не отмечено. */
  predicted: boolean
  /** Ожидаемое начало следующей менструации. */
  nextStart: string
}

export interface CycleInfoErr {
  ok: false
  error: string
}

export type CycleInfo = CycleInfoOk | CycleInfoErr

/**
 * Расчёт состояния цикла на дату.
 * Если отмеченных начал нет — ошибка с просьбой указать дату.
 * Если дата начала в будущем — ошибка о неверной дате.
 * Если прошло больше L+7 дней — цикл считается спрогнозированным (кратные L дней от последней отметки).
 */
export function cycleInfo(cfg: CycleConfig, today: string): CycleInfo {
  const starts = cfg.periodStarts
  if (!starts.length) return { ok: false, error: ERR_NO_START }
  const start = starts[starts.length - 1]
  const L = cfg.cycleLen
  const P = cfg.periodLen
  let ds = diffDays(today, start)
  if (ds < 0) return { ok: false, error: ERR_FUTURE_START }
  let cycleStart = start
  let predicted = false
  if (ds >= L + 7) {
    const k = Math.floor(ds / L)
    cycleStart = addDays(start, k * L)
    ds -= k * L
    predicted = true
  }
  const day = ds + 1
  const phase = phaseForDay(day, L, P)
  return {
    ok: true,
    day,
    L,
    P,
    phase,
    mode: modeFor(phase, day),
    cycleStart,
    predicted,
    nextStart: addDays(cycleStart, L),
  }
}

export interface PhaseRange {
  phase: Phase
  from: number
  to: number
}

/** Сжатые диапазоны фаз внутри цикла (для таблицы «Текущий цикл»). */
export function phaseRanges(L: number, P: number): PhaseRange[] {
  const out: PhaseRange[] = []
  for (let d = 1; d <= L; d++) {
    const p = phaseForDay(d, L, P)
    const last = out[out.length - 1]
    if (last && last.phase === p) last.to = d
    else out.push({ phase: p, from: d, to: d })
  }
  return out
}

/** Приводит настройки к допустимым значениям: цикл 20–45 дней, менструация 2–9 дней. */
export function normConfig(c: Partial<CycleConfig> | null | undefined): CycleConfig {
  const src = c ?? {}
  const starts = Array.isArray(src.periodStarts) ? src.periodStarts.filter(isDate) : []
  const unique = Array.from(new Set(starts)).sort()
  const L = Math.min(CYCLE_LEN_MAX, Math.max(CYCLE_LEN_MIN, parseInt(String(src.cycleLen), 10) || DEFAULT_CYCLE_LEN))
  const P = Math.min(PERIOD_LEN_MAX, Math.max(PERIOD_LEN_MIN, parseInt(String(src.periodLen), 10) || DEFAULT_PERIOD_LEN))
  return { periodStarts: unique, cycleLen: L, periodLen: P }
}

/** Интервалы между отмеченными началами, попадающие в 18–45 дней. */
export function cycleIntervals(starts: string[]): number[] {
  const out: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const d = diffDays(starts[i], starts[i - 1])
    if (d >= 18 && d <= 45) out.push(d)
  }
  return out
}

/** Средняя длина цикла по последним трём интервалам (18–45 дней). null — данных нет. */
export function averageCycleLen(starts: string[]): number | null {
  const recent = cycleIntervals(starts).slice(-3)
  if (!recent.length) return null
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
}

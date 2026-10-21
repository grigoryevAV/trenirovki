/**
 * Прогрессия нагрузок: двойная прогрессия по факту выполненного.
 * Все правила — чистые функции, без доступа к базе и без UI.
 */
import { diffDays, fmtKg, num } from './format'
import type { ExerciseDef, Mode, Session, SetEntry } from './types'

/** Шаги прибавки по умолчанию, кг. Для резинки шаг не числовой — «тоньше». */
export const DEFAULT_STEPS: Record<string, number> = {
  squat: 2.5,
  rdl: 2.5,
  hip: 5,
  bench: 1,
  ohp: 1,
  hyper: 2.5,
  pull: 0,
}

/** Шаг прибавки упражнения: из настроек, иначе по умолчанию. */
export function stepFor(def: ExerciseDef, steps?: Record<string, number>): number {
  const custom = steps?.[def.id]
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 0) return custom
  const preset = DEFAULT_STEPS[def.id]
  if (typeof preset === 'number') return preset
  switch (def.kind) {
    case 'db': return 1
    case 'bw': return 2.5
    case 'band': return 0
    default: return 2.5
  }
}

/** Одна тренировка с упражнением. */
export interface ExerciseHistoryItem {
  /** YYYY-MM-DD */
  date: string
  ts: number
  /** Режим тренировки: облегчённые не участвуют в анализе застоя. */
  mode: Mode
  sets: SetEntry[]
}

/** Тренировки с упражнением (того же типа), новые сверху. */
export function exerciseHistory(sessions: Session[], type: string, exId: string): ExerciseHistoryItem[] {
  return [...sessions]
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .filter((s) => s.type === type && s.ex && Array.isArray(s.ex[exId]) && s.ex[exId].length)
    .map((s) => ({ date: s.date, ts: s.ts, mode: s.mode, sets: s.ex[exId] }))
}

/** Цели повторений по подходам: прошлые + 1, не выше верхней границы; подхода не было — нижняя граница. */
export function repTargets(def: ExerciseDef, lastSets: SetEntry[]): number[] {
  return Array.from({ length: def.sets }, (_, i) => {
    const prev = lastSets[i]
    if (!prev) return def.lo
    return Math.min(def.hi, num(prev.r) + 1)
  })
}

/** Цели повторений без повышения (облегчённый режим): как в прошлый раз. */
function keepReps(def: ExerciseDef, lastSets: SetEntry[]): number[] {
  return Array.from({ length: def.sets }, (_, i) => {
    const prev = lastSets[i]
    if (!prev) return def.lo
    return Math.min(def.hi, Math.max(def.lo, num(prev.r)))
  })
}

/**
 * Все запланированные подходы сделаны на верхней границе.
 * Считается по РАБОЧЕМУ весу = максимальному: подходы легче рабочего в проверку не входят,
 * но все подходы с рабочим весом должны быть на верхней границе, и сделано должно быть
 * не меньше def.sets подходов.
 */
export function allSetsAtTop(def: ExerciseDef, sets: SetEntry[]): boolean {
  if (sets.length < def.sets) return false
  const weights = sets.map((s) => num(s.w))
  const working = Math.max(...weights)
  const topSets = sets.filter((_, i) => weights[i] === working)
  return topSets.length > 0 && topSets.every((s) => num(s.r) >= def.hi)
}

/** Максимальный вес подхода. */
export function maxWeight(sets: SetEntry[]): number {
  return sets.length ? Math.max(...sets.map((s) => num(s.w))) : 0
}

/** Сумма повторений. */
export function sumReps(sets: SetEntry[]): number {
  return sets.reduce((a, s) => a + num(s.r), 0)
}

/** Вес со снижением на 10%: штанга — с округлением к 2,5 кг, остальные — к шагу упражнения. */
export function reduceTen(weight: number, def: ExerciseDef, step: number): number {
  const target = weight * 0.9
  const unit = def.kind === 'bar' ? 2.5 : step > 0 ? step : 1
  return Math.max(0, Math.round(target / unit) * unit)
}

/**
 * Застой: две последние не-облегчённые тренировки этого упражнения прошли одним и тем же весом,
 * сумма повторений не выросла и прибавки не было.
 */
export function detectStagnation(
  def: ExerciseDef,
  history: ExerciseHistoryItem[],
  step: number,
): { weight: number } | null {
  const relevant = history.filter((h) => h.mode !== 'light').slice(0, 2)
  if (relevant.length < 2) return null
  const [cur, prev] = relevant
  const curW = maxWeight(cur.sets)
  const prevW = maxWeight(prev.sets)
  if (curW !== prevW) return null
  if (sumReps(cur.sets) > sumReps(prev.sets)) return null
  if (allSetsAtTop(def, cur.sets)) return null
  return { weight: reduceTen(curW, def, step) }
}

/** Номер недели тренировок: от первой сохранённой тренировки. */
export function trainingWeek(firstDate: string | null | undefined, today: string): number {
  if (!firstDate) return 1
  const days = diffDays(today, firstDate)
  if (!Number.isFinite(days) || days < 0) return 1
  return Math.floor(days / 7) + 1
}

/** Короткая подпись запаса повторений для строки цели. */
export function rirCaption(week: number, def: ExerciseDef, mode: Mode): string {
  if (mode === 'light') return 'запас 3–4'
  const base = week <= 2 ? 'запас 4–5' : week <= 6 ? 'запас 3' : 'запас 2'
  return def.id === 'squat' || def.id === 'rdl' ? `${base}, не до отказа` : base
}

export interface ProgressionInput {
  def: ExerciseDef
  /** Тренировки этого упражнения, новые сверху. */
  history: ExerciseHistoryItem[]
  mode: Mode
  /** Этап освоения: первые 4 тренировки. */
  early: boolean
  /** Шаги прибавки из настроек. */
  steps?: Record<string, number>
  /** Подпись запаса повторений. */
  rir?: string
}

export interface ProgressionPlan {
  /** Вес, который подставляется в поле. */
  weight: number | string
  /** Цели повторений по подходам. */
  reps: number[]
  tone: 'first' | 'up' | 'down' | 'same'
  /** Короткая рекомендация одной строкой. */
  text: string
  /** Строка цели: «Цель: 40 кг × 11 · 10 · 9 — запас 3». */
  target: string
}

/** Шаг в виде текста: 2,5 кг. */
export function fmtStep(step: number): string {
  return fmtKg(step)
}

/** Подпись прибавки: у гантелей — «следующие по весу гантели», у остальных — «+2,5 кг». */
export function stepLabel(def: ExerciseDef, step: number): string {
  if (def.kind === 'band') return 'тоньше'
  if (def.kind === 'db') return 'следующие по весу гантели'
  return `+${fmtStep(step)} кг`
}

/** Строка цели для карточки упражнения. */
export function targetLine(weight: number | string, reps: number[], rir?: string): string {
  const w =
    typeof weight === 'number'
      ? weight === 0
        ? 'без веса'
        : `${fmtKg(weight)} кг`
      : weight
        ? String(weight)
        : 'подобрать вес'
  return `Цель: ${w} × ${reps.join(' · ')}${rir ? ` — ${rir}` : ''}`
}

function plan(
  weight: number | string,
  reps: number[],
  tone: ProgressionPlan['tone'],
  text: string,
  rir?: string,
): ProgressionPlan {
  return { weight, reps, tone, text, target: targetLine(weight, reps, rir) }
}

/**
 * План на сегодня по упражнению: вес и цели повторений.
 * Порядок правил: первый раз → облегчённый режим → этап освоения → обычный режим.
 */
export function planProgression(input: ProgressionInput): ProgressionPlan {
  const { def, mode, early, steps, rir } = input
  const history = input.history
  const last = history[0] ?? null
  const step = stepFor(def, steps)
  const rirText = rir ?? undefined

  // Первый раз
  if (!last) {
    const reps = Array.from({ length: def.sets }, () => def.lo)
    // Режим дня отмечается только в тексте рекомендации — без названий фаз.
    const prefix = mode === 'light' ? 'Облегчённый день: ' : ''
    const low = (s: string): string => (prefix ? prefix + s.charAt(0).toLowerCase() + s.slice(1) : s)
    if (def.kind === 'band') return plan('', reps, 'first', low('Подберите резинку на 5–8 повторений'), rirText)
    if (def.id === 'squat') return plan('', reps, 'first', low('Пустой гриф, запас 4–5'), rirText)
    if (def.kind === 'bw') return plan(0, reps, 'first', low('Без веса, плавно'), rirText)
    return plan('', reps, 'first', low('Лёгкий вес, запас 4–5'), rirText)
  }

  const lastW = maxWeight(last.sets)
  const band = last.sets[last.sets.length - 1]?.w ?? ''
  const top = allSetsAtTop(def, last.sets)

  // Облегчённый режим: без прибавки, цели повторений не повышаем
  if (mode === 'light') {
    if (def.kind === 'band') {
      return plan(band, keepReps(def, last.sets), 'down', 'Облегчённый день: та же или толще резинка, без отказа', rirText)
    }
    if (def.kind === 'bar') {
      const w = Math.max(0, Math.round((lastW * 0.9) / 2.5) * 2.5)
      return plan(w, keepReps(def, last.sets), 'down', 'Облегчённый день: −10%, запас 3–4', rirText)
    }
    return plan(lastW, keepReps(def, last.sets), 'down', 'Облегчённый день: тот же вес, запас 3–4', rirText)
  }

  // Этап освоения: первые 4 тренировки
  if (early) {
    const reps = repTargets(def, last.sets)
    if (def.kind === 'bar') {
      return plan(lastW + step, reps, 'up', `Освоение: ${stepLabel(def, step)}, если было легко`, rirText)
    }
    return plan(lastW, reps, 'same', 'Освоение: тот же вес, запас 4–5', rirText)
  }

  // Обычный режим
  if (top) {
    const lo = Array.from({ length: def.sets }, () => def.lo)
    if (def.kind === 'band') {
      if (mode === 'progress') {
        return plan(band, lo, 'up', `Все подходы на ${def.hi}+ — резинка тоньше, с ${def.lo}`, rirText)
      }
      return plan(band, repTargets(def, last.sets), 'same', 'Резинка тоньше, только если сегодня легко', rirText)
    }
    if (mode === 'progress') {
      return plan(lastW + step, lo, 'up', `Все подходы на ${def.hi}+ — ${stepLabel(def, step)}, с ${def.lo}`, rirText)
    }
    // hold: прибавку не подставляем
    const hint = def.kind === 'db' ? 'взять следующие по весу гантели' : stepLabel(def, step)
    return plan(lastW, repTargets(def, last.sets), 'same', `Можно ${hint}, если сегодня легко`, rirText)
  }

  const stagnation = detectStagnation(def, history, step)
  if (stagnation && def.kind === 'band') {
    // у резинки нет веса в кг: «снизить на 10%» = взять резинку толще
    return plan(
      band,
      Array.from({ length: def.sets }, () => def.lo),
      'down',
      'Два раза без прогресса — возьмите резинку толще и наберите заново',
      rirText,
    )
  }
  if (stagnation) {
    return plan(
      stagnation.weight,
      Array.from({ length: def.sets }, () => def.lo),
      'down',
      'Два раза без прогресса — снизьте вес на 10% и наберите заново',
      rirText,
    )
  }
  if (def.kind === 'band') {
    return plan(band, repTargets(def, last.sets), 'same', 'Та же резинка, добирайте повторения', rirText)
  }
  return plan(lastW, repTargets(def, last.sets), 'same', `Тот же вес, добирайте повторения до ${def.hi}`, rirText)
}

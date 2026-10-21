import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STEPS,
  allSetsAtTop,
  detectStagnation,
  exerciseHistory,
  planProgression,
  reduceTen,
  repTargets,
  rirCaption,
  stepFor,
  trainingWeek,
} from '../../src/domain/progression'
import type { ExerciseDef, Mode, Session, SetEntry } from '../../src/domain/types'
import { WORKOUTS } from '../../src/domain/workouts'

const squat = WORKOUTS.A.ex[0] // штанга, 3 × 6–8
const rdl = WORKOUTS.A.ex[3] // штанга, 3 × 8–10
const bench = WORKOUTS.A.ex[1] // гантели, 3 × 8–12
const pull = WORKOUTS.A.ex[2] // резинка, 3 × 5–8
const hip = WORKOUTS.B.ex[1] // штанга, 3 × 8–12
const hyper = WORKOUTS.B.ex[4] // доп. вес, 2 × 12–15

const sets = (n: number, w: number | string, r: number): SetEntry[] => Array.from({ length: n }, () => ({ w, r }))

const item = (mode: Mode, ws: Array<number | string>, rs: number[], ts = 1): { date: string; ts: number; mode: Mode; sets: SetEntry[] } => ({
  date: '2026-01-01',
  ts,
  mode,
  sets: ws.map((w, i) => ({ w, r: rs[i] })),
})

const plan = (
  def: ExerciseDef,
  history: ReturnType<typeof item>[],
  mode: Mode = 'progress',
  extra: { early?: boolean; steps?: Record<string, number>; rir?: string } = {},
) => planProgression({ def, history, mode, early: extra.early ?? false, steps: extra.steps, rir: extra.rir })

describe('история упражнения', () => {
  it('собирается из тренировок того же типа, новые сверху', () => {
    const sessions: Session[] = [
      { id: 's1', date: '2026-01-01', ts: 100, type: 'A', cycleDay: 1, phase: 'men', mode: 'hold', feel: 'ok', note: '', ex: { squat: [{ w: 30, r: 8 }] } },
      { id: 's2', date: '2026-01-03', ts: 300, type: 'A', cycleDay: 3, phase: 'men', mode: 'hold', feel: 'ok', note: '', ex: { squat: [{ w: 35, r: 8 }] } },
      { id: 's3', date: '2026-01-04', ts: 400, type: 'B', cycleDay: 4, phase: 'men', mode: 'hold', feel: 'ok', note: '', ex: { squat: [{ w: 40, r: 8 }] } },
    ]
    const h = exerciseHistory(sessions, 'A', 'squat')
    expect(h).toHaveLength(2)
    expect(h[0].sets[0].w).toBe(35)
    expect(exerciseHistory(sessions, 'A', 'bench')).toHaveLength(0)
  })
})

describe('цели повторений (п. 3.1)', () => {
  it('не хватает подхода — берём нижнюю границу', () => {
    expect(repTargets(bench, [{ w: 20, r: 10 }, { w: 20, r: 9 }])).toEqual([11, 10, 8])
  })

  it('пример 3×8–12, прошлый раз 10, 9, 8 → 11, 10, 9', () => {
    expect(repTargets(bench, [{ w: 20, r: 10 }, { w: 20, r: 9 }, { w: 20, r: 8 }])).toEqual([11, 10, 9])
  })

  it('повторения не выше верхней границы', () => {
    expect(repTargets(bench, [{ w: 20, r: 12 }, { w: 20, r: 12 }, { w: 20, r: 12 }])).toEqual([12, 12, 12])
  })

  it('вес рабочий — максимальный из прошлых', () => {
    const p = plan(squat, [item('progress', [40, 42.5, 40], [7, 7, 7])])
    expect(p.weight).toBe(42.5)
  })
})

describe('верхняя граница (п. 3.1)', () => {
  it('все подходы на hi и один вес', () => {
    expect(allSetsAtTop(squat, sets(3, 40, 8))).toBe(true)
  })

  it('пирамида: рабочий вес — максимальный, прибавка от него', () => {
    // 30 / 32,5 / 32,5 — все подходы с рабочим весом на верхней границе
    expect(allSetsAtTop(squat, [{ w: 30, r: 8 }, { w: 32.5, r: 8 }, { w: 32.5, r: 8 }])).toBe(true)
    const p = plan(squat, [item('progress', [30, 32.5, 32.5], [8, 8, 8])])
    expect(p.weight).toBe(35)
    expect(p.tone).toBe('up')
  })

  it('пирамида вниз: подход с рабочим весом не на hi — прибавки нет', () => {
    expect(allSetsAtTop(squat, [{ w: 32.5, r: 8 }, { w: 32.5, r: 7 }, { w: 30, r: 8 }])).toBe(false)
    const p = plan(squat, [item('progress', [32.5, 32.5, 30], [8, 7, 8])])
    expect(p.weight).toBe(32.5)
    expect(p.tone).toBe('same')
  })

  it('подходы легче рабочего веса в проверку не входят', () => {
    expect(allSetsAtTop(squat, [{ w: 40, r: 8 }, { w: 42.5, r: 8 }, { w: 40, r: 8 }])).toBe(true)
  })

  it('не все подходы на hi', () => {
    expect(allSetsAtTop(squat, [{ w: 40, r: 8 }, { w: 40, r: 7 }, { w: 40, r: 8 }])).toBe(false)
  })

  it('неполный набор подходов — не верхняя граница', () => {
    expect(allSetsAtTop(squat, sets(2, 40, 8))).toBe(false)
  })
})

describe('прибавка веса', () => {
  it('все подходы на верхней границе — прибавляем шаг, цели с lo', () => {
    const p = plan(squat, [item('progress', [40, 40, 40], [8, 8, 8])])
    expect(p.weight).toBe(42.5)
    expect(p.reps).toEqual([6, 6, 6])
    expect(p.tone).toBe('up')
  })

  it('иначе — вес тот же, повторения +1', () => {
    const p = plan(squat, [item('progress', [40, 40, 40], [7, 6, 7])])
    expect(p.weight).toBe(40)
    expect(p.reps).toEqual([8, 7, 8])
    expect(p.tone).toBe('same')
  })

  it('шаг берётся из настроек', () => {
    const p = plan(squat, [item('progress', [40, 40, 40], [8, 8, 8])], 'progress', { steps: { squat: 5 } })
    expect(p.weight).toBe(45)
  })

  it('шаг по умолчанию: штанга 2,5, мост 5, гантели 1, гиперэкстензия 2,5', () => {
    expect(stepFor(squat)).toBe(2.5)
    expect(stepFor(rdl)).toBe(2.5)
    expect(stepFor(hip)).toBe(5)
    expect(stepFor(bench)).toBe(1)
    expect(stepFor(hyper)).toBe(2.5)
    expect(DEFAULT_STEPS.squat).toBe(2.5)
    expect(DEFAULT_STEPS.hip).toBe(5)
  })

  it('шаг из настроек важнее умолчания', () => {
    expect(stepFor(bench, { bench: 2 })).toBe(2)
  })

  it('гантели — подпись «следующие по весу гантели»', () => {
    const p = plan(bench, [item('progress', [20, 20, 20], [12, 12, 12])])
    expect(p.weight).toBe(21)
    expect(p.text).toContain('следующие по весу гантели')
  })

  it('гантели в режиме поддержки — «Можно взять следующие по весу гантели…»', () => {
    const p = plan(bench, [item('hold', [20, 20, 20], [12, 12, 12])], 'hold')
    expect(p.weight).toBe(20)
    expect(p.text).toContain('Можно взять следующие по весу гантели')
  })
})

describe('режимы (п. 3.4)', () => {
  it('progress — прибавка', () => {
    expect(plan(squat, [item('progress', [40, 40, 40], [8, 8, 8])], 'progress').weight).toBe(42.5)
  })

  it('hold — вес прежний, в тексте «Можно +…»', () => {
    const p = plan(squat, [item('hold', [40, 40, 40], [8, 8, 8])], 'hold')
    expect(p.weight).toBe(40)
    expect(p.text).toContain('Можно +')
  })

  it('progress — без пометок о режиме', () => {
    const p = plan(squat, [item('progress', [40, 40, 40], [8, 8, 8])], 'progress')
    expect(p.text).not.toMatch(/Облегчённый день|Можно/)
    const p2 = plan(squat, [item('progress', [40, 40, 40], [7, 6, 7])], 'progress')
    expect(p2.text).not.toMatch(/Облегчённый день|Можно/)
  })

  it('light — штанга −10% с округлением к 2,5', () => {
    const p = plan(squat, [item('light', [40, 40, 40], [8, 8, 8])], 'light')
    expect(p.weight).toBe(35)
    expect(p.tone).toBe('down')
    expect(p.text).toBe('Облегчённый день: −10%, запас 3–4')
  })

  it('light — гантели и доп. вес: тот же вес', () => {
    expect(plan(bench, [item('light', [20, 20, 20], [10, 10, 10])], 'light').weight).toBe(20)
    expect(plan(hyper, [item('light', [10, 10], [13, 13])], 'light').weight).toBe(10)
    expect(plan(bench, [item('light', [20, 20, 20], [10, 10, 10])], 'light').text).toContain('Облегчённый день')
  })

  it('light — резинка: та же или толще', () => {
    const p = plan(pull, [item('light', ['жёлтая', 'жёлтая', 'жёлтая'], [6, 6, 6])], 'light')
    expect(p.text).toContain('Облегчённый день')
  })

  it('light — цели повторений не повышаются', () => {
    const p = plan(squat, [item('light', [40, 40, 40], [7, 6, 8])], 'light')
    expect(p.reps).toEqual([7, 6, 8])
  })
})

describe('застой (п. 3.3)', () => {
  it('два раза без роста повторений — вес −10% и начать заново', () => {
    const h = [item('progress', [40, 40, 40], [7, 7, 7], 2), item('progress', [40, 40, 40], [8, 8, 8], 1)]
    const p = plan(squat, h)
    expect(p.weight).toBe(35)
    expect(p.text).toBe('Два раза без прогресса — снизьте вес на 10% и наберите заново')
    expect(p.reps).toEqual([6, 6, 6])
  })

  it('резинка: застой — резинка толще, а не «0 кг»', () => {
    const h = [item('progress', ['красная', 'красная', 'красная'], [6, 6, 5], 2), item('progress', ['красная', 'красная', 'красная'], [6, 6, 6], 1)]
    const p = plan(pull, h)
    expect(p.weight).toBe('красная')
    expect(p.text).toBe('Два раза без прогресса — возьмите резинку толще и наберите заново')
    expect(p.reps).toEqual([5, 5, 5])
  })

  it('сумма повторений выросла — застоя нет', () => {
    const h = [item('progress', [40, 40, 40], [7, 7, 7], 2), item('progress', [40, 40, 40], [6, 6, 6], 1)]
    expect(plan(squat, h).weight).toBe(40)
  })

  it('вес менялся — застоя нет', () => {
    const h = [item('progress', [42.5, 42.5, 42.5], [7, 7, 7], 2), item('progress', [40, 40, 40], [8, 8, 8], 1)]
    expect(plan(squat, h).weight).toBe(42.5)
  })

  it('облегчённые тренировки в анализ не берутся', () => {
    const h = [item('light', [40, 40, 40], [7, 7, 7], 2), item('progress', [40, 40, 40], [8, 8, 8], 1)]
    // осталась одна не-облегчённая тренировка — застоя нет
    expect(plan(squat, h, 'progress').weight).toBe(40)
    expect(detectStagnation(squat, h, 2.5)).toBeNull()
  })

  it('снижение округляется к шагу', () => {
    expect(reduceTen(50, squat, 2.5)).toBe(45)
    expect(reduceTen(50, bench, 1)).toBe(45)
  })

  it('одна тренировка — застоя нет', () => {
    expect(detectStagnation(squat, [item('progress', [40, 40, 40], [8, 8, 8])], 2.5)).toBeNull()
  })
})

describe('этап освоения (п. 3.5)', () => {
  it('штанга — можно прибавить шаг', () => {
    const p = plan(squat, [item('progress', [40, 40, 40], [6, 6, 6])], 'progress', { early: true })
    expect(p.weight).toBe(42.5)
    expect(p.text).toContain('Освоение')
  })

  it('гантели — вес тот же', () => {
    const p = plan(bench, [item('progress', [20, 20, 20], [10, 10, 10])], 'progress', { early: true })
    expect(p.weight).toBe(20)
  })
})

describe('резинка (п. 3.7)', () => {
  it('все подходы на hi — резинка тоньше, начните с lo', () => {
    const p = plan(pull, [item('progress', ['жёлтая', 'жёлтая', 'жёлтая'], [8, 8, 8])])
    expect(p.weight).toBe('жёлтая')
    expect(p.reps).toEqual([5, 5, 5])
    expect(p.text).toContain('резинка тоньше')
  })

  it('иначе — та же резинка, цели по подходам', () => {
    const p = plan(pull, [item('progress', ['жёлтая', 'жёлтая', 'жёлтая'], [6, 5, 7])])
    expect(p.weight).toBe('жёлтая')
    expect(p.reps).toEqual([7, 6, 8])
  })
})

describe('запас повторений (п. 3.6)', () => {
  it('неделя считается от первой сохранённой тренировки', () => {
    expect(trainingWeek('2026-01-01', '2026-01-01')).toBe(1)
    expect(trainingWeek('2026-01-01', '2026-01-07')).toBe(1) // дни 0–6 — неделя 1
    expect(trainingWeek('2026-01-01', '2026-01-08')).toBe(2) // дни 7–13 — неделя 2
    expect(trainingWeek('2026-01-01', '2026-01-14')).toBe(2)
    expect(trainingWeek('2026-01-01', '2026-01-15')).toBe(3) // дни 14–20 — неделя 3
    expect(trainingWeek('2026-01-01', '2026-02-12')).toBe(7)
  })

  it('без первой тренировки — первая неделя', () => {
    expect(trainingWeek(null, '2026-01-01')).toBe(1)
  })

  it('подписи по неделям', () => {
    expect(rirCaption(1, bench, 'progress')).toBe('запас 4–5')
    expect(rirCaption(2, bench, 'progress')).toBe('запас 4–5')
    expect(rirCaption(3, bench, 'progress')).toBe('запас 3')
    expect(rirCaption(6, bench, 'progress')).toBe('запас 3')
    expect(rirCaption(7, bench, 'progress')).toBe('запас 2')
    expect(rirCaption(9, bench, 'progress')).toBe('запас 2')
  })

  it('присед и румынская тяга — не до отказа', () => {
    expect(rirCaption(1, squat, 'progress')).toBe('запас 4–5, не до отказа')
    expect(rirCaption(7, rdl, 'progress')).toBe('запас 2, не до отказа')
  })

  it('облегчённый режим — запас 3–4', () => {
    expect(rirCaption(1, squat, 'light')).toBe('запас 3–4')
  })

  it('подпись попадает в строку цели', () => {
    const p = plan(bench, [item('progress', [20, 20, 20], [10, 9, 8])], 'progress', { rir: 'запас 3' })
    expect(p.target).toBe('Цель: 20 кг × 11 · 10 · 9 — запас 3')
  })
})

describe('первый раз', () => {
  it('подбираем вес, цели — с нижней границы', () => {
    const p = plan(squat, [])
    expect(p.weight).toBe('')
    expect(p.reps).toEqual([6, 6, 6])
    expect(p.tone).toBe('first')
  })

  it('собственный вес — без отягощения', () => {
    expect(plan(hyper, []).weight).toBe(0)
  })
})

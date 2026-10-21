import { describe, expect, it } from 'vitest'
import { lastFor, nextType, rec } from '../../src/domain/rec'
import type { ExerciseDef, Session, SetEntry } from '../../src/domain/types'
import { WORKOUTS } from '../../src/domain/workouts'

const squat = WORKOUTS.A.ex[0] // штанга, 3 × 6–8
const bench = WORKOUTS.A.ex[1] // гантели, 3 × 8–12
const pull = WORKOUTS.A.ex[2] // резинка, 3 × 5–8
const rdl = WORKOUTS.A.ex[3] // штанга, 3 × 8–10
const hip = WORKOUTS.B.ex[1] // штанга, 3 × 8–12
const hyper = WORKOUTS.B.ex[4] // доп. вес, 2 × 12–15

const sets = (n: number, w: number | string, r: number): SetEntry[] => Array.from({ length: n }, () => ({ w, r }))

describe('rec(): первый раз', () => {
  it('резинка — подобрать', () => {
    expect(rec(pull, null, 'progress', false)).toEqual({
      w: '',
      tone: 'first',
      text: 'Первый раз: подберите резинку, с которой получается 5–8 чистых повторений.',
    })
  })

  it('присед — пустой гриф', () => {
    expect(rec(squat, null, 'progress', false)).toEqual({
      w: '',
      tone: 'first',
      text: 'Первый раз: пустой гриф, запас 4–5 повторов. Задача — техника.',
    })
  })

  it('собственный вес — без отягощения', () => {
    expect(rec(hyper, null, 'progress', false)).toEqual({
      w: 0,
      tone: 'first',
      text: 'Первый раз: без веса, плавно, без переразгибания в пояснице.',
    })
  })

  it('гантели — лёгкий вес', () => {
    expect(rec(bench, null, 'progress', false)).toEqual({
      w: '',
      tone: 'first',
      text: 'Первый раз: лёгкий вес с запасом 4–5 повторов.',
    })
  })
})

describe('rec(): облегчённый режим', () => {
  it('штанга: −10% с округлением к 2,5', () => {
    expect(rec(squat, { date: '2026-01-01', sets: sets(3, 40, 8) }, 'light', false)).toEqual({
      w: 35,
      tone: 'down',
      text: 'Облегчённо: около 35 кг (−10%), запас 3–4 повтора. Можно на 1 подход меньше.',
    })
  })

  it('штанга: округление вниз до 2,5 кг', () => {
    expect(rec(squat, { date: '2026-01-01', sets: sets(3, 50, 8) }, 'light', false).w).toBe(45)
  })

  it('гантели: вес прошлого раза или легче', () => {
    expect(rec(bench, { date: '2026-01-01', sets: sets(3, 20, 10) }, 'light', false)).toEqual({
      w: 20,
      tone: 'down',
      text: 'Вес прошлого раза или легче, запас 3–4 повтора.',
    })
  })

  it('собственный вес: вес прошлого раза или легче', () => {
    expect(rec(hyper, { date: '2026-01-01', sets: sets(2, 10, 13) }, 'light', false)).toEqual({
      w: 10,
      tone: 'down',
      text: 'Вес прошлого раза или легче, запас 3–4 повтора.',
    })
  })

  it('резинка: та же или толще', () => {
    expect(rec(pull, { date: '2026-01-01', sets: sets(3, 'жёлтая', 6) }, 'light', false)).toEqual({
      w: 'жёлтая',
      tone: 'down',
      text: 'Та же или более толстая резинка, без отказа.',
    })
  })

  it('облегчённый режим важнее этапа освоения', () => {
    const r = rec(squat, { date: '2026-01-01', sets: sets(3, 40, 8) }, 'light', true)
    expect(r.w).toBe(35)
  })
})

describe('rec(): этап освоения (первые 4 тренировки)', () => {
  it('штанга: +2,5 кг', () => {
    expect(rec(squat, { date: '2026-01-01', sets: sets(3, 40, 6) }, 'hold', true)).toEqual({
      w: 42.5,
      tone: 'up',
      text: 'Этап освоения: если в прошлый раз было легко и чисто — +2,5–5 кг. Запас 4–5 повторов.',
    })
  })

  it('гантели: тот же вес, техника важнее', () => {
    expect(rec(bench, { date: '2026-01-01', sets: sets(3, 20, 10) }, 'hold', true)).toEqual({
      w: 20,
      tone: 'same',
      text: 'Этап освоения: запас 4–5 повторов, техника важнее веса.',
    })
  })
})

describe('rec(): верхняя граница', () => {
  it('штанга в окне прогресса: +2,5 кг', () => {
    expect(rec(squat, { date: '2026-01-01', sets: sets(3, 40, 8) }, 'progress', false)).toEqual({
      w: 42.5,
      tone: 'up',
      text: 'Все подходы на верхней границе — +2,5 кг, начинайте с 6 повторов.',
    })
  })

  it('гантели в окне прогресса: следующие по весу, вес тот же', () => {
    expect(rec(bench, { date: '2026-01-01', sets: sets(3, 20, 12) }, 'progress', false)).toEqual({
      w: 20,
      tone: 'up',
      text: 'Все подходы на верхней границе — берите следующие по весу гантели, начинайте с 8 повторов.',
    })
  })

  it('вне окна прогресса: вес тот же', () => {
    expect(rec(rdl, { date: '2026-01-01', sets: sets(3, 60, 10) }, 'hold', false)).toEqual({
      w: 60,
      tone: 'same',
      text: 'Верхняя граница взята. +2,5 кг — только если сегодня легко.',
    })
  })

  it('мост: шаг +2,5–5 кг', () => {
    expect(rec(hip, { date: '2026-01-01', sets: sets(3, 50, 12) }, 'hold', false).text).toBe(
      'Верхняя граница взята. +2,5–5 кг — только если сегодня легко.',
    )
  })

  it('резинка в окне прогресса: тоньше', () => {
    expect(rec(pull, { date: '2026-01-01', sets: sets(3, 'жёлтая', 8) }, 'progress', false)).toEqual({
      w: 'жёлтая',
      tone: 'up',
      text: 'Все подходы на 8+ — возьмите резинку тоньше и начните с 5 повторов.',
    })
  })

  it('резинка вне окна прогресса: тоньше только если легко', () => {
    expect(rec(pull, { date: '2026-01-01', sets: sets(3, 'жёлтая', 8) }, 'hold', false).text).toBe(
      'Верхняя граница взята. Резинку тоньше — только если сегодня легко.',
    )
  })

  it('резинка: та же резинка, добирать повторения', () => {
    expect(rec(pull, { date: '2026-01-01', sets: sets(3, 'жёлтая', 6) }, 'progress', false)).toEqual({
      w: 'жёлтая',
      tone: 'same',
      text: 'Та же резинка, добирайте повторения до 8.',
    })
  })
})

describe('rec(): обычный случай', () => {
  it('тот же вес, добирать повторения', () => {
    expect(rec(squat, { date: '2026-01-01', sets: sets(3, 40, 7) }, 'progress', false)).toEqual({
      w: 40,
      tone: 'same',
      text: 'Тот же вес, добирайте повторения до 8 во всех подходах.',
    })
  })

  it('берётся максимальный вес из подходов', () => {
    const last = { date: '2026-01-01', sets: [{ w: 40, r: 8 }, { w: 42.5, r: 7 }, { w: 40, r: 8 }] }
    expect(rec(squat, last, 'hold', false).w).toBe(42.5)
  })

  it('неполный набор подходов не считается верхней границей', () => {
    const last = { date: '2026-01-01', sets: sets(2, 40, 8) }
    expect(rec(squat, last, 'progress', false).tone).toBe('same')
  })
})

describe('очередь тренировок', () => {
  const session = (id: string, type: 'A' | 'B', ts: number): Session => ({
    id,
    date: '2026-01-01',
    ts,
    type,
    cycleDay: 1,
    phase: 'men',
    mode: 'hold',
    feel: 'ok',
    note: '',
    ex: {},
  })

  it('первая тренировка — А', () => {
    expect(nextType([])).toBe('A')
  })

  it('следующая — противоположная последней', () => {
    expect(nextType([session('s1', 'A', 100)])).toBe('B')
    expect(nextType([session('s1', 'B', 100)])).toBe('A')
  })

  it('считается самая свежая запись', () => {
    const list = [session('s1', 'A', 100), session('s2', 'B', 200), session('s3', 'A', 150)]
    // свежайшая — s2 (тип B), значит следующая по очереди — A
    expect(nextType(list)).toBe('A')
  })

  it('последние подходы берутся из последней тренировки этого типа', () => {
    const s1: Session = { ...session('s1', 'A', 100), ex: { squat: [{ w: 30, r: 8 }] } }
    const s2: Session = { ...session('s2', 'A', 200), ex: { squat: [{ w: 40, r: 8 }] } }
    expect(lastFor([s1, s2], 'A', 'squat')).toEqual({ date: '2026-01-01', sets: [{ w: 40, r: 8 }] })
    expect(lastFor([s1, s2], 'B', 'squat')).toBeNull()
  })
})

describe('описания упражнений', () => {
  it('соответствуют эталону', () => {
    const ex: ExerciseDef[] = [...WORKOUTS.A.ex, ...WORKOUTS.B.ex]
    expect(ex.find((e) => e.id === 'squat' && e.kind === 'bar')).toMatchObject({ sets: 3, lo: 6, hi: 8, rest: 'отдых 2,5–3 мин' })
    expect(ex.find((e) => e.id === 'hyper')).toMatchObject({ sets: 2, lo: 12, hi: 15, kind: 'bw' })
    expect(ex.find((e) => e.id === 'ohp')).toMatchObject({ sets: 2, lo: 10, hi: 12, kind: 'db' })
  })
})

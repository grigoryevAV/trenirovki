import { describe, expect, it } from 'vitest'
import { planProgression } from '../../src/domain/progression'
import { lastFor, lastLine, nextType, rec, sortedDesc } from '../../src/domain/rec'
import type { ExerciseDef, Session } from '../../src/domain/types'
import { WORKOUTS } from '../../src/domain/workouts'

const squat = WORKOUTS.A.ex[0]

const session = (id: string, type: 'A' | 'B', ts: number, over: Partial<Session> = {}): Session => ({
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
  ...over,
})

describe('rec()', () => {
  it('отдаёт план прогрессии', () => {
    const history = [{ date: '2026-01-01', ts: 1, mode: 'progress' as const, sets: [{ w: 40, r: 8 }, { w: 40, r: 8 }, { w: 40, r: 8 }] }]
    const r = rec({ def: squat, history, mode: 'progress', early: false })
    expect(r).toEqual(planProgression({ def: squat, history, mode: 'progress', early: false }))
    expect(r.weight).toBe(42.5)
    expect(r.reps).toEqual([6, 6, 6])
  })

  it('учитывает шаги из настроек и подпись запаса', () => {
    const history = [{ date: '2026-01-01', ts: 1, mode: 'progress' as const, sets: [{ w: 40, r: 8 }, { w: 40, r: 8 }, { w: 40, r: 8 }] }]
    const r = rec({ def: squat, history, mode: 'progress', early: false, steps: { squat: 5 }, rir: 'запас 4–5, не до отказа' })
    expect(r.weight).toBe(45)
    expect(r.target).toBe('Цель: 45 кг × 6 · 6 · 6 — запас 4–5, не до отказа')
  })
})

describe('очередь тренировок', () => {
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

  it('сортировка — новые сверху', () => {
    const list = [session('s1', 'A', 100), session('s2', 'A', 300), session('s3', 'A', 200)]
    expect(sortedDesc(list).map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })
})

describe('описания упражнений', () => {
  it('соответствуют эталону', () => {
    const ex: ExerciseDef[] = [...WORKOUTS.A.ex, ...WORKOUTS.B.ex]
    expect(ex.find((e) => e.id === 'squat' && e.kind === 'bar')).toMatchObject({ sets: 3, lo: 6, hi: 8, rest: 'отдых 2,5–3 мин' })
    expect(ex.find((e) => e.id === 'hyper')).toMatchObject({ sets: 2, lo: 12, hi: 15, kind: 'bw' })
    expect(ex.find((e) => e.id === 'ohp')).toMatchObject({ sets: 2, lo: 10, hi: 12, kind: 'db' })
  })

  it('строка «Прошлый раз»', () => {
    const last = { date: '2026-01-21', sets: [{ w: 40, r: 8 }, { w: 40, r: 7 }] }
    expect(lastLine(squat, last)).toBe('Прошлый раз, 21.01: 40×8 · 40×7')
  })
})

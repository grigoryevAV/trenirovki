import { describe, expect, it } from 'vitest'
import { mergeDraft } from '../../src/domain/draft'
import type { Draft } from '../../src/domain/types'

const date = '2026-01-05'

describe('слияние черновика (К2)', () => {
  it('если в этой сессии ничего не меняли — берётся загруженный черновик', () => {
    const current: Draft = { date, feel: 'ok' }
    const loaded: Draft = { date, feel: 'bad', A: { ex: { squat: [{ w: '35', r: '7' }] }, note: 'из базы' } }
    expect(mergeDraft(current, loaded, new Set())).toEqual(loaded)
  })

  it('введённые повторения не перетираются загруженным черновиком', () => {
    const current: Draft = { date, feel: 'ok', A: { ex: { squat: [{ r: '9' }] }, note: '' } }
    const loaded: Draft = { date, feel: 'ok', A: { ex: { squat: [{ w: '35', r: '7' }] }, note: 'из базы' } }
    const merged = mergeDraft(current, loaded, new Set(['set:A:squat:0:r']))
    // введённые повторения на месте, вес взят из загруженного черновика
    expect(merged.A?.ex.squat?.[0]).toEqual({ w: '35', r: '9' })
    // заметка из черновика сохранилась
    expect(merged.A?.note).toBe('из базы')
  })

  it('изменённое самочувствие не перетирается', () => {
    const current: Draft = { date, feel: 'bad' }
    const loaded: Draft = { date, feel: 'ok', A: { ex: { squat: [{ w: '35', r: '7' }] }, note: '' } }
    const merged = mergeDraft(current, loaded, new Set(['feel']))
    expect(merged.feel).toBe('bad')
    expect(merged.A?.ex.squat?.[0]).toEqual({ w: '35', r: '7' })
  })

  it('очищенная пользователем заметка не возвращается', () => {
    const current: Draft = { date, feel: 'ok', A: { ex: {}, note: '' } }
    const loaded: Draft = { date, feel: 'ok', A: { ex: {}, note: 'из базы' } }
    const merged = mergeDraft(current, loaded, new Set(['note:A']))
    expect(merged.A?.note).toBe('')
  })

  it('незатронутая тренировка берётся из загруженного черновика', () => {
    const current: Draft = { date, feel: 'ok', A: { ex: { squat: [{ r: '9' }] }, note: '' } }
    const loaded: Draft = { date, feel: 'ok', A: { ex: { squat: [{ w: '35', r: '7' }] }, note: '' }, B: { ex: { hip: [{ w: '50', r: '9' }] }, note: 'B' } }
    const merged = mergeDraft(current, loaded, new Set(['set:A:squat:0:r']))
    expect(merged.B).toEqual(loaded.B)
  })
})

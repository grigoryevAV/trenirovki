import { describe, expect, it } from 'vitest'
import {
  CYCLE_LEN_MAX,
  CYCLE_LEN_MIN,
  ERR_FUTURE_START,
  ERR_NO_START,
  PERIOD_LEN_MAX,
  PERIOD_LEN_MIN,
  averageCycleLen,
  cycleInfo,
  modeFor,
  normConfig,
  phaseForDay,
  phaseRanges,
} from '../../src/domain/cycle'
import { addDays } from '../../src/domain/format'
import type { CycleConfig } from '../../src/domain/types'

const cfg = (over: Partial<CycleConfig> = {}): CycleConfig => ({
  periodStarts: ['2026-01-01'],
  cycleLen: 28,
  periodLen: 5,
  ...over,
})

describe('фазы по дню цикла (L=28, P=5)', () => {
  it('границы фаз', () => {
    expect(phaseForDay(1, 28, 5)).toBe('men')
    expect(phaseForDay(5, 28, 5)).toBe('men')
    expect(phaseForDay(6, 28, 5)).toBe('fol')
    expect(phaseForDay(12, 28, 5)).toBe('fol')
    expect(phaseForDay(13, 28, 5)).toBe('ovu')
    expect(phaseForDay(15, 28, 5)).toBe('ovu')
    expect(phaseForDay(16, 28, 5)).toBe('lut')
    expect(phaseForDay(23, 28, 5)).toBe('lut')
    expect(phaseForDay(24, 28, 5)).toBe('pms')
    expect(phaseForDay(28, 28, 5)).toBe('pms')
    expect(phaseForDay(29, 28, 5)).toBe('late')
  })

  it('режимы по фазам', () => {
    expect(modeFor('men', 1)).toBe('light')
    expect(modeFor('men', 2)).toBe('light')
    expect(modeFor('men', 3)).toBe('hold')
    expect(modeFor('fol', 6)).toBe('progress')
    expect(modeFor('ovu', 14)).toBe('progress')
    expect(modeFor('lut', 20)).toBe('hold')
    expect(modeFor('pms', 24)).toBe('light')
    expect(modeFor('late', 30)).toBe('hold')
  })
})

describe('фазы по дню цикла (L=24, P=5)', () => {
  it('границы фаз', () => {
    expect(phaseForDay(5, 24, 5)).toBe('men')
    expect(phaseForDay(6, 24, 5)).toBe('fol')
    expect(phaseForDay(8, 24, 5)).toBe('fol')
    expect(phaseForDay(9, 24, 5)).toBe('ovu')
    expect(phaseForDay(11, 24, 5)).toBe('ovu')
    expect(phaseForDay(12, 24, 5)).toBe('lut')
    expect(phaseForDay(19, 24, 5)).toBe('lut')
    expect(phaseForDay(20, 24, 5)).toBe('pms')
    expect(phaseForDay(24, 24, 5)).toBe('pms')
  })
})

describe('фазы по дню цикла (L=35, P=5)', () => {
  it('границы фаз', () => {
    expect(phaseForDay(5, 35, 5)).toBe('men')
    expect(phaseForDay(6, 35, 5)).toBe('fol')
    expect(phaseForDay(19, 35, 5)).toBe('fol')
    expect(phaseForDay(20, 35, 5)).toBe('ovu')
    expect(phaseForDay(22, 35, 5)).toBe('ovu')
    expect(phaseForDay(23, 35, 5)).toBe('lut')
    expect(phaseForDay(30, 35, 5)).toBe('lut')
    expect(phaseForDay(31, 35, 5)).toBe('pms')
    expect(phaseForDay(35, 35, 5)).toBe('pms')
  })
})

describe('диапазоны фаз', () => {
  it('сжимает фазы в интервалы', () => {
    expect(phaseRanges(28, 5)).toEqual([
      { phase: 'men', from: 1, to: 5 },
      { phase: 'fol', from: 6, to: 12 },
      { phase: 'ovu', from: 13, to: 15 },
      { phase: 'lut', from: 16, to: 23 },
      { phase: 'pms', from: 24, to: 28 },
    ])
  })

  it('для короткого цикла', () => {
    const r = phaseRanges(24, 5)
    expect(r[0]).toEqual({ phase: 'men', from: 1, to: 5 })
    expect(r[r.length - 1]).toEqual({ phase: 'pms', from: 20, to: 24 })
  })
})

describe('расчёт дня цикла', () => {
  it('первый день цикла', () => {
    const ci = cycleInfo(cfg(), '2026-01-01')
    expect(ci.ok).toBe(true)
    if (!ci.ok) return
    expect(ci.day).toBe(1)
    expect(ci.phase).toBe('men')
    expect(ci.mode).toBe('light')
    expect(ci.predicted).toBe(false)
    expect(ci.cycleStart).toBe('2026-01-01')
    expect(ci.nextStart).toBe('2026-01-29')
  })

  it('день 8 — фолликулярная фаза, режим прогресса', () => {
    const ci = cycleInfo(cfg(), '2026-01-08')
    expect(ci.ok).toBe(true)
    if (!ci.ok) return
    expect(ci.day).toBe(8)
    expect(ci.phase).toBe('fol')
    expect(ci.mode).toBe('progress')
  })

  it('нет отмеченных начал — просьба указать дату', () => {
    const ci = cycleInfo(cfg({ periodStarts: [] }), '2026-01-01')
    expect(ci.ok).toBe(false)
    if (ci.ok) return
    expect(ci.error).toBe(ERR_NO_START)
  })

  it('дата начала в будущем — понятная ошибка', () => {
    const ci = cycleInfo(cfg(), '2025-12-25')
    expect(ci.ok).toBe(false)
    if (ci.ok) return
    expect(ci.error).toBe(ERR_FUTURE_START)
  })

  it('через L+7 дней включается прогноз', () => {
    // 2026-03-01 — 59 дней от 2026-01-01, при L=28 это два полных цикла: прогноз.
    const ci = cycleInfo(cfg(), '2026-03-01')
    expect(ci.ok).toBe(true)
    if (!ci.ok) return
    expect(ci.predicted).toBe(true)
    expect(ci.cycleStart).toBe('2026-02-26')
    expect(ci.day).toBe(4)
    expect(ci.nextStart).toBe(addDays('2026-02-26', 28))
  })

  it('до L+7 дней прогноза нет', () => {
    const ci = cycleInfo(cfg(), addDays('2026-01-01', 34))
    expect(ci.ok).toBe(true)
    if (!ci.ok) return
    expect(ci.predicted).toBe(false)
    expect(ci.day).toBe(35)
    expect(ci.phase).toBe('late')
  })
})

describe('настройки цикла', () => {
  it('длина цикла ограничена 20–45, менструация 2–9', () => {
    expect(normConfig({ cycleLen: 10, periodLen: 1, periodStarts: [] }).cycleLen).toBe(CYCLE_LEN_MIN)
    expect(normConfig({ cycleLen: 90, periodLen: 20, periodStarts: [] }).cycleLen).toBe(CYCLE_LEN_MAX)
    expect(normConfig({ cycleLen: 28, periodLen: 1, periodStarts: [] }).periodLen).toBe(PERIOD_LEN_MIN)
    expect(normConfig({ cycleLen: 28, periodLen: 30, periodStarts: [] }).periodLen).toBe(PERIOD_LEN_MAX)
  })

  it('дата начала не зашита: без отметок список пуст', () => {
    expect(normConfig({ periodStarts: [] }).periodStarts).toEqual([])
    expect(normConfig(null).periodStarts).toEqual([])
  })

  it('кривые даты отбрасываются, дубли убираются', () => {
    const c = normConfig({ periodStarts: ['2026-02-01', '2026-01-01', '2026-01-01', 'не дата'], cycleLen: 28, periodLen: 5 })
    expect(c.periodStarts).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('средняя длина — по последним трём интервалам 18–45 дней', () => {
    expect(averageCycleLen(['2026-01-01', '2026-01-30', '2026-03-01', '2026-03-29'])).toBe(29)
    // интервал 60 дней не учитывается
    expect(averageCycleLen(['2026-01-01', '2026-03-02'])).toBeNull()
    // берутся только последние три интервала
    expect(averageCycleLen(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-25', '2026-04-22'])).toBe(28)
  })
})

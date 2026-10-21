import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayStr } from '../../src/domain/format'
import { db, defaultConfig, useDatabase } from '../../src/storage/db'
import { App } from '../../src/ui/App'

const today = todayStr()

/** Тексты, которых не должно быть на основных экранах: фазы и день цикла. */
const PHASE_TEXTS = ['Менструация', 'Фолликулярная фаза', 'Овуляция (примерно)', 'Лютеиновая фаза', 'Перед менструацией', 'Цикл длиннее расчётного']

beforeEach(async () => {
  useDatabase(`ui-${Math.random()}`)
  // начало менструации 5 дней назад → сегодня 6-й день цикла, фолликулярная фаза, окно прогресса
  await db.config.put({ ...defaultConfig(), periodStarts: [addDays(today, -5)] })
  window.location.hash = '#/today'
})

/** Тренировки А с приседанием: по одной на каждый набор повторений. */
async function insertSquatSessions(reps: number[][]): Promise<void> {
  const base = { date: today, type: 'A' as const, cycleDay: 6, phase: 'fol' as const, mode: 'progress' as const, feel: 'ok' as const, note: '' }
  for (let i = 0; i < reps.length; i++) {
    await db.sessions.put({ ...base, id: `s${i + 1}`, ts: i + 1, ex: { squat: reps[i].map((r) => ({ w: 40, r })) } })
  }
}

describe('экран «Сегодня»', () => {
  it('сохранённая тренировка появляется в «Истории»', async () => {
    render(<App />)

    const cards = await screen.findAllByRole('article')
    const reps = within(cards[0]).getByLabelText('Подход 1, повторения')
    fireEvent.change(reps, { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренировку' }))
    await waitFor(() => expect(screen.getByText('Тренировка сохранена')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'История' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'История' })).toBeTruthy())
    await waitFor(() => expect(screen.getByText(/Приседания со штангой/)).toBeTruthy())
    expect(screen.getByText(/×8/)).toBeTruthy()
  })

  it('без даты начала менструации — компактная просьба указать её', async () => {
    await db.config.put({ ...defaultConfig(), periodStarts: [] })
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Укажите дату начала менструации/)).toBeTruthy())
    expect(screen.getByLabelText('Начало последней менструации')).toBeTruthy()
    // дублирующей подсказки про вкладку «Цикл» быть не должно
    expect(screen.queryByText(/во вкладке «Цикл»/)).toBeNull()
  })

  it('все разделы открываются', async () => {
    render(<App />)
    await screen.findAllByRole('article')

    fireEvent.click(screen.getByRole('button', { name: 'История' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'История' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Цикл' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Цикл' })).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Менструация началась сегодня')).toBeTruthy())
    expect(screen.getByText('Резервная копия')).toBeTruthy()
    // кольцо цикла и настройки шагов прогрессии — только во вкладке «Цикл»
    expect(screen.getByRole('img', { name: /День цикла 6 из 28/ })).toBeTruthy()
    expect(screen.getByText('Настройки прогрессии')).toBeTruthy()
    const step = screen.getByLabelText('Шаг прибавки, Приседания со штангой') as HTMLInputElement
    expect(step.value).toBe('2.5')
  })
})

describe('цикл скрыт на основных экранах', () => {
  it('на «Сегодня» нет фазы, дня цикла и режима', async () => {
    render(<App />)
    await screen.findAllByRole('article')
    await waitFor(() => expect(screen.getAllByText(/Цель:/).length).toBeGreaterThan(0))

    for (const t of PHASE_TEXTS) expect(screen.queryByText(t)).toBeNull()
    expect(screen.queryByText(/День \d+ из/)).toBeNull()
    expect(screen.queryByText(/окно прогресса/i)).toBeNull()
    expect(screen.queryByText(/Поддержка/)).toBeNull()
    expect(screen.queryByText(/Облегчённый режим/)).toBeNull()
    // строки цикла с раскрывашкой нет
    expect(screen.queryByRole('button', { expanded: false })).toBeNull()
  })

  it('в «Истории» нет чипа «день N · фаза» и подписи про цвет точки', async () => {
    await db.sessions.put({
      id: 's1',
      date: today,
      ts: Date.now(),
      type: 'A',
      cycleDay: 6,
      phase: 'fol',
      mode: 'progress',
      feel: 'ok',
      note: '',
      ex: { squat: [{ w: 40, r: 8 }] },
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'История' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'История' })).toBeTruthy())
    await waitFor(() => expect(screen.getByText(/Приседания со штангой/)).toBeTruthy())

    for (const t of PHASE_TEXTS) expect(screen.queryByText(t)).toBeNull()
    expect(screen.queryByText(/день \d+ ·/i)).toBeNull()
    expect(screen.queryByText(/Цвет точки/)).toBeNull()
  })
})

describe('исправления по аудиту (К1–К3, Д2, Д7)', () => {
  it('К1: для резинки — текстовая клавиатура, для веса — цифровая', async () => {
    render(<App />)
    await screen.findAllByRole('article')
    const band = screen.getAllByLabelText('Подход 1, резинка')[0]
    expect(band.getAttribute('inputmode')).not.toBe('decimal')
    expect(band.getAttribute('autocapitalize')).toBe('none')
    const weight = screen.getAllByLabelText('Подход 1, вес')[0]
    expect(weight.getAttribute('inputmode')).toBe('decimal')
  })

  it('К2: введённое до загрузки черновика не теряется', async () => {
    await db.drafts.put({
      id: today,
      date: today,
      feel: 'ok',
      A: { ex: { squat: [{ w: '35', r: '7' }] }, note: 'из базы' },
    })
    render(<App />)
    // печатаем сразу, не дожидаясь загрузки черновика из базы
    const reps = screen.getAllByLabelText('Подход 1, повторения')[0] as HTMLInputElement
    fireEvent.change(reps, { target: { value: '9' } })
    expect(reps.value).toBe('9')
    // ждём, пока черновик из базы загрузится
    await new Promise((r) => setTimeout(r, 300))
    const after = screen.getAllByLabelText('Подход 1, повторения')[0] as HTMLInputElement
    expect(after.value).toBe('9')
  })

  it('Д2: в обычном случае показана только строка цели, без строки рекомендации', async () => {
    await insertSquatSessions([
      [3, 3, 3],
      [4, 4, 4],
      [5, 4, 3],
      [7, 7, 7],
    ])
    render(<App />)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: /Тренировка А/ }))
    await waitFor(() => expect(screen.getAllByText(/Цель: 40 кг/).length).toBeGreaterThan(0))
    expect(screen.queryByText(/Тот же вес, добирайте повторения/)).toBeNull()
  })

  it('Д2: при прибавке строка рекомендации показана', async () => {
    await insertSquatSessions([
      [3, 3, 3],
      [4, 4, 4],
      [5, 4, 3],
      [8, 8, 8],
    ])
    render(<App />)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: /Тренировка А/ }))
    await waitFor(() => expect(screen.getAllByText(/Цель: 42,5 кг/).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Все подходы на 8\+/).length).toBeGreaterThan(0)
  })

  it('Д7: «Очистить введённое» — с подтверждением вторым нажатием', async () => {
    render(<App />)
    const cards = await screen.findAllByRole('article')
    fireEvent.change(within(cards[0]).getByLabelText('Подход 1, повторения'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Очистить введённое' }))
    const armed = await screen.findByRole('button', { name: /Нажмите ещё раз, чтобы очистить/ })
    // первое нажатие только спрашивает подтверждение — данные на месте
    expect((screen.getAllByLabelText('Подход 1, повторения')[0] as HTMLInputElement).value).toBe('8')
    fireEvent.click(armed)
    await waitFor(() => expect((screen.getAllByLabelText('Подход 1, повторения')[0] as HTMLInputElement).value).toBe(''))
  })
})

describe('вкладка «Техника» удалена', () => {
  it('в панели её нет', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Сегодня' })
    expect(screen.queryByRole('button', { name: 'Техника' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^(Сегодня|История|Цикл)$/ })).toHaveLength(3)
  })

  it('старый адрес #/tech открывает «Сегодня»', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Сегодня' })
    window.location.hash = '#/tech'
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'Техника и правила' })).toBeNull()
  })
})

describe('режим цикла влияет только на текст рекомендации', () => {
  it('«Плохо» — облегчённая рекомендация, без названий фаз', async () => {
    render(<App />)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: 'Плохо' }))
    await waitFor(() => expect(screen.getAllByText(/Облегчённый день:/).length).toBeGreaterThan(0))
    for (const t of PHASE_TEXTS) expect(screen.queryByText(t)).toBeNull()
  })

  it('цель повторений видна в placeholder и в строке цели', async () => {
    const base = { date: today, type: 'A' as const, cycleDay: 6, phase: 'fol' as const, mode: 'progress' as const, feel: 'ok' as const, note: '' }
    const rows = [
      { id: 's1', ts: 1, ex: { squat: [{ w: 40, r: 3 }, { w: 40, r: 3 }, { w: 40, r: 3 }] } },
      { id: 's2', ts: 2, ex: { squat: [{ w: 40, r: 4 }, { w: 40, r: 4 }, { w: 40, r: 4 }] } },
      { id: 's3', ts: 3, ex: { squat: [{ w: 40, r: 5 }, { w: 40, r: 4 }, { w: 40, r: 3 }] } },
      { id: 's4', ts: 4, ex: { squat: [{ w: 40, r: 6 }, { w: 40, r: 5 }, { w: 40, r: 4 }] } },
    ]
    for (const r of rows) await db.sessions.put({ ...base, ...r })

    render(<App />)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: /Тренировка А/ }))

    const reps = screen.getAllByLabelText('Подход 1, повторения')
    expect(reps[0].getAttribute('placeholder')).toBe('цель 7')
    expect(screen.getAllByLabelText('Подход 2, повторения')[0].getAttribute('placeholder')).toBe('цель 6')
    expect(screen.getAllByLabelText('Подход 3, повторения')[0].getAttribute('placeholder')).toBe('цель 5')
    expect(screen.getByText(/Цель: 40 кг × 7 · 6 · 5/)).toBeTruthy()
  })
})

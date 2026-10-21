import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayStr } from '../../src/domain/format'
import { db, defaultConfig, useDatabase } from '../../src/storage/db'
import { App } from '../../src/ui/App'

beforeEach(async () => {
  useDatabase(`ui-${Math.random()}`)
  // начало менструации — сегодня: день цикла 1, фаза «менструация»
  await db.config.put({ ...defaultConfig(), periodStarts: [todayStr()] })
  window.location.hash = '#/today'
})

describe('экран «Сегодня»', () => {
  it('сохранённая тренировка появляется в «Истории»', async () => {
    render(<App />)

    // ждём загрузки настроек цикла — после этого известен режим тренировки
    await screen.findByText('Облегчённый режим')

    const cards = await screen.findAllByRole('article')
    const reps = within(cards[0]).getByLabelText('Подход 1, повторения')
    fireEvent.change(reps, { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренировку' }))
    await waitFor(() => expect(screen.getByText('Тренировка сохранена')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'История' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'История' })).toBeTruthy())
    await waitFor(() => expect(screen.getByText(/Приседания со штангой/)).toBeTruthy())
    expect(screen.getByText(/×8/)).toBeTruthy()
    // день цикла и фаза сохранились вместе с тренировкой
    expect(screen.getByText(/день 1 · менструация/)).toBeTruthy()
  })

  it('без даты начала менструации просит её указать', async () => {
    await db.config.put({ ...defaultConfig(), periodStarts: [] })
    render(<App />)
    await waitFor(() => expect(screen.getByText('Укажите дату начала менструации')).toBeTruthy())
  })

  it('все разделы открываются', async () => {
    render(<App />)
    await screen.findByText('Облегчённый режим')

    fireEvent.click(screen.getByRole('button', { name: 'История' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'История' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Цикл' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Цикл' })).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Менструация началась сегодня')).toBeTruthy())
    expect(screen.getByText('Резервная копия')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Техника' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Техника и правила' })).toBeTruthy())
    expect(screen.getByText('Запас повторений (RIR)')).toBeTruthy()
  })
})

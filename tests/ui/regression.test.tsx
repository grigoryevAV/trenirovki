import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db, ensureConfig, useDatabase } from '../../src/storage/db'
import { App } from '../../src/ui/App'
import { ErrorBoundary } from '../../src/ui/ErrorBoundary'

/**
 * Регрессия: useLiveQuery(() => ensureConfig()) писал в базу внутри liveQuery.
 * Dexie на это отвечает ReadOnlyError («Readwrite transaction in liveQuery context»),
 * useLiveQuery пробрасывает ошибку в render, React размонтирует дерево — приложение
 * показывало белый экран в реальном браузере (jsdom-тесты это не ловили).
 *
 * Проверяем: на пустой базе приложение рисует экран «Сегодня», ошибок нет,
 * а внутри liveQuery не происходит ни одной записи.
 */
describe('запуск приложения на пустой базе', () => {
  it('не падает с ReadOnlyError и рисует экран «Сегодня»', async () => {
    useDatabase(`regression-${Math.random()}`)

    const problems: string[] = []
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      problems.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))
    })
    const onWindowError = (e: ErrorEvent): void => {
      problems.push(String((e.error as Error | undefined)?.message ?? e.message ?? e))
    }
    window.addEventListener('error', onWindowError)
    // любая запись во время работы liveQuery — запрещена
    const putSpy = vi.spyOn(db.config, 'put')

    try {
      render(<App />)

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeTruthy())
      // даём подпискам время на первый запрос к базе и на возможную ошибку
      await new Promise((r) => setTimeout(r, 250))

      expect(problems.join(' | ')).not.toMatch(/ReadOnlyError|liveQuery context/)
      expect(putSpy).not.toHaveBeenCalled()
      // настроек по умолчанию ещё нет — приложение просит указать дату начала менструации
      expect(screen.getByText(/Укажите дату начала менструации/)).toBeTruthy()
    } finally {
      window.removeEventListener('error', onWindowError)
      consoleSpy.mockRestore()
      putSpy.mockRestore()
    }
  })

  it('старт как в приложении: настройки создаются до рендера, без ошибок', async () => {
    useDatabase(`regression-start-${Math.random()}`)
    const problems: string[] = []
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      problems.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))
    })
    try {
      // так работает src/main.tsx: ensureConfig() до рендера
      await ensureConfig()
      render(<App />)
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeTruthy())
      await new Promise((r) => setTimeout(r, 250))
      expect(problems.join(' | ')).not.toMatch(/ReadOnlyError|liveQuery context/)
      // настройки по умолчанию без даты начала менструации
      expect(screen.getByText(/Укажите дату начала менструации/)).toBeTruthy()
      expect(await db.config.get('me')).toMatchObject({ periodStarts: [], cycleLen: 28, periodLen: 5 })
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('настоящая точка входа main.tsx поднимает приложение', async () => {
    useDatabase(`regression-main-${Math.random()}`)
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    const problems: string[] = []
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      problems.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))
    })
    try {
      await import('../../src/main')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeTruthy())
      await new Promise((r) => setTimeout(r, 250))
      expect(problems.join(' | ')).not.toMatch(/ReadOnlyError|liveQuery context/)
      // настройки созданы на старте, приложение просит указать дату начала менструации
      expect(screen.getByText(/Укажите дату начала менструации/)).toBeTruthy()
      expect(await db.config.get('me')).toMatchObject({ periodStarts: [], cycleLen: 28, periodLen: 5 })
    } finally {
      consoleSpy.mockRestore()
      root.remove()
    }
  })

  it('ошибка при отрисовке не оставляет белый экран', async () => {
    const Boom = (): never => {
      throw new Error('тестовая ошибка')
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      )
      expect(screen.getByText('Что-то пошло не так')).toBeTruthy()
      expect(screen.getByText('тестовая ошибка')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Перезапустить' })).toBeTruthy()
    } finally {
      consoleSpy.mockRestore()
    }
  })
})

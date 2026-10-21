/** Доступ к данным приложения в React (IndexedDB через Dexie, реактивные подписки). */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../storage/db'
import type { ConfigRow, SessionRow } from '../storage/types'

/**
 * Настройки цикла и темы.
 *
 * ВАЖНО: здесь только чтение. Внутри useLiveQuery нельзя запускать readwrite-транзакции —
 * Dexie бросает ReadOnlyError («Readwrite transaction in liveQuery context»), а useLiveQuery
 * пробрасывает ошибку в render, из-за чего React размонтирует дерево и приложение показывает
 * белый экран. Запись настроек по умолчанию создаётся один раз при старте приложения
 * (см. ensureConfig в src/storage/db.ts и вызов в src/main.tsx).
 */
export function useConfig(): ConfigRow | undefined {
  return useLiveQuery(() => db.config.get('me'), [])
}

/** Все тренировки, новые сверху. Только чтение. */
export function useSessions(): SessionRow[] {
  const rows = useLiveQuery(() => db.sessions.toArray(), [])
  if (!rows) return []
  return [...rows].sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** Применяет тему оформления к документу: «auto» — по системной настройке. */
export function useTheme(config: ConfigRow | undefined): void {
  const theme = config?.theme ?? 'auto'
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
}

/** Локальная база в IndexedDB (Dexie). Сервера нет: данные живут только на этом устройстве. */
import Dexie, { type Table } from 'dexie'
import { DEFAULT_CYCLE_LEN, DEFAULT_PERIOD_LEN } from '../domain/cycle'
import { DEFAULT_STEPS } from '../domain/progression'
import type { ConfigRow, DraftRow, SessionRow } from './types'

/** Версия схемы хранения. Повышается вместе с миграцией в Dexie.version(). */
export const SCHEMA_VERSION = 1

export class AppDB extends Dexie {
  config!: Table<ConfigRow, string>
  sessions!: Table<SessionRow, string>
  drafts!: Table<DraftRow, string>

  constructor(name = 'trenirovki-zheny') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      config: 'id',
      sessions: 'id, date, ts, type',
      drafts: 'id',
    })
  }
}

export let db = new AppDB()

/** Для тестов: отдельная база с другим именем. */
export function useDatabase(name: string): AppDB {
  db = new AppDB(name)
  return db
}

/** Настройки по умолчанию. Дата начала менструации намеренно пустая — её указывает пользователь. */
export function defaultConfig(now = new Date().toISOString()): ConfigRow {
  return {
    id: 'me',
    periodStarts: [],
    cycleLen: DEFAULT_CYCLE_LEN,
    periodLen: DEFAULT_PERIOD_LEN,
    theme: 'auto',
    steps: { ...DEFAULT_STEPS },
    updatedAt: now,
  }
}

/**
 * Запись настроек по умолчанию (создаётся один раз при первом запуске).
 *
 * ВАЖНО: вызывать только вне liveQuery-подписок (useLiveQuery). Внутри них Dexie запрещает
 * readwrite-транзакции и бросает ReadOnlyError — приложение падает с белым экраном.
 * Точка вызова при старте — src/main.tsx.
 */
export async function ensureConfig(): Promise<ConfigRow> {
  const c = await db.config.get('me')
  if (c) {
    // Конфиг, созданный до появления настроек прогрессии, дополняем шагами по умолчанию.
    if (!c.steps || typeof c.steps !== 'object') {
      const fixed: ConfigRow = { ...c, steps: { ...DEFAULT_STEPS } }
      await db.config.put(fixed)
      return fixed
    }
    return c
  }
  const fresh = defaultConfig()
  await db.config.put(fresh)
  return fresh
}

/** Долговременное хранение: просим браузер не очищать базу при нехватке места. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* браузер не поддерживает — данные всё равно сохраняются */
  }
  return false
}

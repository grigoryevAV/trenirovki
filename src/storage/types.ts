/** Записи локальной базы (IndexedDB). Версия схемы — SCHEMA_VERSION в db.ts. */
import type { CycleConfig, Draft, Session } from '../domain/types'

/** Тема оформления: по системной настройке, светлая или тёмная. */
export type Theme = 'auto' | 'light' | 'dark'

export interface ConfigRow extends CycleConfig {
  id: 'me'
  theme: Theme
  updatedAt: string
}

/** Сохранённая тренировка. Формат поля ex совпадает с эталоном — записи переносятся без конвертации. */
export type SessionRow = Session

/** Черновик ввода: id = дата (YYYY-MM-DD), живёт до конца дня. */
export interface DraftRow extends Draft {
  id: string
}

/** Идентификатор приложения в файле резервной копии (совпадает с эталоном). */
export const BACKUP_APP_ID = 'trenirovki'

/** Файл резервной копии. Принимается и формат эталона: { app:'trenirovki', v:1, config, sessions }. */
export interface BackupFile {
  app: typeof BACKUP_APP_ID
  v: number
  exported?: string
  config: CycleConfig
  sessions: SessionRow[]
}

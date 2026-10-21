/** Операции с данными: настройки цикла, тренировки, черновик. */
import { normConfig } from '../domain/cycle'
import { DEFAULT_STEPS } from '../domain/progression'
import type { Draft, DraftType, Session } from '../domain/types'
import { db, ensureConfig } from './db'
import type { ConfigRow, DraftRow, SessionRow } from './types'

const now = () => new Date().toISOString()

// ------------------------------------------------ настройки цикла

export async function getConfig(): Promise<ConfigRow> {
  return ensureConfig()
}

/** Обновляет настройки цикла (длина цикла/менструации приводится к допустимым значениям). */
export async function saveConfig(patch: Partial<ConfigRow>): Promise<ConfigRow> {
  const cur = await ensureConfig()
  const merged = normConfig({
    periodStarts: patch.periodStarts ?? cur.periodStarts,
    cycleLen: patch.cycleLen ?? cur.cycleLen,
    periodLen: patch.periodLen ?? cur.periodLen,
  })
  const next: ConfigRow = {
    id: 'me',
    periodStarts: merged.periodStarts,
    cycleLen: merged.cycleLen,
    periodLen: merged.periodLen,
    theme: patch.theme ?? cur.theme,
    steps: { ...DEFAULT_STEPS, ...cur.steps, ...(patch.steps ?? {}) },
    updatedAt: now(),
  }
  await db.config.put(next)
  return next
}

// ------------------------------------------------ тренировки

/** Все тренировки, новые сверху. */
export async function listSessions(): Promise<SessionRow[]> {
  const all = await db.sessions.toArray()
  return all.sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** Сохраняет тренировку (с тем же id — перезаписывает). */
export async function addSession(s: Session): Promise<void> {
  await db.sessions.put(s as SessionRow)
}

/** Удаляет тренировку. */
export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

/**
 * Слияние тренировок по id: уже сохранённые записи не перезаписываются,
 * новые добавляются. Возвращает количество добавленных.
 */
export async function mergeSessions(incoming: Session[]): Promise<number> {
  let added = 0
  await db.transaction('rw', db.sessions, async () => {
    for (const s of incoming) {
      const exists = await db.sessions.get(s.id)
      if (!exists) {
        await db.sessions.put(s as SessionRow)
        added++
      }
    }
  })
  return added
}

// ------------------------------------------------ черновик

export async function getDraft(date: string): Promise<Draft> {
  const row = await db.drafts.get(date)
  if (!row) return { date, feel: 'ok' }
  return { date: row.date ?? date, feel: row.feel ?? 'ok', A: row.A, B: row.B }
}

export async function saveDraft(draft: Draft): Promise<void> {
  const row: DraftRow = { id: draft.date, ...draft }
  await db.drafts.put(row)
  // Черновик живёт только до конца дня — записи за прошлые дни удаляются.
  await db.drafts.where('id').notEqual(draft.date).delete()
}

/** Убирает введённое по одной тренировке (после сохранения). */
export async function clearDraftType(date: string, type: 'A' | 'B'): Promise<void> {
  const row = await db.drafts.get(date)
  if (!row) return
  const next: DraftRow = { ...row }
  delete next[type]
  await db.drafts.put(next)
}

/** Пустая заготовка под конкретную тренировку. */
export function emptyDraftType(): DraftType {
  return { ex: {}, note: '' }
}

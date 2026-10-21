/**
 * Резервная копия: экспорт/импорт JSON.
 * Формат совместим с эталоном: { app:'trenirovki', v:1, config, sessions } —
 * записи из старой страницы переносятся в это приложение без конвертации.
 */
import { normConfig } from '../domain/cycle'
import type { CycleConfig, Feel, Mode, Phase, Session, WorkoutType } from '../domain/types'
import { getConfig, listSessions, mergeSessions, saveConfig } from './repo'
import { BACKUP_APP_ID, type BackupFile, type SessionRow } from './types'

export { BACKUP_APP_ID }
export const BACKUP_VERSION = 1

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const PHASES: Phase[] = ['men', 'fol', 'ovu', 'lut', 'pms', 'late']
const MODES: Mode[] = ['progress', 'hold', 'light']
const FEELS: Feel[] = ['good', 'ok', 'bad']

/** Собирает копию из текущего состояния базы. */
export async function buildBackup(): Promise<BackupFile> {
  const config = await getConfig()
  const sessions = await listSessions()
  return {
    app: BACKUP_APP_ID,
    v: BACKUP_VERSION,
    exported: new Date().toISOString(),
    config: { periodStarts: config.periodStarts, cycleLen: config.cycleLen, periodLen: config.periodLen },
    sessions: sessions as SessionRow[],
  }
}

/** Текст копии (тот же, что в файле). */
export function backupText(file: BackupFile): string {
  return JSON.stringify(file, null, 1)
}

/** Текст копии без даты экспорта — для «Скопировать текстом» (как в эталоне). */
export function backupPlainText(file: BackupFile): string {
  return JSON.stringify({ app: BACKUP_APP_ID, v: BACKUP_VERSION, config: file.config, sessions: file.sessions })
}

function checkSession(s: unknown, i: number): string | null {
  if (!isObj(s)) return `запись №${i + 1} повреждена`
  if (typeof s.id !== 'string' || !s.id) return `у записи №${i + 1} нет идентификатора`
  if (s.type !== 'A' && s.type !== 'B') return `у записи ${s.id} неизвестный тип тренировки`
  if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return `у записи ${s.id} неверная дата`
  if (s.ex !== undefined && !isObj(s.ex)) return `у записи ${s.id} повреждены подходы`
  return null
}

function normalizeSession(s: Record<string, unknown>): Session {
  const ex: Record<string, Array<{ w: number | string; r: number }>> = {}
  const rawEx = isObj(s.ex) ? s.ex : {}
  for (const [id, sets] of Object.entries(rawEx)) {
    if (!Array.isArray(sets)) continue
    ex[id] = sets
      .filter((x): x is Record<string, unknown> => isObj(x))
      .map((x) => ({ w: (typeof x.w === 'number' ? x.w : String(x.w ?? '')) as number | string, r: Number(x.r) || 0 }))
  }
  const ts = typeof s.ts === 'number' ? s.ts : Date.parse(String(s.date)) || 0
  return {
    id: String(s.id),
    date: String(s.date),
    ts,
    type: s.type as WorkoutType,
    cycleDay: typeof s.cycleDay === 'number' ? s.cycleDay : null,
    phase: PHASES.includes(s.phase as Phase) ? (s.phase as Phase) : null,
    mode: MODES.includes(s.mode as Mode) ? (s.mode as Mode) : 'hold',
    feel: FEELS.includes(s.feel as Feel) ? (s.feel as Feel) : 'ok',
    note: typeof s.note === 'string' ? s.note : '',
    ex,
  }
}

export type ValidateResult = { ok: true; file: BackupFile } | { ok: false; error: string }

/** Проверка файла копии. Чужой или повреждённый файл отклоняется с понятным текстом. */
export function validateBackup(raw: unknown): ValidateResult {
  if (!isObj(raw)) return { ok: false, error: 'Это не файл копии' }
  if (raw.app !== BACKUP_APP_ID) return { ok: false, error: 'Это не файл копии' }
  if (!Array.isArray(raw.sessions)) return { ok: false, error: 'Это не файл копии' }
  const sessions: Session[] = []
  for (let i = 0; i < raw.sessions.length; i++) {
    const err = checkSession(raw.sessions[i], i)
    if (err) return { ok: false, error: `Это не файл копии: ${err}` }
    sessions.push(normalizeSession(raw.sessions[i] as Record<string, unknown>))
  }
  const config: CycleConfig = isObj(raw.config) ? normConfig(raw.config as Partial<CycleConfig>) : { periodStarts: [], cycleLen: 28, periodLen: 5 }
  return {
    ok: true,
    file: {
      app: BACKUP_APP_ID,
      v: typeof raw.v === 'number' ? raw.v : BACKUP_VERSION,
      exported: typeof raw.exported === 'string' ? raw.exported : undefined,
      config,
      sessions,
    },
  }
}

/** Разбор текста копии. */
export function parseBackupText(text: string): ValidateResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Это не файл копии' }
  }
  return validateBackup(raw)
}

/**
 * Импорт копии: тренировки сливаются по id (существующие не перезаписываются),
 * настройки цикла переносятся из копии.
 */
export async function importBackup(file: BackupFile): Promise<{ added: number }> {
  const added = await mergeSessions(file.sessions)
  if (file.config) {
    // Пустой список начал в копии не затирает текущую настройку — дата начала могла быть указана уже в этом приложении.
    const starts = file.config.periodStarts.length ? file.config.periodStarts : undefined
    await saveConfig({
      periodStarts: starts,
      cycleLen: file.config.cycleLen,
      periodLen: file.config.periodLen,
    })
  }
  return { added }
}

/** Скачивание текста файлом (резервная копия). */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup, parseBackupText, validateBackup } from '../../src/storage/backup'
import { db, defaultConfig, ensureConfig, useDatabase } from '../../src/storage/db'
import { addSession, deleteSession, getDraft, listSessions, saveConfig, saveDraft } from '../../src/storage/repo'
import type { Session } from '../../src/domain/types'

let n = 0
beforeEach(async () => {
  useDatabase(`test-${++n}-${Math.random()}`)
  await ensureConfig()
})

const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  date: '2026-01-05',
  ts: 1767571200000,
  type: 'A',
  cycleDay: 5,
  phase: 'men',
  mode: 'hold',
  feel: 'ok',
  note: '',
  ex: { squat: [{ w: 40, r: 8 }] },
  ...over,
})

describe('хранение тренировок', () => {
  it('сохранение и чтение', async () => {
    await addSession(session('s1'))
    const list = await listSessions()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 's1', type: 'A' })
    expect(list[0].ex.squat[0]).toEqual({ w: 40, r: 8 })
  })

  it('удаление', async () => {
    await addSession(session('s1'))
    await addSession(session('s2'))
    expect(await listSessions()).toHaveLength(2)
    await deleteSession('s1')
    const list = await listSessions()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('s2')
  })

  it('данные переживают перезапуск (то же имя базы)', async () => {
    await addSession(session('s1'))
    const name = db.name
    db.close()
    useDatabase(name)
    expect(await listSessions()).toHaveLength(1)
  })
})

describe('настройки цикла', () => {
  it('сохраняются и нормализуются', async () => {
    const c = await saveConfig({ periodStarts: ['2026-01-01'], cycleLen: 100, periodLen: 1 })
    expect(c.cycleLen).toBe(45)
    expect(c.periodLen).toBe(2)
    expect((await db.config.get('me'))!.periodStarts).toEqual(['2026-01-01'])
  })

  it('дата начала по умолчанию не зашита', async () => {
    const c = await ensureConfig()
    expect(c.periodStarts).toEqual([])
  })

  it('тема оформления сохраняется', async () => {
    const c = await saveConfig({ theme: 'dark' })
    expect(c.theme).toBe('dark')
  })
})

describe('черновик', () => {
  it('живёт до конца дня', async () => {
    expect(await getDraft('2026-01-05')).toEqual({ date: '2026-01-05', feel: 'ok' })
    await saveDraft({ date: '2026-01-05', feel: 'bad', A: { ex: { squat: [{ w: '40', r: '8' }] }, note: 'болела поясница' } })
    const d = await getDraft('2026-01-05')
    expect(d.feel).toBe('bad')
    expect(d.A?.note).toBe('болела поясница')
    expect(d.A?.ex.squat?.[0]).toEqual({ w: '40', r: '8' })
  })

  it('черновик за прошлый день не переживает новый день', async () => {
    await saveDraft({ date: '2026-01-05', feel: 'ok', A: { ex: {}, note: 'вчера' } })
    await saveDraft({ date: '2026-01-06', feel: 'ok' })
    expect(await db.drafts.get('2026-01-05')).toBeUndefined()
    expect(await db.drafts.get('2026-01-06')).toBeTruthy()
  })
})

describe('резервная копия', () => {
  it('принимает формат эталона и сливает записи по id', async () => {
    const file = {
      app: 'trenirovki',
      v: 1,
      config: { periodStarts: ['2026-01-01'], cycleLen: 28, periodLen: 5 },
      sessions: [session('s1'), session('s2', { type: 'B', ts: 1767657600000 })],
    }
    const parsed = validateBackup(file)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const { added } = await importBackup(parsed.file)
    expect(added).toBe(2)
    expect(await listSessions()).toHaveLength(2)

    // повторный импорт той же копии не создаёт дублей
    const again = await importBackup(parsed.file)
    expect(again.added).toBe(0)
    expect(await listSessions()).toHaveLength(2)
  })

  it('не затирает уже сохранённые записи той же копии', async () => {
    await addSession(session('s1', { note: 'моя запись' }))
    const parsed = validateBackup({
      app: 'trenirovki',
      v: 1,
      config: { periodStarts: ['2026-01-01'], cycleLen: 28, periodLen: 5 },
      sessions: [session('s1', { note: 'из копии' }), session('s2')],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importBackup(parsed.file)
    const list = await listSessions()
    expect(list).toHaveLength(2)
    expect(list.find((s) => s.id === 's1')!.note).toBe('моя запись')
  })

  it('переносит настройки цикла из копии', async () => {
    const parsed = validateBackup({
      app: 'trenirovki',
      v: 1,
      config: { periodStarts: ['2026-01-01', '2026-01-29'], cycleLen: 30, periodLen: 6 },
      sessions: [],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importBackup(parsed.file)
    const c = await ensureConfig()
    expect(c.periodStarts).toEqual(['2026-01-01', '2026-01-29'])
    expect(c.cycleLen).toBe(30)
    expect(c.periodLen).toBe(6)
  })

  it('отказывается от чужого файла', () => {
    expect(validateBackup({ app: 'zhimovaya-proga', v: 1, config: {}, sessions: [] })).toMatchObject({ ok: false })
    expect(validateBackup({ app: 'trenirovki', v: 1 })).toMatchObject({ ok: false })
    expect(validateBackup([])).toMatchObject({ ok: false })
    expect(parseBackupText('{не json')).toMatchObject({ ok: false })
    expect(validateBackup({ app: 'trenirovki', v: 1, sessions: [{ id: 'x', type: 'C', date: '2026-01-01' }] })).toMatchObject({ ok: false })
  })

  it('экспорт и импорт своего файла возвращают всё', async () => {
    await addSession(session('s1'))
    await saveConfig({ periodStarts: ['2026-01-01'] })
    const file = await buildBackup()
    expect(file.app).toBe('trenirovki')
    expect(file.sessions).toHaveLength(1)

    useDatabase(`test-restored-${Math.random()}`)
    await ensureConfig()
    const parsed = parseBackupText(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importBackup(parsed.file)
    expect(await listSessions()).toHaveLength(1)
    expect((await ensureConfig()).periodStarts).toEqual(['2026-01-01'])
  })

  it('настройки по умолчанию не содержат даты начала', () => {
    expect(defaultConfig().periodStarts).toEqual([])
  })
})

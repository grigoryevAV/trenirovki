import { useEffect, useState } from 'react'
import { cycleInfo } from '../../domain/cycle'
import { fmtKg, fmtLong, num, todayStr } from '../../domain/format'
import { lastFor, lastLine, nextType, rec } from '../../domain/rec'
import type { CycleConfig, Draft, DraftType, Feel, Mode, Session, SetEntry, WorkoutType } from '../../domain/types'
import { MODES, PHASES, WORKOUTS, W_LABEL } from '../../domain/workouts'
import { addSession, clearDraftType, getDraft, saveConfig, saveDraft } from '../../storage/repo'
import { CycleRing, useToast } from '../components'
import { useConfig, useSessions } from '../data'

/** Настройки по умолчанию, пока запись в базе ещё не создана. */
const EMPTY_CONFIG: CycleConfig = { periodStarts: [], cycleLen: 28, periodLen: 5 }

const FEELS: Array<[Feel, string]> = [
  ['good', 'Хорошо'],
  ['ok', 'Нормально'],
  ['bad', 'Плохо'],
]

/** Карточка первого запуска: просит указать дату начала менструации. */
function FirstRunCard({ onSave }: { onSave: (date: string) => void }) {
  const [date, setDate] = useState('')
  const today = todayStr()
  return (
    <div className="note alert">
      <p>
        <b>Укажите дату начала менструации</b> — без неё не определить фазу цикла и режим тренировки. Дата
        останется только на этом устройстве.
      </p>
      <div className="field">
        <label htmlFor="firstStart">Начало последней менструации</label>
        <input id="firstStart" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button type="button" className="btn sm" disabled={!date} onClick={() => onSave(date)}>
        Сохранить дату
      </button>
    </div>
  )
}

export function TodayScreen() {
  const toast = useToast()
  const config = useConfig()
  const sessions = useSessions()
  const today = todayStr()

  const [draft, setDraft] = useState<Draft>({ date: today, feel: 'ok' })
  const [picked, setPicked] = useState<WorkoutType | null>(null)

  useEffect(() => {
    let alive = true
    void getDraft(today).then((d) => {
      if (alive) setDraft(d)
    })
    return () => {
      alive = false
    }
  }, [today])

  const update = (next: Draft): void => {
    setDraft(next)
    void saveDraft(next)
  }

  const type: WorkoutType = picked ?? nextType(sessions)
  const def = WORKOUTS[type]
  const nextT = nextType(sessions)
  // Пока запись настроек не создана (база недоступна) — работаем с пустыми настройками.
  const cfg: CycleConfig = config ?? EMPTY_CONFIG
  const ci = cycleInfo(cfg, today)
  const phaseMode: Mode = ci.ok ? ci.mode : 'hold'
  const feel: Feel = draft.feel || 'ok'
  const mode: Mode = feel === 'bad' ? 'light' : phaseMode
  const early = sessions.length < 4
  const dt: DraftType | undefined = draft[type]

  const setFeel = (v: Feel): void => update({ ...draft, feel: v })

  const setSetValue = (exId: string, i: number, field: 'w' | 'r', value: string): void => {
    const cur: DraftType = dt ?? { ex: {}, note: '' }
    const arr = [...(cur.ex[exId] ?? [])]
    const item = { ...(arr[i] ?? {}) }
    item[field] = value
    arr[i] = item
    update({ ...draft, [type]: { ...cur, ex: { ...cur.ex, [exId]: arr } } })
  }

  const setNote = (value: string): void => {
    const cur: DraftType = dt ?? { ex: {}, note: '' }
    update({ ...draft, [type]: { ...cur, note: value } })
  }

  const clearInputs = (): void => {
    const next = { ...draft }
    delete next[type]
    update(next)
    toast('Введённое очищено')
  }

  const saveWorkout = async (): Promise<void> => {
    const ex: Record<string, SetEntry[]> = {}
    let count = 0
    for (const d of def.ex) {
      const r = rec(d, lastFor(sessions, type, d.id), mode, early)
      const dEx = dt?.ex?.[d.id] ?? []
      const sets: SetEntry[] = []
      for (let i = 0; i < d.sets; i++) {
        const row = dEx[i] ?? {}
        const reps = parseInt(row.r ?? '', 10)
        if (!reps) continue
        const wRaw = row.w !== undefined ? row.w : r.w
        sets.push({ w: d.kind === 'band' ? String(wRaw || '') : num(wRaw), r: reps })
      }
      if (sets.length) {
        ex[d.id] = sets
        count++
      }
    }
    if (!count) {
      toast('Введите повторения хотя бы в одном подходе')
      return
    }
    const ts = Date.now()
    const obj: Session = {
      id: 's' + ts,
      date: today,
      ts,
      type,
      cycleDay: ci && ci.ok ? ci.day : null,
      phase: ci && ci.ok ? ci.phase : null,
      mode,
      feel,
      note: dt?.note ?? '',
      ex,
    }
    await addSession(obj)
    await clearDraftType(today, type)
    const next = { ...draft }
    delete next[type]
    update(next)
    setPicked(type === 'A' ? 'B' : 'A')
    toast('Тренировка сохранена')
    window.scrollTo(0, 0)
  }

  return (
    <main className="screen">
      <div className="top-date">{fmtLong(today)}</div>
      <h1>Сегодня</h1>

      {cfg.periodStarts.length === 0 && (
        <FirstRunCard onSave={(date) => void saveConfig({ periodStarts: [date] })} />
      )}

      {ci.ok ? (
        <section className="hero">
          <CycleRing day={ci.day} L={ci.L} P={ci.P} />
          <div className="hero-text">
            <p className="phase-name" style={{ color: PHASES[ci.phase].color }}>{PHASES[ci.phase].name}</p>
            <span className={`mode-chip mode-${mode}`}>{MODES[mode].label}</span>
            <p>
              {feel === 'bad' && phaseMode !== 'light'
                ? 'Самочувствие важнее календаря: сегодня облегчённо, без прибавок.'
                : MODES[mode].text}
            </p>
            {ci.predicted && (
              <p className="muted small" style={{ marginTop: 6 }}>
                Расчёт приблизительный — отметьте начало последней менструации.
              </p>
            )}
          </div>
        </section>
      ) : (
        <div className="note">{ci.error}</div>
      )}

      <div className="label">Как самочувствие?</div>
      <div className="seg" role="group" aria-label="Самочувствие">
        {FEELS.map(([k, l]) => (
          <button key={k} type="button" data-act="feel" data-v={k} aria-pressed={feel === k} onClick={() => setFeel(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="label">Тренировка</div>
      <div className="seg" role="group" aria-label="Выбор тренировки">
        {(['A', 'B'] as WorkoutType[]).map((k) => (
          <button key={k} type="button" data-act="wtype" data-v={k} aria-pressed={type === k} onClick={() => setPicked(k)}>
            {WORKOUTS[k].title}
            <span className="sub">{k === nextT ? 'следующая по очереди' : WORKOUTS[k].sub}</span>
          </button>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        Разминка 5 минут + 1–2 подхода приседа с пустым грифом. Вес подставлен по рекомендации — меняйте, если сделали
        другой.
      </p>

      {def.ex.map((d) => {
        const last = lastFor(sessions, type, d.id)
        const r = rec(d, last, mode, early)
        const dEx = dt?.ex?.[d.id] ?? []
        return (
          <article className="ex" key={d.id}>
            <div className="ex-head">
              <span className="ex-num">{d.n}</span>
              <span className="ex-name">{d.name}</span>
            </div>
            <div className="ex-target">
              {d.sets} × {d.lo}–{d.hi} · {d.rest}
            </div>
            {last && <div className="ex-last">{lastLine(d, last)}</div>}
            <div className={`rec ${r.tone}`}>{r.text}</div>
            <div className="sets">
              <span className="h" />
              <span className="h">{W_LABEL[d.kind]}</span>
              <span />
              <span className="h">повторы</span>
              {Array.from({ length: d.sets }, (_, i) => {
                const raw = dEx[i]?.w
                const wv = raw !== undefined ? raw : d.kind === 'band' ? String(r.w) : r.w === '' ? '' : fmtKg(r.w)
                const rv = dEx[i]?.r ?? ''
                return (
                  <span key={i} style={{ display: 'contents' }}>
                    <span className="set-n">{i + 1}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={d.kind === 'band' ? 'цвет/сила' : 'кг'}
                      aria-label={`Подход ${i + 1}, ${d.kind === 'band' ? 'резинка' : 'вес'}`}
                      value={wv}
                      onChange={(e) => setSetValue(d.id, i, 'w', e.target.value)}
                    />
                    <span className="x">×</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={`${d.lo}–${d.hi}`}
                      aria-label={`Подход ${i + 1}, повторения`}
                      value={rv}
                      onChange={(e) => setSetValue(d.id, i, 'r', e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </span>
                )
              })}
            </div>
          </article>
        )
      })}

      <div className="field">
        <label htmlFor="note">Заметка</label>
        <textarea
          id="note"
          placeholder="Например: болела поясница, присед шёл легко"
          value={dt?.note ?? ''}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button type="button" className="btn" onClick={() => void saveWorkout()}>
        Сохранить тренировку
      </button>
      <button type="button" className="linkbtn" onClick={clearInputs}>
        Очистить введённое
      </button>
    </main>
  )
}

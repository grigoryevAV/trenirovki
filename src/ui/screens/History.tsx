import { useState } from 'react'
import { WD, fmtKg, fmtShort, num, parseD } from '../../domain/format'
import { WORKOUTS } from '../../domain/workouts'
import { deleteSession } from '../../storage/repo'
import { WeightChart, useToast } from '../components'
import { useSessions } from '../data'

const CHART_OPTIONS: Array<[string, string]> = [
  ['A.squat', 'Присед (А)'],
  ['B.squat', 'Присед (Б)'],
  ['A.rdl', 'Румынская тяга'],
  ['B.hip', 'Ягодичный мост'],
  ['A.bench', 'Жим лёжа'],
  ['B.ohp', 'Жим над головой'],
  ['B.hyper', 'Гиперэкстензия'],
]

const FEEL_TEXT: Record<string, string> = { good: 'хорошо', ok: 'нормально', bad: 'плохо' }

export function HistoryScreen() {
  const toast = useToast()
  const sessions = useSessions()
  const [chartEx, setChartEx] = useState('A.squat')
  const [delArm, setDelArm] = useState<string | null>(null)

  const [type, id] = chartEx.split('.')
  const points = [...sessions]
    .reverse()
    .filter((s) => s.type === type && s.ex && s.ex[id] && s.ex[id].length)
    .map((s) => ({ date: s.date, w: Math.max(...s.ex[id].map((x) => num(x.w))) }))

  const onDelete = async (id2: string): Promise<void> => {
    if (delArm === id2) {
      setDelArm(null)
      await deleteSession(id2)
      toast('Запись удалена')
    } else {
      setDelArm(id2)
    }
  }

  return (
    <main className="screen">
      <h1>История</h1>

      <div className="field">
        <label htmlFor="chartEx">Динамика рабочего веса</label>
        <select id="chartEx" value={chartEx} onChange={(e) => setChartEx(e.target.value)}>
          {CHART_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="chart-wrap">
        <WeightChart points={points} />
      </div>

      <h2>Тренировки</h2>
      {!sessions.length && <div className="note">Здесь появятся сохранённые тренировки. Начните с вкладки «Сегодня».</div>}
      {sessions.map((s) => {
        const W = WORKOUTS[s.type]
        if (!W) return null
        const feelTxt = FEEL_TEXT[s.feel] ?? ''
        return (
          <article className="sess" key={s.id}>
            <div className="sess-head">
              <span className="sess-title">
                {fmtShort(s.date)}, {WD[parseD(s.date).getDay()]} · {W.title}
              </span>
            </div>
            {feelTxt && <div className="muted small">Самочувствие: {feelTxt}</div>}
            <ul>
              {W.ex.map((def) => {
                const sets = s.ex?.[def.id]
                if (!sets || !sets.length) return null
                return (
                  <li key={def.id}>
                    <b>{def.name}:</b>{' '}
                    {sets.map((x) => (def.kind === 'band' ? String(x.w || '—') : fmtKg(x.w)) + '×' + x.r).join(' · ')}
                  </li>
                )
              })}
            </ul>
            {s.note && <p className="small" style={{ marginTop: 6 }}>{s.note}</p>}
            <button
              type="button"
              className="linkbtn"
              style={delArm === s.id ? { color: 'var(--c-men)' } : undefined}
              onClick={() => void onDelete(s.id)}
            >
              {delArm === s.id ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить'}
            </button>
          </article>
        )
      })}
    </main>
  )
}

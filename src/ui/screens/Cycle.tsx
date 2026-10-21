import { useState } from 'react'
import { averageCycleLen, cycleInfo, phaseRanges } from '../../domain/cycle'
import { addDays, fmtShort, todayStr } from '../../domain/format'
import { DEFAULT_STEPS } from '../../domain/progression'
import { ALL_EXERCISES, MODES, PHASES, PHASE_ADVICE, PHASE_SHORT } from '../../domain/workouts'
import { backupPlainText, backupText, buildBackup, downloadText, importBackup, parseBackupText } from '../../storage/backup'
import { defaultConfig } from '../../storage/db'
import { saveConfig } from '../../storage/repo'
import type { ConfigRow, Theme } from '../../storage/types'
import { CycleRing, useToast } from '../components'
import { useConfig } from '../data'

const THEMES: Array<[Theme, string]> = [
  ['auto', 'Системная'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
]

export function CycleScreen() {
  const toast = useToast()
  const config = useConfig()
  const today = todayStr()
  const [copyText, setCopyText] = useState<string | null>(null)

  // Пока запись настроек не создана (база недоступна) — показываем значения по умолчанию,
  // любое изменение создаст запись через saveConfig.
  const cfg: ConfigRow = config ?? { ...defaultConfig(), updatedAt: '' }

  const starts = cfg.periodStarts
  const last = starts.length ? starts[starts.length - 1] : ''
  const ci = cycleInfo(cfg, today)
  const avg = averageCycleLen(starts)
  const storageOk = typeof indexedDB !== 'undefined'

  const setStart = (value: string): void => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
    if (value > today) {
      toast('Дата не может быть в будущем')
      return
    }
    const next = starts.length ? [...starts.slice(0, -1), value] : [value]
    void saveConfig({ periodStarts: next })
  }

  const markToday = (): void => {
    const next = starts.includes(today) ? starts : [...starts, today]
    void saveConfig({ periodStarts: next })
    toast('Отмечено: день 1 цикла')
  }

  const removeStart = (value: string): void => {
    void saveConfig({ periodStarts: starts.filter((s) => s !== value) })
  }

  const doExport = async (): Promise<void> => {
    try {
      const file = await buildBackup()
      downloadText('trenirovki-kopiya-' + today + '.json', backupText(file), 'application/json')
      toast('Копия сохранена в загрузки')
    } catch {
      toast('Не удалось создать файл — используйте «Скопировать текстом»')
    }
  }

  const doCopy = async (): Promise<void> => {
    const file = await buildBackup()
    const text = backupPlainText(file)
    try {
      await navigator.clipboard.writeText(text)
      setCopyText(null)
      toast('Скопировано. Вставьте в заметки или сообщение себе')
    } catch {
      setCopyText(text)
      toast('Выделите текст и скопируйте')
    }
  }

  const doImport = async (file: File): Promise<void> => {
    const text = await file.text()
    const res = parseBackupText(text)
    if (!res.ok) {
      toast(res.error)
      return
    }
    const { added } = await importBackup(res.file)
    toast('Загружено записей: ' + added)
  }

  const storeTxt = storageOk
    ? 'Все записи хранятся только в памяти этого браузера на этом телефоне и никуда не отправляются. Если очистить данные сайтов или сменить браузер, они пропадут — поэтому иногда делайте копию.'
    : 'Браузер не разрешает сохранять данные для этой страницы (например, режим приватного просмотра). Записи пропадут после закрытия. Откройте приложение в обычной вкладке или делайте копию после каждой тренировки.'

  return (
    <main className="screen">
      <h1>Цикл</h1>

      <div className="field">
        <label htmlFor="cfgStart">Начало последней менструации</label>
        <input id="cfgStart" type="date" value={last} max={today} onChange={(e) => setStart(e.target.value)} />
      </div>
      <p className="muted small">Если менструация началась в другой день — поправьте.</p>

      <div className="row2">
        <div className="field">
          <label htmlFor="cfgL">Длина цикла, дней</label>
          <input
            id="cfgL"
            type="number"
            min={20}
            max={45}
            inputMode="numeric"
            value={cfg.cycleLen}
            onChange={(e) => void saveConfig({ cycleLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="cfgP">Менструация, дней</label>
          <input
            id="cfgP"
            type="number"
            min={2}
            max={9}
            inputMode="numeric"
            value={cfg.periodLen}
            onChange={(e) => void saveConfig({ periodLen: Number(e.target.value) })}
          />
        </div>
      </div>

      <button type="button" className="btn ghost" onClick={markToday}>
        Менструация началась сегодня
      </button>
      <p className="muted small">
        Отмечайте начало каждой менструации: после 40 лет длина цикла может меняться, и программа будет пересчитывать фазы по
        факту.
      </p>

      {ci.ok && (
        <>
          <h2>Текущий цикл</h2>
          <section className="cycle-hero">
            <CycleRing day={ci.day} L={ci.L} P={ci.P} small />
            <div className="cycle-hero-text">
              <p className="phase-name" style={{ color: PHASES[ci.phase].color }}>
                {PHASES[ci.phase].name}
              </p>
              <span className={`mode-chip mode-${ci.mode}`}>{MODES[ci.mode].label}</span>
              <p className="muted small" style={{ marginTop: 6 }}>
                День {ci.day} из {ci.L} · {PHASE_SHORT[ci.phase]}
              </p>
            </div>
          </section>
          <table className="ptable">
            <tbody>
              {phaseRanges(cfg.cycleLen, cfg.periodLen).map((r) => {
                const from = addDays(ci.cycleStart, r.from - 1)
                const to = addDays(ci.cycleStart, r.to - 1)
                const cur = ci.day >= r.from && ci.day <= r.to
                return (
                  <tr key={r.phase + r.from} style={cur ? { fontWeight: 600 } : undefined}>
                    <td>
                      <span className="dot" style={{ background: PHASES[r.phase].color }} />
                      {PHASES[r.phase].name}
                      <div className="muted small" style={{ fontWeight: 400 }}>
                        {PHASE_ADVICE[r.phase]}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {fmtShort(from)}–{fmtShort(to)}
                      <div className="muted small" style={{ fontWeight: 400 }}>
                        дни {r.from}–{r.to}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted small" style={{ marginTop: 8 }}>
            Следующая менструация ожидается около {fmtShort(ci.nextStart)}.
          </p>
        </>
      )}
      {!ci.ok && <div className="note">{ci.error}</div>}

      {starts.length > 1 && (
        <>
          <h3>Отмеченные начала</h3>
          <ul className="starts">
            {[...starts].reverse().map((s, i) => (
              <li key={s}>
                <span>
                  {fmtShort(s)}.{s.slice(0, 4)}
                </span>
                {i > 0 ? (
                  <button type="button" className="linkbtn" onClick={() => removeStart(s)}>
                    Удалить
                  </button>
                ) : (
                  <span className="muted small">последнее</span>
                )}
              </li>
            ))}
          </ul>
          {avg !== null && avg !== cfg.cycleLen && (
            <p className="small">
              Средняя длина по отметкам: {avg} дн.{' '}
              <button type="button" className="linkbtn" onClick={() => void saveConfig({ cycleLen: avg })}>
                Применить
              </button>
            </p>
          )}
        </>
      )}

      <div className="label">Тема оформления</div>
      <div className="seg" role="group" aria-label="Тема оформления">
        {THEMES.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={cfg.theme === k} onClick={() => void saveConfig({ theme: k })}>
            {l}
          </button>
        ))}
      </div>

      <h2>Настройки прогрессии</h2>
      <p className="muted small">Шаг прибавки веса для каждого упражнения. В окне прогресса вес прибавляется на этот шаг.</p>
      <div className="steps">
        {ALL_EXERCISES.map((e) => (
          <div className="step-row" key={e.id}>
            <span className="step-name">{e.name}</span>
            {e.kind === 'band' ? (
              <span className="muted small step-note">тоньше</span>
            ) : (
              <>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  aria-label={`Шаг прибавки, ${e.name}`}
                  value={cfg.steps?.[e.id] ?? DEFAULT_STEPS[e.id] ?? 0}
                  onChange={(ev) => void saveConfig({ steps: { ...cfg.steps, [e.id]: Number(ev.target.value) } })}
                />
                <span className="muted small step-note">кг</span>
              </>
            )}
          </div>
        ))}
      </div>

      <h2>Резервная копия</h2>
      <div className="note">{storeTxt}</div>
      <button type="button" className="btn ghost" onClick={() => void doExport()}>
        Сохранить копию в файл
      </button>
      <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => void doCopy()}>
        Скопировать текстом
      </button>
      <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => document.getElementById('bkfile')?.click()}>
        Загрузить копию из файла
      </button>
      <input
        type="file"
        id="bkfile"
        accept=".json,application/json,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void doImport(f)
        }}
      />
      {copyText !== null && (
        <div className="field">
          <label htmlFor="bk">Текст копии</label>
          <textarea id="bk" readOnly value={copyText} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </main>
  )
}

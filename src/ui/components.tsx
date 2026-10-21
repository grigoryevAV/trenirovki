/** Общие элементы интерфейса: иконки, уведомления, кольцо цикла, график веса. */
import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react'
import { phaseForDay } from '../domain/cycle'
import { fmtKg, fmtShort } from '../domain/format'
import type { Phase } from '../domain/types'
import { PHASES } from '../domain/workouts'

// ---------------------------------------------------------------- иконки

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  today: () => <svg viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><circle cx="12" cy="15" r="2" /></svg>,
  history: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>,
  cycle: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8" /><path d="M12 4v3M20 12h-3M12 20v-3M4 12h3" /></svg>,
  tech: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  sun: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: () => <svg viewBox="0 0 24 24" {...P}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>,
}

// ---------------------------------------------------------------- уведомления

const ToastCtx = createContext<(msg: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------------------------------------------------------------- кольцо цикла

/** Кольцо-диаграмма дня цикла: сегменты по фазам, отметка текущего дня. */
export function CycleRing({ day, L, P }: { day: number; L: number; P: number }) {
  const cx = 74
  const cy = 74
  const r = 60
  const sw = 14
  const pt = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const step = (2 * Math.PI) / L
  const gap = Math.min(0.035, step * 0.18)
  const segs = []
  for (let d = 1; d <= L; d++) {
    const a0 = -Math.PI / 2 + (d - 1) * step + gap / 2
    const a1 = -Math.PI / 2 + d * step - gap / 2
    const [x0, y0] = pt(a0)
    const [x1, y1] = pt(a1)
    const past = d < Math.min(day, L + 1)
    const cur = d === day
    segs.push(
      <path
        key={d}
        d={`M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
        stroke={PHASES[phaseForDay(d, L, P)].color}
        strokeWidth={cur ? sw + 6 : sw}
        fill="none"
        opacity={cur ? 1 : past ? 0.45 : 0.9}
      />,
    )
  }
  const md = Math.min(day, L)
  const am = -Math.PI / 2 + (md - 0.5) * step
  const mx = cx + (r + sw / 2 + 7) * Math.cos(am)
  const my = cy + (r + sw / 2 + 7) * Math.sin(am)
  return (
    <svg className="ring" viewBox="0 0 148 148" role="img" aria-label={`День цикла ${day} из ${L}`}>
      {segs}
      <circle cx={mx.toFixed(2)} cy={my.toFixed(2)} r="4.5" fill="var(--ink)" />
      <text x="74" y="62" textAnchor="middle" fontSize="12" style={{ fill: 'var(--muted)' }}>день</text>
      <text x="74" y="92" textAnchor="middle" fontSize="36" fontWeight="800">{day}</text>
      <text x="74" y="108" textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>из {L}</text>
    </svg>
  )
}

// ---------------------------------------------------------------- график веса

export interface WeightPoint {
  date: string
  w: number
  phase: Phase | null
}

/** График рабочего веса по упражнению: точки окрашены цветом фазы. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return <p className="muted small" style={{ margin: '6px 2px' }}>График появится после двух тренировок с этим упражнением.</p>
  }
  const Wd = 340
  const H = 150
  const pl = 34
  const pr = 10
  const ptm = 12
  const pb = 24
  const ws = points.map((p) => p.w)
  let lo = Math.min(...ws)
  let hi = Math.max(...ws)
  if (hi === lo) {
    hi += 2.5
    lo = Math.max(0, lo - 2.5)
  }
  const x = (i: number) => pl + (Wd - pl - pr) * (points.length === 1 ? 0.5 : i / (points.length - 1))
  const y = (v: number) => ptm + (H - ptm - pb) * (1 - (v - lo) / (hi - lo))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.w).toFixed(1)}`).join(' ')
  const dots = points.map((p, i) => (
    <circle key={i} cx={x(i).toFixed(1)} cy={y(p.w).toFixed(1)} r="4" fill={p.phase && PHASES[p.phase] ? PHASES[p.phase].color : 'var(--ink)'} />
  ))
  const labels = [0, points.length - 1].map((i) => (
    <text key={i} x={x(i).toFixed(1)} y={H - 6} textAnchor={i ? 'end' : 'start'}>{fmtShort(points[i].date)}</text>
  ))
  return (
    <>
      <svg viewBox={`0 0 ${Wd} ${H}`} role="img" aria-label="График веса">
        <line x1={pl} x2={Wd - pr} y1={y(hi)} y2={y(hi)} stroke="var(--line)" />
        <line x1={pl} x2={Wd - pr} y1={y(lo)} y2={y(lo)} stroke="var(--line)" />
        <text x={pl - 6} y={y(hi) + 4} textAnchor="end">{fmtKg(hi)}</text>
        <text x={pl - 6} y={y(lo) + 4} textAnchor="end">{fmtKg(lo)}</text>
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        {dots}
        {labels}
      </svg>
      <p className="muted small" style={{ margin: '6px 2px 0' }}>Цвет точки — фаза цикла в день тренировки.</p>
    </>
  )
}

// ---------------------------------------------------------------- обновление приложения

type UpdateListener = () => void
let updateListener: UpdateListener | null = null
let updateFn: ((reload?: boolean) => Promise<void>) | null = null

/** Регистрирует слушателя «появилась новая версия». */
export function onUpdateAvailable(cb: UpdateListener): () => void {
  updateListener = cb
  return () => {
    if (updateListener === cb) updateListener = null
  }
}

/** Сообщает приложению, что service worker предлагает обновление. */
export function notifyUpdateAvailable(): void {
  updateListener?.()
}

/** Сохраняет функцию обновления service worker. */
export function setUpdateFunction(fn: (reload?: boolean) => Promise<void>): void {
  updateFn = fn
}

/** Применяет обновление: новая версия подхватывается и страница перезагружается. */
export function applyUpdate(): void {
  void updateFn?.(true)
}

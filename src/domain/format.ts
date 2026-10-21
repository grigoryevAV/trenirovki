/** Форматирование дат и чисел — как в эталоне. */
export const pad = (n: number): string => String(n).padStart(2, '0')

/** Дата в формате YYYY-MM-DD по местному времени. */
export const ymd = (d: Date): string => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())

/** Разбор YYYY-MM-DD в локальную дату (полдень — чтобы не «съезжал» день). */
export const parseD = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** Разница в днях между двумя датами YYYY-MM-DD (a - b). */
export const diffDays = (a: string, b: string): number => Math.round((parseD(a).getTime() - parseD(b).getTime()) / 864e5)

/** Дата YYYY-MM-DD через n дней. */
export const addDays = (s: string, n: number): string => {
  const d = parseD(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Сегодняшняя дата YYYY-MM-DD. */
export const todayStr = (): string => ymd(new Date())

/** Короткая дата: «21.10». */
export const fmtShort = (s: string): string => {
  const d = parseD(s)
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1)
}

export const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** Длинная дата: «среда, 21 октября». */
export const fmtLong = (s: string): string => parseD(s).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

/** Число из строки (запятая или точка). Некорректное значение — 0. */
export const num = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Вес с запятой: 12,5. */
export const fmtKg = (v: unknown): string => String(Math.round(num(v) * 100) / 100).replace('.', ',')

/** YYYY-MM-DD? */
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

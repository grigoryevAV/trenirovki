/** Общие типы приложения «Тренировки». Логика — 1:1 с эталоном (reference/Trenirovki_dnevnik_1.html). */

/** Тип тренировки: А или Б. */
export type WorkoutType = 'A' | 'B'

/** Тип нагрузки: штанга, гантели, доп. вес, резинка. */
export type LoadKind = 'bar' | 'db' | 'bw' | 'band'

/** Фаза цикла. */
export type Phase = 'men' | 'fol' | 'ovu' | 'lut' | 'pms' | 'late'

/** Режим тренировки, зависящий от фазы и самочувствия. */
export type Mode = 'progress' | 'hold' | 'light'

/** Самочувствие: хорошо / нормально / плохо. */
export type Feel = 'good' | 'ok' | 'bad'

export interface ExerciseDef {
  id: string
  /** Номер упражнения в тренировке: «1», «2а», «2б»… */
  n: string
  name: string
  sets: number
  /** Нижняя граница диапазона повторений. */
  lo: number
  /** Верхняя граница диапазона повторений. */
  hi: number
  rest: string
  kind: LoadKind
}

export interface WorkoutDef {
  title: string
  sub: string
  ex: ExerciseDef[]
}

/** Один подход в записанной тренировке. Для резинки w — строка («цвет/сила»), иначе — число (кг). */
export interface SetEntry {
  w: number | string
  r: number
}

/** Сохранённая тренировка. Формат совпадает с эталоном (нужен для переноса записей). */
export interface Session {
  id: string
  /** YYYY-MM-DD */
  date: string
  ts: number
  type: WorkoutType
  /** День цикла в момент тренировки (null — цикл не настроен). */
  cycleDay: number | null
  phase: Phase | null
  mode: Mode
  feel: Feel
  note: string
  /** Подходы по id упражнения. */
  ex: Record<string, SetEntry[]>
}

/** Настройки цикла. */
export interface CycleConfig {
  /** Отмеченные начала менструации, YYYY-MM-DD, по возрастанию. */
  periodStarts: string[]
  cycleLen: number
  periodLen: number
}

/** Черновик ввода: живёт до конца дня. */
export interface DraftType {
  ex: Record<string, Array<{ w?: string; r?: string }>>
  note: string
}

export interface Draft {
  /** YYYY-MM-DD — день, к которому относится черновик. */
  date: string
  feel: Feel
  A?: DraftType
  B?: DraftType
}

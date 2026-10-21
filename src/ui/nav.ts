/** Навигация по hash-маршрутам (#/today, #/history, #/cycle). */
export function go(path: string): void {
  window.location.hash = `#/${path}`
}

export function back(fallback = 'today'): void {
  if (window.history.length > 1) window.history.back()
  else go(fallback)
}

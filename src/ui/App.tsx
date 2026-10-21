import { useEffect, useState } from 'react'
import { Icon, ToastProvider, applyUpdate, onUpdateAvailable } from './components'
import { useConfig, useTheme } from './data'
import { ErrorBoundary } from './ErrorBoundary'
import { go } from './nav'
import { CycleScreen } from './screens/Cycle'
import { HistoryScreen } from './screens/History'
import { TechScreen } from './screens/Tech'
import { TodayScreen } from './screens/Today'

/** Маршрут в hash: #/today, #/history, #/cycle, #/tech. Кнопка «назад» телефона работает штатно. */
function useHashRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'today').split('/').map(decodeURIComponent)
  const [route, setRoute] = useState<string[]>(read)
  useEffect(() => {
    const on = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

const TABS = [
  { id: 'today', label: 'Сегодня', icon: Icon.today },
  { id: 'history', label: 'История', icon: Icon.history },
  { id: 'cycle', label: 'Цикл', icon: Icon.cycle },
  { id: 'tech', label: 'Техника', icon: Icon.tech },
] as const

function Screen({ route }: { route: string[] }) {
  switch (route[0]) {
    case 'history': return <HistoryScreen />
    case 'cycle': return <CycleScreen />
    case 'tech': return <TechScreen />
    default: return <TodayScreen />
  }
}

export function App() {
  const route = useHashRoute()
  const config = useConfig()
  useTheme(config)
  const [update, setUpdate] = useState(false)
  useEffect(() => onUpdateAvailable(() => setUpdate(true)), [])

  return (
    <ToastProvider>
      {update && (
        <div className="banner" role="status">
          <span>Доступна новая версия — обновить?</span>
          <button type="button" onClick={applyUpdate}>Обновить</button>
          <button type="button" onClick={() => setUpdate(false)}>Позже</button>
        </div>
      )}
      <div className="app">
        <ErrorBoundary
          title="Не удалось открыть базу данных"
          text="Приложение не смогло запуститься: браузер не даёт доступ к локальному хранилищу (например, приватный режим). Данные не пострадали — откройте приложение в обычном окне."
        >
          <Screen route={route} />
        </ErrorBoundary>
      </div>
      <nav className="nav" aria-label="Разделы">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.id} aria-current={route[0] === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <t.icon />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </ToastProvider>
  )
}

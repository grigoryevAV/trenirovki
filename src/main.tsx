import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ensureConfig, requestPersistence } from './storage/db'
import { App } from './ui/App'
import { notifyUpdateAvailable, setUpdateFunction } from './ui/components'
import './ui/styles.css'

// Запись настроек по умолчанию создаётся ДО рендера: внутри useLiveQuery писать нельзя
// (Dexie: ReadOnlyError → приложение показывает белый экран).
// Если база недоступна или зависла — ждём не дольше 2 секунд и всё равно показываем приложение
// (ошибку отрисовки перехватит ErrorBoundary).
async function bootstrap(): Promise<void> {
  try {
    await Promise.race([
      ensureConfig(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
  } catch {
    /* База недоступна (например, приватный режим) — приложение откроется с пустыми настройками. */
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  void requestPersistence()
}

void bootstrap()

// Офлайн-работа: service worker кэширует приложение после первого открытия.
// registerType: 'prompt' — новая версия не применяется молча, а по баннеру в приложении.
const updateSW = registerSW({
  onNeedRefresh() {
    notifyUpdateAvailable()
  },
})
setUpdateFunction(updateSW)

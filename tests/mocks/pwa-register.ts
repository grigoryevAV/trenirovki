/** Заглушка service worker для тестов: настоящий модуль доступен только при сборке vite-plugin-pwa. */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {
    /* в тестах обновление не применяется */
  }
}

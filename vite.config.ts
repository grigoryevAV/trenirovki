import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// base: './' — сборка работает из любой подпапки статического хостинга (GitHub Pages и т. п.)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Тренировки',
        short_name: 'Тренировки',
        description: 'Дневник тренировок с учётом цикла: тренировки А и Б, фазы цикла, рекомендации по весу',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F3F2F7',
        theme_color: '#3B2F80',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // virtual:pwa-register существует только при сборке vite-plugin-pwa — в тестах подменяем заглушкой
    alias: {
      'virtual:pwa-register': fileURLToPath(new URL('./tests/mocks/pwa-register.ts', import.meta.url)),
    },
  },
})

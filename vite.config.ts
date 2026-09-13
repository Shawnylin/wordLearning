import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { articleReaderMiddleware } from './server/article-reader.mjs'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/wordLearning/',
  plugins: [
    { name: 'article-reader', configureServer(server) { server.middlewares.use(articleReaderMiddleware) }, configurePreviewServer(server) { server.middlewares.use(articleReaderMiddleware) } },
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: '成语学习 - 公考必备',
        short_name: '成语学习',
        description: '公务员考试成语/词语学习工具',
        theme_color: '#faf9f5',
        background_color: '#faf9f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/wordLearning/',
        scope: '/wordLearning/',
        lang: 'zh-CN',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const store = await readFile(new URL('../src/stores/appUpdate.ts', import.meta.url), 'utf8')
const prompt = await readFile(new URL('../src/components/AppUpdatePrompt.vue', import.meta.url), 'utf8')
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8')
const serviceWorker = await readFile(new URL('../src/sw.ts', import.meta.url), 'utf8')

test('update lifecycle uses prompt registration and registration.update', () => {
  assert.match(store, /registerSW\(\{/)
  assert.match(store, /onNeedRefresh\(\)/)
  assert.match(store, /await registration\.update\(\)/)
  assert.match(store, /waitingWorker\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/)
  assert.match(store, /controllerchange/)
  assert.match(store, /window\.location\.reload\(\)/)
})

test('update UI contains the required safe copy and actions', () => {
  assert.match(prompt, /发现新版本/)
  assert.match(prompt, /更新不会清除你的学习记录和本地设置/)
  assert.match(prompt, /立即更新/)
  assert.match(prompt, /稍后/)
  assert.match(prompt, /update-sheet-enter-from/)
  assert.match(prompt, /env\(safe-area-inset-bottom\)/)
  assert.match(prompt, /border-radius: 34px/)
})

test('update reload is bridged by leave and reveal transitions', () => {
  assert.match(store, /app-update-transition/)
  assert.match(store, /app-update-leaving/)
})

test('PWA keeps prompt mode and GitHub Pages base path', () => {
  assert.match(vite, /base: ['"]\/wordLearning\/['"]/)
  assert.match(vite, /registerType: ['"]prompt['"]/)
  assert.match(vite, /strategies: ['"]injectManifest['"]/)
  assert.match(vite, /filename: ['"]sw\.ts['"]/)
})

test('service worker removes CloudBase download headers from app-shell responses', () => {
  assert.match(serviceWorker, /content-disposition/)
  assert.match(serviceWorker, /headers\.delete\('content-disposition'\)/)
  assert.match(serviceWorker, /cacheWillUpdate/)
  assert.match(serviceWorker, /handlerWillRespond/)
  assert.match(serviceWorker, /SKIP_WAITING/)
})

test('update flow never clears browser data', () => {
  assert.doesNotMatch(store, /localStorage\.clear|sessionStorage\.clear|deleteDatabase|caches\.keys/)
})

import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'
const file = new URL('./.daily-store-test.tmp.mjs', import.meta.url)
const compiled = await build({ stdin: { contents: "export { useIdiomStore } from './src/stores/idiom'; export { useDailyStore } from './src/stores/daily'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', external: ['pinia', 'vue'] })
await writeFile(file, compiled.outputFiles[0].text)
const { useIdiomStore, useDailyStore } = await import(file.href)
const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage
after(async () => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; await unlink(file) })
const config = { apiKey: '', model: 'test', baseUrl: 'https://example.test/v1' }
test('cached word restores deleted history without key or another API generation', async () => {
  setActivePinia(createPinia()); const store = useIdiomStore()
  store.idiomCache['因地制宜'] = { id: 'cached', word: '因地制宜', explanation: '原有完整释义', createdAt: 1 }
  store.idiomError = 'old error'
  globalThis.fetch = async () => { throw new Error('cache must not call API') }
  await store.searchIdiom('因地制宜', config)
  await store.searchIdiom('因地制宜', config)
  assert.equal(store.currentIdiom.explanation, '原有完整释义')
  assert.equal(store.searchHistory.length, 1); assert.equal(store.queryCounts['因地制宜'], 2)
  assert.equal(store.idiomError, ''); assert.equal(store.tokenStats.requestCount, 0)
})
test('daily persists before success and protects existing history when storage is full', async () => {
  setActivePinia(createPinia()); const daily = useDailyStore()
  const article = { title: '测试', source: '人民日报', url: 'https://people.com.cn/test.html', publishedAt: new Date(Date.now() + 28800000).toISOString().slice(0, 10), content: '因地制宜，协同发展。'.repeat(15), words: ['因地制宜', '协同发展'], analysis: '学习提示' }
  globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ type: 'web_search_call', status: 'completed', action: { sources: [{ url: article.url }] } }, { content: [{ type: 'output_text', text: JSON.stringify({ articles: [article] }) }] }] })
  let saved
  globalThis.localStorage = { setItem: (_, value) => { saved = JSON.parse(value) } }
  await daily.generate({ ...config, apiKey: 'test' })
  assert.equal(daily.issues.length, 1); assert.equal(saved.selectedId, daily.selectedId)
  const previous = daily.selectedId
  article.url = 'https://people.com.cn/second.html'
  globalThis.localStorage = { setItem: () => { throw new Error('quota exceeded') } }
  await daily.generate({ ...config, apiKey: 'test' })
  assert.equal(daily.issues.length, 1); assert.equal(daily.selectedId, previous); assert.match(daily.error, /quota/); assert.equal(daily.loading, false)
})

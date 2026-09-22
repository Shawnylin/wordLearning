import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'
const file = new URL('./.daily-store-test.tmp.mjs', import.meta.url)
const compiled = await build({ stdin: { contents: "export { useIdiomStore } from './src/stores/idiom'; export { useDailyStore } from './src/stores/daily'; export { useReviewStore } from './src/stores/review'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', external: ['pinia', 'vue'] })
await writeFile(file, compiled.outputFiles[0].text)
const { useIdiomStore, useDailyStore, useReviewStore } = await import(file.href)
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

test('failed daily generation records paid usage once without saving an issue', async () => {
  setActivePinia(createPinia())
  const daily = useDailyStore(), idioms = useIdiomStore()
  globalThis.fetch = async () => Response.json({ status: 'incomplete', usage: { total_tokens: 321 }, output: [] })
  await daily.generate({ ...config, apiKey: 'test' })
  assert.equal(daily.issues.length, 0)
  assert.match(daily.error, /321 tokens/)
  assert.equal(idioms.tokenStats.totalTokens, 321)
  assert.equal(idioms.tokenStats.requestCount, 1)
  assert.equal(daily.loading, false)
})

test('link generation saves the card through the same history and usage path', async () => {
  setActivePinia(createPinia())
  const daily = useDailyStore(), idioms = useIdiomStore()
  const url = 'https://news.example.com/article'
  const content = '因地制宜，推动协同发展。'.repeat(15)
  let calls = 0, saved
  globalThis.localStorage = { setItem: (_, value) => { saved = JSON.parse(value) } }
  globalThis.fetch = async target => {
    if (target === url) throw new TypeError('CORS')
    calls++
    if (String(target).startsWith('https://r.jina.ai/')) return new Response(`Title: 链接精读\nMarkdown Content:\n${content}`)
    return Response.json({ choices: [{ message: { content: JSON.stringify({ articles: [{ title: '链接精读', publishedAt: '', content, words: ['因地制宜'], analysis: '关注搭配。' }] }) }, finish_reason: 'stop' }], usage: { total_tokens: 123 } })
  }
  await daily.generate({ ...config, apiKey: 'test' }, url)
  assert.equal(daily.error, ''); assert.equal(daily.issues.length, 1)
  assert.equal(saved.issues[0].articles[0].origin, 'link')
  assert.equal(daily.selectedId, saved.selectedId); assert.equal(idioms.tokenStats.totalTokens, 123)
  await daily.generate({ ...config, apiKey: 'test' }, url)
  assert.match(daily.error, /已收录/); assert.equal(calls, 2); assert.equal(idioms.tokenStats.totalTokens, 123)
})

test('history groups migrate, rename, collapse and move issues without changing article content', () => {
  setActivePinia(createPinia())
  const store = useDailyStore()
  globalThis.localStorage = { setItem: () => {} }
  const first = { id: 'a', createdAt: Date.UTC(2026, 8, 15), tokenUsage: 0, articles: [{ title: '甲', source: '导入 PDF', url: '', publishedAt: '', content: '原文甲', words: [], analysis: '', origin: 'pdf', page: 1 }], pdf: { fingerprint: 'a'.repeat(64), filename: 'rmrb-20260915.pdf', pages: 1, remainder: '', model: 'test', usageEstimated: false, editionDate: '2026-09-15' } }
  const second = { ...structuredClone(first), id: 'b', articles: [{ ...first.articles[0], title: '乙', content: '原文乙' }] }
  store.issues = [first, second]
  store.ensureGroups()
  assert.equal(store.groups.length, 1)
  assert.equal(store.groups[0].name, '2026年9月15日 人民日报')
  store.renameGroup(store.groups[0].id, '自定义日报')
  store.toggleGroup(store.groups[0].id)
  store.groups.push({ id: 'manual', name: '稍后整理', collapsed: false, createdAt: Date.now() })
  store.moveIssue('b', 'manual')
  assert.equal(store.groups[0].name, '自定义日报')
  assert.equal(store.groups[0].collapsed, true)
  assert.equal(store.issues.find(issue => issue.id === 'b').groupId, 'manual')
  assert.equal(store.issues[1].articles[0].content, '原文乙')
})

test('daily deletion keeps shared idiom/review data intact for PDF and link articles and sync serialization', () => {
  setActivePinia(createPinia())
  const daily = useDailyStore(), idioms = useIdiomStore(), review = useReviewStore()
  globalThis.localStorage = { setItem: () => {} }
  const pdfArticle = { title: 'PDF 原文', source: '导入 PDF', url: '', publishedAt: '', content: '因地制宜推进发展。'.repeat(12), words: ['因地制宜'], analysis: '', origin: 'pdf', page: 1 }
  const linkArticle = { title: '链接原文', source: '示例媒体', url: 'https://news.example.com/a', publishedAt: '', content: '守正创新推动发展。'.repeat(12), words: ['守正创新'], analysis: '', origin: 'link' }
  daily.issues = [
    { id: 'pdf', createdAt: 1, tokenUsage: 0, articles: [pdfArticle] },
    { id: 'link', createdAt: 2, tokenUsage: 0, articles: [linkArticle] },
  ]
  daily.selectedId = 'pdf'
  idioms.idiomCache['因地制宜'] = { id: 'pdf-word', word: '因地制宜', pinyin: '', explanation: '释义', origin: '', example: '', usage: '', relatedIdioms: [], createdAt: 1 }
  idioms.idiomCache['守正创新'] = { id: 'link-word', word: '守正创新', pinyin: '', explanation: '释义', origin: '', example: '', usage: '', relatedIdioms: [], createdAt: 2 }
  review.ensureWord('因地制宜', 100)
  review.ensureWord('守正创新', 200)
  review.wordStats['因地制宜'] = {
    state: 'mastered', nextReviewAt: 9_999, interval: 30,
    correctCount: 8, wrongCount: 2, lastReviewedAt: 8_888,
  }

  const before = JSON.parse(JSON.stringify({
    daily: daily.exportSyncData(),
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
  }))
  assert.equal(before.daily.issues[0].articles[0].origin, 'pdf')
  assert.equal(before.daily.issues[1].articles[0].origin, 'link')
  assert.equal(before.review.wordStats['因地制宜'].state, 'mastered')
  assert.equal(Object.keys(before.idiom.idiomCache).length, 2)

  daily.deleteIssue('pdf')
  const after = JSON.parse(JSON.stringify({
    daily: daily.exportSyncData(),
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
  }))
  assert.deepEqual(after.daily.issues.map(issue => issue.id), ['link'])
  assert.equal(after.daily.issues[0].articles[0].content, linkArticle.content)
  assert.deepEqual(Object.keys(after.idiom.idiomCache).sort(), ['因地制宜', '守正创新'].sort())
  assert.equal(after.review.wordStats['因地制宜'].state, 'mastered')
  assert.equal(after.review.wordStats['因地制宜'].correctCount, 8)
  assert.equal(after.review.wordStats['守正创新'].state, 'new')
})

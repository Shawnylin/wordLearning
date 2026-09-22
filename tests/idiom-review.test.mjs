import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'

const file = new URL('./.idiom-review-test.tmp.mjs', import.meta.url)
const compiled = await build({
  stdin: {
    contents: "export { useIdiomStore } from './src/stores/idiom'; export { useReviewStore } from './src/stores/review'; export { useStatisticsStore } from './src/stores/statistics'",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  external: ['pinia', 'vue'],
})
await writeFile(file, compiled.outputFiles[0].text)
const { useIdiomStore, useReviewStore, useStatisticsStore } = await import(file.href)

const originalFetch = globalThis.fetch
after(async () => {
  globalThis.fetch = originalFetch
  await unlink(file)
})

const config = {
  apiKey: 'test-key',
  model: 'test-model',
  baseUrl: 'https://example.test/v1',
}
const card = word => ({
  pinyin: 'cè shì',
  explanation: `${word}的完整释义`,
  origin: '测试出处',
  example: `${word}测试例句`,
  usage: '测试用法',
  relatedIdioms: ['相关一', '相关二', '相关三'],
})
const cachedCard = word => ({
  id: `cached-${word}`,
  word,
  ...card(word),
  createdAt: 1,
})

function successSse(word, tokenUsage = 80) {
  const content = JSON.stringify(card(word))
  const event = {
    choices: [{ delta: { content }, finish_reason: 'stop' }],
    usage: { total_tokens: tokenUsage },
  }
  return new Response(
    `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

function incompleteSse() {
  const content = JSON.stringify({ explanation: '只有部分内容' })
  const event = {
    choices: [{ delta: { content }, finish_reason: 'stop' }],
    usage: { total_tokens: 12 },
  }
  return new Response(
    `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

test('first successful learning creates exactly one review item without changing token behavior', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const statistics = useStatisticsStore()
  globalThis.fetch = async () => successSse('因地制宜')

  const result = await idiom.searchIdiom('因地制宜', config)

  assert.equal(result?.word, '因地制宜')
  assert.equal(Object.keys(review.wordStats).length, 1)
  assert.deepEqual(review.wordStats['因地制宜'], {
    state: 'new',
    nextReviewAt: review.wordStats['因地制宜'].nextReviewAt,
    interval: 0,
    correctCount: 0,
    wrongCount: 0,
    lastReviewedAt: 0,
  })
  assert(review.wordStats['因地制宜'].nextReviewAt > 0)
  assert.deepEqual(idiom.tokenStats, { totalTokens: 80, requestCount: 1 })
  assert.equal(idiom.searchHistory.length, 1)
  assert.equal(statistics.activities.length, 1)
  assert.equal(statistics.activities[0].type, 'learn')
  assert.equal(statistics.activities[0].word, '因地制宜')
  assert.equal(statistics.tokenUsage.length, 1)
  assert.equal(statistics.tokenUsage[0].tokens, 80)
  assert.equal(statistics.tokenUsage[0].source, 'idiom')
})

test('repeated learning and cache hits never duplicate or reset review progress', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const statistics = useStatisticsStore()
  globalThis.fetch = async () => successSse('久久为功')

  await idiom.searchIdiom('久久为功', config)
  review.wordStats['久久为功'] = {
    state: 'review',
    nextReviewAt: 99_999,
    interval: 12,
    correctCount: 4,
    wrongCount: 2,
    lastReviewedAt: 88_888,
  }
  const before = { ...review.wordStats['久久为功'] }
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls++
    throw new Error('cache hit must not request network')
  }

  await idiom.searchIdiom('久久为功', config)
  await idiom.searchIdiom('久久为功', config)

  assert.deepEqual(review.wordStats['久久为功'], before)
  assert.equal(Object.keys(review.wordStats).length, 1)
  assert.equal(networkCalls, 0)
  assert.equal(idiom.searchHistory.length, 1)
  assert.equal(idiom.queryCounts['久久为功'], 3)
  assert.deepEqual(idiom.tokenStats, { totalTokens: 80, requestCount: 1 })
  assert.equal(statistics.activities.length, 1)
  assert.equal(statistics.tokenUsage.length, 1)
})

test('API failure, cancellation and incomplete output never create review items', async () => {
  for (const scenario of ['failure', 'cancel', 'incomplete']) {
    setActivePinia(createPinia())
    const idiom = useIdiomStore()
    const review = useReviewStore()
    const statistics = useStatisticsStore()
    if (scenario === 'failure') {
      globalThis.fetch = async () => Response.json(
        { error: { message: 'server failed' } },
        { status: 500 },
      )
    } else if (scenario === 'cancel') {
      globalThis.fetch = async () => {
        throw new DOMException('cancelled', 'AbortError')
      }
    } else {
      globalThis.fetch = async () => incompleteSse()
    }

    const result = await idiom.searchIdiom(`失败词-${scenario}`, config)
    assert.equal(result, null)
    assert.deepEqual(review.wordStats, {})
    assert.equal(Object.keys(idiom.idiomCache).length, 0)
    assert.equal(statistics.activities.length, 0)
  }
})

test('cached learning content backfills a missing review item without an API call', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const statistics = useStatisticsStore()
  idiom.idiomCache['守正创新'] = cachedCard('守正创新')
  globalThis.fetch = async () => {
    throw new Error('cached content must not request network')
  }

  const result = await idiom.searchIdiom('守正创新', config)

  assert.equal(result?.id, 'cached-守正创新')
  assert.equal(review.wordStats['守正创新'].state, 'new')
  assert.equal(Object.keys(review.wordStats).length, 1)
  assert.equal(idiom.searchHistory.length, 1)
  assert.equal(statistics.activities.length, 1)
  assert.equal(statistics.tokenUsage.length, 0)
})

test('relearning a mastered word preserves mastery history and favorites remain independent', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  idiom.idiomCache['实事求是'] = cachedCard('实事求是')
  const mastered = {
    state: 'mastered',
    nextReviewAt: 999_999,
    interval: 30,
    correctCount: 8,
    wrongCount: 3,
    lastReviewedAt: 777_777,
  }
  review.wordStats['实事求是'] = structuredClone(mastered)
  idiom.toggleFavorite('实事求是')
  globalThis.fetch = async () => successSse('实事求是', 90)

  await idiom.regenerateIdiom('实事求是', config)

  assert.deepEqual(review.wordStats['实事求是'], mastered)
  assert.equal(idiom.isFavorite('实事求是'), true)
  idiom.toggleFavorite('实事求是')
  assert.equal(idiom.isFavorite('实事求是'), false)
  assert.deepEqual(review.wordStats['实事求是'], mastered)
})

test('deleting search history never deletes review progress', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const statistics = useStatisticsStore()
  globalThis.fetch = async () => successSse('循序渐进')

  await idiom.searchIdiom('循序渐进', config)
  const stat = { ...review.wordStats['循序渐进'] }
  const recordId = idiom.searchHistory[0].id

  idiom.deleteSearchRecord(recordId)
  assert.equal(idiom.searchHistory.length, 0)
  assert.deepEqual(review.wordStats['循序渐进'], stat)
  assert.equal(statistics.activities.length, 1)

  await idiom.searchIdiom('循序渐进', config)
  idiom.clearHistory()
  assert.equal(idiom.searchHistory.length, 0)
  assert.deepEqual(review.wordStats['循序渐进'], stat)
  assert.equal(statistics.activities.length, 1)
})

test('review item created by learning is included in cloud-sync serialization', async () => {
  setActivePinia(createPinia())
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const statistics = useStatisticsStore()
  globalThis.fetch = async () => successSse('知行合一', 64)

  await idiom.searchIdiom('知行合一', config)
  const serialized = JSON.parse(JSON.stringify({
    idiom: idiom.exportSyncData(),
    review: review.exportSyncData(),
    statistics: statistics.exportSyncData(),
  }))

  assert.equal(serialized.idiom.idiomCache['知行合一'].word, '知行合一')
  assert.equal(serialized.review.wordStats['知行合一'].state, 'new')
  assert.equal(serialized.review.wordStats['知行合一'].correctCount, 0)
  assert.equal(serialized.review.wordStats['知行合一'].wrongCount, 0)
  assert.equal(serialized.statistics.activities.length, 1)
  assert.equal(serialized.statistics.tokenUsage.length, 1)
})

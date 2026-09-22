import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('../src/services/cloudSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const statisticsSource = ts.transpileModule(readFileSync(new URL('../src/services/learningStatistics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const statisticsExports = {}
new Function('require', 'exports', statisticsSource)(name => {
  throw new Error(`Unexpected dependency in learning statistics merge: ${name}`)
}, statisticsExports)
const exports = {}
// Exercise the real merge functions; pure statistics helpers are allowed, stores or CloudBase are not.
new Function('require', 'exports', source)(name => {
  if (name === './learningStatistics') return statisticsExports
  return new Proxy({}, { get() { throw new Error(`Unexpected dependency in merge: ${name}`) } })
}, exports)
const { mergeSyncPayload, hasSameSyncContent } = exports
const snapshot = () => ({ version: 2, capturedAt: 1,
  profile: { name: '本机', nameUpdatedAt: 10, avatarDataUrl: 'local-avatar', avatarUpdatedAt: 30 },
  idiom: { idiomCache: {}, searchHistory: [], compareCache: {}, compareHistory: [], tokenStats: { totalTokens: 10, requestCount: 1 }, favorites: [], queryCounts: {} },
  daily: { issues: [], groups: [], selectedId: '' },
  review: { phase: 'idle', queue: [], done: [], levels: {}, thresholds: {}, wrongToday: {}, history: [], target: 10, startedAt: 0, elapsedMs: 0, lastResult: null, finishedToday: 0, lastFinishedDay: '', wordStats: {} },
})
test('repeated cloud merge keeps one review item and never downgrades newer mastery', () => {
  const local = snapshot(), remote = snapshot()
  local.review.wordStats = {
    甲: { state: 'review', nextReviewAt: 500, interval: 12, correctCount: 4, wrongCount: 6, lastReviewedAt: 100 }
  }
  remote.review.wordStats = {
    甲: { state: 'mastered', nextReviewAt: 5_000, interval: 30, correctCount: 8, wrongCount: 2, lastReviewedAt: 200 }
  }

  const once = mergeSyncPayload(local, remote)
  const twice = mergeSyncPayload(once, remote)

  assert.deepEqual(Object.keys(once.review.wordStats), ['甲'])
  assert.deepEqual(Object.keys(twice.review.wordStats), ['甲'])
  assert.deepEqual(twice.review.wordStats.甲, {
    state: 'mastered', nextReviewAt: 5_000, interval: 30,
    correctCount: 8, wrongCount: 6, lastReviewedAt: 200
  })
  assert(hasSameSyncContent(once, twice))
})

test('cloud merge preserves both devices, resolves fields independently, and is idempotent without mutating inputs', () => {
  const local = snapshot(), remote = snapshot()
  local.idiom.idiomCache = { shared: { word: '旧词义', createdAt: 10 }, localOnly: { word: '本机独有', createdAt: 10 } }
  remote.idiom.idiomCache = { shared: { word: '新词义', createdAt: 20 }, remoteOnly: { word: '云端独有', createdAt: 10 } }
  local.idiom.favorites = ['甲']; remote.idiom.favorites = ['甲', '乙']
  local.idiom.queryCounts = { 甲: 5 }; remote.idiom.queryCounts = { 甲: 3, 乙: 2 }
  remote.idiom.tokenStats = { totalTokens: 20, requestCount: 2 }
  remote.profile = { name: '新名称', nameUpdatedAt: 20, avatarDataUrl: 'older-avatar', avatarUpdatedAt: 5 }
  local.daily.issues = [{ id: 'a', createdAt: 1, articles: [{ content: '原文甲' }] }]
  remote.daily.issues = [{ id: 'b', createdAt: 2, articles: [{ content: '原文乙' }] }]
  const before = structuredClone([local, remote])
  const merged = mergeSyncPayload(local, remote)
  assert.equal(merged.idiom.idiomCache.shared.word, '新词义')
  assert.equal(Object.keys(merged.idiom.idiomCache).length, 3)
  assert.deepEqual(merged.idiom.favorites, ['甲', '乙'])
  assert.deepEqual(merged.idiom.queryCounts, { 甲: 5, 乙: 2 })
  assert.deepEqual(merged.idiom.tokenStats, { totalTokens: 20, requestCount: 2 })
  assert.equal(merged.profile.name, '新名称'); assert.equal(merged.profile.avatarDataUrl, 'local-avatar')
  assert.deepEqual(merged.daily.issues.map(issue => issue.articles[0].content), ['原文甲', '原文乙'])
  assert.deepEqual([local, remote], before)
  assert(hasSameSyncContent(merged, mergeSyncPayload(merged, remote)))
  merged.daily.issues[0].articles[0].content = '改动合并结果'
  assert.equal(local.daily.issues[0].articles[0].content, '原文甲')
})
test('equal-time conflicts follow the selected preference; capturedAt alone is not a content change', () => {
  const local = snapshot(), remote = snapshot()
  remote.profile.name = '云端名称'
  local.daily.selectedId = 'a'; remote.daily.selectedId = 'b'
  assert.equal(mergeSyncPayload(local, remote).profile.name, '本机')
  const merged = mergeSyncPayload(local, remote, 'remote')
  assert.equal(merged.profile.name, '云端名称'); assert.equal(merged.daily.selectedId, 'b')
  assert(hasSameSyncContent(local, { ...local, capturedAt: 999 }))
  assert(!hasSameSyncContent(local, remote))
})
test('review scheduling sync accepts legacy stats and preserves the newest schedule plus maximum counters', () => {
  const local = snapshot(), remote = snapshot()
  local.review.wordStats = {
    甲: { state: 'review', nextReviewAt: 500, interval: 12, correctCount: 4, wrongCount: 1, lastReviewedAt: 100 },
    旧词: { wrong: 3, lastAt: 80 }
  }
  remote.review.wordStats = {
    甲: { state: 'learning', nextReviewAt: 900, interval: 1, correctCount: 2, wrongCount: 5, lastReviewedAt: 200 }
  }
  const merged = mergeSyncPayload(local, remote)
  assert.deepEqual(merged.review.wordStats.甲, {
    state: 'learning', nextReviewAt: 900, interval: 1,
    correctCount: 4, wrongCount: 5, lastReviewedAt: 200
  })
  assert.deepEqual(merged.review.wordStats.旧词, {
    state: 'learning', nextReviewAt: 80, interval: 0,
    correctCount: 0, wrongCount: 3, lastReviewedAt: 80
  })
})

test('cloud merge deduplicates learning statistics facts by stable id', () => {
  const local = snapshot(), remote = snapshot()
  const shared = { id: 'learn-day-word', type: 'learn', word: '甲', at: 100 }
  local.statistics = {
    version: 1,
    activities: [shared],
    reviewAnswers: [{ id: 'answer-shared', word: '甲', correct: true, at: 110 }],
    tokenUsage: [{ id: 'token-shared', at: 120, tokens: 50, source: 'idiom' }]
  }
  remote.statistics = {
    version: 1,
    activities: [shared, { id: 'review-day-word', type: 'review', word: '乙', at: 130 }],
    reviewAnswers: [
      { id: 'answer-shared', word: '甲', correct: true, at: 110 },
      { id: 'answer-remote', word: '乙', correct: false, at: 140 }
    ],
    tokenUsage: [
      { id: 'token-shared', at: 120, tokens: 50, source: 'idiom' },
      { id: 'token-remote', at: 150, tokens: 30, source: 'daily' }
    ]
  }

  const merged = mergeSyncPayload(local, remote)
  const twice = mergeSyncPayload(merged, remote)
  assert.equal(merged.statistics.activities.length, 2)
  assert.equal(merged.statistics.reviewAnswers.length, 2)
  assert.equal(merged.statistics.tokenUsage.length, 2)
  assert.deepEqual(twice.statistics, merged.statistics)
  assert(hasSameSyncContent(merged, twice))
})

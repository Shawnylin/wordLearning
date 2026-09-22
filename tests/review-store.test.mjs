import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/stores/review.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function loadReviewModule() {
  const idiomStore = { idiomCache: {} }
  const statisticsStore = {
    reviewCalls: [],
    reviewAnswers: [],
    recordReview(word, now) { this.reviewCalls.push({ word, now }) },
    recordReviewAnswer(word, correct, now) {
      const id = `answer-${this.reviewAnswers.length + 1}`
      this.reviewAnswers.push({ id, word, correct, now })
      return id
    },
    removeReviewAnswer(id) { this.reviewAnswers = this.reviewAnswers.filter(item => item.id !== id) },
    reconcileReviewDay() {},
    clearReviewEvents() { this.reviewCalls = []; this.reviewAnswers = [] },
  }
  const ref = value => ({ __kind: 'ref', value })
  const computed = getter => ({ __kind: 'computed', get value() { return getter() } })
  const defineStore = (_id, setup) => () => {
    const raw = setup()
    return new Proxy(raw, {
      get(target, key) {
        const value = target[key]
        return value?.__kind === 'ref' || value?.__kind === 'computed' ? value.value : value
      },
      set(target, key, value) {
        const current = target[key]
        if (current?.__kind === 'ref') {
          current.value = value
          return true
        }
        target[key] = value
        return true
      }
    })
  }
  const exports = {}
  new Function('require', 'exports', source)(name => {
    if (name === 'pinia') return { defineStore }
    if (name === 'vue') return { ref, computed }
    if (name === './idiom') return { useIdiomStore: () => idiomStore }
    if (name === './statistics') return { useStatisticsStore: () => statisticsStore }
    return {}
  }, exports)
  return { ...exports, idiomStore, statisticsStore }
}

const DAY = 24 * 60 * 60 * 1000

test('new review words initialize once and repeated registration preserves schedule', () => {
  const { useReviewStore } = loadReviewModule()
  const store = useReviewStore()
  const first = store.ensureWord('因地制宜', 1_000)
  const again = store.ensureWord('因地制宜', 9_000)
  assert.deepEqual(first, {
    state: 'new', nextReviewAt: 1_000, interval: 0,
    correctCount: 0, wrongCount: 0, lastReviewedAt: 0
  })
  assert.deepEqual(again, first)
  assert.equal(Object.keys(store.wordStats).length, 1)
})

test('session requires consecutive correct answers before scheduling the next review', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  idiomStore.idiomCache['画龙点睛'] = { word: '画龙点睛' }
  const store = useReviewStore()
  assert.equal(store.startSession(1, ['画龙点睛'], 10_000), true)
  assert.equal(store.wordStats['画龙点睛'].state, 'new')

  store.judge(true, 11_000)
  assert.equal(store.phase, 'reviewing')
  assert.equal(store.levels['画龙点睛'], 1)
  assert.equal(store.wordStats['画龙点睛'].correctCount, 0)

  store.judge(true, 12_000)
  assert.equal(store.phase, 'finished')
  assert.deepEqual(store.wordStats['画龙点睛'], {
    state: 'learning',
    nextReviewAt: 12_000 + DAY,
    interval: 1,
    correctCount: 1,
    wrongCount: 0,
    lastReviewedAt: 12_000
  })
})

test('a wrong answer increases the consecutive threshold and falls back to learning', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  idiomStore.idiomCache['守正创新'] = { word: '守正创新' }
  const store = useReviewStore()
  store.restoreSyncData({
    phase: 'idle', queue: [], done: [], levels: {}, thresholds: {}, wrongToday: {}, history: [],
    target: 0, startedAt: 0, elapsedMs: 0, lastResult: null, finishedToday: 0, lastFinishedDay: '',
    wordStats: {
      '守正创新': { state: 'review', nextReviewAt: 1, interval: 12, correctCount: 4, wrongCount: 2, lastReviewedAt: 1 }
    }
  })
  store.startSession(1, ['守正创新'], 20_000)
  store.judge(false, 21_000)
  assert.equal(store.thresholds['守正创新'], 3)
  store.judge(true, 22_000)
  store.judge(true, 23_000)
  store.judge(true, 24_000)

  assert.equal(store.phase, 'finished')
  assert.deepEqual(store.wordStats['守正创新'], {
    state: 'learning',
    nextReviewAt: 24_000 + DAY,
    interval: 1,
    correctCount: 4,
    wrongCount: 3,
    lastReviewedAt: 24_000
  })
})

test('deterministic schedule progresses to mastered and caps mastered interval', () => {
  const { createReviewWordStat, scheduleReviewWord, isReviewDue } = loadReviewModule()
  let stat = createReviewWordStat(100_000)
  const times = [200_000, 300_000, 400_000, 500_000, 600_000]
  stat = scheduleReviewWord(stat, 0, times[0])
  assert.deepEqual([stat.state, stat.interval, stat.correctCount], ['learning', 1, 1])
  stat = scheduleReviewWord(stat, 0, times[1])
  assert.deepEqual([stat.state, stat.interval, stat.correctCount], ['review', 3, 2])
  stat = scheduleReviewWord(stat, 0, times[2])
  assert.deepEqual([stat.state, stat.interval, stat.correctCount], ['review', 6, 3])
  stat = scheduleReviewWord(stat, 0, times[3])
  assert.deepEqual([stat.state, stat.interval, stat.correctCount], ['review', 12, 4])
  stat = scheduleReviewWord(stat, 0, times[4])
  assert.deepEqual([stat.state, stat.interval, stat.correctCount], ['mastered', 30, 5])
  assert.equal(stat.nextReviewAt, times[4] + 30 * DAY)
  assert.equal(isReviewDue(stat, stat.nextReviewAt - 1), false)
  assert.equal(isReviewDue(stat, stat.nextReviewAt), true)

  stat = scheduleReviewWord(stat, 0, stat.nextReviewAt)
  assert.equal(stat.state, 'mastered')
  assert.equal(stat.interval, 60)
})

test('relearning makes a mastered word due now without erasing lifetime counts', () => {
  const { relearnReviewWord } = loadReviewModule()
  const stat = relearnReviewWord({
    state: 'mastered', nextReviewAt: 99_000, interval: 30,
    correctCount: 8, wrongCount: 2, lastReviewedAt: 80_000
  }, 90_000)
  assert.deepEqual(stat, {
    state: 'learning', nextReviewAt: 90_000, interval: 1,
    correctCount: 8, wrongCount: 2, lastReviewedAt: 80_000
  })
})

test('legacy word stats migrate without losing wrong count or last review time', () => {
  const { normalizeReviewWordStat, useReviewStore } = loadReviewModule()
  assert.deepEqual(normalizeReviewWordStat({ wrong: 3, lastAt: 12_345 }, 90_000), {
    state: 'learning', nextReviewAt: 12_345, interval: 0,
    correctCount: 0, wrongCount: 3, lastReviewedAt: 12_345
  })

  const store = useReviewStore()
  store.restoreSyncData({
    phase: 'idle', queue: [], done: [], levels: {}, thresholds: {}, wrongToday: {}, history: [],
    target: 0, startedAt: 0, elapsedMs: 0, lastResult: null, finishedToday: 2, lastFinishedDay: 'legacy-day',
    wordStats: { '久久为功': { wrong: 5, lastAt: 22_222 } }
  })
  const exported = store.exportSyncData()
  assert.equal(exported.finishedToday, 2)
  assert.equal(exported.lastFinishedDay, 'legacy-day')
  assert.deepEqual(exported.wordStats['久久为功'], {
    state: 'learning', nextReviewAt: 22_222, interval: 0,
    correctCount: 0, wrongCount: 5, lastReviewedAt: 22_222
  })
})

test('undo restores long-term scheduling when a graduating answer is reverted', () => {
  const { useReviewStore, idiomStore, statisticsStore } = loadReviewModule()
  idiomStore.idiomCache['实事求是'] = { word: '实事求是' }
  const store = useReviewStore()
  store.startSession(1, ['实事求是'], 1_000)
  store.judge(true, 2_000)
  store.queue.push('占位词')
  store.judge(true, 3_000)
  assert.equal(store.phase, 'reviewing')
  assert.equal(store.wordStats['实事求是'].correctCount, 1)
  assert.equal(store.getTodayCompletedCount(3_000), 1)
  assert.equal(statisticsStore.reviewAnswers.length, 2)

  store.undo()
  assert.equal(store.phase, 'reviewing')
  assert.equal(store.wordStats['实事求是'].correctCount, 0)
  assert.equal(store.getTodayCompletedCount(3_000), 0)
  assert.deepEqual(store.queue, ['实事求是', '占位词'])
  assert.equal(statisticsStore.reviewAnswers.length, 1)
  assert.equal(statisticsStore.reviewAnswers[0].correct, true)
})

test('daily queue includes only due non-mastered words and fills the requested target', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  const now = 1_000_000
  for (const word of ['新词', '到期词', '已掌握词', '未到期词']) idiomStore.idiomCache[word] = { word }
  const pool = Object.keys(idiomStore.idiomCache)
  const store = useReviewStore()
  store.restoreSyncData({
    phase: 'idle', queue: [], done: [], levels: {}, thresholds: {}, wrongToday: {}, history: [],
    target: 0, startedAt: 0, elapsedMs: 0, lastResult: null, finishedToday: 0, lastFinishedDay: '',
    wordStats: {
      '到期词': { state: 'review', nextReviewAt: now - 1, interval: 6, correctCount: 3, wrongCount: 1, lastReviewedAt: now - DAY },
      '已掌握词': { state: 'mastered', nextReviewAt: now - 1, interval: 30, correctCount: 5, wrongCount: 0, lastReviewedAt: now - DAY },
      '未到期词': { state: 'review', nextReviewAt: now + DAY, interval: 6, correctCount: 3, wrongCount: 0, lastReviewedAt: now - DAY }
    }
  })
  assert.deepEqual(new Set(store.getDueWords(pool, now)), new Set(['新词', '到期词']))
  assert.equal(store.getDueCount(pool, now), 2)
  assert.equal(store.startSession(10, pool, now), true)
  assert.equal(store.target, 2)
  assert.deepEqual(new Set(store.queue), new Set(['新词', '到期词']))
  assert(!store.queue.includes('已掌握词'))
  assert(!store.queue.includes('未到期词'))
})

test('mastered action leaves the ordinary queue and daily progress survives serialization', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  const now = 2_000_000
  idiomStore.idiomCache['甲'] = { word: '甲' }
  idiomStore.idiomCache['乙'] = { word: '乙' }
  const pool = ['甲', '乙']
  const store = useReviewStore()
  store.startSession(2, pool, now)

  const masteredWord = store.currentWord
  store.markCurrentMastered(now + 1)
  assert.equal(store.wordStats[masteredWord].state, 'mastered')
  assert.equal(store.getTodayCompletedCount(now + 1), 1)
  assert(!store.getDueWords(pool, now + 1).includes(masteredWord))
  assert.equal(store.getTodayGoal(2, pool, now + 1), 2)
  assert.equal(store.getTodayRemainingGoal(2, pool, now + 1), 1)

  store.judge(true, now + 2)
  store.judge(true, now + 3)
  assert.equal(store.phase, 'finished')
  assert.equal(store.getTodayCompletedCount(now + 3), 2)
  assert.equal(store.getTodayRemainingGoal(2, pool, now + 3), 0)

  const exported = store.exportSyncData()
  assert.equal(exported.reviewedToday.length, 2)
  assert(exported.reviewedDay)

  const restored = useReviewStore()
  restored.restoreSyncData(exported)
  assert.equal(restored.getTodayCompletedCount(now + 3), 2)
  assert.equal(restored.getTodayRemainingGoal(2, pool, now + 3), 0)
})

test('defer current only rotates the queue and never changes review counters', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  idiomStore.idiomCache['甲'] = { word: '甲' }
  idiomStore.idiomCache['乙'] = { word: '乙' }
  const store = useReviewStore()
  store.startSession(2, ['甲', '乙'], 3_000_000)

  const first = store.currentWord
  const before = [...store.queue]
  store.deferCurrent()
  assert.notEqual(store.currentWord, first)
  assert.deepEqual(store.queue, [before[1], before[0]])
  assert.equal(store.getTodayCompletedCount(3_000_000), 0)
  assert.deepEqual(store.levels, { 甲: 0, 乙: 0 })
  assert.deepEqual(store.wrongToday, {})
})

test('wrong answers stay in the active queue until the stricter consecutive target is met', () => {
  const { useReviewStore, idiomStore } = loadReviewModule()
  idiomStore.idiomCache['反复巩固'] = { word: '反复巩固' }
  const store = useReviewStore()
  store.startSession(1, ['反复巩固'], 4_000_000)
  store.judge(false, 4_000_001)
  assert.equal(store.phase, 'reviewing')
  assert.deepEqual(store.queue, ['反复巩固'])
  assert.equal(store.thresholds['反复巩固'], 3)
  assert.equal(store.wrongToday['反复巩固'], 1)
  assert.equal(store.getTodayCompletedCount(4_000_001), 0)
})

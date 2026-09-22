import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/learningStatistics.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const exports = {}
new Function('require', 'exports', compiled)(
  name => { throw new Error(`Unexpected runtime dependency in learning statistics: ${name}`) },
  exports
)

const {
  calculateLearningStatistics,
  localDayKey,
  mergeLearningStatisticsSyncData,
  normalizeLearningStatisticsSyncData,
  recentLocalDayKeys
} = exports

const at = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
const now = at(2026, 9, 23, 18)

const emptyIdiom = () => ({
  idiomCache: {},
  searchHistory: [],
  compareCache: {},
  compareHistory: [],
  tokenStats: { totalTokens: 0, requestCount: 0 },
  favorites: [],
  queryCounts: {}
})

const emptyReview = () => ({
  phase: 'idle',
  queue: [],
  done: [],
  levels: {},
  thresholds: {},
  wrongToday: {},
  history: [],
  target: 0,
  startedAt: 0,
  elapsedMs: 0,
  lastResult: null,
  finishedToday: 0,
  lastFinishedDay: '',
  reviewedToday: [],
  reviewedDay: '',
  wordStats: {}
})

const emptyDaily = () => ({ issues: [], groups: [], selectedId: '' })

const activity = (type, word, timestamp, id = `${type}:${localDayKey(timestamp)}:${word}`) => ({
  id, type, word, at: timestamp
})

const stat = (state, lastReviewedAt = 0, correctCount = 0, wrongCount = 0) => ({
  state,
  nextReviewAt: lastReviewedAt,
  interval: state === 'mastered' ? 30 : 3,
  correctCount,
  wrongCount,
  lastReviewedAt
})

test('empty data returns zeroed statistics and stable 7/30-day windows', () => {
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(),
    review: emptyReview(),
    daily: emptyDaily()
  }, now)

  assert.equal(result.totalLearnedWords, 0)
  assert.equal(result.masteredWords, 0)
  assert.equal(result.todayLearnedWords, 0)
  assert.equal(result.todayReviewedWords, 0)
  assert.equal(result.currentStreakDays, 0)
  assert.equal(result.recent7DaysLearning, 0)
  assert.equal(result.recent30DaysLearning, 0)
  assert.equal(result.reviewAccuracy, null)
  assert.equal(result.dailyReadCount, 0)
  assert.equal(result.dailyCompletedCount, 0)
  assert.equal(result.recent7Days.length, 7)
  assert.equal(result.recent30Days.length, 30)
  assert.equal(result.tokenTrend.length, 30)
})

test('single-day data counts unique learned/reviewed words and daily completion once', () => {
  const statistics = normalizeLearningStatisticsSyncData({
    version: 1,
    activities: [
      activity('learn', '因地制宜', at(2026, 9, 23, 9)),
      activity('learn', '因地制宜', at(2026, 9, 23, 10), 'duplicate-logical-id'),
      activity('review', '守正创新', at(2026, 9, 23, 11))
    ],
    tokenUsage: []
  })
  const daily = emptyDaily()
  daily.issues = [{
    id: 'd1',
    createdAt: at(2026, 9, 23, 8),
    tokenUsage: 0,
    articles: [{
      title: '文章', source: '来源', url: 'https://example.com/a', publishedAt: '2026-09-23',
      content: '正文', words: [], analysis: '', completedAt: at(2026, 9, 23, 15)
    }]
  }]

  const result = calculateLearningStatistics({
    idiom: emptyIdiom(),
    review: emptyReview(),
    daily,
    statistics
  }, now)

  assert.equal(result.todayLearnedWords, 1)
  assert.equal(result.todayReviewedWords, 1)
  assert.equal(result.dailyReadCount, 1)
  assert.equal(result.dailyCompletedCount, 1)
  assert.equal(result.recent7DaysLearning, 3)
  assert.equal(result.currentStreakDays, 1)
})

test('cross-day boundaries use local calendar days rather than rolling 24-hour windows', () => {
  const statistics = {
    version: 1,
    activities: [
      activity('learn', '甲', at(2026, 9, 22, 23, 55)),
      activity('learn', '乙', at(2026, 9, 23, 0, 5))
    ],
    tokenUsage: []
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(),
    review: emptyReview(),
    daily: emptyDaily(),
    statistics
  }, at(2026, 9, 23, 0, 10))

  assert.equal(result.todayLearnedWords, 1)
  assert.deepEqual(result.recent7Days.slice(-2).map(point => [point.day, point.learnedWords]), [
    [localDayKey(at(2026, 9, 22)), 1],
    [localDayKey(at(2026, 9, 23)), 1]
  ])
})

test('continuous activity ending today produces a streak across local calendar days', () => {
  const statistics = {
    version: 1,
    activities: [
      activity('learn', '甲', at(2026, 9, 20)),
      activity('review', '乙', at(2026, 9, 21)),
      activity('learn', '丙', at(2026, 9, 22)),
      activity('review', '丁', at(2026, 9, 23))
    ],
    tokenUsage: []
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review: emptyReview(), daily: emptyDaily(), statistics
  }, now)
  assert.equal(result.currentStreakDays, 4)
})

test('a missed local day breaks the current streak', () => {
  const statistics = {
    version: 1,
    activities: [
      activity('learn', '甲', at(2026, 9, 21)),
      activity('learn', '乙', at(2026, 9, 23))
    ],
    tokenUsage: []
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review: emptyReview(), daily: emptyDaily(), statistics
  }, now)
  assert.equal(result.currentStreakDays, 1)
})

test('review accuracy is derived from current long-term review facts', () => {
  const review = emptyReview()
  review.wordStats = {
    甲: stat('review', at(2026, 9, 22), 3, 1),
    乙: stat('learning', at(2026, 9, 23), 2, 0)
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review, daily: emptyDaily()
  }, now)

  assert.equal(result.reviewCorrectCount, 5)
  assert.equal(result.reviewWrongCount, 1)
  assert.equal(result.reviewAccuracy, 5 / 6)
})

test('explicit review-answer facts provide true per-judgment accuracy once available', () => {
  const review = emptyReview()
  review.wordStats = { 甲: stat('review', at(2026, 9, 23), 20, 10) }
  const statistics = {
    version: 1,
    activities: [],
    reviewAnswers: [
      { id: 'a1', word: '甲', correct: true, at: at(2026, 9, 23, 9) },
      { id: 'a2', word: '甲', correct: true, at: at(2026, 9, 23, 10) },
      { id: 'a3', word: '甲', correct: false, at: at(2026, 9, 23, 11) },
      { id: 'a4', word: '甲', correct: true, at: at(2026, 9, 23, 12) }
    ],
    tokenUsage: []
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review, daily: emptyDaily(), statistics
  }, now)

  assert.equal(result.reviewCorrectCount, 3)
  assert.equal(result.reviewWrongCount, 1)
  assert.equal(result.reviewAccuracy, 0.75)
})

test('mastered words are counted from review state without a second counter', () => {
  const review = emptyReview()
  review.wordStats = {
    甲: stat('mastered', at(2026, 9, 20), 8, 1),
    乙: stat('mastered', at(2026, 9, 21), 7, 0),
    丙: stat('review', at(2026, 9, 22), 3, 2)
  }
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review, daily: emptyDaily()
  }, now)
  assert.equal(result.masteredWords, 2)
})

test('daily read/completed counts follow retained article facts and completedAt', () => {
  const daily = emptyDaily()
  daily.issues = [{
    id: 'd1', createdAt: at(2026, 9, 20), tokenUsage: 0,
    articles: [
      { title: 'A', source: 's', url: 'https://e/a', publishedAt: '', content: 'a', words: [], analysis: '', completedAt: at(2026, 9, 22) },
      { title: 'B', source: 's', url: 'https://e/b', publishedAt: '', content: 'b', words: [], analysis: '' }
    ]
  }]
  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review: emptyReview(), daily
  }, now)
  assert.equal(result.dailyReadCount, 2)
  assert.equal(result.dailyCompletedCount, 1)

  const afterDelete = calculateLearningStatistics({
    idiom: emptyIdiom(), review: emptyReview(), daily: emptyDaily()
  }, now)
  assert.equal(afterDelete.dailyReadCount, 0)
  assert.equal(afterDelete.dailyCompletedCount, 0)
})

test('cloud-style fact merge deduplicates stable ids and remains idempotent', () => {
  const sameLearn = activity('learn', '甲', at(2026, 9, 23, 9), 'learn:2026-09-23:%E7%94%B2')
  const local = {
    version: 1,
    activities: [sameLearn, activity('review', '乙', at(2026, 9, 23, 10), 'review-a')],
    tokenUsage: [{ id: 'token-a', at: at(2026, 9, 23, 11), tokens: 100, source: 'idiom' }]
  }
  const remote = {
    version: 1,
    activities: [{ ...sameLearn, at: at(2026, 9, 23, 9, 5) }],
    tokenUsage: [
      { id: 'token-a', at: at(2026, 9, 23, 11), tokens: 100, source: 'idiom' },
      { id: 'token-b', at: at(2026, 9, 23, 12), tokens: 50, source: 'daily' }
    ]
  }

  const merged = mergeLearningStatisticsSyncData(local, remote)
  const twice = mergeLearningStatisticsSyncData(merged, remote)
  assert.equal(merged.activities.length, 2)
  assert.equal(merged.tokenUsage.length, 2)
  assert.deepEqual(twice, merged)

  const result = calculateLearningStatistics({
    idiom: emptyIdiom(), review: emptyReview(), daily: emptyDaily(), statistics: merged
  }, now)
  assert.equal(result.todayLearnedWords, 1)
  assert.equal(result.todayReviewedWords, 1)
  assert.equal(result.tokenTrend.at(-1).tokens, 150)
})

test('7-day and 30-day windows are inclusive local calendar windows and exclude older activity', () => {
  const activities = []
  for (let offset = 0; offset < 35; offset++) {
    const date = new Date(now)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    activities.push(activity('learn', `词-${offset}`, date.getTime()))
  }

  const result = calculateLearningStatistics({
    idiom: emptyIdiom(),
    review: emptyReview(),
    daily: emptyDaily(),
    statistics: { version: 1, activities, tokenUsage: [] }
  }, now)

  assert.equal(result.recent7DaysLearning, 7)
  assert.equal(result.recent30DaysLearning, 30)
  assert.equal(result.recent7Days[0].day, recentLocalDayKeys(now, 7)[0])
  assert.equal(result.recent30Days[0].day, recentLocalDayKeys(now, 30)[0])
})

test('legacy users without statistics facts still get conservative learning/review/token trends', () => {
  const idiom = emptyIdiom()
  idiom.idiomCache = {
    旧词: {
      id: 'old', word: '旧词', pinyin: '', explanation: '', origin: '', example: '', usage: '',
      relatedIdioms: [], tokenUsage: 120, createdAt: at(2026, 9, 22, 9)
    }
  }
  idiom.compareCache = {
    '甲|乙': {
      id: 'cmp', words: ['甲', '乙'],
      content: { meaningDiff: '', usageDiff: '', scenarios: '', confusionPoints: '' },
      tokenUsage: 80, createdAt: at(2026, 9, 22, 10)
    }
  }
  const review = emptyReview()
  review.wordStats = { 旧词: stat('review', at(2026, 9, 23, 8), 2, 1) }
  const daily = emptyDaily()
  daily.issues = [{
    id: 'legacy-daily', createdAt: at(2026, 9, 21), tokenUsage: 50,
    articles: [{ title: 'A', source: 's', url: 'https://e/a', publishedAt: '', content: 'a', words: [], analysis: '' }]
  }]

  const result = calculateLearningStatistics({ idiom, review, daily }, now)
  assert.equal(result.totalLearnedWords, 1)
  assert.equal(result.todayReviewedWords, 1)
  assert.equal(result.recent7Days.find(point => point.day === localDayKey(at(2026, 9, 22))).learnedWords, 1)
  assert.equal(result.tokenTrend.find(point => point.day === localDayKey(at(2026, 9, 22))).tokens, 200)
  assert.equal(result.tokenTrend.find(point => point.day === localDayKey(at(2026, 9, 21))).tokens, 50)
})

test('learn and review legacy fallbacks use independent cutoffs', () => {
  const idiom = emptyIdiom()
  idiom.idiomCache = {
    旧词: {
      id: 'old', word: '旧词', pinyin: '', explanation: '', origin: '', example: '', usage: '',
      relatedIdioms: [], createdAt: at(2026, 9, 20)
    }
  }
  const review = emptyReview()
  review.wordStats = { 旧词: stat('review', at(2026, 9, 22), 2, 0) }
  const statistics = {
    version: 1,
    activities: [activity('learn', '新词', at(2026, 9, 21))],
    reviewAnswers: [],
    tokenUsage: []
  }

  const result = calculateLearningStatistics({ idiom, review, daily: emptyDaily(), statistics }, now)
  assert.equal(result.recent7Days.find(point => point.day === localDayKey(at(2026, 9, 22))).reviewedWords, 1)
})

test('new explicit token facts take over after their first timestamp without double-counting new artifacts', () => {
  const idiom = emptyIdiom()
  idiom.idiomCache = {
    old: {
      id: 'old', word: '旧词', pinyin: '', explanation: '', origin: '', example: '', usage: '',
      relatedIdioms: [], tokenUsage: 100, createdAt: at(2026, 9, 20)
    },
    newer: {
      id: 'new', word: '新词', pinyin: '', explanation: '', origin: '', example: '', usage: '',
      relatedIdioms: [], tokenUsage: 300, createdAt: at(2026, 9, 23, 10)
    }
  }
  const statistics = {
    version: 1,
    activities: [],
    tokenUsage: [{ id: 'new-token', at: at(2026, 9, 23, 9), tokens: 300, source: 'idiom' }]
  }

  const result = calculateLearningStatistics({
    idiom, review: emptyReview(), daily: emptyDaily(), statistics
  }, now)

  assert.equal(result.tokenTrend.find(point => point.day === localDayKey(at(2026, 9, 20))).tokens, 100)
  assert.equal(result.tokenTrend.find(point => point.day === localDayKey(at(2026, 9, 23))).tokens, 300)
})

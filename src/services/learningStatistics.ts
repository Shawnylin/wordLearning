import type { DailySyncData, IdiomSyncData, ReviewSyncData } from '../types/sync'
import type {
  LearningActivityEvent,
  LearningStatisticsSnapshot,
  LearningStatisticsSyncData,
  LearningTrendPoint,
  ReviewAnswerEvent,
  TokenUsageEvent,
  TokenUsageSource
} from '../types/statistics'

const ACTIVITY_TYPES = new Set(['learn', 'review'])
const TOKEN_SOURCES = new Set(['idiom', 'comparison', 'daily', 'pdf', 'other'])

function finitePositive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeActivity(value: unknown): LearningActivityEvent | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = text(raw.id)
  const type = text(raw.type)
  const word = text(raw.word)
  const at = finitePositive(raw.at)
  if (!id || !ACTIVITY_TYPES.has(type) || !word || !at) return null
  return { id, type: type as LearningActivityEvent['type'], word, at }
}

function normalizeTokenUsage(value: unknown): TokenUsageEvent | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = text(raw.id)
  const at = finitePositive(raw.at)
  const tokens = finitePositive(raw.tokens)
  const rawSource = text(raw.source)
  const source = TOKEN_SOURCES.has(rawSource) ? rawSource as TokenUsageSource : 'other'
  if (!id || !at || !tokens) return null
  return { id, at, tokens: Math.floor(tokens), source }
}

function normalizeReviewAnswer(value: unknown): ReviewAnswerEvent | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = text(raw.id)
  const word = text(raw.word)
  const at = finitePositive(raw.at)
  if (!id || !word || !at || typeof raw.correct !== 'boolean') return null
  return { id, word, correct: raw.correct, at }
}

function dedupeById<T extends { id: string; at: number }>(values: T[], tieBreak?: (left: T, right: T) => T): T[] {
  const map = new Map<string, T>()
  for (const value of values) {
    const current = map.get(value.id)
    if (!current) {
      map.set(value.id, value)
      continue
    }
    if (tieBreak) map.set(value.id, tieBreak(current, value))
    else if (value.at < current.at) map.set(value.id, value)
  }
  return [...map.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

export function emptyLearningStatisticsSyncData(): LearningStatisticsSyncData {
  return { version: 1, activities: [], reviewAnswers: [], tokenUsage: [] }
}

export function normalizeLearningStatisticsSyncData(value: unknown): LearningStatisticsSyncData {
  if (!value || typeof value !== 'object') return emptyLearningStatisticsSyncData()
  const raw = value as Record<string, unknown>
  const activities = Array.isArray(raw.activities)
    ? raw.activities.flatMap(item => {
        const normalized = normalizeActivity(item)
        return normalized ? [normalized] : []
      })
    : []
  const tokenUsage = Array.isArray(raw.tokenUsage)
    ? raw.tokenUsage.flatMap(item => {
        const normalized = normalizeTokenUsage(item)
        return normalized ? [normalized] : []
      })
    : []
  const reviewAnswers = Array.isArray(raw.reviewAnswers)
    ? raw.reviewAnswers.flatMap(item => {
        const normalized = normalizeReviewAnswer(item)
        return normalized ? [normalized] : []
      })
    : []
  return {
    version: 1,
    activities: dedupeById(activities),
    reviewAnswers: dedupeById(reviewAnswers),
    tokenUsage: dedupeById(tokenUsage, (left, right) => {
      if (right.at !== left.at) return right.at < left.at ? right : left
      if (right.tokens !== left.tokens) return right.tokens > left.tokens ? right : left
      return right.source.localeCompare(left.source) < 0 ? right : left
    })
  }
}

export function mergeLearningStatisticsSyncData(local: unknown, remote: unknown): LearningStatisticsSyncData {
  const left = normalizeLearningStatisticsSyncData(local)
  const right = normalizeLearningStatisticsSyncData(remote)
  return normalizeLearningStatisticsSyncData({
    version: 1,
    activities: [...left.activities, ...right.activities],
    reviewAnswers: [...left.reviewAnswers, ...right.reviewAnswers],
    tokenUsage: [...left.tokenUsage, ...right.tokenUsage]
  })
}

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function recentLocalDayKeys(now: number, days: number): string[] {
  const count = Math.max(0, Math.floor(days))
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  const result: string[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() - offset)
    result.push(localDayKey(date.getTime()))
  }
  return result
}

function uniqueWordActivity(
  statistics: LearningStatisticsSyncData,
  idiom: IdiomSyncData,
  review: ReviewSyncData
): LearningActivityEvent[] {
  const explicit = statistics.activities
  const explicitLearn = explicit.filter(item => item.type === 'learn')
  const explicitReview = explicit.filter(item => item.type === 'review')
  const firstExplicitLearnAt = explicitLearn.length
    ? Math.min(...explicitLearn.map(item => item.at))
    : Number.POSITIVE_INFINITY
  const firstExplicitReviewAt = explicitReview.length
    ? Math.min(...explicitReview.map(item => item.at))
    : Number.POSITIVE_INFINITY
  const legacyLearn = Object.entries(idiom.idiomCache).flatMap(([key, item]) => {
    const word = text(item.word) || text(key)
    const at = finitePositive(item.createdAt)
    if (!word || !at || at >= firstExplicitLearnAt) return []
    return [{ id: `legacy-learn:${word}`, type: 'learn' as const, word, at }]
  })
  const legacyReview = Object.entries(review.wordStats).flatMap(([word, stat]) => {
    const at = finitePositive(stat.lastReviewedAt || stat.lastAt)
    if (!word || !at || at >= firstExplicitReviewAt) return []
    return [{ id: `legacy-review:${word}`, type: 'review' as const, word, at }]
  })
  const todayWords = Array.isArray(review.reviewedToday) ? review.reviewedToday : []
  const todayDay = typeof review.reviewedDay === 'string' ? review.reviewedDay : ''
  const todayAt = todayDay ? Date.parse(`${todayDay}T12:00:00`) : 0
  const legacyToday = explicit.some(item => item.type === 'review' && localDayKey(item.at) === todayDay)
    ? []
    : todayWords.flatMap(word => todayAt && todayAt < firstExplicitReviewAt
      ? [{ id: `legacy-reviewed-day:${todayDay}:${word}`, type: 'review' as const, word, at: todayAt }]
      : [])
  return [...explicit, ...legacyLearn, ...legacyReview, ...legacyToday]
}

function activityByDay(events: LearningActivityEvent[]): Map<string, { learn: Set<string>; review: Set<string> }> {
  const result = new Map<string, { learn: Set<string>; review: Set<string> }>()
  for (const event of events) {
    const day = localDayKey(event.at)
    if (!day) continue
    const entry = result.get(day) || { learn: new Set<string>(), review: new Set<string>() }
    entry[event.type].add(event.word)
    result.set(day, entry)
  }
  return result
}

function dailyCompletedByDay(daily: DailySyncData): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  for (const issue of daily.issues) {
    issue.articles.forEach((article, index) => {
      const at = finitePositive(article.completedAt)
      if (!at) return
      const day = localDayKey(at)
      const set = result.get(day) || new Set<string>()
      set.add(`${issue.id}:${index}`)
      result.set(day, set)
    })
  }
  return result
}

function legacyTokenEvents(idiom: IdiomSyncData, daily: DailySyncData, before: number): TokenUsageEvent[] {
  const result: TokenUsageEvent[] = []
  for (const [word, item] of Object.entries(idiom.idiomCache)) {
    const at = finitePositive(item.createdAt)
    const tokens = finitePositive(item.tokenUsage)
    if (at && tokens && at < before) result.push({ id: `legacy-idiom:${word}`, at, tokens: Math.floor(tokens), source: 'idiom' })
  }
  for (const [key, record] of Object.entries(idiom.compareCache)) {
    const at = finitePositive(record.createdAt)
    const tokens = finitePositive(record.tokenUsage)
    if (at && tokens && at < before) result.push({ id: `legacy-compare:${key}`, at, tokens: Math.floor(tokens), source: 'comparison' })
  }
  for (const issue of daily.issues) {
    const at = finitePositive(issue.createdAt)
    const tokens = finitePositive(issue.tokenUsage)
    if (at && tokens && at < before) result.push({
      id: `legacy-daily:${issue.id}`,
      at,
      tokens: Math.floor(tokens),
      source: issue.pdf ? 'pdf' : 'daily'
    })
  }
  return result
}

function tokenByDay(statistics: LearningStatisticsSyncData, idiom: IdiomSyncData, daily: DailySyncData): Map<string, number> {
  const explicit = statistics.tokenUsage
  const cutoff = explicit.length ? Math.min(...explicit.map(item => item.at)) : Number.POSITIVE_INFINITY
  const events = [...legacyTokenEvents(idiom, daily, cutoff), ...explicit]
  const result = new Map<string, number>()
  for (const event of events) {
    const day = localDayKey(event.at)
    if (!day) continue
    result.set(day, (result.get(day) || 0) + event.tokens)
  }
  return result
}

function uniqueLearnedWords(idiom: IdiomSyncData): number {
  const words = new Set<string>()
  for (const [key, item] of Object.entries(idiom.idiomCache)) {
    const word = text(item.word) || text(key)
    if (word) words.add(word)
  }
  return words.size
}

function legacyReviewCounts(review: ReviewSyncData): { correct: number; wrong: number } {
  let correct = 0
  let wrong = 0
  for (const stat of Object.values(review.wordStats)) {
    correct += Math.max(0, Math.floor(Number(stat.correctCount) || 0))
    wrong += Math.max(0, Math.floor(Number(stat.wrongCount ?? stat.wrong) || 0))
  }
  return { correct, wrong }
}

function reviewCounts(review: ReviewSyncData, statistics: LearningStatisticsSyncData): { correct: number; wrong: number } {
  if (statistics.reviewAnswers.length > 0) {
    return statistics.reviewAnswers.reduce(
      (counts, answer) => {
        if (answer.correct) counts.correct++
        else counts.wrong++
        return counts
      },
      { correct: 0, wrong: 0 }
    )
  }
  return legacyReviewCounts(review)
}

export function calculateLearningStatistics(
  input: {
    idiom: IdiomSyncData
    review: ReviewSyncData
    daily: DailySyncData
    statistics?: LearningStatisticsSyncData
  },
  now = Date.now()
): LearningStatisticsSnapshot {
  const statistics = normalizeLearningStatisticsSyncData(input.statistics)
  const events = uniqueWordActivity(statistics, input.idiom, input.review)
  const activities = activityByDay(events)
  const completed = dailyCompletedByDay(input.daily)
  const tokens = tokenByDay(statistics, input.idiom, input.daily)
  const today = localDayKey(now)

  const buildTrend = (days: number): LearningTrendPoint[] => recentLocalDayKeys(now, days).map(day => {
    const activity = activities.get(day)
    const learnedWords = activity?.learn.size || 0
    const reviewedWords = activity?.review.size || 0
    const dailyCompleted = completed.get(day)?.size || 0
    return {
      day,
      learnedWords,
      reviewedWords,
      dailyCompleted,
      activityTotal: learnedWords + reviewedWords + dailyCompleted,
      tokens: tokens.get(day) || 0
    }
  })

  const recent30Days = buildTrend(30)
  const recent7Days = recent30Days.slice(-7)
  const activeDays = new Set<string>()
  for (const [day, value] of activities) {
    if (value.learn.size || value.review.size) activeDays.add(day)
  }
  for (const [day, value] of completed) if (value.size) activeDays.add(day)

  let currentStreakDays = 0
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  while (activeDays.has(localDayKey(cursor.getTime()))) {
    currentStreakDays++
    cursor.setDate(cursor.getDate() - 1)
  }

  const { correct, wrong } = reviewCounts(input.review, statistics)
  const reviewTotal = correct + wrong
  const dailyArticles = new Set<string>()
  const completedArticles = new Set<string>()
  for (const issue of input.daily.issues) {
    issue.articles.forEach((article, index) => {
      const key = `${issue.id}:${index}`
      dailyArticles.add(key)
      if (finitePositive(article.completedAt)) completedArticles.add(key)
    })
  }

  return {
    totalLearnedWords: uniqueLearnedWords(input.idiom),
    masteredWords: Object.values(input.review.wordStats).filter(stat => stat.state === 'mastered').length,
    todayLearnedWords: activities.get(today)?.learn.size || 0,
    todayReviewedWords: activities.get(today)?.review.size || 0,
    currentStreakDays,
    recent7DaysLearning: recent7Days.reduce((sum, point) => sum + point.activityTotal, 0),
    recent30DaysLearning: recent30Days.reduce((sum, point) => sum + point.activityTotal, 0),
    reviewAccuracy: reviewTotal > 0 ? correct / reviewTotal : null,
    reviewCorrectCount: correct,
    reviewWrongCount: wrong,
    dailyReadCount: dailyArticles.size,
    dailyCompletedCount: completedArticles.size,
    recent7Days,
    recent30Days,
    tokenTrend: recent30Days.map(point => ({ day: point.day, tokens: point.tokens }))
  }
}

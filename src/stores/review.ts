import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useIdiomStore } from './idiom'
import type { ReviewSyncData } from '../types/sync'

export type ReviewPhase = 'idle' | 'reviewing' | 'finished'
export type ReviewState = 'new' | 'learning' | 'review' | 'mastered'

export interface ReviewWordStat {
  state: ReviewState
  /** 下次应复习的时间戳 */
  nextReviewAt: number
  /** 当前复习间隔，单位：天 */
  interval: number
  /** 成功完成复习的累计次数 */
  correctCount: number
  /** 历史累计答错次数 */
  wrongCount: number
  /** 最近一次完成复习的时间戳 */
  lastReviewedAt: number
}

interface ReviewSnapshot {
  queue: string[]
  done: string[]
  levels: Record<string, number>
  thresholds: Record<string, number>
  wrongToday: Record<string, number>
  wordStats?: Record<string, ReviewWordStat>
}

export interface ReviewResult {
  reviewedAt: number
  words: string[]
  wrongWords: string[]
  wrongCount: number
  elapsedMs: number
  perfect: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_REVIEW_INTERVAL = 30
const MAX_MASTERED_INTERVAL = 60

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function safeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function safeInterval(value: unknown): number {
  return Math.min(MAX_MASTERED_INTERVAL, safeCount(value))
}

export function createReviewWordStat(now = Date.now()): ReviewWordStat {
  return {
    state: 'new',
    nextReviewAt: now,
    interval: 0,
    correctCount: 0,
    wrongCount: 0,
    lastReviewedAt: 0
  }
}

/** 将旧版 { wrong, lastAt } 与不完整数据迁移到当前 schema。 */
export function normalizeReviewWordStat(value: unknown, now = Date.now()): ReviewWordStat {
  if (!value || typeof value !== 'object') return createReviewWordStat(now)
  const raw = value as Record<string, unknown>
  const lastReviewedAt = safeTimestamp(raw.lastReviewedAt) || safeTimestamp(raw.lastAt)
  const wrongCount = safeCount(raw.wrongCount) || safeCount(raw.wrong)
  const interval = safeInterval(raw.interval)
  const rawState = raw.state
  const state: ReviewState = rawState === 'new' || rawState === 'learning' || rawState === 'review' || rawState === 'mastered'
    ? rawState
    : lastReviewedAt > 0
      ? 'learning'
      : 'new'
  const nextReviewAt = safeTimestamp(raw.nextReviewAt) || (lastReviewedAt > 0 ? lastReviewedAt : now)
  return {
    state,
    nextReviewAt,
    interval,
    correctCount: safeCount(raw.correctCount),
    wrongCount,
    lastReviewedAt
  }
}

export function scheduleReviewWord(stat: ReviewWordStat, wrongCount: number, now = Date.now()): ReviewWordStat {
  const current = normalizeReviewWordStat(stat, now)
  const misses = safeCount(wrongCount)
  if (misses > 0) {
    return {
      ...current,
      state: 'learning',
      interval: 1,
      wrongCount: current.wrongCount + misses,
      lastReviewedAt: now,
      nextReviewAt: now + DAY_MS
    }
  }

  const correctCount = current.correctCount + 1
  let state: ReviewState = current.state
  let interval = current.interval
  if (current.state === 'new') {
    state = 'learning'
    interval = 1
  } else if (current.state === 'learning') {
    state = 'review'
    interval = 3
  } else if (current.state === 'review') {
    interval = Math.min(MAX_REVIEW_INTERVAL, Math.max(3, current.interval > 0 ? current.interval * 2 : 3))
    if (interval >= 14 && correctCount >= 4) {
      state = 'mastered'
      interval = MAX_REVIEW_INTERVAL
    }
  } else {
    state = 'mastered'
    interval = Math.min(MAX_MASTERED_INTERVAL, Math.max(MAX_REVIEW_INTERVAL, current.interval) * 2)
  }

  return {
    ...current,
    state,
    interval,
    correctCount,
    lastReviewedAt: now,
    nextReviewAt: now + interval * DAY_MS
  }
}

export function relearnReviewWord(stat: ReviewWordStat, now = Date.now()): ReviewWordStat {
  const current = normalizeReviewWordStat(stat, now)
  return {
    ...current,
    state: 'learning',
    interval: 1,
    nextReviewAt: now
  }
}

export function isReviewDue(stat: ReviewWordStat, now = Date.now()): boolean {
  return normalizeReviewWordStat(stat, now).nextReviewAt <= now
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 今日复习会话（持久化，切页/重启均保留进度）
 *
 * 推送机制（参考背单词 App 的「连对毕业」）：
 * - 每个词初始需连续答对 2 次（threshold=2）才从今日列表移除
 * - 一旦答错：连对计数清零、所需连对次数 +1（封顶 4），并把该词插回
 *   队列前 2 位，稍后再次出现，直到连续答对足够次数
 * - 每次判断前保存快照，支持撤回上一步
 */
export const useReviewStore = defineStore('review', () => {
  const phase = ref<ReviewPhase>('idle')
  const queue = ref<string[]>([])
  const done = ref<string[]>([])
  const levels = ref<Record<string, number>>({})
  const thresholds = ref<Record<string, number>>({})
  const wrongToday = ref<Record<string, number>>({})
  const history = ref<ReviewSnapshot[]>([])
  const target = ref(0)
  const startedAt = ref(0)
  /** 在复习页面停留的累计用时（毫秒），离开页面时冻结 */
  const elapsedMs = ref(0)
  const lastTick = ref(0)
  const lastResult = ref<ReviewResult | null>(null)
  /** 今日已完成组数 */
  const finishedToday = ref(0)
  const lastFinishedDay = ref('')
  /** 每个词的长期表现（跨会话累计答错次数） */
  const wordStats = ref<Record<string, ReviewWordStat>>({})

  const currentWord = computed(() => queue.value[0] || null)
  const remaining = computed(() => queue.value.length)
  const doneCount = computed(() => done.value.length)
  const sessionActive = computed(() => phase.value === 'reviewing' && queue.value.length > 0)
  const progressRatio = computed(() =>
    target.value > 0 ? Math.min(1, done.value.length / target.value) : 0
  )
  const levelOfCurrent = computed(() =>
    currentWord.value ? levels.value[currentWord.value] ?? 0 : 0
  )
  const thresholdOfCurrent = computed(() =>
    currentWord.value ? thresholds.value[currentWord.value] ?? 2 : 2
  )

  function snapshot(): ReviewSnapshot {
    return {
      queue: [...queue.value],
      done: [...done.value],
      levels: { ...levels.value },
      thresholds: { ...thresholds.value },
      wrongToday: { ...wrongToday.value },
      wordStats: Object.fromEntries(
        Object.entries(wordStats.value).map(([word, stat]) => [word, { ...normalizeReviewWordStat(stat) }])
      )
    }
  }

  function migrateWordStats(now = Date.now()) {
    wordStats.value = Object.fromEntries(
      Object.entries(wordStats.value).map(([word, stat]) => [word, normalizeReviewWordStat(stat, now)])
    )
  }

  function ensureWord(word: string, now = Date.now()): ReviewWordStat | null {
    const normalized = word.trim()
    if (!normalized) return null
    const existing = wordStats.value[normalized]
    const stat = existing ? normalizeReviewWordStat(existing, now) : createReviewWordStat(now)
    wordStats.value[normalized] = stat
    return stat
  }

  function relearnWord(word: string, now = Date.now()): ReviewWordStat | null {
    const normalized = word.trim()
    const stat = ensureWord(normalized, now)
    if (!stat) return null
    const next = relearnReviewWord(stat, now)
    wordStats.value[normalized] = next
    return next
  }

  /**
   * 开始一组复习：n 为数量（0 表示全部）。
   * 选词策略：优先挑选历史答错过的词（约 60% 名额），其余随机补齐，最后打乱顺序。
   */
  function startSession(n: number, now = Date.now()): boolean {
    const idiomStore = useIdiomStore()
    const pool = Object.keys(idiomStore.idiomCache)
    if (pool.length === 0) return false
    for (const word of pool) ensureWord(word, now)

    const size = n > 0 ? Math.min(n, pool.length) : pool.length
    const weak = pool.filter(w => (wordStats.value[w]?.wrongCount || 0) > 0)
    const strong = pool.filter(w => (wordStats.value[w]?.wrongCount || 0) === 0)
    const weakSlots = Math.min(weak.length, Math.ceil(size * 0.6))
    const picks = [
      ...shuffle(weak).slice(0, weakSlots),
      ...shuffle(strong).slice(0, size - weakSlots)
    ]

    queue.value = shuffle(picks)
    done.value = []
    levels.value = {}
    thresholds.value = {}
    wrongToday.value = {}
    history.value = []
    for (const w of queue.value) {
      levels.value[w] = 0
      thresholds.value[w] = 2
    }
    target.value = queue.value.length
    startedAt.value = now
    elapsedMs.value = 0
    lastTick.value = now
    phase.value = 'reviewing'
    return true
  }

  /** 判定当前卡片：known=true 认识，false 不熟 */
  function judge(known: boolean, now = Date.now()) {
    if (phase.value !== 'reviewing' || queue.value.length === 0) return
    const w = queue.value[0]
    history.value.push(snapshot())

    if (known) {
      levels.value[w] = (levels.value[w] || 0) + 1
      queue.value.shift()
      const passed = levels.value[w] >= thresholds.value[w]
      if (passed) {
        const stat = ensureWord(w, now)!
        wordStats.value[w] = scheduleReviewWord(stat, wrongToday.value[w] || 0, now)
        done.value.push(w)
      } else {
        // 还没连对够次数：排到队尾稍后重现
        queue.value.push(w)
      }
    } else {
      levels.value[w] = 0
      thresholds.value[w] = Math.min((thresholds.value[w] || 2) + 1, 4)
      wrongToday.value[w] = (wrongToday.value[w] || 0) + 1
      queue.value.shift()
      // 答错后尽快重现（插到第 2 位，避免立刻连续出现）
      queue.value.splice(Math.min(2, queue.value.length), 0, w)
    }

    if (queue.value.length === 0) finishSession(now)
  }

  /** 左右滑动浏览：不判定，仅轮转卡片顺序 */
  function browse(dir: 1 | -1) {
    if (queue.value.length === 0) return
    if (dir === 1) {
      queue.value.push(queue.value.shift()!)
    } else {
      queue.value.unshift(queue.value.pop()!)
    }
  }

  /** 撤回上一步判定（恢复队列/计数到判断前） */
  function undo() {
    const s = history.value.pop()
    if (!s) return
    queue.value = s.queue
    done.value = s.done
    levels.value = s.levels
    thresholds.value = s.thresholds
    wrongToday.value = s.wrongToday
    if (s.wordStats) wordStats.value = s.wordStats
  }

  /** 跳过当前卡片（例如缓存被清掉后兜底），不做判定 */
  function skipCurrent() {
    if (queue.value.length === 0) return
    queue.value.shift()
    if (queue.value.length === 0) finishSession()
  }

  function finishSession(now = Date.now()) {
    const today = new Date(now).toDateString()
    if (lastFinishedDay.value !== today) {
      lastFinishedDay.value = today
      finishedToday.value = 1
    } else {
      finishedToday.value++
    }
    const wrongWords = Object.entries(wrongToday.value)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w)
    const wrongCount = Object.values(wrongToday.value).reduce((s, c) => s + c, 0)
    elapsedMs.value += Math.max(0, now - lastTick.value)
    lastResult.value = {
      reviewedAt: now,
      words: [...done.value],
      wrongWords,
      wrongCount,
      elapsedMs: elapsedMs.value,
      perfect: wrongCount === 0
    }
    phase.value = 'finished'
    queue.value = []
  }

  /** 清空会话回到初始状态（不清理长期 wordStats） */
  function resetSession() {
    phase.value = 'idle'
    queue.value = []
    done.value = []
    levels.value = {}
    thresholds.value = {}
    wrongToday.value = {}
    history.value = []
    target.value = 0
    startedAt.value = 0
    elapsedMs.value = 0
    lastTick.value = 0
  }

  /** 全部重置（含长期表现数据） */
  function resetAll() {
    resetSession()
    wordStats.value = {}
    lastResult.value = null
    finishedToday.value = 0
    lastFinishedDay.value = ''
  }

  /** 离开复习页面：冻结用时 */
  function pause() {
    if (phase.value === 'reviewing' && lastTick.value > 0) {
      elapsedMs.value += Math.max(0, Date.now() - lastTick.value)
      lastTick.value = 0
    }
  }

  /** 进入复习页面：恢复计时 */
  function resumeClock() {
    if (phase.value === 'reviewing') {
      lastTick.value = Date.now()
    }
  }

  function exportSyncData(): ReviewSyncData {
    migrateWordStats()
    return {
      phase: phase.value,
      queue: queue.value,
      done: done.value,
      levels: levels.value,
      thresholds: thresholds.value,
      wrongToday: wrongToday.value,
      history: history.value,
      target: target.value,
      startedAt: startedAt.value,
      elapsedMs: elapsedMs.value,
      lastResult: lastResult.value,
      finishedToday: finishedToday.value,
      lastFinishedDay: lastFinishedDay.value,
      wordStats: wordStats.value
    }
  }

  function restoreSyncData(data: ReviewSyncData) {
    phase.value = data.phase
    queue.value = data.queue
    done.value = data.done
    levels.value = data.levels
    thresholds.value = data.thresholds
    wrongToday.value = data.wrongToday
    history.value = data.history.map(item => ({
      ...item,
      wordStats: item.wordStats
        ? Object.fromEntries(Object.entries(item.wordStats).map(([word, stat]) => [word, normalizeReviewWordStat(stat)]))
        : undefined
    }))
    target.value = data.target
    startedAt.value = data.startedAt
    elapsedMs.value = data.elapsedMs
    lastTick.value = 0
    lastResult.value = data.lastResult
    finishedToday.value = data.finishedToday
    lastFinishedDay.value = data.lastFinishedDay
    wordStats.value = Object.fromEntries(
      Object.entries(data.wordStats || {}).map(([word, stat]) => [word, normalizeReviewWordStat(stat)])
    )
  }

  return {
    phase,
    queue,
    done,
    levels,
    thresholds,
    wrongToday,
    history,
    target,
    startedAt,
    elapsedMs,
    lastResult,
    finishedToday,
    lastFinishedDay,
    wordStats,
    currentWord,
    remaining,
    doneCount,
    sessionActive,
    progressRatio,
    levelOfCurrent,
    thresholdOfCurrent,
    ensureWord,
    relearnWord,
    migrateWordStats,
    startSession,
    judge,
    browse,
    undo,
    skipCurrent,
    resetSession,
    resetAll,
    pause,
    resumeClock,
    exportSyncData,
    restoreSyncData
  }
}, {
  persist: {
    key: 'review-store'
  }
})

import { useDailyStore } from '../stores/daily'
import { useIdiomStore } from '../stores/idiom'
import { useReviewStore } from '../stores/review'
import { useSettingsStore } from '../stores/settings'
import { useThemeStore, type ThemeColor, type ThemeMode } from '../stores/theme'
import { readProfileIdentity, saveProfileIdentity } from '../utils/profileAvatar'
import type {
  DailySyncData,
  IdiomSyncData,
  LocalSyncPayload,
  ProfileSyncData,
  ReviewSyncData,
  ReviewSyncWordStat,
  SyncSummary
} from '../types/sync'
import type { CompareRecord, IdiomData, SearchRecord } from '../types/idiom'

export const LOCAL_BACKUP_LIMIT = 3
export const LOCAL_BACKUP_STORAGE_KEY = 'word-learning-local-backups-v1'

export type SafeBackupPayload = Omit<LocalSyncPayload, 'apiSettings'>

export interface LocalBackupPreferences {
  reviewTarget: number
  appearance: {
    theme: ThemeMode
    followSystem: boolean
    themeColor: ThemeColor
  }
}

export interface LocalBackupDocument {
  kind: 'word-learning-backup'
  version: 1
  createdAt: number
  payload: SafeBackupPayload
  preferences: LocalBackupPreferences
}

export interface PreparedLocalBackup {
  id: string
  document: LocalBackupDocument
  summary: SyncSummary
  legacy: boolean
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, '')
  if (['apisettings', 'ciphertext', 'authorization'].includes(normalized)) return true
  if (/(?:apikey|password|passphrase|secret|credential|credentials)$/.test(normalized)) return true
  return /token$/.test(normalized)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function summarizeBackupPayload(payload: SafeBackupPayload): SyncSummary {
  const articles = payload.daily.issues.flatMap(issue => issue.articles)
  return {
    words: Object.keys(payload.idiom.idiomCache).length,
    searches: payload.idiom.searchHistory.length,
    comparisons: payload.idiom.compareHistory.length,
    favorites: payload.idiom.favorites.length,
    reviewWords: Object.keys(payload.review.wordStats).length,
    masteredReviewWords: Object.values(payload.review.wordStats).filter(stat => stat.state === 'mastered').length,
    dailyIssues: payload.daily.issues.length,
    dailyArticles: articles.length,
    dailyStarredArticles: articles.filter(article => article.starred === true).length,
    dailyCompletedArticles: articles.filter(article => typeof article.completedAt === 'number' && article.completedAt > 0).length
  }
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  const number = finite(value, fallback)
  return Math.max(0, Math.floor(number))
}

function strings(value: unknown, fallback: string[] = []): string[] {
  if (value === undefined) return [...fallback]
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('备份数据格式不正确')
  return [...new Set(value)]
}

function numberMap(value: unknown): Record<string, number> {
  if (value === undefined) return {}
  if (!isRecord(value)) throw new Error('备份数据格式不正确')
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) throw new Error('备份数据格式不正确')
    return [key, Math.max(0, item)]
  }))
}

function assertNoSensitiveFields(value: unknown, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`))
    return
  }
  if (!isRecord(value)) return
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) throw new Error('备份包含敏感认证字段，已拒绝恢复')
    assertNoSensitiveFields(item, path ? `${path}.${key}` : key)
  }
}

function normalizeIdiom(value: unknown, fallbackWord: string): IdiomData {
  if (!isRecord(value)) throw new Error('学习内容格式不正确')
  const word = typeof value.word === 'string' && value.word.trim() ? value.word.trim() : fallbackWord.trim()
  if (!word) throw new Error('学习内容格式不正确')
  const text = (key: string) => value[key] === undefined ? '' : typeof value[key] === 'string' ? value[key] as string : (() => { throw new Error('学习内容格式不正确') })()
  const relatedIdioms = value.relatedIdioms === undefined ? [] : strings(value.relatedIdioms)
  const createdAt = finite(value.createdAt, 0)
  const tokenUsage = value.tokenUsage === undefined ? undefined : nonNegativeInteger(value.tokenUsage)
  return {
    id: typeof value.id === 'string' && value.id ? value.id : word,
    word,
    pinyin: text('pinyin'),
    explanation: text('explanation'),
    origin: text('origin'),
    example: text('example'),
    usage: text('usage'),
    relatedIdioms,
    ...(tokenUsage === undefined ? {} : { tokenUsage }),
    createdAt
  }
}

function normalizeCompare(value: unknown): CompareRecord {
  if (!isRecord(value) || !Array.isArray(value.words) || value.words.some(word => typeof word !== 'string') || !isRecord(value.content)) {
    throw new Error('对比记录格式不正确')
  }
  const content = value.content
  for (const key of ['meaningDiff', 'usageDiff', 'scenarios', 'confusionPoints']) {
    if (typeof content[key] !== 'string') throw new Error('对比记录格式不正确')
  }
  return {
    id: typeof value.id === 'string' ? value.id : value.words.join('|'),
    words: value.words as string[],
    content: {
      meaningDiff: content.meaningDiff as string,
      usageDiff: content.usageDiff as string,
      scenarios: content.scenarios as string,
      confusionPoints: content.confusionPoints as string
    },
    tokenUsage: nonNegativeInteger(value.tokenUsage),
    createdAt: finite(value.createdAt, 0)
  }
}

function normalizeIdiomData(value: unknown): IdiomSyncData {
  if (!isRecord(value) || !isRecord(value.idiomCache) || !Array.isArray(value.searchHistory)) throw new Error('学习数据格式不正确')
  const idiomCache = Object.fromEntries(Object.entries(value.idiomCache).map(([word, item]) => [word, normalizeIdiom(item, word)]))
  const searchHistory: SearchRecord[] = value.searchHistory.map((item, index) => {
    if (!isRecord(item) || typeof item.word !== 'string') throw new Error('搜索历史格式不正确')
    return {
      id: typeof item.id === 'string' ? item.id : `legacy-search-${index}-${item.word}`,
      word: item.word,
      timestamp: finite(item.timestamp, 0)
    }
  })
  const compareCache = isRecord(value.compareCache)
    ? Object.fromEntries(Object.entries(value.compareCache).map(([key, item]) => [key, normalizeCompare(item)]))
    : {}
  const compareHistory = value.compareHistory === undefined
    ? []
    : Array.isArray(value.compareHistory)
      ? value.compareHistory.map(normalizeCompare)
      : (() => { throw new Error('对比历史格式不正确') })()
  const tokenStats = isRecord(value.tokenStats)
    ? { totalTokens: nonNegativeInteger(value.tokenStats.totalTokens), requestCount: nonNegativeInteger(value.tokenStats.requestCount) }
    : { totalTokens: 0, requestCount: 0 }
  return {
    idiomCache,
    searchHistory,
    compareCache,
    compareHistory,
    tokenStats,
    favorites: strings(value.favorites),
    queryCounts: numberMap(value.queryCounts)
  }
}

function normalizeReviewWordStat(value: unknown, dueAt = 0): ReviewSyncWordStat {
  if (!isRecord(value)) throw new Error('复习进度格式不正确')
  const lastReviewedAt = finite(value.lastReviewedAt, finite(value.lastAt, 0))
  const rawState = typeof value.state === 'string' ? value.state : ''
  const state = ['new', 'learning', 'review', 'mastered'].includes(rawState)
    ? rawState as ReviewSyncWordStat['state']
    : lastReviewedAt > 0 ? 'learning' : 'new'
  return {
    state,
    nextReviewAt: finite(value.nextReviewAt, lastReviewedAt || dueAt),
    interval: Math.min(60, nonNegativeInteger(value.interval)),
    correctCount: nonNegativeInteger(value.correctCount),
    wrongCount: nonNegativeInteger(value.wrongCount, nonNegativeInteger(value.wrong)),
    lastReviewedAt
  }
}

function emptyReview(wordStats: Record<string, ReviewSyncWordStat>): ReviewSyncData {
  return {
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
    wordStats
  }
}

function normalizeReviewData(value: unknown, idiom: IdiomSyncData): ReviewSyncData {
  const derivedStats = Object.fromEntries(Object.entries(idiom.idiomCache).map(([word, item]) => [
    word,
    normalizeReviewWordStat({ state: 'new', nextReviewAt: item.createdAt || 0, interval: 0, correctCount: 0, wrongCount: 0, lastReviewedAt: 0 }, item.createdAt || 0)
  ]))
  if (value === undefined) return emptyReview(derivedStats)
  if (!isRecord(value)) throw new Error('复习数据格式不正确')
  const phase = value.phase === undefined ? 'idle' : value.phase
  if (!['idle', 'reviewing', 'finished'].includes(String(phase))) throw new Error('复习数据格式不正确')
  const rawStats = value.wordStats === undefined
    ? derivedStats
    : isRecord(value.wordStats)
      ? Object.fromEntries(Object.entries(value.wordStats).map(([word, stat]) => [word, normalizeReviewWordStat(stat)]))
      : (() => { throw new Error('复习数据格式不正确') })()
  const history = value.history === undefined ? [] : value.history
  if (!Array.isArray(history)) throw new Error('复习数据格式不正确')
  const normalizedHistory = history.map(item => {
    if (!isRecord(item)) throw new Error('复习历史格式不正确')
    const snapshotStats = item.wordStats === undefined
      ? undefined
      : isRecord(item.wordStats)
        ? Object.fromEntries(Object.entries(item.wordStats).map(([word, stat]) => [word, normalizeReviewWordStat(stat)]))
        : (() => { throw new Error('复习历史格式不正确') })()
    return {
      queue: strings(item.queue),
      done: strings(item.done),
      levels: numberMap(item.levels),
      thresholds: numberMap(item.thresholds),
      wrongToday: numberMap(item.wrongToday),
      ...(snapshotStats ? { wordStats: snapshotStats } : {}),
      ...(item.reviewedToday === undefined ? {} : { reviewedToday: strings(item.reviewedToday) }),
      ...(typeof item.reviewedDay === 'string' ? { reviewedDay: item.reviewedDay } : {})
    }
  })
  const lastResult = value.lastResult === undefined || value.lastResult === null
    ? null
    : isRecord(value.lastResult)
      ? (() => {
          const result = value.lastResult
          if (!Array.isArray(result.words) || result.words.some(word => typeof word !== 'string')
            || !Array.isArray(result.wrongWords) || result.wrongWords.some(word => typeof word !== 'string')
            || typeof result.perfect !== 'boolean') throw new Error('复习结果格式不正确')
          return {
            reviewedAt: finite(result.reviewedAt, 0),
            words: result.words as string[],
            wrongWords: result.wrongWords as string[],
            wrongCount: nonNegativeInteger(result.wrongCount),
            elapsedMs: nonNegativeInteger(result.elapsedMs),
            perfect: result.perfect
          }
        })()
      : (() => { throw new Error('复习结果格式不正确') })()
  return {
    phase: phase as ReviewSyncData['phase'],
    queue: strings(value.queue),
    done: strings(value.done),
    levels: numberMap(value.levels),
    thresholds: numberMap(value.thresholds),
    wrongToday: numberMap(value.wrongToday),
    history: normalizedHistory,
    target: nonNegativeInteger(value.target),
    startedAt: finite(value.startedAt, 0),
    elapsedMs: nonNegativeInteger(value.elapsedMs),
    lastResult,
    finishedToday: nonNegativeInteger(value.finishedToday),
    lastFinishedDay: typeof value.lastFinishedDay === 'string' ? value.lastFinishedDay : '',
    reviewedToday: strings(value.reviewedToday),
    reviewedDay: typeof value.reviewedDay === 'string' ? value.reviewedDay : '',
    wordStats: rawStats
  }
}

function normalizeDailyData(value: unknown): DailySyncData {
  if (!isRecord(value) || !Array.isArray(value.issues)) throw new Error('日报数据格式不正确')
  const issues = value.issues.map(issue => {
    if (!isRecord(issue) || typeof issue.id !== 'string' || !issue.id || !Number.isFinite(issue.createdAt) || !Array.isArray(issue.articles)) {
      throw new Error('日报数据格式不正确')
    }
    for (const article of issue.articles) {
      if (!isRecord(article)
        || !['title', 'source', 'url', 'publishedAt', 'content', 'analysis'].every(key => typeof article[key] === 'string')
        || !Array.isArray(article.words) || article.words.some(word => typeof word !== 'string')) {
        throw new Error('日报文章格式不正确')
      }
      if (article.origin !== undefined && !['pdf', 'link'].includes(String(article.origin))) throw new Error('日报文章格式不正确')
      if (article.starred !== undefined && typeof article.starred !== 'boolean') throw new Error('日报文章格式不正确')
      if (article.completedAt !== undefined && !Number.isFinite(article.completedAt)) throw new Error('日报文章格式不正确')
    }
    if (issue.pdf !== undefined && !isRecord(issue.pdf)) throw new Error('PDF 日报格式不正确')
    return clone(issue) as unknown as DailySyncData['issues'][number]
  })
  const groups = value.groups === undefined ? [] : value.groups
  if (!Array.isArray(groups)) throw new Error('日报分组格式不正确')
  const normalizedGroups = groups.map(group => {
    if (!isRecord(group) || typeof group.id !== 'string' || typeof group.name !== 'string') throw new Error('日报分组格式不正确')
    return {
      id: group.id,
      name: group.name,
      collapsed: group.collapsed === true,
      createdAt: finite(group.createdAt, 0)
    }
  })
  return {
    issues,
    groups: normalizedGroups,
    selectedId: typeof value.selectedId === 'string' ? value.selectedId : issues[0]?.id || ''
  }
}

function normalizeProfile(value: unknown, fallback: ProfileSyncData): ProfileSyncData {
  if (value === undefined) return clone(fallback)
  if (!isRecord(value)) throw new Error('个人资料格式不正确')
  return {
    name: typeof value.name === 'string' ? value.name.trim() : fallback.name,
    nameUpdatedAt: finite(value.nameUpdatedAt, fallback.nameUpdatedAt),
    avatarDataUrl: typeof value.avatarDataUrl === 'string' ? value.avatarDataUrl : fallback.avatarDataUrl,
    avatarUpdatedAt: finite(value.avatarUpdatedAt, fallback.avatarUpdatedAt)
  }
}

function currentPreferences(): LocalBackupPreferences {
  const settings = useSettingsStore()
  const theme = useThemeStore()
  return {
    reviewTarget: nonNegativeInteger(settings.reviewTarget, 10),
    appearance: {
      theme: theme.theme,
      followSystem: theme.followSystem,
      themeColor: theme.themeColor
    }
  }
}

function normalizePreferences(value: unknown, fallback = currentPreferences()): LocalBackupPreferences {
  if (value === undefined) return clone(fallback)
  if (!isRecord(value)) throw new Error('偏好设置格式不正确')
  const appearance = value.appearance
  if (appearance !== undefined && !isRecord(appearance)) throw new Error('偏好设置格式不正确')
  const theme = isRecord(appearance) && ['light', 'dark'].includes(String(appearance.theme))
    ? appearance.theme as ThemeMode
    : fallback.appearance.theme
  const themeColor = isRecord(appearance) && ['cinnabar', 'dai', 'bamboo', 'violet'].includes(String(appearance.themeColor))
    ? appearance.themeColor as ThemeColor
    : fallback.appearance.themeColor
  return {
    reviewTarget: value.reviewTarget === undefined ? fallback.reviewTarget : Math.min(1000, nonNegativeInteger(value.reviewTarget, fallback.reviewTarget)),
    appearance: {
      theme,
      followSystem: isRecord(appearance) && typeof appearance.followSystem === 'boolean' ? appearance.followSystem : fallback.appearance.followSystem,
      themeColor
    }
  }
}

function payloadFromCurrent(capturedAt = Date.now()): SafeBackupPayload {
  return clone({
    version: 2 as const,
    capturedAt,
    profile: readProfileIdentity(),
    idiom: useIdiomStore().exportSyncData(),
    review: useReviewStore().exportSyncData(),
    daily: useDailyStore().exportSyncData()
  })
}

function preparePayload(value: unknown, fallbackProfile: ProfileSyncData): SafeBackupPayload {
  if (!isRecord(value)) throw new Error('备份数据格式不正确')
  if (value.apiSettings !== undefined) throw new Error('备份包含 API 配置，已拒绝恢复')
  const idiom = normalizeIdiomData(value.idiom)
  const review = normalizeReviewData(value.review, idiom)
  const daily = normalizeDailyData(value.daily)
  return {
    version: 2,
    capturedAt: finite(value.capturedAt, 0),
    profile: normalizeProfile(value.profile, fallbackProfile),
    idiom,
    review,
    daily
  }
}

function prepareLegacy(value: Record<string, unknown>, fallbackProfile: ProfileSyncData): LocalBackupDocument {
  const idiom = normalizeIdiomData(value)
  const review = normalizeReviewData(undefined, idiom)
  const daily = normalizeDailyData({
    issues: Array.isArray(value.dailyIssues) ? value.dailyIssues : [],
    groups: Array.isArray(value.dailyGroups) ? value.dailyGroups : [],
    selectedId: ''
  })
  const createdAt = Math.max(
    ...Object.values(idiom.idiomCache).map(item => item.createdAt || 0),
    ...daily.issues.map(issue => issue.createdAt || 0),
    0
  )
  return {
    kind: 'word-learning-backup',
    version: 1,
    createdAt,
    payload: {
      version: 2,
      capturedAt: createdAt,
      profile: clone(fallbackProfile),
      idiom,
      review,
      daily
    },
    preferences: currentPreferences()
  }
}

export function prepareLocalBackup(value: unknown): PreparedLocalBackup {
  assertNoSensitiveFields(value)
  const fallbackProfile = readProfileIdentity()
  let document: LocalBackupDocument
  let legacy = false
  if (isRecord(value) && value.kind === 'word-learning-backup') {
    if (value.version !== 1 || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) throw new Error('备份版本无法识别')
    document = {
      kind: 'word-learning-backup',
      version: 1,
      createdAt: value.createdAt,
      payload: preparePayload(value.payload, fallbackProfile),
      preferences: normalizePreferences(value.preferences)
    }
  } else if (isRecord(value) && isRecord(value.payload) && (value.version === 1 || value.version === 2)) {
    document = {
      kind: 'word-learning-backup',
      version: 1,
      createdAt: finite(value.createdAt, finite(value.capturedAt, 0)),
      payload: preparePayload(value.payload, fallbackProfile),
      preferences: normalizePreferences(value.preferences)
    }
    legacy = true
  } else if (isRecord(value) && isRecord(value.idiom) && isRecord(value.daily)) {
    document = {
      kind: 'word-learning-backup',
      version: 1,
      createdAt: finite(value.capturedAt, 0),
      payload: preparePayload(value, fallbackProfile),
      preferences: normalizePreferences(value.preferences)
    }
    legacy = true
  } else if (isRecord(value) && isRecord(value.idiomCache) && Array.isArray(value.searchHistory)) {
    document = prepareLegacy(value, fallbackProfile)
    legacy = true
  } else {
    throw new Error('备份格式无法识别')
  }
  assertNoSensitiveFields(document)
  const id = `${document.createdAt.toString(36)}-${document.payload.capturedAt.toString(36)}`
  return { id, document, summary: summarizeBackupPayload(document.payload), legacy }
}

export function serializeLocalBackup(document: LocalBackupDocument): string {
  assertNoSensitiveFields(document)
  return JSON.stringify(document, null, 2)
}

export function createLocalBackup(now = Date.now()): PreparedLocalBackup {
  const document: LocalBackupDocument = {
    kind: 'word-learning-backup',
    version: 1,
    createdAt: now,
    payload: payloadFromCurrent(now),
    preferences: currentPreferences()
  }
  const prepared = prepareLocalBackup(document)
  const previous = readLocalBackups()
  const next = [prepared, ...previous.filter(item => item.id !== prepared.id)].slice(0, LOCAL_BACKUP_LIMIT)
  localStorage.setItem(LOCAL_BACKUP_STORAGE_KEY, JSON.stringify(next.map(item => item.document)))
  return prepared
}

export function readLocalBackups(): PreparedLocalBackup[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_BACKUP_STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.flatMap(item => {
      try { return [prepareLocalBackup(item)] } catch { return [] }
    }).sort((a, b) => b.document.createdAt - a.document.createdAt).slice(0, LOCAL_BACKUP_LIMIT)
  } catch {
    return []
  }
}

function applyPreferences(value: LocalBackupPreferences) {
  const settings = useSettingsStore()
  const theme = useThemeStore()
  settings.reviewTarget = value.reviewTarget
  theme.setThemeColor(value.appearance.themeColor)
  if (value.appearance.followSystem) theme.setFollowSystem(true)
  else theme.setTheme(value.appearance.theme)
}

function applyPayload(value: SafeBackupPayload) {
  if (!saveProfileIdentity(clone(value.profile))) throw new Error('个人资料无法保存到本机')
  useIdiomStore().restoreSyncData(clone(value.idiom))
  useReviewStore().restoreSyncData(clone(value.review))
  useDailyStore().restoreSyncData(clone(value.daily))
}

export async function restorePreparedLocalBackup(prepared: PreparedLocalBackup): Promise<void> {
  const normalized = prepareLocalBackup(prepared.document)
  const beforePayload = payloadFromCurrent()
  const beforePreferences = currentPreferences()
  try {
    applyPayload(normalized.document.payload)
    applyPreferences(normalized.document.preferences)
  } catch (error) {
    let rollbackFailed = false
    try {
      applyPayload(beforePayload)
      applyPreferences(beforePreferences)
    } catch {
      rollbackFailed = true
    }
    if (rollbackFailed) throw new Error('恢复失败，且本机回滚未能完整完成；请重新载入页面并使用最近备份')
    throw new Error(error instanceof Error ? error.message : '恢复失败，原数据已保留')
  }
}

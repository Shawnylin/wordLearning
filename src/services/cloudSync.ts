import { useDailyStore } from '../stores/daily'
import { useIdiomStore } from '../stores/idiom'
import { useReviewStore } from '../stores/review'
import { useAuthStore } from '../stores/auth'
import { cloudbaseRdb } from './cloudbase'
import { readProfileIdentity, saveProfileIdentity } from '../utils/profileAvatar'
import type { CompareRecord } from '../types/idiom'
import type {
  DailySyncData,
  IdiomSyncData,
  LocalSyncPayload,
  ProfileSyncData,
  ReviewSyncData,
  ReviewSyncWordStat,
  SyncSummary
} from '../types/sync'

const TABLE_NAME = 'user_sync_snapshots'

export interface RemoteSyncSnapshot {
  payload: LocalSyncPayload
  updatedAt: string
  localUpdatedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function messageFrom(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const message = readString(error.message)
    if (message) return message
  }
  return fallback
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function parseSyncPayload(value: unknown): LocalSyncPayload | null {
  if (!isRecord(value) || ![1, 2].includes(Number(value.version)) || typeof value.capturedAt !== 'number') return null
  const idiom = value.idiom
  const review = value.review
  const daily = value.daily
  if (!isRecord(idiom) || !isRecord(review) || !isRecord(daily)) return null
  if (!isRecord(idiom.idiomCache) || !Array.isArray(idiom.searchHistory) || !isRecord(idiom.compareCache) || !Array.isArray(idiom.compareHistory) || !isRecord(idiom.tokenStats) || !Array.isArray(idiom.favorites) || !isRecord(idiom.queryCounts)) return null
  if (!['idle', 'reviewing', 'finished'].includes(String(review.phase)) || !Array.isArray(review.queue) || !Array.isArray(review.done) || !isRecord(review.levels) || !isRecord(review.thresholds) || !isRecord(review.wrongToday) || !Array.isArray(review.history) || !isRecord(review.wordStats)) return null
  if (!Array.isArray(daily.issues) || !Array.isArray(daily.groups) || typeof daily.selectedId !== 'string') return null
  const rawProfile = isRecord(value.profile) ? value.profile : {}
  const profile: ProfileSyncData = {
    name: typeof rawProfile.name === 'string' ? rawProfile.name.trim() : '',
    nameUpdatedAt: typeof rawProfile.nameUpdatedAt === 'number' ? rawProfile.nameUpdatedAt : 0,
    avatarDataUrl: typeof rawProfile.avatarDataUrl === 'string' ? rawProfile.avatarDataUrl : '',
    avatarUpdatedAt: typeof rawProfile.avatarUpdatedAt === 'number' ? rawProfile.avatarUpdatedAt : 0
  }
  return clone({ ...value, version: 2 as const, profile }) as LocalSyncPayload
}

function chooseByTime<T>(local: T | undefined, remote: T | undefined, getTime: (value: T) => number, preferRemote: boolean): T | undefined {
  if (!local) return remote
  if (!remote) return local
  const localTime = getTime(local)
  const remoteTime = getTime(remote)
  if (remoteTime > localTime || (remoteTime === localTime && preferRemote)) return remote
  return local
}

function mergeMap<T>(local: Record<string, T>, remote: Record<string, T>, getTime: (value: T) => number, preferRemote: boolean): Record<string, T> {
  const result: Record<string, T> = {}
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const key of keys) {
    const selected = chooseByTime(local[key], remote[key], getTime, preferRemote)
    if (selected) result[key] = clone(selected)
  }
  return result
}

function mergeList<T>(local: T[], remote: T[], getKey: (value: T) => string, getTime: (value: T) => number, preferRemote: boolean): T[] {
  const localMap = new Map(local.map(item => [getKey(item), item]))
  const remoteMap = new Map(remote.map(item => [getKey(item), item]))
  const keys = new Set([...localMap.keys(), ...remoteMap.keys()])
  const result: T[] = []
  for (const key of keys) {
    const selected = chooseByTime(localMap.get(key), remoteMap.get(key), getTime, preferRemote)
    if (selected) result.push(clone(selected))
  }
  return result
}

function maxNumberMap(local: Record<string, number>, remote: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    result[key] = Math.max(local[key] || 0, remote[key] || 0)
  }
  return result
}

function compareKey(record: CompareRecord): string {
  return [...record.words].sort().join('|')
}

function reviewActivity(review: ReviewSyncData): number {
  return Math.max(review.startedAt, review.lastResult?.reviewedAt || 0, review.elapsedMs)
}

function mergeReview(local: ReviewSyncData, remote: ReviewSyncData, preferRemote: boolean): ReviewSyncData {
  const current = chooseByTime(local, remote, reviewActivity, preferRemote) || local
  const wordStats: Record<string, ReviewSyncWordStat> = {}
  for (const word of new Set([...Object.keys(local.wordStats), ...Object.keys(remote.wordStats)])) {
    const left = local.wordStats[word]
    const right = remote.wordStats[word]
    if (!left) wordStats[word] = clone(right)
    else if (!right) wordStats[word] = clone(left)
    else if (right.lastAt > left.lastAt) wordStats[word] = clone(right)
    else wordStats[word] = { wrong: Math.max(left.wrong, right.wrong), lastAt: left.lastAt }
  }
  const latestDay = remote.lastFinishedDay > local.lastFinishedDay ? remote.lastFinishedDay : local.lastFinishedDay
  return {
    ...clone(current),
    wrongToday: maxNumberMap(local.wrongToday, remote.wrongToday),
    finishedToday: Math.max(local.finishedToday, remote.finishedToday),
    lastFinishedDay: latestDay,
    wordStats
  }
}

export function summarizeSyncPayload(payload: LocalSyncPayload): SyncSummary {
  return {
    words: Object.keys(payload.idiom.idiomCache).length,
    searches: payload.idiom.searchHistory.length,
    comparisons: payload.idiom.compareHistory.length,
    favorites: payload.idiom.favorites.length,
    reviewWords: Object.keys(payload.review.wordStats).length,
    dailyIssues: payload.daily.issues.length,
    dailyArticles: payload.daily.issues.reduce((total, issue) => total + issue.articles.length, 0)
  }
}

export function mergeSyncPayload(local: LocalSyncPayload, remote: LocalSyncPayload, prefer: 'local' | 'remote' = 'local'): LocalSyncPayload {
  const preferRemote = prefer === 'remote'
  const profile: ProfileSyncData = {
    name: remote.profile.nameUpdatedAt > local.profile.nameUpdatedAt || (remote.profile.nameUpdatedAt === local.profile.nameUpdatedAt && preferRemote)
      ? remote.profile.name
      : local.profile.name,
    nameUpdatedAt: Math.max(local.profile.nameUpdatedAt, remote.profile.nameUpdatedAt),
    avatarDataUrl: remote.profile.avatarUpdatedAt > local.profile.avatarUpdatedAt || (remote.profile.avatarUpdatedAt === local.profile.avatarUpdatedAt && preferRemote)
      ? remote.profile.avatarDataUrl
      : local.profile.avatarDataUrl,
    avatarUpdatedAt: Math.max(local.profile.avatarUpdatedAt, remote.profile.avatarUpdatedAt)
  }
  const idiom: IdiomSyncData = {
    idiomCache: mergeMap(local.idiom.idiomCache, remote.idiom.idiomCache, item => item.createdAt, preferRemote),
    searchHistory: mergeList(local.idiom.searchHistory, remote.idiom.searchHistory, item => item.word, item => item.timestamp, preferRemote),
    compareCache: mergeMap(local.idiom.compareCache, remote.idiom.compareCache, item => item.createdAt, preferRemote),
    compareHistory: mergeList(local.idiom.compareHistory, remote.idiom.compareHistory, compareKey, item => item.createdAt, preferRemote),
    tokenStats: {
      totalTokens: Math.max(local.idiom.tokenStats.totalTokens, remote.idiom.tokenStats.totalTokens),
      requestCount: Math.max(local.idiom.tokenStats.requestCount, remote.idiom.tokenStats.requestCount)
    },
    favorites: [...new Set([...local.idiom.favorites, ...remote.idiom.favorites])],
    queryCounts: maxNumberMap(local.idiom.queryCounts, remote.idiom.queryCounts)
  }
  const daily: DailySyncData = {
    issues: mergeList(local.daily.issues, remote.daily.issues, issue => issue.id, issue => issue.createdAt, preferRemote),
    groups: mergeList(local.daily.groups, remote.daily.groups, group => group.id, group => group.createdAt, preferRemote),
    selectedId: preferRemote && remote.daily.selectedId ? remote.daily.selectedId : local.daily.selectedId || remote.daily.selectedId
  }
  return {
    version: 2,
    capturedAt: Math.max(local.capturedAt, remote.capturedAt),
    profile,
    idiom,
    review: mergeReview(local.review, remote.review, preferRemote),
    daily
  }
}

export function buildLocalSyncPayload(): LocalSyncPayload {
  const idiom = useIdiomStore()
  const review = useReviewStore()
  const daily = useDailyStore()
  const auth = useAuthStore()
  return clone({
    version: 2 as const,
    capturedAt: Date.now(),
    profile: readProfileIdentity(auth.currentUser?.username),
    idiom: idiom.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData()
  })
}

export async function applyLocalSyncPayload(payload: LocalSyncPayload) {
  useIdiomStore().restoreSyncData(clone(payload.idiom))
  useReviewStore().restoreSyncData(clone(payload.review))
  useDailyStore().restoreSyncData(clone(payload.daily))
  if (!saveProfileIdentity(payload.profile)) throw new Error('个人资料无法保存到本机，请检查浏览器存储空间')
  const auth = useAuthStore()
  if (auth.currentUser && payload.profile.name && auth.currentUser.username !== payload.profile.name) {
    await auth.updateProfileName(payload.profile.name, payload.profile.nameUpdatedAt)
  }
}

export function hasSameSyncContent(left: LocalSyncPayload, right: LocalSyncPayload): boolean {
  return JSON.stringify({ profile: left.profile, idiom: left.idiom, review: left.review, daily: left.daily })
    === JSON.stringify({ profile: right.profile, idiom: right.idiom, review: right.review, daily: right.daily })
}

export async function loadRemoteSyncPayload(userId: string, sinceUpdatedAt?: string): Promise<RemoteSyncSnapshot | null> {
  if (!cloudbaseRdb) throw new Error('当前构建未配置 CloudBase 数据服务')
  let query = cloudbaseRdb
    .from(TABLE_NAME)
    .select('payload, schema_version, local_updated_at, updated_at')
    .eq('user_id', userId)
  if (sinceUpdatedAt) query = query.gt('updated_at', sinceUpdatedAt)
  const result = await query.limit(1)
  if (result.error) throw new Error(messageFrom(result.error, '读取云端学习数据失败'))
  const rows: unknown = result.data
  if (!Array.isArray(rows) || rows.length === 0) return null
  const row = rows[0]
  if (!isRecord(row)) throw new Error('云端学习数据格式无法识别，为保护本机数据，本次未执行同步')
  const payload = parseSyncPayload(row.payload)
  if (!payload) throw new Error('云端学习数据格式无法识别，为保护本机数据，本次未执行同步')
  return {
    payload,
    updatedAt: readString(row.updated_at) || '',
    localUpdatedAt: typeof row.local_updated_at === 'number' ? row.local_updated_at : Number(row.local_updated_at) || 0
  }
}

export async function saveRemoteSyncPayload(userId: string, payload: LocalSyncPayload): Promise<RemoteSyncSnapshot> {
  if (!cloudbaseRdb) throw new Error('当前构建未配置 CloudBase 数据服务')
  const updatedAt = new Date().toISOString()
  const record = {
    user_id: userId,
    payload: clone(payload),
    schema_version: 2,
    local_updated_at: payload.capturedAt,
    updated_at: updatedAt
  }
  const result = await cloudbaseRdb
    .from(TABLE_NAME)
    .upsert(record, { onConflict: 'user_id' })
  if (result.error) throw new Error(messageFrom(result.error, '保存云端学习数据失败'))
  return { payload: clone(payload), updatedAt, localUpdatedAt: payload.capturedAt }
}

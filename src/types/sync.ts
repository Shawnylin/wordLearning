import type { EncryptedApiSettings } from '../utils/apiVaultCrypto'
import type { DailyIssue } from '../api/daily'
import type { DailyGroup } from '../stores/daily'
import type { CompareRecord, IdiomData, SearchRecord, TokenStats } from './idiom'

export type SyncChoice = 'no-upload' | 'download' | 'merge-local-to-cloud' | 'merge-cloud-to-local'

export type SyncDomain = 'profile' | 'idiom' | 'review' | 'daily' | 'apiSettings'

export interface SyncState {
  pendingDomains: SyncDomain[]
  lastLocalChangeAt: number
  lastSyncAt: number
  lastRemoteUpdatedAt: string
  retryCount: number
  nextRetryAt: number
  lastError: string
}

export interface IdiomSyncData {
  idiomCache: Record<string, IdiomData>
  searchHistory: SearchRecord[]
  compareCache: Record<string, CompareRecord>
  compareHistory: CompareRecord[]
  tokenStats: TokenStats
  favorites: string[]
  queryCounts: Record<string, number>
}

export interface ReviewSyncSnapshot {
  queue: string[]
  done: string[]
  levels: Record<string, number>
  thresholds: Record<string, number>
  wrongToday: Record<string, number>
  wordStats?: Record<string, ReviewSyncWordStat>
  reviewedToday?: string[]
  reviewedDay?: string
}

export interface ReviewSyncWordStat {
  state: 'new' | 'learning' | 'review' | 'mastered'
  nextReviewAt: number
  interval: number
  correctCount: number
  wrongCount: number
  lastReviewedAt: number
  /** v0.9.3 及更早版本兼容字段，仅用于迁移旧快照 */
  wrong?: number
  lastAt?: number
}

export interface ReviewSyncResult {
  reviewedAt: number
  words: string[]
  wrongWords: string[]
  wrongCount: number
  elapsedMs: number
  perfect: boolean
}

export interface ReviewSyncData {
  phase: 'idle' | 'reviewing' | 'finished'
  queue: string[]
  done: string[]
  levels: Record<string, number>
  thresholds: Record<string, number>
  wrongToday: Record<string, number>
  history: ReviewSyncSnapshot[]
  target: number
  startedAt: number
  elapsedMs: number
  lastResult: ReviewSyncResult | null
  finishedToday: number
  lastFinishedDay: string
  reviewedToday?: string[]
  reviewedDay?: string
  wordStats: Record<string, ReviewSyncWordStat>
}

export interface DailySyncData {
  issues: DailyIssue[]
  groups: DailyGroup[]
  selectedId: string
}

export interface ProfileSyncData {
  name: string
  nameUpdatedAt: number
  avatarDataUrl: string
  avatarUpdatedAt: number
}

export interface LocalSyncPayload {
  version: 2
  apiSettings?: EncryptedApiSettings
  capturedAt: number
  profile: ProfileSyncData
  idiom: IdiomSyncData
  review: ReviewSyncData
  daily: DailySyncData
}

export interface SyncSummary {
  words: number
  searches: number
  comparisons: number
  favorites: number
  reviewWords: number
  dailyIssues: number
  dailyArticles: number
}

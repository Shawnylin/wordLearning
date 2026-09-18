import type { DailyIssue } from '../api/daily'
import type { DailyGroup } from '../stores/daily'
import type { CompareRecord, IdiomData, SearchRecord, TokenStats } from './idiom'

export type SyncChoice = 'no-upload' | 'download' | 'merge-local-to-cloud' | 'merge-cloud-to-local'

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
}

export interface ReviewSyncWordStat {
  wrong: number
  lastAt: number
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
  wordStats: Record<string, ReviewSyncWordStat>
}

export interface DailySyncData {
  issues: DailyIssue[]
  groups: DailyGroup[]
  selectedId: string
}

export interface LocalSyncPayload {
  version: 1
  capturedAt: number
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

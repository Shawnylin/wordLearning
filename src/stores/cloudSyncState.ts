import type { SyncChoice, SyncDomain, SyncOperation, SyncRunResult, SyncRunSource, SyncState } from '../types/sync'

export interface SyncDecisionRecord {
  choice: SyncChoice
  completedAt: number
}

const DECISION_PREFIX = 'word-learning-cloud-sync:'
const STATE_PREFIX = 'word-learning-cloud-sync-state:'
const SYNC_CHOICES: readonly SyncChoice[] = ['no-upload', 'download', 'merge-local-to-cloud', 'merge-cloud-to-local']
const SYNC_OPERATIONS: readonly SyncOperation[] = [...SYNC_CHOICES, 'prepare']
const SYNC_SOURCES: readonly SyncRunSource[] = ['choice', 'manual', 'automatic', 'background', 'prepare']
const SYNC_RESULTS: readonly SyncRunResult[] = ['', 'success', 'failure']

export const AUTO_CHANGE_DELAY = 45_000
export const RETRY_DELAYS = [30_000, 120_000, 600_000] as const
export const SYNC_DOMAINS: readonly SyncDomain[] = ['profile', 'idiom', 'review', 'daily', 'apiSettings']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

export function sanitizeSyncError(value: unknown, fallback = '云同步失败，请稍后重试'): string {
  const raw = typeof value === 'string'
    ? value
    : isRecord(value) && typeof value.message === 'string'
      ? value.message
      : fallback
  const sanitized = raw
    .replace(/https?:\/\/[^\s]+/gi, '[地址已隐藏]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [已隐藏]')
    .replace(/((?:api[-_ ]?key|access[-_ ]?token|session[-_ ]?token|refresh[-_ ]?token|authorization|pass(?:word|phrase)|secret|credential)\s*[:=]\s*)[^\s,;]+/gi, '$1[已隐藏]')
    .replace(/\b(?:sk-|eyJ)[A-Za-z0-9._-]{12,}\b/g, '[凭据已隐藏]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
  return (sanitized || fallback).slice(0, 180)
}

export function decisionKey(userId: string): string {
  return `${DECISION_PREFIX}${userId}`
}

export function stateKey(userId: string): string {
  return `${STATE_PREFIX}${userId}`
}

export function createSyncState(lastSyncAt = 0): SyncState {
  return {
    pendingDomains: [],
    lastLocalChangeAt: 0,
    lastSyncAt,
    lastAttemptAt: 0,
    lastSyncOperation: '',
    lastSyncSource: '',
    lastSyncResult: '',
    lastRemoteUpdatedAt: '',
    retryCount: 0,
    nextRetryAt: 0,
    lastError: ''
  }
}

export function deserializeDecision(raw: string | null): SyncDecisionRecord | null {
  try {
    const value: unknown = JSON.parse(raw || 'null')
    if (!isRecord(value)) return null
    const choice = value.choice
    if (typeof choice !== 'string' || !SYNC_CHOICES.includes(choice as SyncChoice)) return null
    return {
      choice: choice as SyncChoice,
      completedAt: numberOr(value.completedAt, 0)
    }
  } catch {
    return null
  }
}

export function serializeDecision(choice: SyncChoice, completedAt: number): string {
  return JSON.stringify({ choice, completedAt } satisfies SyncDecisionRecord)
}

export function readDecision(userId: string): SyncDecisionRecord | null {
  try {
    return deserializeDecision(localStorage.getItem(decisionKey(userId)))
  } catch {
    return null
  }
}

export function saveDecision(userId: string, choice: SyncChoice, completedAt: number) {
  try {
    localStorage.setItem(decisionKey(userId), serializeDecision(choice, completedAt))
  } catch {
    // The learning data remains in the existing stores if metadata storage is unavailable.
  }
}

export function deserializeSyncState(raw: string | null, fallbackLastSyncAt = 0): SyncState {
  const fallback = createSyncState(fallbackLastSyncAt)
  try {
    const value: unknown = JSON.parse(raw || 'null')
    if (!isRecord(value)) return fallback
    const pendingDomains = Array.isArray(value.pendingDomains)
      ? value.pendingDomains.filter((domain): domain is SyncDomain => typeof domain === 'string' && SYNC_DOMAINS.includes(domain as SyncDomain))
      : []
    return {
      pendingDomains: [...new Set(pendingDomains)],
      lastLocalChangeAt: numberOr(value.lastLocalChangeAt, 0),
      lastSyncAt: numberOr(value.lastSyncAt, fallbackLastSyncAt),
      lastAttemptAt: numberOr(value.lastAttemptAt, 0),
      lastSyncOperation: typeof value.lastSyncOperation === 'string' && SYNC_OPERATIONS.includes(value.lastSyncOperation as SyncOperation)
        ? value.lastSyncOperation as SyncOperation
        : '',
      lastSyncSource: typeof value.lastSyncSource === 'string' && SYNC_SOURCES.includes(value.lastSyncSource as SyncRunSource)
        ? value.lastSyncSource as SyncRunSource
        : '',
      lastSyncResult: typeof value.lastSyncResult === 'string' && SYNC_RESULTS.includes(value.lastSyncResult as SyncRunResult)
        ? value.lastSyncResult as SyncRunResult
        : '',
      lastRemoteUpdatedAt: stringOr(value.lastRemoteUpdatedAt, ''),
      retryCount: Math.max(0, Math.floor(numberOr(value.retryCount, 0))),
      nextRetryAt: numberOr(value.nextRetryAt, 0),
      lastError: sanitizeSyncError(stringOr(value.lastError, ''), '')
    }
  } catch {
    return fallback
  }
}

export function serializeSyncState(state: SyncState): string {
  return JSON.stringify(state)
}

export function readSyncState(userId: string, fallbackLastSyncAt = 0): SyncState {
  try {
    return deserializeSyncState(localStorage.getItem(stateKey(userId)), fallbackLastSyncAt)
  } catch {
    return createSyncState(fallbackLastSyncAt)
  }
}

export function saveSyncState(userId: string, state: SyncState) {
  if (!userId) return
  try {
    localStorage.setItem(stateKey(userId), serializeSyncState(state))
  } catch {
    // The queue is best-effort metadata; the existing Pinia persistence remains authoritative.
  }
}

export function autoSyncDueAt(lastLocalChangeAt: number, nextRetryAt: number): number {
  return Math.max(lastLocalChangeAt + AUTO_CHANGE_DELAY, nextRetryAt)
}

export function nextRetrySchedule(currentRetryCount: number, now: number): Pick<SyncState, 'retryCount' | 'nextRetryAt'> {
  const retryCount = Math.min(currentRetryCount + 1, RETRY_DELAYS.length)
  return {
    retryCount,
    nextRetryAt: now + RETRY_DELAYS[retryCount - 1]
  }
}

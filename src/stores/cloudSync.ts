import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  applyLocalSyncPayload,
  buildLocalSyncPayload,
  loadRemoteSyncPayload,
  mergeSyncPayload,
  saveRemoteSyncPayload,
  summarizeSyncPayload
} from '../services/cloudSync'
import type { RemoteSyncSnapshot } from '../services/cloudSync'
import type { LocalSyncPayload, SyncChoice, SyncDomain, SyncState, SyncSummary } from '../types/sync'
import { useDailyStore } from './daily'
import { useIdiomStore } from './idiom'
import { useReviewStore } from './review'

interface SyncDecisionRecord {
  choice: SyncChoice
  completedAt: number
}

type SyncSource = 'choice' | 'manual' | 'automatic' | 'background'
type ForegroundReason = 'foreground' | 'resume' | 'online'

const DECISION_PREFIX = 'word-learning-cloud-sync:'
const STATE_PREFIX = 'word-learning-cloud-sync-state:'
const AUTO_CHANGE_DELAY = 45_000
const RETRY_DELAYS = [30_000, 120_000, 600_000] as const
const SYNC_DOMAINS: SyncDomain[] = ['idiom', 'review', 'daily']

export const syncChoiceLabels: Record<SyncChoice, string> = {
  'no-upload': '仅在本机',
  download: '下载到本机',
  'merge-local-to-cloud': '合并到云端',
  'merge-cloud-to-local': '合并到本机'
}

function decisionKey(userId: string): string {
  return `${DECISION_PREFIX}${userId}`
}

function stateKey(userId: string): string {
  return `${STATE_PREFIX}${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function createSyncState(lastSyncAt = 0): SyncState {
  return {
    pendingDomains: [],
    lastLocalChangeAt: 0,
    lastSyncAt,
    lastRemoteUpdatedAt: '',
    retryCount: 0,
    nextRetryAt: 0,
    lastError: ''
  }
}

function readDecision(userId: string): SyncDecisionRecord | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(decisionKey(userId)) || 'null')
    if (!isRecord(value)) return null
    const choice = value.choice
    if (typeof choice !== 'string' || !Object.prototype.hasOwnProperty.call(syncChoiceLabels, choice)) return null
    return {
      choice: choice as SyncChoice,
      completedAt: numberOr(value.completedAt, 0)
    }
  } catch {
    return null
  }
}

function saveDecision(userId: string, choice: SyncChoice, completedAt: number) {
  try {
    localStorage.setItem(decisionKey(userId), JSON.stringify({ choice, completedAt } satisfies SyncDecisionRecord))
  } catch {
    // The learning data remains in the existing stores if metadata storage is unavailable.
  }
}

function readSyncState(userId: string, fallbackLastSyncAt = 0): SyncState {
  const fallback = createSyncState(fallbackLastSyncAt)
  try {
    const value: unknown = JSON.parse(localStorage.getItem(stateKey(userId)) || 'null')
    if (!isRecord(value)) return fallback
    const pendingDomains = Array.isArray(value.pendingDomains)
      ? value.pendingDomains.filter((domain): domain is SyncDomain => typeof domain === 'string' && SYNC_DOMAINS.includes(domain as SyncDomain))
      : []
    return {
      pendingDomains: [...new Set(pendingDomains)],
      lastLocalChangeAt: numberOr(value.lastLocalChangeAt, 0),
      lastSyncAt: numberOr(value.lastSyncAt, fallbackLastSyncAt),
      lastRemoteUpdatedAt: stringOr(value.lastRemoteUpdatedAt, ''),
      retryCount: Math.max(0, Math.floor(numberOr(value.retryCount, 0))),
      nextRetryAt: numberOr(value.nextRetryAt, 0),
      lastError: stringOr(value.lastError, '')
    }
  } catch {
    return fallback
  }
}

function saveSyncState(userId: string, state: SyncState) {
  if (!userId) return
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state))
  } catch {
    // The queue is best-effort metadata; the existing Pinia persistence remains authoritative.
  }
}

export const useCloudSyncStore = defineStore('cloudSync', () => {
  const activeUserId = ref('')
  const prepared = ref(false)
  const open = ref(false)
  const preparing = ref(false)
  const syncing = ref(false)
  const error = ref('')
  const notice = ref('')
  const selectedChoice = ref<SyncChoice | null>(null)
  const decision = ref<SyncDecisionRecord | null>(null)
  const syncState = ref<SyncState>(createSyncState())
  const localSnapshot = ref<LocalSyncPayload | null>(null)
  const remoteSnapshot = ref<LocalSyncPayload | null>(null)
  const localSummary = ref<SyncSummary | null>(null)
  const remoteSummary = ref<SyncSummary | null>(null)
  const remoteLoadFailed = ref(false)

  let autoTimer: ReturnType<typeof setTimeout> | undefined
  let autoUnsubscribers: Array<() => void> = []
  let applyingLocalSync = false

  const firstChoice = computed(() => decision.value === null)
  const pendingChanges = computed(() => syncState.value.pendingDomains.length > 0)
  const canUseCloudChoices = computed(() => !remoteLoadFailed.value)
  const statusLabel = computed(() => {
    if (preparing.value || syncing.value) return '正在同步'
    if (error.value || syncState.value.lastError || remoteLoadFailed.value) return '同步失败'
    if (!decision.value) return '待设置'
    if (decision.value.choice === 'no-upload') return '仅本机'
    if (pendingChanges.value) return '有待同步数据'
    return '已同步'
  })
  const autoSyncLabel = computed(() => {
    if (!decision.value) return '首次同步后设置'
    if (decision.value.choice === 'no-upload') return '已关闭'
    return '变更后 45 秒 · 后台补同步 · 失败递增退避'
  })
  const lastCompletedAt = computed(() => syncState.value.lastSyncAt || decision.value?.completedAt || 0)

  function patchSyncState(patch: Partial<SyncState>) {
    syncState.value = { ...syncState.value, ...patch }
    saveSyncState(activeUserId.value, syncState.value)
  }

  function clearAutoTimer() {
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = undefined
  }

  function stopAutoSync() {
    clearAutoTimer()
    for (const unsubscribe of autoUnsubscribers) unsubscribe()
    autoUnsubscribers = []
  }

  function automaticChoice(): 'merge-local-to-cloud' | 'merge-cloud-to-local' | null {
    if (!decision.value || decision.value.choice === 'no-upload') return null
    return decision.value.choice === 'merge-local-to-cloud' ? 'merge-local-to-cloud' : 'merge-cloud-to-local'
  }

  function scheduleAutoSync() {
    if (!activeUserId.value || !prepared.value || syncing.value || open.value || !automaticChoice() || !pendingChanges.value) return
    clearAutoTimer()
    const debounceAt = syncState.value.lastLocalChangeAt + AUTO_CHANGE_DELAY
    const dueAt = Math.max(debounceAt, syncState.value.nextRetryAt)
    autoTimer = setTimeout(() => {
      autoTimer = undefined
      const choice = automaticChoice()
      if (!choice || open.value || !pendingChanges.value) return
      if (Date.now() < syncState.value.nextRetryAt) {
        scheduleAutoSync()
        return
      }
      void executeChoice(choice, 'automatic')
    }, Math.max(0, dueAt - Date.now()))
  }

  function markLocalMutation(domain: SyncDomain) {
    if (!activeUserId.value || !prepared.value || applyingLocalSync || !automaticChoice()) return
    const now = Date.now()
    patchSyncState({
      pendingDomains: [...new Set([...syncState.value.pendingDomains, domain])],
      lastLocalChangeAt: now,
      retryCount: 0,
      nextRetryAt: 0,
      lastError: ''
    })
    error.value = ''
    scheduleAutoSync()
  }

  function startAutoSync() {
    stopAutoSync()
    autoUnsubscribers = [
      useIdiomStore().$subscribe(() => markLocalMutation('idiom')),
      useReviewStore().$subscribe(() => markLocalMutation('review')),
      useDailyStore().$subscribe(() => markLocalMutation('daily'))
    ]
    scheduleAutoSync()
  }

  function recordFailure(message: string, queueUpload: boolean) {
    const retryCount = Math.min(syncState.value.retryCount + 1, RETRY_DELAYS.length)
    const pendingDomains = syncState.value.pendingDomains.length > 0 || !queueUpload
      ? syncState.value.pendingDomains
      : [...SYNC_DOMAINS]
    patchSyncState({
      pendingDomains,
      retryCount,
      nextRetryAt: Date.now() + RETRY_DELAYS[retryCount - 1],
      lastError: message
    })
    if (pendingDomains.length > 0) scheduleAutoSync()
  }

  async function executeChoice(choice: SyncChoice, source: SyncSource): Promise<boolean> {
    const userId = activeUserId.value
    if (!userId || syncing.value) return false
    if ((source === 'automatic' || source === 'background') && !pendingChanges.value) return false

    const startedLocalChangeAt = syncState.value.lastLocalChangeAt
    const hadPendingChanges = pendingChanges.value
    syncing.value = true
    error.value = ''
    notice.value = ''
    try {
      let remoteRecord: RemoteSyncSnapshot | null = null
      let remote = remoteSnapshot.value
      let savedRecord: RemoteSyncSnapshot | null = null

      if (choice !== 'no-upload') {
        const sinceUpdatedAt = source === 'automatic' || source === 'background'
          ? syncState.value.lastRemoteUpdatedAt || undefined
          : undefined
        remoteRecord = await loadRemoteSyncPayload(userId, sinceUpdatedAt)
        if (remoteRecord) {
          remote = remoteRecord.payload
          remoteSnapshot.value = remoteRecord.payload
          remoteSummary.value = summarizeSyncPayload(remoteRecord.payload)
        }
      }

      const local = buildLocalSyncPayload()
      let result = local
      if (choice === 'download') {
        if (!remote) throw new Error('云端还没有同步数据，为保护本机数据，本次未执行下载')
        result = syncState.value.lastLocalChangeAt > startedLocalChangeAt
          ? mergeSyncPayload(local, remote, 'local')
          : remote
      } else if (choice === 'merge-local-to-cloud') {
        result = remote ? mergeSyncPayload(local, remote, 'local') : local
        savedRecord = await saveRemoteSyncPayload(userId, result)
      } else if (choice === 'merge-cloud-to-local') {
        result = remote ? mergeSyncPayload(local, remote, 'remote') : local
        if (!remote && (hadPendingChanges || source === 'manual')) {
          savedRecord = await saveRemoteSyncPayload(userId, result)
        }
      }

      if (choice !== 'no-upload') {
        if (syncState.value.lastLocalChangeAt > startedLocalChangeAt) {
          const latestLocal = buildLocalSyncPayload()
          result = choice === 'merge-cloud-to-local'
            ? mergeSyncPayload(latestLocal, result, 'remote')
            : mergeSyncPayload(latestLocal, result, 'local')
        }
        applyingLocalSync = true
        try {
          applyLocalSyncPayload(result)
        } finally {
          applyingLocalSync = false
        }
      }

      const completedAt = Date.now()
      const changedDuringSync = syncState.value.lastLocalChangeAt > startedLocalChangeAt
      const preferredChoice = source === 'choice' ? choice : decision.value?.choice
      if (preferredChoice) {
        saveDecision(userId, preferredChoice, completedAt)
        decision.value = { choice: preferredChoice, completedAt }
      }
      const pendingDomains = changedDuringSync ? syncState.value.pendingDomains : []
      patchSyncState({
        pendingDomains,
        lastSyncAt: completedAt,
        lastRemoteUpdatedAt: savedRecord?.updatedAt || remoteRecord?.updatedAt || syncState.value.lastRemoteUpdatedAt,
        retryCount: 0,
        nextRetryAt: 0,
        lastError: ''
      })
      localSnapshot.value = buildLocalSyncPayload()
      localSummary.value = summarizeSyncPayload(localSnapshot.value)
      remoteSnapshot.value = savedRecord?.payload || remoteRecord?.payload || remote
      remoteSummary.value = remoteSnapshot.value ? summarizeSyncPayload(remoteSnapshot.value) : null
      remoteLoadFailed.value = false
      notice.value = source === 'automatic'
        ? '已自动同步'
        : source === 'background'
          ? '已在切后台前补同步'
          : `已完成：${syncChoiceLabels[choice]}`
      if (source === 'choice') open.value = false
      return true
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : '云同步失败，请稍后重试'
      error.value = message
      const queueUpload = choice === 'merge-local-to-cloud' && Boolean(automaticChoice())
      recordFailure(message, queueUpload)
      return false
    } finally {
      syncing.value = false
      scheduleAutoSync()
    }
  }

  async function prepare(userId: string, force = false) {
    if (!userId) return
    if (!force && prepared.value && activeUserId.value === userId) return
    if (preparing.value) return
    activeUserId.value = userId
    preparing.value = true
    error.value = ''
    notice.value = ''
    remoteLoadFailed.value = false
    const storedDecision = readDecision(userId)
    const storedState = readSyncState(userId, storedDecision?.completedAt || 0)
    syncState.value = storedState
    decision.value = storedDecision
    try {
      const remoteRecord = await loadRemoteSyncPayload(userId, storedState.lastRemoteUpdatedAt || undefined)
      const local = buildLocalSyncPayload()
      localSnapshot.value = local
      localSummary.value = summarizeSyncPayload(local)
      if (remoteRecord) {
        remoteSnapshot.value = remoteRecord.payload
        remoteSummary.value = summarizeSyncPayload(remoteRecord.payload)
      }
      prepared.value = true

      if (decision.value && remoteSnapshot.value && decision.value.choice !== 'no-upload') {
        const merged = mergeSyncPayload(
          local,
          remoteSnapshot.value,
          decision.value.choice === 'merge-cloud-to-local' ? 'remote' : 'local'
        )
        applyingLocalSync = true
        try {
          applyLocalSyncPayload(merged)
        } finally {
          applyingLocalSync = false
        }
        localSnapshot.value = buildLocalSyncPayload()
        localSummary.value = summarizeSyncPayload(localSnapshot.value)
      }

      const completedAt = Date.now()
      patchSyncState({
        lastSyncAt: completedAt,
        lastRemoteUpdatedAt: remoteRecord?.updatedAt || storedState.lastRemoteUpdatedAt,
        retryCount: 0,
        nextRetryAt: 0,
        lastError: ''
      })
      if (!decision.value && !force) open.value = true
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : '读取云端学习数据失败'
      remoteLoadFailed.value = true
      prepared.value = true
      localSnapshot.value = buildLocalSyncPayload()
      localSummary.value = summarizeSyncPayload(localSnapshot.value)
      remoteSnapshot.value = null
      remoteSummary.value = null
      error.value = message
      recordFailure(message, false)
      if (!decision.value && !force) open.value = true
    } finally {
      preparing.value = false
      if (prepared.value) startAutoSync()
    }
  }

  async function openWizard() {
    if (!activeUserId.value) return
    open.value = true
    await prepare(activeUserId.value, true)
    selectedChoice.value = null
    notice.value = ''
  }

  function closeWizard() {
    if (!syncing.value) {
      open.value = false
      scheduleAutoSync()
    }
  }

  function selectChoice(choice: SyncChoice) {
    if (choice !== 'no-upload' && !canUseCloudChoices.value) return
    selectedChoice.value = choice
    error.value = ''
  }

  async function confirmChoice() {
    const choice = selectedChoice.value
    if (!choice) return
    await executeChoice(choice, 'choice')
  }

  async function downloadNow() {
    await executeChoice('download', 'manual')
  }

  async function uploadNow() {
    await executeChoice('merge-local-to-cloud', 'manual')
  }

  function handleForeground(reason: ForegroundReason = 'foreground') {
    if (!activeUserId.value || !prepared.value || syncing.value) return
    if (remoteLoadFailed.value && (reason === 'resume' || reason === 'online')) {
      void prepare(activeUserId.value, true)
      return
    }
    if (!automaticChoice() || !pendingChanges.value || open.value) return
    if (reason === 'online') patchSyncState({ nextRetryAt: 0 })
    scheduleAutoSync()
  }

  function handleBackground() {
    const choice = automaticChoice()
    if (!activeUserId.value || !prepared.value || syncing.value || open.value || !choice || !pendingChanges.value) return
    if (Date.now() < syncState.value.nextRetryAt) return
    void executeChoice(choice, 'background')
  }

  function resetForUser() {
    stopAutoSync()
    activeUserId.value = ''
    prepared.value = false
    open.value = false
    selectedChoice.value = null
    decision.value = null
    syncState.value = createSyncState()
    localSnapshot.value = null
    remoteSnapshot.value = null
    localSummary.value = null
    remoteSummary.value = null
    error.value = ''
    notice.value = ''
    remoteLoadFailed.value = false
    applyingLocalSync = false
  }

  return {
    activeUserId,
    prepared,
    open,
    preparing,
    syncing,
    error,
    notice,
    selectedChoice,
    decision,
    localSummary,
    remoteSummary,
    remoteLoadFailed,
    firstChoice,
    canUseCloudChoices,
    pendingChanges,
    statusLabel,
    autoSyncLabel,
    lastCompletedAt,
    prepare,
    openWizard,
    closeWizard,
    selectChoice,
    confirmChoice,
    downloadNow,
    uploadNow,
    handleForeground,
    handleBackground,
    resetForUser
  }
})

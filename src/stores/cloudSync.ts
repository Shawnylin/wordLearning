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
import type { LocalSyncPayload, SyncChoice, SyncSummary } from '../types/sync'
import { useDailyStore } from './daily'
import { useIdiomStore } from './idiom'
import { useReviewStore } from './review'

interface SyncDecisionRecord {
  choice: SyncChoice
  completedAt: number
}

const DECISION_PREFIX = 'word-learning-cloud-sync:'
const AUTO_CHANGE_DELAY = 30_000
const AUTO_FOREGROUND_INTERVAL = 5 * 60_000

export const syncChoiceLabels: Record<SyncChoice, string> = {
  'no-upload': '仅在本机',
  download: '下载到本机',
  'merge-local-to-cloud': '合并到云端',
  'merge-cloud-to-local': '合并到本机'
}

function decisionKey(userId: string): string {
  return `${DECISION_PREFIX}${userId}`
}

function readDecision(userId: string): SyncDecisionRecord | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(decisionKey(userId)) || 'null')
    if (!value || typeof value !== 'object') return null
    const record = value as Partial<SyncDecisionRecord>
    if (!record.choice || !Object.prototype.hasOwnProperty.call(syncChoiceLabels, record.choice)) return null
    return { choice: record.choice, completedAt: typeof record.completedAt === 'number' ? record.completedAt : 0 }
  } catch {
    return null
  }
}

function saveDecision(userId: string, choice: SyncChoice, completedAt: number) {
  localStorage.setItem(decisionKey(userId), JSON.stringify({ choice, completedAt } satisfies SyncDecisionRecord))
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
  const localSnapshot = ref<LocalSyncPayload | null>(null)
  const remoteSnapshot = ref<LocalSyncPayload | null>(null)
  const localSummary = ref<SyncSummary | null>(null)
  const remoteSummary = ref<SyncSummary | null>(null)
  const remoteLoadFailed = ref(false)

  let autoTimer: ReturnType<typeof setTimeout> | undefined
  let autoUnsubscribers: Array<() => void> = []
  let localMutationIgnoredUntil = 0

  const firstChoice = computed(() => decision.value === null)
  const canUseCloudChoices = computed(() => !remoteLoadFailed.value)
  const statusLabel = computed(() => {
    if (!decision.value) return '待设置'
    if (decision.value.choice === 'no-upload') return '仅本机'
    if (decision.value.choice === 'merge-local-to-cloud') return '自动合并到云端'
    return '自动同步'
  })
  const autoSyncLabel = computed(() => {
    if (!decision.value) return '首次同步后设置'
    if (decision.value.choice === 'no-upload') return '已关闭'
    return '变更后 30 秒 · 回前台满 5 分钟'
  })
  const lastCompletedAt = computed(() => decision.value?.completedAt || 0)

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
    if (!activeUserId.value || !prepared.value || syncing.value || !automaticChoice()) return
    clearAutoTimer()
    autoTimer = setTimeout(() => {
      autoTimer = undefined
      const choice = automaticChoice()
      if (choice) void executeChoice(choice, 'automatic')
    }, AUTO_CHANGE_DELAY)
  }

  function startAutoSync() {
    stopAutoSync()
    const onLocalMutation = () => {
      if (syncing.value || Date.now() < localMutationIgnoredUntil) return
      scheduleAutoSync()
    }
    autoUnsubscribers = [
      useIdiomStore().$subscribe(onLocalMutation),
      useReviewStore().$subscribe(onLocalMutation),
      useDailyStore().$subscribe(onLocalMutation)
    ]
  }

  async function executeChoice(choice: SyncChoice, source: 'choice' | 'manual' | 'automatic'): Promise<boolean> {
    const userId = activeUserId.value
    if (!userId || syncing.value) return false
    syncing.value = true
    error.value = ''
    notice.value = ''
    try {
      const local = buildLocalSyncPayload()
      const remote = choice === 'no-upload'
        ? remoteSnapshot.value
        : await loadRemoteSyncPayload(userId)
      let result = local
      if (choice === 'download') {
        if (!remote) throw new Error('云端还没有同步数据，为保护本机数据，本次未执行下载')
        result = remote
      } else if (choice === 'merge-local-to-cloud') {
        result = remote ? mergeSyncPayload(local, remote, 'local') : local
        await saveRemoteSyncPayload(userId, result)
      } else if (choice === 'merge-cloud-to-local') {
        result = remote ? mergeSyncPayload(local, remote, 'remote') : local
      }

      if (choice !== 'no-upload') {
        localMutationIgnoredUntil = Date.now() + 1000
        applyLocalSyncPayload(result)
      }

      const completedAt = Date.now()
      const preferredChoice = source === 'choice' ? choice : decision.value?.choice
      if (preferredChoice) {
        saveDecision(userId, preferredChoice, completedAt)
        decision.value = { choice: preferredChoice, completedAt }
      }
      localSnapshot.value = buildLocalSyncPayload()
      localSummary.value = summarizeSyncPayload(localSnapshot.value)
      remoteSnapshot.value = choice === 'merge-local-to-cloud' ? result : remote
      remoteSummary.value = remoteSnapshot.value ? summarizeSyncPayload(remoteSnapshot.value) : null
      notice.value = source === 'automatic' ? '已自动同步' : `已完成：${syncChoiceLabels[choice]}`
      if (source === 'choice') open.value = false
      return true
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '云同步失败，请稍后重试'
      return false
    } finally {
      syncing.value = false
    }
  }

  async function prepare(userId: string, force = false) {
    if (!userId) return
    if (!force && prepared.value && activeUserId.value === userId) return
    activeUserId.value = userId
    preparing.value = true
    error.value = ''
    notice.value = ''
    remoteLoadFailed.value = false
    try {
      const local = buildLocalSyncPayload()
      const remote = await loadRemoteSyncPayload(userId)
      localSnapshot.value = local
      remoteSnapshot.value = remote
      localSummary.value = summarizeSyncPayload(local)
      remoteSummary.value = remote ? summarizeSyncPayload(remote) : null
      decision.value = readDecision(userId)
      prepared.value = true
      if (!decision.value && !force) open.value = true
    } catch (caught: unknown) {
      remoteLoadFailed.value = true
      localSnapshot.value = buildLocalSyncPayload()
      localSummary.value = summarizeSyncPayload(localSnapshot.value)
      remoteSnapshot.value = null
      remoteSummary.value = null
      decision.value = readDecision(userId)
      prepared.value = true
      error.value = caught instanceof Error ? caught.message : '读取云端学习数据失败'
      if (!decision.value && !force) open.value = true
    } finally {
      preparing.value = false
      if (prepared.value) {
        startAutoSync()
        if (decision.value && !force) handleForeground()
      }
    }
  }

  async function openWizard() {
    if (!activeUserId.value) return
    await prepare(activeUserId.value, true)
    selectedChoice.value = null
    notice.value = ''
    open.value = true
  }

  function closeWizard() {
    if (!syncing.value) open.value = false
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

  function handleForeground() {
    if (!activeUserId.value || !prepared.value || syncing.value || open.value || !automaticChoice()) return
    const elapsed = Date.now() - lastCompletedAt.value
    if (elapsed >= AUTO_FOREGROUND_INTERVAL) {
      const choice = automaticChoice()
      if (choice) void executeChoice(choice, 'automatic')
      return
    }
    clearAutoTimer()
    autoTimer = setTimeout(() => {
      autoTimer = undefined
      const choice = automaticChoice()
      if (choice) void executeChoice(choice, 'automatic')
    }, Math.max(1000, AUTO_FOREGROUND_INTERVAL - elapsed))
  }

  function resetForUser() {
    stopAutoSync()
    activeUserId.value = ''
    prepared.value = false
    open.value = false
    selectedChoice.value = null
    decision.value = null
    localSnapshot.value = null
    remoteSnapshot.value = null
    localSummary.value = null
    remoteSummary.value = null
    error.value = ''
    notice.value = ''
    remoteLoadFailed.value = false
    localMutationIgnoredUntil = 0
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
    resetForUser
  }
})

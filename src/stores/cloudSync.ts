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

interface SyncDecisionRecord {
  choice: SyncChoice
  completedAt: number
}

const DECISION_PREFIX = 'word-learning-cloud-sync:'

export const syncChoiceLabels: Record<SyncChoice, string> = {
  'no-upload': '不上传数据',
  download: '从服务器下载数据',
  'merge-local-to-cloud': '将本地数据合并到云端',
  'merge-cloud-to-local': '将云端数据合并到本地'
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

  const firstChoice = computed(() => decision.value === null)
  const canUseCloudChoices = computed(() => !remoteLoadFailed.value)
  const statusLabel = computed(() => decision.value ? `已选择：${syncChoiceLabels[decision.value.choice]}` : '等待首次同步选择')
  const lastCompletedAt = computed(() => decision.value?.completedAt || 0)

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
    const userId = activeUserId.value
    const choice = selectedChoice.value
    if (!userId || !choice || syncing.value) return
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

      if (choice !== 'no-upload') applyLocalSyncPayload(result)
      const completedAt = Date.now()
      saveDecision(userId, choice, completedAt)
      decision.value = { choice, completedAt }
      localSnapshot.value = buildLocalSyncPayload()
      localSummary.value = summarizeSyncPayload(localSnapshot.value)
      remoteSnapshot.value = choice === 'merge-local-to-cloud' ? result : remote
      remoteSummary.value = remoteSnapshot.value ? summarizeSyncPayload(remoteSnapshot.value) : null
      notice.value = `已完成：${syncChoiceLabels[choice]}`
      open.value = false
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '云同步失败，请稍后重试'
    } finally {
      syncing.value = false
    }
  }

  function resetForUser() {
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
    lastCompletedAt,
    prepare,
    openWizard,
    closeWizard,
    selectChoice,
    confirmChoice,
    resetForUser
  }
})

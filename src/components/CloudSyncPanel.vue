<script setup lang="ts">
import ApiVaultSettings from './ApiVaultSettings.vue'
import { LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useCloudSyncStore } from '../stores/cloudSync'

const props = withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false
})
const auth = useAuthStore()
const sync = useCloudSyncStore()

function formatTime(value: number) {
  if (!value) return '尚未完成'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value)
}
function formatSummary(summary: typeof sync.localSummary) {
  if (!summary) return '暂无数据'
  const total = summary.words + summary.searches + summary.comparisons + summary.favorites + summary.reviewWords + summary.dailyIssues
  return `${total.toLocaleString()} 项数据`
}
</script>

<template>
  <section :class="props.compact ? 'cloud-sync-panel cloud-sync-panel-compact' : 'cloud-sync-panel card rounded-2xl p-5'" data-testid="cloud-sync-panel">
    <div class="cloud-sync-heading">
      <div class="flex min-w-0 items-center gap-3">

        <div class="min-w-0">
          <h2 class="font-semibold text-ink">云同步</h2>

        </div>
      </div>
      <span v-if="auth.signedIn" class="profile-sync-time">上次成功 {{ formatTime(sync.lastCompletedAt) }}</span>
    </div>

    <div v-if="!auth.signedIn" class="profile-sync-unauth">

      <RouterLink to="/profile/account">登录后同步</RouterLink>
    </div>

    <div v-else class="profile-sync-body">
      <div class="profile-sync-main">
        <div class="profile-sync-data">
          <strong>本机</strong>
          <span>{{ formatSummary(sync.localSummary) }}</span>
        </div>
        <button
          class="profile-sync-action profile-sync-action-primary"
          data-testid="cloud-sync-now-button"
          type="button"
          :disabled="sync.preparing || sync.syncing"
          @click="sync.uploadNow"
        >
          <LoaderCircle v-if="sync.syncing" :size="16" class="animate-spin" />
          <RefreshCw v-else :size="16" />
          {{ sync.syncing ? '正在同步…' : '立即同步' }}
        </button>
        <div class="profile-sync-data profile-sync-data-cloud">
          <strong>云端</strong>
          <span>{{ formatSummary(sync.remoteSummary) }}</span>
        </div>
      </div>

      <p class="profile-sync-meta">最近结果：{{ sync.lastSyncResultLabel }} · {{ sync.lastSyncTypeLabel }}</p>
      <p v-if="sync.error && !sync.open" class="profile-inline-feedback is-error" role="alert">{{ sync.error }}</p>

      <ApiVaultSettings />
    </div>
  </section>
</template>

<style scoped>
.cloud-sync-heading h2 { font-size: 16px; font-weight: 600; }
.cloud-sync-heading > :first-child { min-width: 0; flex: 1 1 auto; }
.cloud-sync-heading > .profile-sync-time { margin-left: auto; }
.profile-sync-body { display: grid; }
.profile-sync-main { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); min-height: 76px; align-items: center; gap: 10px; }
.profile-sync-data { display: grid; min-width: 0; gap: 3px; color: var(--ink-mute); font-size: 11px; line-height: 1.45; }
.profile-sync-data strong { color: var(--ink-soft); font-weight: 600; }
.profile-sync-data span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-sync-data-cloud { justify-items: end; text-align: right; }
.profile-sync-time { color: var(--ink-mute); }
.profile-sync-main > .profile-sync-action { min-width: 104px; }
.profile-sync-time { font-size: 11px; line-height: 1.45; white-space: nowrap; }
.profile-sync-meta { margin-top: -4px; color: var(--ink-mute); font-size: 11px; line-height: 1.45; }
.sync-mode { color: var(--ink-mute); font-size: 12px; font-weight: 400; }
.profile-sync-body > .vault-settings, .profile-sync-body > .profile-inline-feedback { width: 100%; }
.profile-sync-unauth { padding: 8px 0; font-size: 13px; }
@media (max-width: 340px) { .profile-sync-main { gap: 6px; } }
</style>

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
</script>

<template>
  <section :class="props.compact ? 'cloud-sync-panel cloud-sync-panel-compact' : 'cloud-sync-panel card rounded-2xl p-5'" data-testid="cloud-sync-panel">
    <div class="cloud-sync-heading">
      <div class="flex min-w-0 items-center gap-3">

        <div class="min-w-0">
          <h2 class="font-semibold text-ink">云同步</h2>

        </div>
      </div>
      <button v-if="auth.signedIn" class="profile-row-value sync-mode" type="button" aria-label="同步方式" :disabled="sync.preparing || sync.syncing" @click="sync.openWizard">{{ sync.statusLabel }} · 设置</button>
    </div>

    <div v-if="!auth.signedIn" class="profile-sync-unauth">

      <RouterLink to="/profile/account">登录后同步</RouterLink>
    </div>

    <div v-else class="profile-sync-body">
      <div class="profile-sync-summary">

        <span>上次 {{ formatTime(sync.lastCompletedAt) }}</span>
      </div>

      <div class="profile-sync-actions">
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
      </div>


      <p v-if="sync.error && !sync.open" class="profile-inline-feedback is-error" role="alert">{{ sync.error }}</p>

      <ApiVaultSettings />
    </div>
  </section>
</template>

<style scoped>
.cloud-sync-heading h2 { font-size: 16px; font-weight: 600; }
.profile-sync-body { display: grid; justify-items: center; gap: 10px; text-align: center; }
.profile-sync-summary { font-size: 12px; }
.profile-sync-actions { display: grid; width: min(100%, 220px); grid-template-columns: 1fr; }
.sync-mode { color: var(--ink-mute); font-size: 12px; font-weight: 400; }
.profile-sync-body > .vault-settings, .profile-sync-body > .profile-inline-feedback { width: 100%; }
.profile-sync-unauth { padding: 8px 0; font-size: 13px; }
</style>

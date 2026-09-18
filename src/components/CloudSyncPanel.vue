<script setup lang="ts">
import { Cloud, Download, LoaderCircle, RefreshCw, ShieldCheck, Upload } from 'lucide-vue-next'
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
        <span class="profile-row-icon bg-dai-soft text-dai"><Cloud :size="18" /></span>
        <div class="min-w-0">
          <h2 class="font-semibold text-ink">云同步</h2>
          <p class="mt-0.5 text-xs text-ink-mute">学习记录，不含 API 密钥</p>
        </div>
      </div>
      <span v-if="auth.signedIn" class="profile-row-value text-bamboo">{{ sync.statusLabel }}</span>
    </div>

    <div v-if="!auth.signedIn" class="profile-sync-unauth">
      <ShieldCheck :size="17" class="shrink-0 text-ink-mute" />
      <p>登录后可手动下载、上传或合并学习数据；未登录时继续使用本机模式。</p>
    </div>

    <div v-else class="profile-sync-body">
      <div class="profile-sync-summary">
        <span>本机 {{ sync.localSummary?.words ?? 0 }} 词 · {{ sync.localSummary?.dailyArticles ?? 0 }} 篇日报</span>
        <span>上次 {{ formatTime(sync.lastCompletedAt) }}</span>
      </div>

      <div class="profile-sync-actions">
        <button
          class="profile-sync-action"
          data-testid="cloud-download-button"
          type="button"
          :disabled="sync.preparing || sync.syncing || sync.remoteLoadFailed"
          @click="sync.downloadNow"
        >
          <LoaderCircle v-if="sync.syncing" :size="16" class="animate-spin" />
          <Download v-else :size="16" />
          从云端下载
        </button>
        <button
          class="profile-sync-action profile-sync-action-primary"
          data-testid="cloud-upload-button"
          type="button"
          :disabled="sync.preparing || sync.syncing || sync.remoteLoadFailed"
          @click="sync.uploadNow"
        >
          <LoaderCircle v-if="sync.syncing" :size="16" class="animate-spin" />
          <Upload v-else :size="16" />
          上传到云端
        </button>
      </div>

      <div class="profile-sync-policy">
        <span>自动同步</span>
        <span>{{ sync.autoSyncLabel }}</span>
      </div>

      <p v-if="sync.notice" class="profile-inline-feedback is-success" role="status">{{ sync.notice }}</p>
      <p v-if="sync.error && !sync.open" class="profile-inline-feedback is-error" role="alert">{{ sync.error }}</p>

      <button class="profile-sync-settings" type="button" :disabled="sync.preparing || sync.syncing" @click="sync.openWizard">
        <LoaderCircle v-if="sync.preparing" :size="15" class="animate-spin" />
        <RefreshCw v-else :size="15" />
        同步设置
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Cloud, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useCloudSyncStore } from '../stores/cloudSync'

const auth = useAuthStore()
const sync = useCloudSyncStore()

function formatTime(value: number) {
  if (!value) return '尚未完成'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value)
}
</script>

<template>
  <section class="cloud-sync-panel card rounded-2xl p-5" data-testid="cloud-sync-panel">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dai-soft text-dai">
          <Cloud :size="20" />
        </div>
        <div class="min-w-0">
          <h2 class="font-semibold text-ink">云同步</h2>
          <p class="mt-1 text-xs leading-5 text-ink-mute">只同步学习记录，不同步 API 密钥</p>
        </div>
      </div>
      <span v-if="auth.signedIn" class="shrink-0 rounded-full bg-bamboo-soft px-2.5 py-1 text-xs text-bamboo">{{ sync.statusLabel }}</span>
    </div>

    <div v-if="!auth.signedIn" class="mt-4 flex items-start gap-3 rounded-xl bg-soft p-3 text-sm leading-6 text-ink-soft">
      <ShieldCheck :size="17" class="mt-0.5 shrink-0 text-ink-mute" />
      <p>登录后可以选择是否上传、下载或合并学习数据。未登录时仍完全使用本机模式。</p>
    </div>
    <div v-else class="mt-4">
      <div class="grid gap-2 sm:grid-cols-2">
        <div class="rounded-xl bg-soft px-3 py-2.5">
          <p class="text-[11px] text-ink-mute">本机记录</p>
          <p class="mt-1 text-sm font-medium text-ink">{{ sync.localSummary?.words ?? 0 }} 个成语 · {{ sync.localSummary?.dailyArticles ?? 0 }} 篇日报</p>
        </div>
        <div class="rounded-xl bg-soft px-3 py-2.5">
          <p class="text-[11px] text-ink-mute">上次选择</p>
          <p class="mt-1 text-sm font-medium text-ink">{{ formatTime(sync.lastCompletedAt) }}</p>
        </div>
      </div>
      <p v-if="sync.notice" class="mt-3 rounded-xl bg-bamboo-soft p-3 text-sm leading-6 text-bamboo" role="status">{{ sync.notice }}</p>
      <p v-if="sync.error && !sync.open" class="mt-3 rounded-xl bg-zhuhong-soft p-3 text-sm leading-6 text-zhuhong" role="alert">{{ sync.error }}</p>
      <button class="mt-4 inline-flex items-center gap-2 rounded-xl bg-soft px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50" type="button" :disabled="sync.preparing || sync.syncing" @click="sync.openWizard">
        <LoaderCircle v-if="sync.preparing" :size="16" class="animate-spin" />
        <RefreshCw v-else :size="16" />
        重新选择同步方式
      </button>
    </div>
  </section>
</template>

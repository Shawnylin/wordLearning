<script setup lang="ts">
import { computed, watch } from 'vue'
import { Cloud, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { syncChoiceLabels, useCloudSyncStore } from '../stores/cloudSync'
import type { SyncChoice } from '../types/sync'

const auth = useAuthStore()
const sync = useCloudSyncStore()

const choices: Array<{ id: SyncChoice; title: string; description: string; icon: typeof ShieldCheck }> = [
  { id: 'merge-local-to-cloud', title: '开启云同步', description: '自动合并两边数据，各项保留较新的版本。', icon: Sparkles },
  { id: 'no-upload', title: '仅在本机', description: '暂不上传，之后仍可在个人页开启。', icon: ShieldCheck }
]

const localCountLabel = computed(() => {
  const summary = sync.localSummary
  if (!summary) return '正在统计本机数据…'
  return `${summary.words} 个成语 · ${summary.searches} 条搜索 · ${summary.dailyArticles} 篇日报`
})

const remoteCountLabel = computed(() => {
  const summary = sync.remoteSummary
  if (!summary) return '云端暂无同步快照'
  return `${summary.words} 个成语 · ${summary.searches} 条搜索 · ${summary.dailyArticles} 篇日报`
})

watch(
  () => [auth.initialized, auth.currentUser?.id] as const,
  ([initialized, userId]) => {
    if (!initialized) return
    if (userId) void sync.prepare(userId)
    else sync.resetForUser()
  },
  { immediate: true }
)

function isDisabled(choice: SyncChoice) {
  return choice !== 'no-upload' && !sync.canUseCloudChoices
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="sync.open"
      class="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      data-testid="cloud-sync-dialog"
      role="presentation"
      @click.self="sync.closeWizard"
    >
      <section
        class="cloud-sync-dialog card max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] p-5 shadow-2xl sm:max-w-4xl sm:rounded-[2rem] sm:p-7"
        aria-labelledby="cloud-sync-title"
        aria-modal="true"
        role="dialog"
      >
        <div class="grid gap-6 md:grid-cols-[.76fr_1.24fr] md:gap-8">
          <aside class="relative overflow-hidden rounded-[1.45rem] bg-ink p-5 text-paper md:p-6">
            <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-paper/10" />
            <div class="absolute -bottom-16 -left-12 h-44 w-44 rounded-full border border-paper/10" />
            <div class="relative flex h-full flex-col">
              <div class="flex items-center justify-between gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-paper/10 text-paper">
                  <Cloud :size="21" />
                </span>
                <span class="font-mono text-[10px] uppercase tracking-[.22em] text-paper/55">sync / 01</span>
              </div>
              <p class="mt-8 text-xs uppercase tracking-[.2em] text-paper/55">{{ sync.firstChoice ? '第一次登录' : '数据管理' }}</p>
              <h2 id="cloud-sync-title" class="mt-2 font-kai text-3xl leading-tight tracking-wide">数据同步</h2>
              <p class="mt-4 text-sm leading-7 text-paper/70">合并学习记录与个人资料。API 配置可在个人页开启加密同步。</p>
              <div class="mt-auto hidden border-t border-paper/15 pt-5 md:block">
                <p class="text-xs leading-6 text-paper/55">同步学习记录、名称和头像。</p>
              </div>
            </div>
          </aside>

          <div class="min-w-0">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-[.18em] text-ink-mute">CLOUDBASE</p>
                <p class="mt-2 text-sm leading-6 text-ink-soft">本机与云端数据</p>
              </div>
              <button class="rounded-xl p-2 text-ink-mute transition-colors hover:bg-soft hover:text-ink" type="button" aria-label="关闭同步选择" @click="sync.closeWizard">
                <X :size="19" />
              </button>
            </div>

            <div class="mt-5 grid gap-2 sm:grid-cols-2">
              <div class="rounded-2xl bg-soft px-4 py-3">
                <p class="text-[11px] uppercase tracking-[.12em] text-ink-mute">本机</p>
                <p class="mt-1 text-sm font-medium text-ink">{{ localCountLabel }}</p>
              </div>
              <div class="rounded-2xl bg-soft px-4 py-3">
                <p class="text-[11px] uppercase tracking-[.12em] text-ink-mute">服务器</p>
                <p class="mt-1 text-sm font-medium text-ink">{{ remoteCountLabel }}</p>
              </div>
            </div>

            <p v-if="sync.error" class="mt-4 rounded-2xl bg-zhuhong-soft px-4 py-3 text-sm leading-6 text-zhuhong" role="alert">{{ sync.error }}</p>
            <p v-if="sync.remoteLoadFailed" class="mt-3 rounded-2xl bg-gold-soft px-4 py-3 text-xs leading-5 text-gold">云端数据暂时无法读取。为避免覆盖未知数据，目前只允许选择“不上传数据”。</p>

            <div class="mt-5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="云同步方式">
              <button
                v-for="choice in choices"
                :key="choice.id"
                class="cloud-sync-option group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
                :class="[
                  sync.selectedChoice === choice.id ? 'ring-2 ring-ink/70 ring-offset-2 ring-offset-card' : 'border-line',
                ]"
                :data-testid="`sync-choice-${choice.id}`"
                :aria-checked="sync.selectedChoice === choice.id"
                :disabled="isDisabled(choice.id) || sync.syncing"
                role="radio"
                type="button"
                @click="sync.selectChoice(choice.id)"
              >
                <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-soft text-ink-soft transition-colors group-hover:text-ink" :class="sync.selectedChoice === choice.id ? 'bg-ink text-paper' : ''">
                  <component :is="choice.icon" :size="17" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center justify-between gap-3">
                    <span class="text-sm font-semibold text-ink">{{ choice.title }}</span>
                    <span v-if="choice.id === 'merge-local-to-cloud'" class="text-[10px] text-bamboo">推荐</span>
                  </span>
                  <span class="mt-1 block text-xs leading-5 text-ink-soft">{{ choice.description }}</span>
                </span>
              </button>
            </div>

            <div class="mt-5 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs leading-5 text-ink-mute">开启后会在数据变化时自动同步</p>
              <div class="flex gap-2 sm:shrink-0">
                <button class="rounded-xl px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-soft" type="button" :disabled="sync.syncing" @click="sync.closeWizard">稍后处理</button>
                <button class="btn-primary inline-flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-45" type="button" :disabled="!sync.selectedChoice || sync.syncing" @click="sync.confirmChoice">
                  <LoaderCircle v-if="sync.syncing" :size="16" class="animate-spin" />
                  {{ sync.syncing ? '处理中…' : sync.selectedChoice === 'merge-local-to-cloud' ? '开启云同步' : sync.selectedChoice ? syncChoiceLabels[sync.selectedChoice] : '请选择一种方式' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
@media (max-width: 639px) {
  .cloud-sync-dialog { padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
}
</style>

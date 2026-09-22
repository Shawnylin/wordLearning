<script setup lang="ts">
import type { DailyProgressPhase } from '../api/daily'
import Motion from './Motion.vue'

const props = defineProps<{
  loading: boolean
  error: string
  progressPhase: DailyProgressPhase
  streamedText: string
}>()

const progressLabels: Record<DailyProgressPhase, string> = {
  searching: '联网搜索中',
  reading: '正在读取文章',
  generating: '正在生成日报内容',
  validating: '正在校验原文并保存',
}
</script>

<template>
  <Motion>
    <div
      v-if="props.loading"
      class="daily-progress rounded-2xl border border-line bg-soft p-4 text-sm text-ink-soft"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-2 text-ink">
        <span class="daily-progress-dot" aria-hidden="true" />
        <span class="font-medium">{{ progressLabels[props.progressPhase] }}</span>
      </div>
      <p v-if="props.progressPhase === 'searching'" class="mt-2 text-xs leading-6">
        正在从人民网、光明网和半月谈检索并核对近三年的优质文段。
      </p>
      <p v-if="props.progressPhase === 'reading'" class="mt-2 text-xs leading-6">
        正在读取指定网页正文，随后生成精读文段。
      </p>
      <pre v-if="props.streamedText" class="daily-stream mt-3">{{ props.streamedText }}</pre>
    </div>
  </Motion>
  <Motion>
    <p
      v-if="props.error"
      role="alert"
      class="rounded-2xl border border-zhuhong/30 bg-zhuhong-soft p-4 text-sm leading-6 text-zhuhong"
    >
      {{ props.error }}
    </p>
  </Motion>
</template>

<style scoped>
.daily-progress-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: var(--zhuhong);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--zhuhong) 35%, transparent);
  animation: daily-pulse 1.4s ease-out infinite;
}
.daily-stream {
  max-height: 32dvh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-soft);
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
@keyframes daily-pulse {
  70%,
  100% {
    box-shadow: 0 0 0 8px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .daily-progress-dot {
    animation: none;
  }
}
</style>

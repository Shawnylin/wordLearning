<script setup lang="ts">
import CompareWords from './CompareWords.vue'
import { RefreshCw, Coins, BookOpen, Lightbulb, Map, AlertTriangle } from 'lucide-vue-next'
import type { CompareRecord } from '../types/idiom'

defineProps<{
  compare: CompareRecord
  loading?: boolean
}>()

const emit = defineEmits<{
  regenerate: []
}>()

const sections = [
  { key: 'meaningDiff', label: '含义区别', icon: BookOpen },
  { key: 'usageDiff', label: '用法差异', icon: Lightbulb },
  { key: 'scenarios', label: '适用场景', icon: Map },
  { key: 'confusionPoints', label: '常见混淆点', icon: AlertTriangle }
]

</script>

<template>
  <div class="animate-card-enter">
    <div class="rounded-3xl card glass-card overflow-hidden">
      <!-- Header -->
      <div class="study-heading compare-heading px-6 pt-8 pb-6 glass-card-header">
        <div class="study-heading-row">
          <CompareWords :words="compare.words" />
          <div class="study-heading-actions">
            <button
              @click="emit('regenerate')"
              :disabled="loading"
              class="p-2 rounded-full text-ink-mute hover:text-dai hover:bg-dai-soft transition-all duration-200 disabled:opacity-50"
              title="重新生成"
            >
              <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
            </button>
          </div>
        </div>
        <div v-if="compare.tokenUsage > 0" class="token-usage flex items-center justify-center gap-1 mt-1.5">
          <Coins :size="12" class="text-gold" />
          <span class="text-xs text-gold">
            消耗 {{ compare.tokenUsage }} tokens
          </span>
        </div>
      </div>

      <!-- Content sections -->
      <div class="study-sections compare-sections px-6 pb-6 space-y-5">
        <div
          v-for="section in sections"
          :key="section.key"
          v-show="compare.content[section.key as 'meaningDiff' | 'usageDiff' | 'scenarios' | 'confusionPoints'] || loading"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-dai-soft text-dai">
              <component :is="section.icon" :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-ink-soft tracking-wide">
              {{ section.label }}
            </h3>
          </div>
          <div class="pl-9 space-y-2">
            <p
              v-for="(line, i) in compare.content[section.key as 'meaningDiff' | 'usageDiff' | 'scenarios' | 'confusionPoints'].split('\n').filter(l => l.trim())"
              :key="i"
              class="text-base leading-relaxed text-ink-soft [overflow-wrap:anywhere]"
            >
              {{ line }}
            </p>
            <p v-if="!compare.content[section.key as 'meaningDiff' | 'usageDiff' | 'scenarios' | 'confusionPoints'] && loading" class="text-ink-mute">正在生成…</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


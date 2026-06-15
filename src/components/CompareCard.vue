<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw, GitCompare, Coins, BookOpen, Lightbulb, Map, AlertTriangle } from 'lucide-vue-next'
import type { CompareRecord } from '../types/idiom'

const props = defineProps<{
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

// 根据词语数量调整字体大小
const wordCount = computed(() => props.compare.words.length)
const wordClass = computed(() => {
  if (wordCount.value <= 3) return 'text-2xl md:text-3xl'
  if (wordCount.value === 4) return 'text-xl md:text-2xl'
  return 'text-lg md:text-xl'
})
const vsClass = computed(() => {
  if (wordCount.value <= 3) return 'text-lg'
  if (wordCount.value === 4) return 'text-base'
  return 'text-sm'
})
</script>

<template>
  <div class="animate-card-enter">
    <div class="rounded-3xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <!-- Header -->
      <div class="relative px-6 pt-8 pb-6 bg-gradient-to-b from-blue-50 to-transparent dark:from-blue-950/20 dark:to-transparent">
        <!-- Regenerate button -->
        <button
          @click="emit('regenerate')"
          :disabled="loading"
          class="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50"
          title="重新生成"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>

        <!-- Title -->
        <div class="flex items-center justify-center gap-2 mb-3">
          <GitCompare :size="20" class="text-blue-600 dark:text-blue-400" />
          <span class="text-sm font-medium text-blue-600 dark:text-blue-400">词语对比</span>
        </div>

        <!-- Words - single line -->
        <div class="flex items-center justify-center gap-2 flex-nowrap overflow-hidden px-2">
          <template v-for="(word, index) in compare.words" :key="word">
            <span :class="['font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap', wordClass]">
              {{ word }}
            </span>
            <span
              v-if="index < compare.words.length - 1"
              :class="['text-gray-400 dark:text-gray-500 whitespace-nowrap', vsClass]"
            >
              vs
            </span>
          </template>
        </div>

        <!-- Token usage -->
        <div class="flex items-center justify-center gap-1 mt-3">
          <Coins :size="12" class="text-gray-400 dark:text-gray-500" />
          <span class="text-xs text-gray-400 dark:text-gray-500">
            消耗 {{ compare.tokenUsage }} tokens
          </span>
        </div>
      </div>

      <!-- Content sections -->
      <div class="px-6 pb-6 space-y-5">
        <div
          v-for="section in sections"
          :key="section.key"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <component :is="section.icon" :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ section.label }}
            </h3>
          </div>
          <div class="pl-9 space-y-2">
            <p
              v-for="(line, i) in compare.content[section.key as 'meaningDiff' | 'usageDiff' | 'scenarios' | 'confusionPoints'].split('\n').filter(l => l.trim())"
              :key="i"
              class="text-base leading-relaxed text-gray-600 dark:text-gray-400"
            >
              {{ line }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

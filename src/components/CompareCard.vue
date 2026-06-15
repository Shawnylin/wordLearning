<script setup lang="ts">
import { RefreshCw, GitCompare, Coins } from 'lucide-vue-next'
import type { CompareRecord } from '../types/idiom'

defineProps<{
  compare: CompareRecord
  loading?: boolean
}>()

const emit = defineEmits<{
  regenerate: []
}>()

// 将内容按换行符分割为段落
const paragraphs = (content: string) => content.split('\n').filter(p => p.trim().length > 0)
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

        <!-- Words -->
        <div class="flex flex-wrap items-center justify-center gap-2">
          <template v-for="(word, index) in compare.words" :key="word">
            <span class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50">
              {{ word }}
            </span>
            <span
              v-if="index < compare.words.length - 1"
              class="text-lg text-gray-400 dark:text-gray-500"
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

      <!-- Content -->
      <div class="px-6 pb-6">
        <div class="space-y-3">
          <p
            v-for="(para, index) in paragraphs(compare.content)"
            :key="index"
            class="text-base leading-relaxed text-gray-600 dark:text-gray-400"
          >
            {{ para }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, BookOpen, FileText, Quote, Lightbulb, Link2 } from 'lucide-vue-next'
import type { IdiomData } from '../types/idiom'

const props = defineProps<{
  idiom: IdiomData
  loading?: boolean
}>()

const emit = defineEmits<{
  regenerate: []
  relatedClick: [word: string]
}>()

interface CardSection {
  key: string
  label: string
  icon: typeof BookOpen
  content: string
}

const sections: CardSection[] = [
  { key: 'explanation', label: '解释', icon: BookOpen, content: '' },
  { key: 'origin', label: '出处', icon: FileText, content: '' },
  { key: 'example', label: '例子', icon: Quote, content: '' },
  { key: 'usage', label: '用法', icon: Lightbulb, content: '' }
]

function getSectionContent(key: string): string {
  return (props.idiom as any)[key] || ''
}
</script>

<template>
  <div class="animate-card-enter">
    <div class="rounded-3xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <!-- Header: Word + Pinyin -->
      <div class="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-red-50 to-transparent dark:from-red-950/20 dark:to-transparent">
        <!-- Regenerate button -->
        <button
          @click="emit('regenerate')"
          :disabled="loading"
          class="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50"
          title="重新生成"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>

        <!-- Pinyin -->
        <p class="text-lg tracking-wider mb-2" style="color: #C0392B">
          {{ idiom.pinyin }}
        </p>

        <!-- Word -->
        <h1 class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 tracking-wider">
          {{ idiom.word }}
        </h1>
      </div>

      <!-- Content sections -->
      <div class="px-6 pb-6 space-y-5">
        <div
          v-for="section in sections"
          :key="section.key"
          class="group"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <component :is="section.icon" :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ section.label }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-gray-600 dark:text-gray-400 pl-9">
            {{ getSectionContent(section.key) }}
          </p>
        </div>

        <!-- Related idioms -->
        <div v-if="idiom.relatedIdioms?.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <Link2 :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              相关成语
            </h3>
          </div>
          <div class="flex flex-wrap gap-2 pl-9">
            <button
              v-for="related in idiom.relatedIdioms"
              :key="related"
              @click="emit('relatedClick', related)"
              class="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
            >
              {{ related }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

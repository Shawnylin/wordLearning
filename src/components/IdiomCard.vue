<script setup lang="ts">
import { RefreshCw, BookOpen, FileText, Quote, Lightbulb, Link2, Heart } from 'lucide-vue-next'
import type { IdiomData } from '../types/idiom'
import { useIdiomStore } from '../stores/idiom'

const idiomStore = useIdiomStore()

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
}

const sections: CardSection[] = [
  { key: 'explanation', label: '解释', icon: BookOpen },
  { key: 'origin', label: '出处', icon: FileText },
  { key: 'example', label: '例子', icon: Quote },
  { key: 'usage', label: '用法', icon: Lightbulb }
]

function getSectionContent(key: string): string {
  return (props.idiom as any)[key] || ''
}
</script>

<template>
  <div class="animate-card-enter">
    <div class="rounded-3xl card overflow-hidden">
      <!-- Header -->
      <div class="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-zhuhong-soft to-card">
        <!-- Favorite button -->
        <button
          @click="idiomStore.toggleFavorite(idiom.word)"
          class="absolute top-4 left-4 p-2 rounded-full transition-all duration-200"
          :class="idiomStore.isFavorite(idiom.word)
            ? 'text-zhuhong hover:scale-110'
            : 'text-ink-mute hover:text-zhuhong'"
          :title="idiomStore.isFavorite(idiom.word) ? '取消收藏' : '收藏'"
        >
          <Heart :size="18" :fill="idiomStore.isFavorite(idiom.word) ? 'currentColor' : 'none'" />
        </button>

        <!-- Regenerate button -->
        <button
          @click="emit('regenerate')"
          :disabled="loading"
          class="absolute top-4 right-4 p-2 rounded-full text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-all duration-200 disabled:opacity-50"
          title="重新生成"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>

        <!-- Pinyin -->
        <p class="text-lg tracking-widest mb-2 text-zhuhong">
          {{ idiom.pinyin }}
        </p>

        <!-- Word -->
        <h1 class="font-kai text-5xl md:text-6xl font-bold text-ink tracking-widest leading-tight">
          {{ idiom.word }}
        </h1>
      </div>

      <!-- Content sections -->
      <div class="px-6 pb-6 space-y-5">
        <div
          v-for="section in sections"
          :key="section.key"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-zhuhong-soft text-zhuhong">
              <component :is="section.icon" :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-ink-soft tracking-wide">
              {{ section.label }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-ink-soft pl-9">
            {{ getSectionContent(section.key) }}
          </p>
        </div>

        <!-- Related idioms -->
        <div v-if="idiom.relatedIdioms?.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-zhuhong-soft text-zhuhong">
              <Link2 :size="14" />
            </div>
            <h3 class="text-sm font-semibold text-ink-soft tracking-wide">
              相关成语
            </h3>
          </div>
          <div class="flex flex-wrap gap-2 pl-9">
            <button
              v-for="related in idiom.relatedIdioms"
              :key="related"
              @click="emit('relatedClick', related)"
              class="px-4 py-2 rounded-full text-sm font-medium bg-soft text-ink-soft hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200"
            >
              {{ related }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

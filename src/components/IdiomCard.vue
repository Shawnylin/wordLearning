<script setup lang="ts">
import { RefreshCw, BookOpen, FileText, Quote, Lightbulb, Link2, Heart, Coins } from 'lucide-vue-next'
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
    <div class="rounded-3xl card glass-card overflow-hidden">
      <!-- Header -->
      <div class="study-heading px-6 pt-8 pb-6 text-center glass-card-header">
        <div class="study-heading-row mb-2">
          <p class="min-w-0 text-lg tracking-widest text-zhuhong">
            {{ idiom.pinyin || (loading ? '正在生成…' : '') }}
          </p>
          <div class="study-heading-actions">
            <button
              @click="idiomStore.toggleFavorite(idiom.word)"
              class="p-2 rounded-full transition-all duration-200"
              :class="idiomStore.isFavorite(idiom.word)
                ? 'text-zhuhong hover:scale-110'
                : 'text-ink-mute hover:text-zhuhong'"
              :title="idiomStore.isFavorite(idiom.word) ? '取消收藏' : '收藏'"
            >
              <Heart :size="18" :fill="idiomStore.isFavorite(idiom.word) ? 'currentColor' : 'none'" />
            </button>
            <button
              @click="emit('regenerate')"
              :disabled="loading"
              class="p-2 rounded-full text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-all duration-200 disabled:opacity-50"
              title="重新生成"
            >
              <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
            </button>
          </div>
        </div>

        <!-- Word -->
        <h1 class="font-kai text-5xl md:text-6xl font-bold text-ink tracking-widest leading-tight">
          <span :data-morph-word="idiom.word">{{ idiom.word }}</span>
        </h1>

        <div v-if="typeof idiom.tokenUsage === 'number'" class="token-usage flex items-center justify-center gap-1 mt-1.5">
          <Coins :size="12" class="text-gold" />
          <span class="text-xs text-gold">
            消耗 {{ idiom.tokenUsage }} tokens
          </span>
        </div>
      </div>

      <!-- Content sections -->
      <div class="study-sections px-6 pb-6 space-y-5">
        <div
          v-for="section in sections"
          :key="section.key"
          v-show="getSectionContent(section.key) || loading"
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
            {{ getSectionContent(section.key) || '正在生成…' }}
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
          <div class="grid grid-cols-3 gap-2 pl-9">
            <button
              v-for="related in idiom.relatedIdioms.slice(0, 3)"
              :key="related"
              @click="emit('relatedClick', related)"
              class="min-w-0 px-2 py-2 rounded-full text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis bg-soft text-ink-soft hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200"
              :title="related"
            >
              {{ related }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

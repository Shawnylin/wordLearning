<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import { Search, Clock, Trash2, ChevronRight, BookOpen, GitCompare, ArrowLeft, AlertCircle, Heart } from 'lucide-vue-next'
import IdiomCard from '../components/IdiomCard.vue'
import CompareCard from '../components/CompareCard.vue'

const router = useRouter()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const searchQuery = ref('')
const activeTab = ref<'idiom' | 'compare'>('idiom')
const detailMode = ref<'idiom' | 'compare' | null>(null)
const detailWord = ref<string | null>(null)
const detailCompareId = ref<string | null>(null)
const showFavoritesOnly = ref(false)

// 词语记录过滤
const filteredHistory = computed(() => {
  let history = idiomStore.sortedHistory
  if (showFavoritesOnly.value) {
    history = history.filter(item => idiomStore.isFavorite(item.word))
  }
  if (!searchQuery.value.trim()) return history
  const query = searchQuery.value.trim().toLowerCase()
  return history.filter(item => item.word.toLowerCase().includes(query))
})

// 对比记录过滤
const filteredCompareHistory = computed(() => {
  const history = idiomStore.sortedCompareHistory
  if (!searchQuery.value.trim()) return history
  const query = searchQuery.value.trim().toLowerCase()
  return history.filter(item =>
    item.words.some(w => w.toLowerCase().includes(query))
  )
})

function formatTime(timestamp: number): string {
  const now = new Date()
  const diff = now.getTime() - timestamp

  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`

  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function viewIdiom(word: string) {
  idiomStore.setCurrentIdiom(word)
  detailWord.value = word
  detailMode.value = 'idiom'
}

function viewCompare(id: string) {
  idiomStore.setCurrentCompare(id)
  detailCompareId.value = id
  detailMode.value = 'compare'
}

function backToList() {
  detailMode.value = null
  detailWord.value = null
  detailCompareId.value = null
}

async function handleRegenerateIdiom() {
  if (!detailWord.value || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateIdiom(detailWord.value, settingsStore.apiKey)
}

async function handleRegenerateCompare() {
  if (!idiomStore.currentCompare || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateComparison(idiomStore.currentCompare.words, settingsStore.apiKey)
}

function handleRelatedClick(word: string) {
  idiomStore.setCurrentIdiom(word)
  detailWord.value = word
}

function deleteIdiomRecord(recordId: string, event: Event) {
  event.stopPropagation()
  idiomStore.deleteSearchRecord(recordId)
}

function deleteCompareRecord(recordId: string, event: Event) {
  event.stopPropagation()
  idiomStore.deleteCompareRecord(recordId)
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Detail mode: show card inline -->
    <template v-if="detailMode">
      <!-- Back button -->
      <div class="mx-auto max-w-lg mb-4">
        <button
          @click="backToList"
          class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft :size="20" />
          <span class="text-sm font-medium">返回记录</span>
        </button>
      </div>

      <!-- Error Message -->
      <div
        v-if="idiomStore.errorMessage"
        class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
      >
        <div class="flex items-start gap-3">
          <AlertCircle :size="20" class="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p class="text-sm text-red-800 dark:text-red-200">
              {{ idiomStore.errorMessage }}
            </p>
            <button
              @click="idiomStore.clearError()"
              class="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      <!-- Idiom Card -->
      <div v-if="detailMode === 'idiom' && idiomStore.currentIdiom" class="mx-auto max-w-lg">
        <IdiomCard
          :idiom="idiomStore.currentIdiom"
          :loading="idiomStore.isLoading"
          @regenerate="handleRegenerateIdiom"
          @related-click="handleRelatedClick"
        />
      </div>

      <!-- Compare Card -->
      <div v-if="detailMode === 'compare' && idiomStore.currentCompare" class="mx-auto max-w-lg">
        <CompareCard
          :compare="idiomStore.currentCompare"
          :loading="idiomStore.isLoading"
          @regenerate="handleRegenerateCompare"
        />
      </div>
    </template>

    <!-- List mode -->
    <template v-else>
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">学习记录</h1>
      </div>

      <!-- Tab switcher -->
      <div class="mx-auto max-w-lg mb-4">
        <div class="flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800">
          <button
            @click="activeTab = 'idiom'"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="activeTab === 'idiom'
              ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400'"
          >
            <BookOpen :size="16" />
            词语记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedHistory.length }})</span>
          </button>
          <button
            @click="activeTab = 'compare'"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="activeTab === 'compare'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400'"
          >
            <GitCompare :size="16" />
            对比记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedCompareHistory.length }})</span>
          </button>
        </div>
      </div>

      <!-- Search bar + favorites filter -->
      <div class="mx-auto max-w-lg mb-6 flex gap-2">
        <div class="relative flex-1 flex items-center rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500">
          <div class="pl-4 text-gray-400 dark:text-gray-500">
            <Search :size="18" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="activeTab === 'idiom' ? '搜索已学习的成语...' : '搜索对比记录中的词语...'"
            class="flex-1 px-3 py-3 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
          />
        </div>
        <button
          v-if="activeTab === 'idiom'"
          @click="showFavoritesOnly = !showFavoritesOnly"
          class="shrink-0 p-3 rounded-2xl shadow-md border transition-colors duration-200"
          :class="showFavoritesOnly
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400'"
          :title="showFavoritesOnly ? '显示全部' : '仅显示收藏'"
        >
          <Heart :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
        </button>
      </div>

      <!-- 词语记录 Tab -->
      <div v-if="activeTab === 'idiom'" class="mx-auto max-w-lg">
        <div v-if="filteredHistory.length > 0" class="space-y-2">
          <button
            v-for="record in filteredHistory"
            :key="record.id"
            @click="viewIdiom(record.word)"
            class="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200 group"
          >
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0">
              <BookOpen :size="18" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex items-center gap-1.5">
                {{ record.word }}
                <Heart
                  v-if="idiomStore.isFavorite(record.word)"
                  :size="14"
                  class="text-red-500 dark:text-red-400 shrink-0"
                  fill="currentColor"
                />
              </p>
              <div class="flex items-center gap-1 mt-0.5">
                <Clock :size="12" class="text-gray-400 dark:text-gray-500" />
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  {{ formatTime(record.timestamp) }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="deleteIdiomRecord(record.id, $event)"
                class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                title="删除记录"
              >
                <Trash2 :size="16" />
              </button>
              <ChevronRight :size="18" class="text-gray-300 dark:text-gray-600 group-hover:text-red-400 dark:group-hover:text-red-500 transition-colors" />
            </div>
          </button>
        </div>

        <div v-else class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Clock :size="32" class="text-gray-400 dark:text-gray-500" />
          </div>
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            {{ searchQuery ? '没有找到匹配的成语' : '还没有学习记录' }}
          </p>
          <button
            v-if="!searchQuery"
            @click="router.push('/learn')"
            class="mt-4 px-6 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            开始学习
          </button>
        </div>
      </div>

      <!-- 对比记录 Tab -->
      <div v-if="activeTab === 'compare'" class="mx-auto max-w-lg">
        <div v-if="filteredCompareHistory.length > 0" class="space-y-2">
          <button
            v-for="record in filteredCompareHistory"
            :key="record.id"
            @click="viewCompare(record.id)"
            class="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 group"
          >
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
              <GitCompare :size="18" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {{ record.words.join(' vs ') }}
              </p>
              <div class="flex items-center gap-1 mt-0.5">
                <Clock :size="12" class="text-gray-400 dark:text-gray-500" />
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  {{ formatTime(record.createdAt) }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="deleteCompareRecord(record.id, $event)"
                class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                title="删除记录"
              >
                <Trash2 :size="16" />
              </button>
              <ChevronRight :size="18" class="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
        </div>

        <div v-else class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <GitCompare :size="32" class="text-gray-400 dark:text-gray-500" />
          </div>
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            {{ searchQuery ? '没有找到匹配的对比记录' : '还没有对比记录' }}
          </p>
          <button
            v-if="!searchQuery"
            @click="router.push('/compare')"
            class="mt-4 px-6 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            开始对比
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

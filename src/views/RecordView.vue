<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { Search, Clock, Trash2, ChevronRight, BookOpen } from 'lucide-vue-next'

const router = useRouter()
const idiomStore = useIdiomStore()

const searchQuery = ref('')

const filteredHistory = computed(() => {
  const history = idiomStore.sortedHistory
  if (!searchQuery.value.trim()) return history
  const query = searchQuery.value.trim().toLowerCase()
  return history.filter(item => item.word.toLowerCase().includes(query))
})

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function viewIdiom(word: string) {
  idiomStore.setCurrentIdiom(word)
  router.push('/learn')
}

function deleteRecord(recordId: string, event: Event) {
  event.stopPropagation()
  idiomStore.deleteSearchRecord(recordId)
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Header -->
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">学习记录</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        已学习 {{ idiomStore.learnedCount }} 个成语
      </p>
    </div>

    <!-- Search bar -->
    <div class="mx-auto max-w-lg mb-6">
      <div class="relative flex items-center rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500">
        <div class="pl-4 text-gray-400 dark:text-gray-500">
          <Search :size="18" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索已学习的成语..."
          class="flex-1 px-3 py-3 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
        />
      </div>
    </div>

    <!-- History list -->
    <div class="mx-auto max-w-lg">
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
            <p class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              {{ record.word }}
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
              @click="deleteRecord(record.id, $event)"
              class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
              title="删除记录"
            >
              <Trash2 :size="16" />
            </button>
            <ChevronRight :size="18" class="text-gray-300 dark:text-gray-600 group-hover:text-red-400 dark:group-hover:text-red-500 transition-colors" />
          </div>
        </button>
      </div>

      <!-- Empty state -->
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
  </div>
</template>

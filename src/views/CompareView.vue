<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import CompareCard from '../components/CompareCard.vue'
import { Plus, X, AlertCircle, Settings, GitCompare, Loader2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const words = ref<string[]>(['', ''])
const showNoApiKeyWarning = ref(false)

// 从路由 query 中加载对比记录
watch(() => route.query.loadId, (id) => {
  if (id && typeof id === 'string') {
    idiomStore.setCurrentCompare(id)
    if (idiomStore.currentCompare) {
      words.value = [...idiomStore.currentCompare.words]
    }
  }
}, { immediate: true })

function addWord() {
  if (words.value.length < 5) {
    words.value.push('')
  }
}

function removeWord(index: number) {
  if (words.value.length > 2) {
    words.value.splice(index, 1)
  }
}

async function handleCompare() {
  const validWords = words.value.filter(w => w.trim().length > 0)
  if (validWords.length < 2) {
    idiomStore.errorMessage = '请至少输入两个词语'
    return
  }

  if (!settingsStore.hasApiKey()) {
    showNoApiKeyWarning.value = true
    return
  }
  showNoApiKeyWarning.value = false
  await idiomStore.compareIdioms(validWords, settingsStore.apiKey)
}

async function handleRegenerate() {
  if (!idiomStore.currentCompare || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateComparison(idiomStore.currentCompare.words, settingsStore.apiKey)
}

function goToSettings() {
  router.push('/profile')
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Header -->
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">词语对比</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">输入多个词语，AI 生成对比分析</p>
    </div>

    <!-- Word inputs -->
    <div class="mx-auto max-w-lg mb-6">
      <div class="space-y-3">
        <div
          v-for="(_word, index) in words"
          :key="index"
          class="flex items-center gap-2"
        >
          <input
            v-model="words[index]"
            type="text"
            :placeholder="`词语 ${index + 1}`"
            class="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          <button
            v-if="words.length > 2"
            @click="removeWord(index)"
            class="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- Add button -->
      <div class="flex items-center gap-3 mt-3">
        <button
          v-if="words.length < 5"
          @click="addWord"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <Plus :size="16" />
          添加词语
        </button>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          {{ words.length }}/5
        </span>
      </div>

      <!-- Compare button -->
      <button
        @click="handleCompare"
        :disabled="idiomStore.isLoading"
        class="w-full mt-4 py-3 rounded-2xl text-base font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 v-if="idiomStore.isLoading" :size="18" class="animate-spin" />
        <GitCompare v-else :size="18" />
        <span>{{ idiomStore.isLoading ? '生成中...' : '开始对比' }}</span>
      </button>
    </div>

    <!-- No API Key Warning -->
    <div
      v-if="showNoApiKeyWarning"
      class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-amber-800 dark:text-amber-200 font-medium">
            请先设置 API Key
          </p>
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            使用本功能需要设置 DeepSeek API Key
          </p>
          <button
            @click="goToSettings"
            class="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
          >
            <Settings :size="14" />
            前往设置
          </button>
        </div>
      </div>
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

    <!-- Loading State -->
    <div
      v-if="idiomStore.isLoading"
      class="mx-auto max-w-lg"
    >
      <div class="rounded-3xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        <div class="animate-pulse space-y-6">
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-24 mx-auto"></div>
          <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-64 mx-auto"></div>
          <div class="space-y-3">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-5/6"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-4/6"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compare Card -->
    <div
      v-else-if="idiomStore.currentCompare"
      class="mx-auto max-w-lg"
    >
      <CompareCard
        :compare="idiomStore.currentCompare"
        :loading="idiomStore.isLoading"
        @regenerate="handleRegenerate"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="mx-auto max-w-lg text-center py-16"
    >
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <GitCompare :size="32" class="text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        输入两个或多个词语，开始对比学习
      </p>
    </div>
  </div>
</template>

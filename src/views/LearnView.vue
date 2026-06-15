<script setup lang="ts">
import { ref } from 'vue'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import SearchInput from '../components/SearchInput.vue'
import IdiomCard from '../components/IdiomCard.vue'
import { AlertCircle, Settings } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()
const router = useRouter()

const showNoApiKeyWarning = ref(false)

async function handleSearch(word: string) {
  if (!settingsStore.hasApiKey()) {
    showNoApiKeyWarning.value = true
    return
  }
  showNoApiKeyWarning.value = false
  await idiomStore.searchIdiom(word, settingsStore.apiKey)
}

async function handleRegenerate() {
  if (!idiomStore.currentIdiom || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateIdiom(idiomStore.currentIdiom.word, settingsStore.apiKey)
}

function handleRelatedClick(word: string) {
  handleSearch(word)
}

function goToSettings() {
  router.push('/profile')
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Header -->
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">成语学习</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">输入成语，开始学习</p>
    </div>

    <!-- Search Input -->
    <div class="mb-6">
      <SearchInput
        :loading="idiomStore.isLoading"
        @search="handleSearch"
      />
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
        <div class="animate-pulse-custom space-y-6">
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-32 mx-auto"></div>
          <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-48 mx-auto"></div>
          <div class="space-y-4">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Idiom Card -->
    <div
      v-else-if="idiomStore.currentIdiom"
      class="mx-auto max-w-lg"
    >
      <IdiomCard
        :idiom="idiomStore.currentIdiom"
        :loading="idiomStore.isLoading"
        @regenerate="handleRegenerate"
        @related-click="handleRelatedClick"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="mx-auto max-w-lg text-center py-16"
    >
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span class="text-4xl">📖</span>
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        输入成语或词语，开始你的学习之旅
      </p>
    </div>
  </div>
</template>

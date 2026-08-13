<script setup lang="ts">
import { ref, computed } from 'vue'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import SearchInput from '../components/SearchInput.vue'
import IdiomCard from '../components/IdiomCard.vue'
import { AlertCircle, Settings, Clock, Heart, BookOpen } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()
const router = useRouter()

const showNoApiKeyWarning = ref(false)

// 快速入口：最近学习 + 收藏
const recentWords = computed(() =>
  idiomStore.sortedHistory.slice(0, 6).map(r => r.word)
)
const favoriteWords = computed(() => idiomStore.favorites.slice(0, 6))

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
      class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-gold-soft border border-gold/30"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-gold shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-ink font-medium">
            请先设置 API Key
          </p>
          <p class="text-xs text-ink-soft mt-1">
            使用本功能需要设置 DeepSeek API Key
          </p>
          <button
            @click="goToSettings"
            class="mt-2 flex items-center gap-1 text-xs font-medium text-gold hover:opacity-80"
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
      class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-zhuhong-soft border border-zhuhong/30"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-zhuhong shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-ink">
            {{ idiomStore.errorMessage }}
          </p>
          <button
            @click="idiomStore.clearError()"
            class="mt-1 text-xs text-zhuhong hover:underline"
          >
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="idiomStore.isLoading" class="mx-auto max-w-lg">
      <div class="rounded-3xl card p-8">
        <div class="animate-pulse-custom space-y-6">
          <div class="h-6 bg-soft rounded-full w-32 mx-auto"></div>
          <div class="h-12 bg-soft rounded-xl w-48 mx-auto"></div>
          <div class="space-y-4">
            <div class="h-4 bg-soft rounded-full w-20"></div>
            <div class="h-4 bg-soft rounded-full"></div>
            <div class="h-4 bg-soft rounded-full w-3/4"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Idiom Card -->
    <div v-else-if="idiomStore.currentIdiom" class="mx-auto max-w-lg">
      <IdiomCard
        :idiom="idiomStore.currentIdiom"
        :loading="idiomStore.isLoading"
        @regenerate="handleRegenerate"
        @related-click="handleRelatedClick"
      />
    </div>

    <!-- Empty State + 快速入口 -->
    <div v-else class="mx-auto max-w-lg">
      <div class="text-center pt-4 pb-6">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
          <BookOpen :size="32" class="text-ink-mute" />
        </div>
        <p class="text-ink-mute text-sm">
          输入成语或词语，开始你的学习之旅
        </p>
      </div>

      <!-- 快速入口 -->
      <div class="space-y-5">
        <div v-if="recentWords.length > 0">
          <div class="flex items-center gap-2 mb-2">
            <Clock :size="14" class="text-ink-mute" />
            <h3 class="text-xs font-semibold text-ink-mute tracking-wide">最近学习</h3>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="word in recentWords"
              :key="word"
              @click="handleSearch(word)"
              class="px-4 py-2 rounded-full text-sm bg-card border border-line text-ink-soft hover:border-zhuhong hover:text-zhuhong transition-colors duration-200"
            >
              {{ word }}
            </button>
          </div>
        </div>

        <div v-if="favoriteWords.length > 0">
          <div class="flex items-center gap-2 mb-2">
            <Heart :size="14" class="text-zhuhong" fill="currentColor" />
            <h3 class="text-xs font-semibold text-ink-mute tracking-wide">我的收藏</h3>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="word in favoriteWords"
              :key="word"
              @click="handleSearch(word)"
              class="px-4 py-2 rounded-full text-sm bg-zhuhong-soft border border-zhuhong/20 text-zhuhong hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200"
            >
              {{ word }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

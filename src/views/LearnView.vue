<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { ref, computed } from 'vue'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import GenerationStage from '../components/GenerationStage.vue'
import SearchInput from '../components/SearchInput.vue'
import IdiomCard from '../components/IdiomCard.vue'
import { AlertCircle, Settings, Heart } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()
const router = useRouter()

const showNoApiKeyWarning = ref(false)

const favoriteWords = computed(() => idiomStore.favorites.slice(0, 6))

async function handleSearch(word: string) {
  if (!settingsStore.hasApiKey()) {
    showNoApiKeyWarning.value = true
    return
  }
  showNoApiKeyWarning.value = false
  await idiomStore.searchIdiom(word, settingsStore.apiConfig)
}

async function handleRegenerate() {
  if (!idiomStore.currentIdiom || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateIdiom(idiomStore.currentIdiom.word, settingsStore.apiConfig)
}

function handleRelatedClick(word: string) {
  handleSearch(word)
}

function goToSettings() {
  router.push('/profile/models')
}

function handlePagePointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, button, a, label, [contenteditable="true"]')) return
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur()
}
</script>

<template>
  <div
    class="study-page learn-page min-h-screen px-4 pt-6 pb-4"
    :class="{ 'has-study-result': idiomStore.idiomLoading || !!idiomStore.currentIdiom }"
    @pointerdown="handlePagePointerDown"
  >
    <!-- Search Input -->
    <div class="study-command-zone mb-4">
      <SearchInput
        :loading="idiomStore.idiomLoading"
        @search="handleSearch"
      />
    </div>

    <!-- No API Key Warning -->
    <Motion><div
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
            使用本功能需要设置 模型 API Key
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
    </div></Motion>

    <!-- Error Message -->
    <Motion><div
      v-if="idiomStore.idiomError"
      class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-zhuhong-soft border border-zhuhong/30"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-zhuhong shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-ink">
            {{ idiomStore.idiomError }}
          </p>
          <button
            @click="idiomStore.clearError()"
            class="mt-1 text-xs text-zhuhong hover:underline"
          >
            关闭
          </button>
        </div>
      </div>
    </div></Motion>

    <GenerationStage :loading="idiomStore.idiomLoading" :has-content="!!idiomStore.currentIdiom" kind="idiom">
      <IdiomCard v-if="idiomStore.currentIdiom" :idiom="idiomStore.currentIdiom" :loading="idiomStore.idiomLoading" @regenerate="handleRegenerate" @related-click="handleRelatedClick" />
      <template #empty>
        <Motion><div v-if="favoriteWords.length" class="mt-6 text-left">
          <div class="flex items-center gap-2 mb-2"><Heart :size="14" class="text-zhuhong" /><h3 class="text-xs text-ink-mute">我的收藏</h3></div>
          <div class="flex flex-wrap gap-2">
            <button v-for="word in favoriteWords" :key="word" @click="handleSearch(word)" class="px-4 py-2 rounded-full text-sm bg-zhuhong-soft text-zhuhong">{{ word }}</button>
          </div>
        </div></Motion>
      </template>
    </GenerationStage>
  </div>
</template>

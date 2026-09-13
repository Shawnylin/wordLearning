<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import GenerationStage from '../components/GenerationStage.vue'
import CompareCard from '../components/CompareCard.vue'
import { Plus, X, AlertCircle, Settings, GitCompare, Loader2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const MAX_COMPARE_WORDS = 4
const words = ref<string[]>(['', ''])
let nextWordId = 2
const wordIds = ref([0, 1])
const showNoApiKeyWarning = ref(false)

// 从路由 query 中加载对比记录
watch(() => route.query.loadId, (id) => {
  if (id && typeof id === 'string') {
    idiomStore.setCurrentCompare(id)
    if (idiomStore.currentCompare) {
      words.value = [...idiomStore.currentCompare.words].slice(0, MAX_COMPARE_WORDS)
      while (words.value.length < 2) words.value.push('')
      wordIds.value = words.value.map(() => nextWordId++)
    }
  }
}, { immediate: true })

function addWord() {
  if (words.value.length < MAX_COMPARE_WORDS) {
    words.value.push('')
    wordIds.value.push(nextWordId++)
  }
}

function removeWord(index: number) {
  if (words.value.length > 2) {
    words.value.splice(index, 1)
    wordIds.value.splice(index, 1)
  }
}

async function handleCompare() {
  const validWords = words.value.filter(w => w.trim().length > 0)
  if (validWords.length < 2) {
    idiomStore.compareError = '请至少输入两个词语'
    return
  }

  if (!settingsStore.hasApiKey()) {
    showNoApiKeyWarning.value = true
    return
  }
  showNoApiKeyWarning.value = false
  await idiomStore.compareIdioms(validWords, settingsStore.apiConfig)
}

async function handleRegenerate() {
  if (!idiomStore.currentCompare || !settingsStore.hasApiKey()) return
  await idiomStore.regenerateComparison(idiomStore.currentCompare.words, settingsStore.apiConfig)
}

function goToSettings() {
  router.push('/profile/models')
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Word inputs -->
    <div class="mx-auto max-w-lg mb-6">
      <TransitionGroup name="list" tag="div" class="grid grid-cols-2 gap-3 relative">
        <div
          v-for="(_word, index) in words"
          :key="wordIds[index]"
          class="relative min-w-0"
        >
          <input
            v-model="words[index]"
            type="text"
            :placeholder="`输入词语 ${index + 1}`"
            class="w-full min-w-0 px-4 py-3 rounded-2xl bg-card text-base text-ink placeholder-ink-mute outline-none border border-line focus:ring-2 focus:ring-dai/20 focus:border-dai transition-all"
            :class="words.length > 2 ? 'pr-10' : ''"
          />
          <Motion><button
            v-if="words.length > 2"
            @click="removeWord(index)"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-colors"
            :aria-label="`移除词语 ${index + 1}`"
            title="移除"
          >
            <X :size="18" />
          </button></Motion>
        </div>
      </TransitionGroup>

      <!-- Add button -->
      <div class="flex items-center gap-3 mt-3">
        <Motion><button
          v-if="words.length < MAX_COMPARE_WORDS"
          @click="addWord"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-dai bg-dai-soft hover:opacity-85 transition-colors"
        >
          <Plus :size="16" />
          添加词语
        </button></Motion>
        <span class="text-xs text-ink-mute">
          {{ words.length }}/{{ MAX_COMPARE_WORDS }}
        </span>

      <!-- Compare button -->
      <button
        @click="handleCompare"
        :disabled="idiomStore.compareLoading"
        class="ml-auto w-32 shrink-0 py-2 rounded-xl text-sm font-medium btn-dai transition-colors flex items-center justify-center gap-2"
      >
        <Motion><Loader2 v-if="idiomStore.compareLoading" :size="18" class="animate-spin" />
        <GitCompare v-else :size="18" /></Motion>
        <span>{{ idiomStore.compareLoading ? '生成中…' : '开始对比' }}</span>
      </button>
      </div>
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
      v-if="idiomStore.compareError"
      class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-zhuhong-soft border border-zhuhong/30"
    >
      <div class="flex items-start gap-3">
        <AlertCircle :size="20" class="text-zhuhong shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-ink">
            {{ idiomStore.compareError }}
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

    <GenerationStage :loading="idiomStore.compareLoading" :has-content="!!idiomStore.currentCompare" kind="compare">
      <CompareCard v-if="idiomStore.currentCompare" :compare="idiomStore.currentCompare" :loading="idiomStore.compareLoading" @regenerate="handleRegenerate" />
    </GenerationStage>
  </div>
</template>

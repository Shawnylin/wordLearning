<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Heart, Settings } from 'lucide-vue-next'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import StudyCommand from '../components/StudyCommand.vue'
import GenerationStage from '../components/GenerationStage.vue'
import IdiomCard from '../components/IdiomCard.vue'
import CompareCard from '../components/CompareCard.vue'

const store = useIdiomStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const mode = ref<'idiom' | 'compare'>('idiom')
const expanded = ref(false)
const word = ref('')
let nextId = 2
const words = ref([{ id: 0, value: '' }, { id: 1, value: '' }])
const command = ref<InstanceType<typeof StudyCommand>>()
const showNoApiKeyWarning = ref(false)
const loading = computed(() => mode.value === 'idiom' ? store.idiomLoading : store.compareLoading)
const error = computed(() => mode.value === 'idiom' ? store.idiomError : store.compareError)
const hasContent = computed(() => mode.value === 'idiom' ? !!store.currentIdiom : !!store.currentCompare)
const canSend = computed(() => !loading.value && (mode.value === 'idiom' ? !!word.value.trim() : words.value.filter(w => w.value.trim()).length >= 2))

// Old comparison links and review links now open the shared workspace.
watch(() => [route.path, route.query.mode, route.query.loadId, route.query.word], () => {
  if (route.path !== '/learn') return
  mode.value = route.query.mode === 'compare' ? 'compare' : 'idiom'
  expanded.value = false
  if (typeof route.query.loadId === 'string') {
    store.setCurrentCompare(route.query.loadId)
    if (store.currentCompare) {
      mode.value = 'compare'
      words.value = store.currentCompare.words.slice(0, 4).map(value => ({ id: nextId++, value }))
      while (words.value.length < 2) words.value.push({ id: nextId++, value: '' })
      expanded.value = true
    }
  } else if (typeof route.query.word === 'string') {
    word.value = route.query.word
    store.setCurrentIdiom(word.value)
    expanded.value = !!store.currentIdiom
  }
}, { immediate: true })

function toggleMode() {
  if (expanded.value) return
  showNoApiKeyWarning.value = false
  router.replace({ path: '/learn', query: mode.value === 'idiom' ? { mode: 'compare' } : {} })
}

async function addWord() {
  if (words.value.length >= 4 || loading.value) return
  const id = nextId++
  words.value.push({ id, value: '' })
  await nextTick()
  command.value?.focusWord(id)
}

function removeWord(id: number) {
  if (words.value.length <= 2 || loading.value) return
  words.value = words.value.filter(item => item.id !== id)
}

function hasApiKey() {
  showNoApiKeyWarning.value = !settings.hasApiKey()
  return !showNoApiKeyWarning.value
}

async function submit() {
  if (!canSend.value || !hasApiKey()) return
  const active = document.activeElement
  if (active instanceof HTMLInputElement) active.blur()
  expanded.value = true
  if (mode.value === 'idiom') {
    await store.searchIdiom(word.value.trim(), settings.apiConfig)
  } else {
    store.compareError = ''
    await store.compareIdioms(words.value.map(w => w.value.trim()).filter(Boolean), settings.apiConfig)
  }
}

function searchRelated(value: string) {
  if (store.idiomLoading) return
  word.value = value
  submit()
}

async function regenerate() {
  if (loading.value || !hasApiKey()) return
  if (mode.value === 'idiom' && store.currentIdiom) {
    await store.regenerateIdiom(store.currentIdiom.word, settings.apiConfig)
  } else if (store.currentCompare) {
    await store.regenerateComparison(store.currentCompare.words, settings.apiConfig)
  }
}

function closeResult() {
  expanded.value = false
  // Closing only changes presentation; in-flight work may still finish into the cache.
  document.getElementById('app')?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}

function handlePagePointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, button, a, label, [contenteditable="true"]')) return
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur()
}
</script>

<template>
  <div class="study-page unified-study min-h-screen px-4 pt-6 pb-4" @pointerdown="handlePagePointerDown">
    <StudyCommand ref="command" v-model="word" :words="words" :mode="mode" :expanded="expanded" :loading="loading" :can-send="canSend"
      @update-word="(id, value) => { const item = words.find(w => w.id === id); if (item) item.value = value }"
      @remove="removeWord" @submit="submit" @close="closeResult" />

    <div v-if="showNoApiKeyWarning" class="study-notice p-4 rounded-2xl bg-gold-soft border border-gold/30" role="alert">
      <AlertCircle :size="18" /><span>请先设置 API Key</span>
      <button class="flex items-center gap-1 text-sm" @click="router.push('/profile/models')"><Settings :size="16" />前往设置</button>
    </div>
    <div v-if="error" class="study-notice p-4 rounded-2xl bg-zhuhong-soft border border-zhuhong/30" role="alert">
      <AlertCircle :size="18" class="shrink-0" /><span class="flex-1">{{ error }}</span>
      <button @click="mode === 'idiom' ? store.idiomError = '' : store.compareError = ''">关闭</button>
    </div>

    <GenerationStage :expanded="expanded" :loading="loading" :has-content="hasContent" :kind="mode" :can-add="words.length < 4 && !loading" :can-send="canSend"
      @toggle="toggleMode" @add="addWord" @submit="submit">
      <IdiomCard v-if="mode === 'idiom' && store.currentIdiom" :idiom="store.currentIdiom" :loading="loading" @regenerate="regenerate" @related-click="searchRelated" />
      <CompareCard v-else-if="mode === 'compare' && store.currentCompare" :compare="store.currentCompare" :loading="loading" @regenerate="regenerate" />
      <template #empty>
        <div v-if="mode === 'idiom' && store.favorites.length" class="study-favorites">
          <div class="flex items-center gap-2 mb-3 text-xs text-ink-mute"><Heart :size="14" />我的收藏</div>
          <div class="flex flex-wrap justify-center gap-2">
            <button v-for="item in store.favorites.slice(0, 6)" :key="item" :disabled="loading" class="px-4 py-2 rounded-full text-sm bg-zhuhong-soft text-zhuhong" @click="searchRelated(item)">{{ item }}</button>
          </div>
        </div>
      </template>
    </GenerationStage>
  </div>
</template>

<style scoped>
.study-notice { display: flex; align-items: center; gap: 10px; max-width: 760px; margin: 16px auto; }
.study-favorites { max-width: 512px; margin: 32px auto 0; }
.study-favorites > div:first-child { justify-content: center; }
</style>

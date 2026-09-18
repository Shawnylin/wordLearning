<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import type { SearchRecord, CompareRecord } from '../types/idiom'
import {
  Search, Clock, Trash2, ChevronRight, BookOpen, GitCompare,
  AlertCircle, Heart, ListChecks, Check, Shuffle, X
} from 'lucide-vue-next'
import IdiomCard from '../components/IdiomCard.vue'
import CompareWords from '../components/CompareWords.vue'
import CompareCard from '../components/CompareCard.vue'
import RecordOverlay from '../components/RecordOverlay.vue'

const router = useRouter()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const searchQuery = ref('')
const activeTab = ref<'idiom' | 'compare'>('idiom')
const detailError = computed(() => idiomStore.errorMessage || (detailMode.value === 'idiom' ? idiomStore.idiomError : idiomStore.compareError))
const sourceRow = ref<HTMLElement | null>(null)
const detailIdiom = computed(() => detailWord.value ? idiomStore.idiomCache[detailWord.value] : null)
const detailCompare = computed(() => idiomStore.compareHistory.find(r => r.id === detailCompareId.value))
const detailMode = ref<'idiom' | 'compare' | null>(null)
const detailWord = ref<string | null>(null)
const detailCompareId = ref<string | null>(null)
const showFavoritesOnly = ref(false)

// 批量管理状态
const editMode = ref(false)
const selectedIds = ref<string[]>([])
const confirmDelete = ref<{ ids: string[]; isCompare: boolean; label: string } | null>(null)

watch(activeTab, () => {
  selectedIds.value = []
})

const filteredHistory = computed(() => {
  let history = idiomStore.sortedHistory
  if (showFavoritesOnly.value) {
    history = history.filter(item => idiomStore.isFavorite(item.word))
  }
  if (!searchQuery.value.trim()) return history
  const query = searchQuery.value.trim().toLowerCase()
  return history.filter(item => item.word.toLowerCase().includes(query))
})

const filteredCompareHistory = computed(() => {
  const history = idiomStore.sortedCompareHistory
  if (!searchQuery.value.trim()) return history
  const query = searchQuery.value.trim().toLowerCase()
  return history.filter(item =>
    item.words.some(w => w.toLowerCase().includes(query))
  )
})

const hasAnyRecord = computed(() =>
  activeTab.value === 'idiom'
    ? idiomStore.sortedHistory.length > 0
    : idiomStore.sortedCompareHistory.length > 0
)

const selectedCount = computed(() => selectedIds.value.length)

const isAllSelected = computed(() => {
  const total = activeTab.value === 'idiom'
    ? filteredHistory.value.length
    : filteredCompareHistory.value.length
  return total > 0 && selectedIds.value.length === total
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

function switchTab(tab: 'idiom' | 'compare') {
  activeTab.value = tab
  selectedIds.value = []
}

function viewIdiom(word: string) {
  detailWord.value = word
  detailMode.value = 'idiom'
}

function viewCompare(id: string) {
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
  await idiomStore.regenerateIdiom(detailWord.value, settingsStore.apiConfig)
}

async function handleRegenerateCompare() {
  if (!detailCompare.value || !settingsStore.hasApiKey()) return
  const result = await idiomStore.regenerateComparison(detailCompare.value.words, settingsStore.apiConfig)
  if (result) detailCompareId.value = result.id
}

async function handleRelatedClick(word: string) {
  if (!idiomStore.idiomCache[word]) {
    if (!settingsStore.hasApiKey()) { idiomStore.errorMessage = '请先在个人页面配置 API'; return }
    const result = await idiomStore.searchIdiom(word, settingsStore.apiConfig)
    if (!result) return
  }
  detailWord.value = word
}

function toggleEditMode() {
  editMode.value = !editMode.value
  selectedIds.value = []
}

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function toggleSelect(id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function selectAll() {
  const ids = activeTab.value === 'idiom'
    ? filteredHistory.value.map(r => r.id)
    : filteredCompareHistory.value.map(r => r.id)
  selectedIds.value = [...ids]
}

function clearSelection() {
  selectedIds.value = []
}

function onIdiomRowClick(record: SearchRecord, event: Event) {
  if (editMode.value) {
    toggleSelect(record.id)
  } else {
    sourceRow.value = event.currentTarget as HTMLElement
    viewIdiom(record.word)
  }
}

function onCompareRowClick(record: CompareRecord, event: Event) {
  if (editMode.value) {
    toggleSelect(record.id)
  } else {
    sourceRow.value = event.currentTarget as HTMLElement
    viewCompare(record.id)
  }
}

function requestDeleteIdiom(record: SearchRecord) {
  confirmDelete.value = { ids: [record.id], isCompare: false, label: `「${record.word}」` }
}

function requestDeleteCompare(record: CompareRecord) {
  confirmDelete.value = { ids: [record.id], isCompare: true, label: `「${record.words.join(' vs ')}」` }
}

function requestBatchDelete() {
  if (selectedIds.value.length === 0) return
  const isCompare = activeTab.value === 'compare'
  confirmDelete.value = {
    ids: [...selectedIds.value],
    isCompare,
    label: `已选的 ${selectedIds.value.length} 条记录`
  }
}

function doConfirmDelete() {
  if (!confirmDelete.value) return
  const { ids, isCompare } = confirmDelete.value
  if (isCompare) {
    idiomStore.deleteCompareRecords(ids)
  } else {
    idiomStore.deleteSearchRecords(ids)
  }
  selectedIds.value = []
  confirmDelete.value = null
  if (!hasAnyRecord.value) {
    editMode.value = false
  }
}
</script>

<template>
  <div class="min-h-screen px-4 pt-8 pb-4">
    <RecordOverlay v-if="detailMode" :source="sourceRow" @close="backToList">
      <Motion><div
        v-if="detailError"
        class="mx-auto max-w-lg mb-6 p-4 rounded-2xl bg-zhuhong-soft border border-zhuhong/30"
      >
        <div class="flex items-start gap-3">
          <AlertCircle :size="20" class="text-zhuhong shrink-0 mt-0.5" />
          <div>
            <p class="text-sm text-ink">{{ detailError }}</p>
            <button
              @click="idiomStore.clearError()"
              class="mt-1 text-xs text-zhuhong hover:underline"
            >
              关闭
            </button>
          </div>
        </div>
      </div></Motion>

      <Motion><div v-if="detailMode === 'idiom' && detailIdiom" class="mx-auto max-w-lg">
        <IdiomCard
          :idiom="detailIdiom"
          :loading="idiomStore.isLoading"
          @regenerate="handleRegenerateIdiom"
          @related-click="handleRelatedClick"
        />
      </div></Motion>

      <Motion><div v-if="detailMode === 'compare' && detailCompare" class="mx-auto max-w-lg">
        <CompareCard
          :compare="detailCompare"
          :loading="idiomStore.isLoading"
          @regenerate="handleRegenerateCompare"
        />
      </div></Motion>
    </RecordOverlay>

    <!-- List stays mounted beneath the detail card. -->
    <div :inert="!!detailMode">
      <div class="mx-auto max-w-lg mb-4 flex items-center justify-between">
        <h1 class="font-kai text-3xl text-ink leading-tight">学习记录</h1>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-full border border-zhuhong/25 bg-zhuhong-soft px-3.5 py-2 text-sm font-medium text-zhuhong transition-colors hover:bg-zhuhong hover:text-paper-ink"
            @click="router.push('/review')"
          >
            <Shuffle :size="16" />
            复习
          </button>
          <Motion><button
            v-if="hasAnyRecord"
            @click="toggleEditMode"
            class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
            :class="editMode
              ? 'btn-primary'
              : 'bg-soft text-ink-soft border border-line'"
          >
            <component :is="editMode ? X : ListChecks" :size="16" />
            {{ editMode ? '完成' : '管理' }}
          </button></Motion>
        </div>
      </div>

      <!-- Tab switcher -->
      <div class="mx-auto max-w-lg mb-4">
        <div class="flex p-1 rounded-2xl bg-soft">
          <button
            @click="switchTab('idiom')"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="activeTab === 'idiom'
              ? 'bg-card text-zhuhong shadow-sm'
              : 'text-ink-mute'"
          >
            <BookOpen :size="16" />
            词语记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedHistory.length }})</span>
          </button>
          <button
            @click="switchTab('compare')"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="activeTab === 'compare'
              ? 'bg-card text-dai shadow-sm'
              : 'text-ink-mute'"
          >
            <GitCompare :size="16" />
            对比记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedCompareHistory.length }})</span>
          </button>
        </div>
      </div>

      <!-- Search bar + favorites filter -->
      <div class="mx-auto max-w-lg mb-4 flex gap-2">
        <div class="relative flex-1 flex items-center rounded-2xl bg-card shadow-sm border border-line overflow-hidden focus-within:ring-2 focus-within:ring-zhuhong/15 focus-within:border-zhuhong">
          <div class="pl-4 text-ink-mute">
            <Search :size="18" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="activeTab === 'idiom' ? '搜索已学习的成语…' : '搜索对比记录中的词语…'"
            class="flex-1 px-3 py-3 text-sm bg-transparent text-ink placeholder-ink-mute outline-none"
          />
        </div>
        <Motion><button
          v-if="activeTab === 'idiom'"
          @click="showFavoritesOnly = !showFavoritesOnly"
          class="shrink-0 p-3 rounded-2xl shadow-sm border transition-colors duration-200"
          :class="showFavoritesOnly
            ? 'bg-zhuhong-soft border-zhuhong/30 text-zhuhong'
            : 'bg-card border-line text-ink-mute hover:text-zhuhong'"
          :title="showFavoritesOnly ? '显示全部' : '仅显示收藏'"
        >
          <Heart :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
        </button></Motion>
      </div>

      <!-- Batch action bar -->
      <Motion><div v-if="editMode" class="mx-auto max-w-lg mb-4 flex items-center gap-3">
        <button
          @click="isAllSelected ? clearSelection() : selectAll()"
          class="flex items-center gap-1.5 text-sm font-medium text-ink-soft"
        >
          <Check :size="16" :class="isAllSelected ? 'text-zhuhong' : 'text-ink-mute'" />
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
        <span class="text-xs text-ink-mute">已选 {{ selectedCount }} 项</span>
        <button
          @click="requestBatchDelete"
          :disabled="selectedCount === 0"
          class="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium btn-primary transition-colors"
        >
          <Trash2 :size="16" />
          删除
        </button>
      </div></Motion>

      <!-- 词语记录 -->
      <Motion><div v-if="activeTab === 'idiom'" class="mx-auto max-w-lg">
        <Motion><div v-if="filteredHistory.length > 0">
          <TransitionGroup name="list" tag="div" class="space-y-2 relative">
          <div
            v-for="record in filteredHistory"
            :key="record.id"
            @click="onIdiomRowClick(record, $event)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl card hover:border-zhuhong/50 transition-all duration-200 group cursor-pointer"
            :class="{ 'border-zhuhong ring-1 ring-zhuhong/25': editMode && isSelected(record.id) }"
            role="button"
            tabindex="0"
            @keydown.enter="onIdiomRowClick(record, $event)"
          >
            <Motion><div
              v-if="editMode"
              class="flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors"
              :class="isSelected(record.id)
                ? 'bg-zhuhong-solid border-zhuhong-solid text-paper-ink'
                : 'border-line text-transparent'"
            >
              <Check :size="12" :stroke-width="3" />
            </div></Motion>

            <div class="min-w-0 flex-1 text-left">
              <p class="text-base font-semibold text-ink group-hover:text-zhuhong transition-colors flex items-center gap-1.5">
                <span class="font-kai" :data-morph-word="record.word">{{ record.word }}</span>
                <Motion><Heart data-row-aux
                  v-if="idiomStore.isFavorite(record.word)"
                  :size="14"
                  class="text-zhuhong shrink-0"
                  fill="currentColor"
                /></Motion>
              </p>
              <div data-row-time class="flex items-center gap-1 mt-0.5">
                <Clock :size="12" class="text-ink-mute" />
                <span class="text-xs text-ink-mute">{{ formatTime(record.timestamp) }}</span>
              </div>
            </div>
            <template v-if="!editMode">
              <button
                @click.stop="requestDeleteIdiom(record)"
                class="shrink-0 p-1.5 rounded-lg text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-colors"
                title="删除记录"
              >
                <Trash2 :size="16" />
              </button>
              <ChevronRight :size="18" class="text-ink-mute group-hover:text-zhuhong transition-colors" />
            </template>
          </div>
          </TransitionGroup>
        </div>

        <div v-else class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
            <Clock :size="32" class="text-ink-mute" />
          </div>
          <p class="text-ink-mute text-sm">
            {{ searchQuery ? '没有找到匹配的成语' : '还没有学习记录' }}
          </p>
          <Motion><button
            v-if="!searchQuery"
            @click="router.push('/learn')"
            class="mt-4 px-6 py-2 rounded-full btn-primary text-sm font-medium transition-colors"
          >
            开始学习
          </button></Motion>
        </div></Motion>
      </div></Motion>

      <!-- 对比记录 -->
      <Motion><div v-if="activeTab === 'compare'" class="mx-auto max-w-lg">
        <Motion><div v-if="filteredCompareHistory.length > 0">
          <TransitionGroup name="list" tag="div" class="space-y-2 relative">
          <div
            v-for="record in filteredCompareHistory"
            :key="record.id"
            @click="onCompareRowClick(record, $event)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl card hover:border-dai/50 transition-all duration-200 group cursor-pointer"
            :class="{ 'border-dai ring-1 ring-dai/25': editMode && isSelected(record.id) }"
            role="button"
            tabindex="0"
            @keydown.enter="onCompareRowClick(record, $event)"
          >
            <Motion><div
              v-if="editMode"
              class="flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors"
              :class="isSelected(record.id)
                ? 'bg-dai-solid border-dai-solid text-paper-ink'
                : 'border-line text-transparent'"
            >
              <Check :size="12" :stroke-width="3" />
            </div></Motion>

            <div class="min-w-0 flex-1 text-left">
              <CompareWords :words="record.words" variant="list" class="text-ink group-hover:text-dai" />
              <div data-row-time class="flex items-center gap-1 mt-0.5">
                <Clock :size="12" class="text-ink-mute" />
                <span class="text-xs text-ink-mute">{{ formatTime(record.createdAt) }}</span>
              </div>
            </div>
            <template v-if="!editMode">
              <button
                @click.stop="requestDeleteCompare(record)"
                class="shrink-0 p-1.5 rounded-lg text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-colors"
                title="删除记录"
              >
                <Trash2 :size="16" />
              </button>
              <ChevronRight :size="18" class="shrink-0 text-ink-mute group-hover:text-dai transition-colors" />
            </template>
          </div>
          </TransitionGroup>
        </div>

        <div v-else class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
            <GitCompare :size="32" class="text-ink-mute" />
          </div>
          <p class="text-ink-mute text-sm">
            {{ searchQuery ? '没有找到匹配的对比记录' : '还没有对比记录' }}
          </p>
          <Motion><button
            v-if="!searchQuery"
            @click="router.push('/compare')"
            class="mt-4 px-6 py-2 rounded-full btn-dai text-sm font-medium transition-colors"
          >
            开始对比
          </button></Motion>
        </div></Motion>
      </div></Motion>
    </div>

    <!-- Delete Confirm Modal -->
    <Teleport to="body">
      <Motion><div
        v-if="confirmDelete"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="confirmDelete = null"
      >
        <div class="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
          <h3 class="text-lg font-semibold text-ink mb-2">删除记录？</h3>
          <p class="text-sm text-ink-soft mb-6">
            确定要删除 {{ confirmDelete.label }} 吗？此操作不会删除已缓存的词语内容，且不可恢复。
          </p>
          <div class="flex gap-3">
            <button
              @click="confirmDelete = null"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              取消
            </button>
            <button
              @click="doConfirmDelete"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium btn-primary transition-colors"
            >
              确认删除
            </button>
          </div>
        </div>
      </div></Motion>
    </Teleport>
  </div>
</template>

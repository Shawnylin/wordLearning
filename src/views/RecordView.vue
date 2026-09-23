<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { ref, computed, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import type { SearchRecord, CompareRecord } from '../types/idiom'
import {
  Search, Clock, Trash2, BookOpen, GitCompare,
  AlertCircle, Heart, ListChecks, Check, Shuffle, X
} from 'lucide-vue-next'
import IdiomCard from '../components/IdiomCard.vue'
import CompareWords from '../components/CompareWords.vue'
import CompareCard from '../components/CompareCard.vue'
import RecordOverlay from '../components/RecordOverlay.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

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
const searchLiquidFilterId = `record-search-liquid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

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
    sourceRow.value = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-record-row]')
    viewIdiom(record.word)
  }
}

function onCompareRowClick(record: CompareRecord, event: Event) {
  if (editMode.value) {
    toggleSelect(record.id)
  } else {
    sourceRow.value = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-record-row]')
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
  <div class="min-h-screen px-4 pt-6 pb-4">
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
        <h1 class="app-page-title font-kai text-ink">学习记录</h1>
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
            class="record-manage-button flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
            :class="editMode
              ? 'is-managing btn-primary'
              : 'bg-soft text-ink-soft border border-line'"
          >
            <span class="record-manage-icon" aria-hidden="true">
              <ListChecks class="record-manage-list-icon" :size="16" />
              <X class="record-manage-done-icon" :size="16" />
            </span>
            {{ editMode ? '完成' : '管理' }}
          </button></Motion>
        </div>
      </div>

      <!-- Tab switcher -->
      <div class="mx-auto max-w-lg mb-4">
        <div class="record-tabs grid grid-cols-2 p-1 rounded-2xl bg-soft" :class="{ 'is-compare': activeTab === 'compare' }">
          <span class="record-tab-indicator" aria-hidden="true" />
          <button
            @click="switchTab('idiom')"
            class="record-tab-button flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :aria-pressed="activeTab === 'idiom'"
            :class="activeTab === 'idiom'
              ? 'text-zhuhong'
              : 'text-ink-mute'"
          >
            <BookOpen :size="16" />
            词语记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedHistory.length }})</span>
          </button>
          <button
            @click="switchTab('compare')"
            class="record-tab-button flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :aria-pressed="activeTab === 'compare'"
            :class="activeTab === 'compare'
              ? 'text-dai'
              : 'text-ink-mute'"
          >
            <GitCompare :size="16" />
            对比记录
            <span class="text-xs opacity-60">({{ idiomStore.sortedCompareHistory.length }})</span>
          </button>
        </div>
      </div>

      <!-- Search bar + favorites filter -->
      <div class="record-search-row mx-auto max-w-lg mb-4" :class="{ 'is-compare': activeTab === 'compare' }">
        <svg class="record-search-filter" width="0" height="0" aria-hidden="true"><defs>
          <filter :id="searchLiquidFilterId" x="-20%" y="-80%" width="140%" height="260%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
          </filter>
        </defs></svg>
        <div class="record-search-liquid" :style="{ filter: `url(#${searchLiquidFilterId}) drop-shadow(0 0 1px color-mix(in srgb, var(--ink) 24%, transparent)) drop-shadow(0 2px 3px color-mix(in srgb, var(--ink) 8%, transparent))` }" aria-hidden="true">
          <span class="record-search-liquid-field" />
          <span class="record-search-liquid-heart" :class="{ 'is-selected': showFavoritesOnly }" />
        </div>
        <label class="record-search-field flex items-center overflow-hidden">
          <div class="pl-4 text-ink-mute">
            <Search :size="18" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="activeTab === 'idiom' ? '搜索已学习的成语…' : '搜索对比记录中的词语…'"
            class="min-w-0 flex-1 px-3 py-3 text-sm bg-transparent text-ink placeholder-ink-mute outline-none"
          />
        </label>
        <button
          type="button"
          @click="showFavoritesOnly = !showFavoritesOnly"
          class="record-favorite-button grid place-items-center rounded-2xl"
          :class="showFavoritesOnly ? 'is-selected text-zhuhong' : 'text-ink-mute hover:text-zhuhong'"
          :title="showFavoritesOnly ? '显示全部' : '仅显示收藏'"
          :aria-label="showFavoritesOnly ? '显示全部记录' : '仅显示收藏记录'"
          :aria-pressed="showFavoritesOnly"
          :aria-hidden="activeTab === 'compare'"
          :tabindex="activeTab === 'compare' ? -1 : 0"
          :inert="activeTab === 'compare'"
        >
          <Heart :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
        </button>
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
            data-record-row
            class="record-row w-full flex items-center px-2 rounded-2xl card hover:border-zhuhong/50 group"
            :class="{ 'is-managing': editMode, 'border-zhuhong ring-1 ring-zhuhong/25': editMode && isSelected(record.id) }"
          >
            <button type="button" class="record-row-main min-w-0 min-h-14 flex-1 flex items-center px-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-zhuhong" :aria-pressed="editMode ? isSelected(record.id) : undefined" @click="onIdiomRowClick(record, $event)">
            <span class="record-select-slot" :class="{ 'is-visible': editMode }" aria-hidden="true">
              <span class="record-select-orb flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors"
                :class="isSelected(record.id)
                  ? 'bg-zhuhong-solid border-zhuhong-solid text-paper-ink'
                  : 'border-line text-transparent'">
                <Check :size="12" :stroke-width="3" />
              </span>
            </span>

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
            </button>
            <button
              type="button"
              @click="requestDeleteIdiom(record)"
              class="record-row-delete grid place-items-center rounded-xl text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft"
              :aria-label="`删除${record.word}`"
              :title="`删除${record.word}`"
              :aria-hidden="editMode"
              :tabindex="editMode ? -1 : 0"
              :inert="editMode"
            >
              <Trash2 :size="16" />
            </button>
          </div>
          </TransitionGroup>
        </div>

        <div v-else class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
            <Clock :size="28" class="text-ink-mute" />
          </div>
          <p class="text-ink-mute text-sm">
            {{ searchQuery ? '没有找到匹配的成语' : '还没有学习记录' }}
          </p>
          <Motion><button
            v-if="!searchQuery"
            @click="router.push('/learn')"
            class="mt-4 min-h-11 px-6 py-2 rounded-full btn-primary text-sm font-medium transition-colors"
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
            data-record-row
            class="record-row w-full flex items-center px-2 rounded-2xl card hover:border-dai/50 group"
            :class="{ 'is-managing': editMode, 'border-dai ring-1 ring-dai/25': editMode && isSelected(record.id) }"
          >
            <button type="button" class="record-row-main min-w-0 min-h-14 flex-1 flex items-center px-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-dai" :aria-pressed="editMode ? isSelected(record.id) : undefined" @click="onCompareRowClick(record, $event)">
            <span class="record-select-slot" :class="{ 'is-visible': editMode }" aria-hidden="true">
              <span class="record-select-orb flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors"
                :class="isSelected(record.id)
                  ? 'bg-dai-solid border-dai-solid text-paper-ink'
                  : 'border-line text-transparent'">
                <Check :size="12" :stroke-width="3" />
              </span>
            </span>

            <div class="min-w-0 flex-1 text-left">
              <CompareWords :words="record.words" variant="list" class="text-ink group-hover:text-dai" />
              <div data-row-time class="flex items-center gap-1 mt-0.5">
                <Clock :size="12" class="text-ink-mute" />
                <span class="text-xs text-ink-mute">{{ formatTime(record.createdAt) }}</span>
              </div>
            </div>
            </button>
            <button
              type="button"
              @click="requestDeleteCompare(record)"
              class="record-row-delete grid place-items-center rounded-xl text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft"
              :aria-label="`删除${record.words.join('、')}`"
              :title="`删除${record.words.join('、')}`"
              :aria-hidden="editMode"
              :tabindex="editMode ? -1 : 0"
              :inert="editMode"
            >
              <Trash2 :size="16" />
            </button>
          </div>
          </TransitionGroup>
        </div>

        <div v-else class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
            <GitCompare :size="28" class="text-ink-mute" />
          </div>
          <p class="text-ink-mute text-sm">
            {{ searchQuery ? '没有找到匹配的对比记录' : '还没有对比记录' }}
          </p>
          <Motion><button
            v-if="!searchQuery"
            @click="router.push('/compare')"
            class="mt-4 min-h-11 px-6 py-2 rounded-full btn-dai text-sm font-medium transition-colors"
          >
            开始对比
          </button></Motion>
        </div></Motion>
      </div></Motion>
    </div>

    <ConfirmDialog
      v-if="confirmDelete"
      title="删除记录？"
      :description="`确定要删除 ${confirmDelete.label} 吗？此操作不会删除已缓存的词语内容，且不可恢复。`"
      @cancel="confirmDelete = null"
      @confirm="doConfirmDelete"
    />
  </div>
</template>

<style scoped>
.record-manage-button { min-width: 82px; }
.record-manage-icon { position: relative; flex: 0 0 16px; width: 16px; height: 16px; }
.record-manage-icon svg { position: absolute; inset: 0; transition: opacity 220ms ease, transform 360ms cubic-bezier(.4, 0, .2, 1); }
.record-manage-done-icon { opacity: 0; transform: translateY(5px) scale(.8); }
.record-manage-button.is-managing .record-manage-list-icon { opacity: 0; transform: translateY(-5px) scale(.8); }
.record-manage-button.is-managing .record-manage-done-icon { opacity: 1; transform: none; }
.record-tabs { position: relative; isolation: isolate; }
.record-tab-indicator {
  position: absolute;
  z-index: -1;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 2);
  border-radius: 12px;
  background: var(--card);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent);
  transition: transform 440ms cubic-bezier(.4, 0, .2, 1);
}
.record-tabs.is-compare .record-tab-indicator { transform: translateX(100%); }
.record-tab-button { position: relative; z-index: 1; min-width: 0; }

.record-search-row { position: relative; isolation: isolate; height: 48px; }
.record-search-filter { position: absolute; pointer-events: none; }
.record-search-liquid { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.record-search-liquid-field,
.record-search-liquid-heart { position: absolute; top: 0; height: 48px; border-radius: 16px; background: var(--card); }
.record-search-liquid-field { left: 0; right: 56px; transition: right 560ms cubic-bezier(.4, 0, .2, 1); }
.record-search-liquid-heart {
  right: 0;
  width: 48px;
  transition: transform 560ms cubic-bezier(.4, 0, .2, 1), opacity 220ms ease 40ms, background-color 200ms ease;
}
.record-search-liquid-heart.is-selected { background: var(--zhuhong-soft); }
.record-search-field {
  position: absolute;
  z-index: 1;
  inset: 0 56px 0 0;
  border: 0;
  border-radius: 16px;
  transition: right 560ms cubic-bezier(.4, 0, .2, 1), box-shadow 200ms ease;
}
.record-search-field:focus-within {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--zhuhong) 16%, transparent);
}
.record-favorite-button {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  width: 48px;
  height: 48px;
  border: 0;
  opacity: 1;
  visibility: visible;
  transition: transform 560ms cubic-bezier(.4, 0, .2, 1), opacity 180ms ease 40ms, visibility 0s linear 0s, color 200ms ease;
}
.record-search-row.is-compare .record-search-liquid-field,
.record-search-row.is-compare .record-search-field { right: 0; }
.record-search-row.is-compare .record-search-liquid-heart,
.record-search-row.is-compare .record-favorite-button { transform: translateX(-16px) scale(.72); opacity: 0; }
.record-search-row.is-compare .record-search-liquid-heart { transition: transform 560ms cubic-bezier(.4, 0, .2, 1), opacity 220ms ease 300ms; }
.record-search-row.is-compare .record-favorite-button { visibility: hidden; pointer-events: none; transition: transform 560ms cubic-bezier(.4, 0, .2, 1), opacity 220ms ease 140ms, visibility 0s linear 560ms; }

.record-row { gap: 4px; transition: gap 420ms cubic-bezier(.4, 0, .2, 1), border-color 200ms ease, box-shadow 200ms ease; }
.record-row.is-managing { gap: 0; }
.record-select-slot {
  flex: 0 0 0;
  width: 0;
  height: 20px;
  margin-right: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateX(14px) scale(.76);
  pointer-events: none;
  transition: flex-basis 420ms cubic-bezier(.4, 0, .2, 1), width 420ms cubic-bezier(.4, 0, .2, 1), margin-right 420ms cubic-bezier(.4, 0, .2, 1), transform 420ms cubic-bezier(.4, 0, .2, 1), opacity 250ms ease;
}
.record-select-slot.is-visible { flex-basis: 20px; width: 20px; margin-right: 12px; opacity: 1; transform: none; }
.record-row-delete {
  flex: 0 0 44px;
  width: 44px;
  min-width: 0;
  height: 44px;
  padding: 0;
  overflow: hidden;
  opacity: 1;
  transition: flex-basis 420ms cubic-bezier(.4, 0, .2, 1), width 420ms cubic-bezier(.4, 0, .2, 1), transform 420ms cubic-bezier(.4, 0, .2, 1), opacity 220ms ease, color 200ms ease, background-color 200ms ease;
}
.record-row.is-managing .record-row-delete { flex-basis: 0; width: 0; opacity: 0; transform: translateX(-12px) scale(.72); pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  .record-tab-indicator,
  .record-manage-icon svg,
  .record-search-liquid-field,
  .record-search-liquid-heart,
  .record-search-field,
  .record-favorite-button,
  .record-row,
  .record-select-slot,
  .record-row-delete { transition-duration: .01ms !important; transition-delay: 0ms !important; }
  .record-search-liquid { filter: none !important; }
}
</style>

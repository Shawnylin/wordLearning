<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { ref } from 'vue'
import { Search, Loader2, ArrowUp } from 'lucide-vue-next'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  search: [word: string]
}>()

const inputValue = ref('')

function handleSearch() {
  const word = inputValue.value.trim()
  if (word && !props.loading) {
    emit('search', word)
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    handleSearch()
  }
}
</script>

<template>
  <div class="relative w-full max-w-lg mx-auto">
    <div class="word-command" :class="{ 'is-ready': inputValue.trim() && !loading, 'is-loading': loading }" :aria-busy="loading">
      <label class="word-command-field">
        <Search :size="19" class="word-command-icon" aria-hidden="true" />
      <input
        v-model="inputValue"
        @keydown="handleKeydown"
        type="text"
        aria-label="输入成语或词语"
        placeholder="输入成语或词语…"
        :disabled="loading"
        class="word-command-input"
      />
      </label>
      <button
        @click="handleSearch"
        :disabled="!inputValue.trim() || loading"
        class="word-command-action"
        :aria-label="loading ? '正在生成' : '搜索词语'"
        :title="loading ? '正在生成' : '搜索词语'"
      >
        <Motion><Loader2 v-if="loading" :size="20" class="animate-spin" /><ArrowUp v-else :size="22" /></Motion>
      </button>
    </div>
  </div>
</template>

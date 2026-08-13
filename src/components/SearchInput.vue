<script setup lang="ts">
import { ref } from 'vue'
import { Search, Loader2 } from 'lucide-vue-next'

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
  if (event.key === 'Enter') {
    handleSearch()
  }
}
</script>

<template>
  <div class="relative w-full max-w-lg mx-auto">
    <div class="relative flex items-center rounded-2xl bg-card shadow-[0_2px_12px_-6px_rgba(42,36,28,0.2)] border border-line overflow-hidden transition-all duration-200 focus-within:border-zhuhong focus-within:ring-2 focus-within:ring-zhuhong/15">
      <div class="pl-4 text-ink-mute">
        <Search :size="20" />
      </div>
      <input
        v-model="inputValue"
        @keydown="handleKeydown"
        type="text"
        placeholder="输入成语或词语…"
        :disabled="loading"
        class="min-w-0 flex-1 px-3 py-3.5 text-base bg-transparent text-ink placeholder-ink-mute outline-none disabled:opacity-50"
      />
      <button
        @click="handleSearch"
        :disabled="!inputValue.trim() || loading"
        class="px-5 py-2 mr-1.5 rounded-xl btn-primary text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <Loader2 v-if="loading" :size="16" class="animate-spin" />
        <span>{{ loading ? '生成中' : '搜索' }}</span>
      </button>
    </div>
  </div>
</template>

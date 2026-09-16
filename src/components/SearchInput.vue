<script setup lang="ts">
import CommandSubmit from './CommandSubmit.vue'
import { ref } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  search: [word: string]
}>()

const inputValue = ref('')
const focused = ref(false)

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
    <div class="word-command" :class="{ 'is-ready': inputValue.trim() && !loading, 'is-focused': focused }" :aria-busy="loading">
      <label class="word-command-field">
        <Search :size="19" class="word-command-icon" aria-hidden="true" />
      <input
        v-model="inputValue"
        @keydown="handleKeydown"
        @focus="focused = true"
        @blur="focused = false"
        type="text"
        aria-label="输入成语或词语"
        placeholder="输入成语或词语…"
        :disabled="loading"
        class="word-command-input"
      />
      </label>
      <CommandSubmit
        @click="handleSearch"
        :disabled="!inputValue.trim() || loading"
        :loading="loading"
        label="搜索词语"
      />
    </div>
  </div>
</template>

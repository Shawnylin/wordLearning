<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowUp, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{ loading?: boolean; disabled?: boolean; label: string }>()
const settling = ref(false)
watch(() => props.loading, (loading, previous) => {
  settling.value = !loading && !!previous
})
</script>

<template>
  <button
    type="submit"
    class="word-command-action"
    :class="{ 'is-generating': loading, 'is-settling': settling }"
    :disabled="disabled"
    :aria-label="loading ? '正在生成' : label"
    :aria-busy="loading"
    :title="loading ? '正在生成' : label"
    @animationend.self="settling = false"
  >
    <RefreshCw v-if="loading" :size="20" class="word-command-refresh" aria-hidden="true" />
    <ArrowUp v-else :size="22" aria-hidden="true" />
  </button>
</template>

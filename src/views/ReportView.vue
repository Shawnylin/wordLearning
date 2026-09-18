<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Shuffle } from 'lucide-vue-next'
import Motion from '../components/Motion.vue'
import { useIdiomStore } from '../stores/idiom'
import { useReviewStore } from '../stores/review'

const router = useRouter()
const idiomStore = useIdiomStore()
const reviewStore = useReviewStore()
const learnedCount = computed(() => Object.keys(idiomStore.idiomCache).length)

const props = withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false
})

function goReview() {
  router.push('/review')
}
</script>

<template>
  <div :class="props.compact ? 'profile-list-row profile-stat-row' : 'card rounded-3xl p-5'">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-end gap-2">
        <p class="text-sm text-ink-soft">已学</p>
        <p :class="props.compact ? 'font-serif text-2xl font-bold leading-none text-ink' : 'font-serif text-5xl font-bold text-ink leading-none'">{{ learnedCount }}</p>
        <p class="text-xs text-ink-mute">个词语</p>
      </div>
      <Motion><button
        v-if="learnedCount > 0"
        @click="goReview"
        :class="props.compact ? 'profile-row-action' : 'flex items-center gap-1.5 rounded-full bg-zhuhong-soft px-3.5 py-2 text-xs font-medium text-zhuhong transition-colors duration-200 hover:bg-zhuhong-solid hover:text-paper-ink'"
      >
        <Shuffle :size="14" />
        {{ reviewStore.sessionActive ? `继续复习 · 剩${reviewStore.remaining}` : '开始复习' }}
      </button></Motion>
    </div>
  </div>
</template>

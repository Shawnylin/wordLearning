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

function goReview() {
  router.push('/review')
}
</script>

<template>
  <div class="card rounded-3xl p-5">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-end gap-2">
        <p class="font-serif text-5xl font-bold text-ink leading-none">{{ learnedCount }}</p>
        <p class="text-xs text-ink-mute pb-0.5">已学词语</p>
      </div>
      <Motion><button
        v-if="learnedCount > 0"
        @click="goReview"
        class="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zhuhong-soft text-zhuhong text-xs font-medium hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200"
      >
        <Shuffle :size="14" />
        {{ reviewStore.sessionActive ? `继续复习 · 剩${reviewStore.remaining}` : '开始复习' }}
      </button></Motion>
    </div>
  </div>
</template>

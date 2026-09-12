<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { BookOpen, GitCompare } from 'lucide-vue-next'
import Motion from './Motion.vue'

const props = defineProps<{ loading: boolean; hasContent: boolean; kind: 'idiom' | 'compare' }>()
const surface = ref<HTMLElement>()
const expanding = ref(false)
const active = computed(() => props.loading || props.hasContent || expanding.value)
let hasExpanded = props.hasContent
let animation: Animation | undefined
let disposed = false
watch(() => props.loading || props.hasContent, async value => {
  if (!value || hasExpanded || !surface.value) return
  hasExpanded = true
  const from = surface.value.getBoundingClientRect()
  expanding.value = true
  await nextTick()
  if (disposed || !surface.value) return
  const to = surface.value.getBoundingClientRect()
  animation = surface.value.animate([
    { width: `${from.width}px`, height: `${from.height}px`, transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)`, borderRadius: '40px' },
    { width: `${to.width}px`, height: `${to.height}px`, transform: 'translate(0, 0)', borderRadius: '24px' }
  ], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900, easing: 'cubic-bezier(.4,0,.2,1)' })
  await animation.finished.catch(() => {})
  if (!disposed) expanding.value = false
})
onBeforeUnmount(() => { disposed = true; animation?.cancel() })
</script>

<template>
  <div class="generation-stage mx-auto max-w-lg" :class="{ 'is-active': active, 'is-expanding': expanding }">
    <div ref="surface" class="generation-surface glass-card">
      <component v-if="!active" :is="kind === 'idiom' ? BookOpen : GitCompare" :size="32" class="text-ink-mute" />
      <template v-else>
        <component v-if="expanding" :is="kind === 'idiom' ? BookOpen : GitCompare" :size="32" class="generation-origin-icon text-ink-mute" />
        <Motion><div v-if="loading || expanding" class="generation-skeleton p-8" role="status" aria-label="正在生成内容">
          <div class="animate-pulse-custom space-y-6">
            <div class="h-6 bg-soft rounded-full w-32 mx-auto"></div>
            <div class="h-12 bg-soft rounded-xl w-48 max-w-full mx-auto"></div>
            <div v-for="n in 2" :key="n" class="space-y-4">
              <div class="h-4 bg-soft rounded-full w-20"></div>
              <div class="h-4 bg-soft rounded-full"></div>
              <div class="h-4 bg-soft rounded-full w-3/4"></div>
            </div>
          </div>
        </div>
        <div v-else class="generation-result"><slot /></div></Motion>
      </template>
    </div>
    <div v-if="!active" class="text-center mt-4">
      <p class="text-ink-mute text-sm">{{ kind === 'idiom' ? '输入成语或词语，开始你的学习之旅' : '输入两个或多个词语，开始对比学习' }}</p>
      <slot name="empty" />
    </div>
  </div>
</template>

<style>
.generation-stage { padding-top: 16px; }
.generation-stage.is-active { padding-top: 0; }
.generation-surface { position: relative; width: 80px; height: 80px; margin: 0 auto; display: grid; place-items: center; border: 1px solid var(--line); background: var(--glass-fill); border-radius: 40px; overflow: hidden; transform-origin: top left; transition: none; }
.is-active .generation-surface { display: block; width: 100%; height: auto; margin: 0; border-radius: 24px; }
.generation-skeleton { min-height: 380px; }
.is-expanding .generation-skeleton { animation: skeleton-reveal 900ms ease both; }
.generation-origin-icon { position: absolute; top: 23px; left: 23px; animation: origin-away 320ms ease both; }
.generation-result { animation: result-reveal 320ms ease both; }
.generation-result .animate-card-enter { animation: none; }
.generation-result .card { border: none; box-shadow: none; background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
@keyframes skeleton-reveal { 0%, 25% { opacity: 0; } 100% { opacity: 1; } }
@keyframes origin-away { to { opacity: 0; } }
@keyframes result-reveal { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .generation-stage * { animation: none !important; } }
</style>

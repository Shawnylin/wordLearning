<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { X, Maximize2, Minimize2 } from 'lucide-vue-next'
import DailyWordContent from './DailyWordContent.vue'
import Motion from './Motion.vue'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'

const store = useIdiomStore(), settings = useSettingsStore()
const expanded = ref(false)
const visible = ref(false), word = ref(''), panel = ref<HTMLElement>(), error = ref('')
const content = computed(() => store.currentIdiom?.word === word.value ? store.currentIdiom : null)
let origin: DOMRect | undefined, trigger: HTMLElement | null = null, previousOverflow = ''
let background: HTMLElement | null = null, nav: HTMLElement | null = null
let backgroundReveal: Animation | undefined
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
async function lookup(value: string, regenerate = false) {
  if (store.idiomLoading) { error.value = '另一个词语正在生成，请稍后重试'; return }
  word.value = value; error.value = ''
  const result = regenerate ? await store.regenerateIdiom(value, settings.apiConfig) : await store.searchIdiom(value, settings.apiConfig)
  if (!result) error.value = store.idiomError || '查询失败，请重试'
}
async function open(value: string) {
  if (visible.value) return
  expanded.value = false
  trigger = document.activeElement as HTMLElement
  origin = document.getElementById('bottom-nav-indicator')?.getBoundingClientRect()
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  background = document.querySelector('main'); nav = document.querySelector('nav')
  if (background) background.inert = true
  if (nav) nav.inert = true
  visible.value = true; word.value = value
  void lookup(value)
  await nextTick(); panel.value?.focus()
}
function unlock() {
  document.body.style.overflow = previousOverflow
  if (background) background.inert = false
  if (nav) nav.inert = false
}
function close() {
  if (!visible.value) return
  backgroundReveal?.cancel()
  if (background) {
    backgroundReveal = background.animate(
      [{ opacity: .35 }, { opacity: 1 }],
      { duration: reduced() ? 1 : 760, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
    )
  }
  visible.value = false
}
function afterLeave() { unlock(); trigger?.focus() }
function morph(el: Element, done: () => void, leaving = false) {
  const element = el as HTMLElement, end = element.getBoundingClientRect()
  const start = origin || end
  const small = { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, borderRadius: '999px', backgroundColor: 'var(--zhuhong)' }
  const large = { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`, borderRadius: getComputedStyle(element).borderRadius, backgroundColor: 'var(--card)' }
  const inner = element.firstElementChild as HTMLElement
  inner.animate(leaving ? [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: reduced() ? 1 : 520, fill: 'both' })
  const animation = element.animate(leaving ? [large, small] : [small, large], { duration: reduced() ? 1 : 520, easing: 'cubic-bezier(.22,1,.36,1)' })
  animation.onfinish = done; animation.oncancel = done
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const focusable = [...(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || [])]
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first?.focus() }
}
onBeforeUnmount(() => { backgroundReveal?.cancel(); if (visible.value || background) unlock() })
defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <Transition name="daily-blur"><div v-if="visible" class="daily-scrim" @click="close" /></Transition>
    <Transition :css="false" @enter="(el, done) => morph(el, done)" @leave="(el, done) => morph(el, done, true)" @after-leave="afterLeave">
      <section v-if="visible" ref="panel" role="dialog" aria-modal="true" :aria-label="`${word} · 日报学习`" tabindex="-1" class="daily-sheet" :class="{ expanded }" @keydown="keydown">
        <div class="h-full flex flex-col">
          <header class="flex items-center justify-between px-4 py-2 border-b border-line shrink-0"><p class="text-xs text-ink-mute">日报 · 随文学习</p><div class="flex gap-1"><button @click="expanded = !expanded" class="p-2 rounded-full bg-soft" :aria-label="expanded ? '恢复半屏' : '展开阅读'" :aria-expanded="expanded"><component :is="expanded ? Minimize2 : Maximize2" :size="16" /></button><button @click="close" class="p-2 rounded-full bg-soft" aria-label="收回日报学习卡片"><X :size="18" /></button></div></header>
          <div class="flex flex-col flex-1 min-h-0" aria-live="polite">
            <Motion><div v-if="error" class="p-4 text-sm text-zhuhong"><p>{{ error }}</p><button @click="lookup(word)" :disabled="store.idiomLoading" class="mt-3 underline">重试查询</button></div></Motion>
            <p v-if="store.idiomLoading && !content" class="p-6 text-sm text-ink-mute animate-pulse">正在查询「{{ word }}」…</p>
            <DailyWordContent v-if="content" :key="word" :idiom="content" :loading="store.idiomLoading" @related-click="lookup" @regenerate="lookup(word, true)" />
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.daily-scrim { position: fixed; inset: 0; z-index: 70; background: rgb(0 0 0 / .18); backdrop-filter: blur(9px); }
.daily-sheet { position: fixed; z-index: 71; left: max(0px, calc((100vw - 560px) / 2)); bottom: 0; width: min(100vw, 560px); height: 50dvh; border-radius: 20px 20px 0 0; background: var(--card); color: var(--ink); border: 1px solid var(--line); box-shadow: 0 20px 80px rgb(0 0 0 / .2); overflow: hidden; outline: none; padding-bottom: env(safe-area-inset-bottom, 0px); transition: height 360ms cubic-bezier(.22,1,.36,1); }
.daily-sheet.expanded { height: 85dvh; }
@media (prefers-reduced-motion: reduce) { .daily-sheet { transition: none; } }
.daily-blur-enter-active,.daily-blur-leave-active { transition: backdrop-filter 520ms ease, background 520ms ease; }
.daily-blur-enter-from,.daily-blur-leave-to { backdrop-filter: blur(0); background: transparent; }
@media (prefers-reduced-motion: reduce) { .daily-blur-enter-active,.daily-blur-leave-active { transition-duration: 1ms; } }
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { X, Maximize2, Minimize2, Search } from 'lucide-vue-next'
import CommandSubmit from './CommandSubmit.vue'
import CommandSurface from './CommandSurface.vue'
import DailyWordContent from './DailyWordContent.vue'
import Motion from './Motion.vue'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'

const store = useIdiomStore(), settings = useSettingsStore()
const props = defineProps<{ docked?: boolean; selectionText?: string }>()
const emit = defineEmits<{ querySelection: [] }>()
const input = ref(''), pending = ref('')
const inputFocused = ref(false)
const expanded = ref(false)
const visible = ref(false), word = ref(''), panel = ref<HTMLElement>(), error = ref('')
const content = computed(() => store.currentIdiom?.word === word.value ? store.currentIdiom : store.idiomCache[word.value] || null)
let origin: DOMRect | undefined, trigger: HTMLElement | null = null, previousOverflow = ''
let background: HTMLElement | null = null, nav: HTMLElement | null = null
let backgroundReveal: Animation | undefined
let locked = false
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
async function lookup(value: string, regenerate = false) {
  value = value.trim()
  if (!value) return
  word.value = value; input.value = value; error.value = ''
  if (store.idiomLoading) { pending.value = value; return }
  pending.value = ''
  const result = regenerate ? await store.regenerateIdiom(value, settings.apiConfig) : await store.searchIdiom(value, settings.apiConfig)
  if (!result && word.value === value) error.value = store.idiomError || '查询失败，请重试'
}
watch(() => store.idiomLoading, loading => {
  if (!loading && pending.value) void lookup(pending.value)
}, { flush: 'post' })
async function open(value: string) {
  value = value.trim()
  if (!value) return
  if (visible.value) { if (props.docked) void lookup(value); return }
  expanded.value = false
  trigger = document.activeElement as HTMLElement
  origin = document.getElementById('bottom-nav-indicator')?.getBoundingClientRect()
  if (!props.docked) lock()
  visible.value = true; word.value = value
  void lookup(value)
  if (!props.docked) { await nextTick(); panel.value?.focus() }
}
function lock() {
  if (locked) return
  locked = true
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  background = document.querySelector('main'); nav = document.querySelector('nav')
  if (background) background.inert = true
  if (nav) nav.inert = true
}
function unlock() {
  if (!locked) return
  locked = false
  document.body.style.overflow = previousOverflow
  if (background) background.inert = false
  if (nav) nav.inert = false
  background = null; nav = null
}
function close() {
  if (!visible.value) return
  backgroundReveal?.cancel()
  pending.value = ''
  if (props.docked) { visible.value = false; word.value = ''; input.value = ''; error.value = ''; return }
  if (background) {
    backgroundReveal = background.animate(
      [{ opacity: .35 }, { opacity: 1 }],
      { duration: reduced() ? 1 : 760, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
    )
  }
  visible.value = false
}
function afterLeave() { if (!visible.value) { unlock(); if (!props.docked) trigger?.focus({ preventScroll: true }) } }
function morph(el: Element, done: () => void, leaving = false) {
  if (props.docked) { done(); return }
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
  if (props.docked) return
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const focusable = [...(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || [])]
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first?.focus() }
}
watch(() => props.docked, async docked => {
  backgroundReveal?.cancel()
  // Stop a phone morph if Split View changes mode mid-transition.
  panel.value?.getAnimations({ subtree: true }).forEach(animation => animation.cancel())
  if (docked) unlock()
  else if (visible.value) { lock(); await nextTick(); panel.value?.focus() }
})
function cleanup() { backgroundReveal?.cancel(); pending.value = ''; visible.value = false; unlock() }
onDeactivated(cleanup)
onBeforeUnmount(cleanup)
defineExpose({ open })
</script>

<template>
  <Teleport to="body" :disabled="docked">
    <Transition name="daily-blur"><div v-if="visible && !docked" class="daily-scrim" @click="close" /></Transition>
    <Transition :css="false" @enter="(el, done) => morph(el, done)" @leave="(el, done) => morph(el, done, true)" @after-leave="afterLeave">
      <section v-if="visible || docked" ref="panel" :role="docked ? 'region' : 'dialog'" :aria-modal="docked ? undefined : true" :aria-label="docked ? '随文查词' : `${word} · 日报学习`" tabindex="-1" class="daily-sheet" :class="{ expanded: expanded && !docked, 'is-docked': docked }" @keydown="keydown">
        <div class="h-full flex flex-col">
          <header class="flex items-center justify-between px-4 py-2 border-b border-line shrink-0"><p class="text-xs text-ink-mute">{{ docked ? '随文查词' : '日报 · 随文学习' }}</p><div class="flex gap-1"><button v-if="!docked" @click="expanded = !expanded" class="p-2 rounded-full bg-soft" :aria-label="expanded ? '恢复半屏' : '展开阅读'" :aria-expanded="expanded"><component :is="expanded ? Minimize2 : Maximize2" :size="16" /></button><button v-if="visible" @click="close" class="p-2 rounded-full bg-soft" :aria-label="docked ? '清除查词结果' : '收回日报学习卡片'"><X :size="18" /></button></div></header>
          <form v-if="docked" class="lookup-form word-command" :class="{ 'is-ready': input.trim(), 'is-open': inputFocused || !!input.trim() || store.idiomLoading }" @submit.prevent="open(input)">
            <CommandSurface />
            <label class="word-command-field">
              <Search :size="18" class="word-command-icon" aria-hidden="true" />
              <input v-model="input" class="word-command-input" aria-label="查询词语" placeholder="输入词语…" @focus="inputFocused = true" @blur="inputFocused = false" @keydown.enter="($event.isComposing || $event.keyCode === 229) && $event.preventDefault()" />
            </label>
            <CommandSubmit :loading="store.idiomLoading" :disabled="!input.trim()" label="查词" @pointerdown.prevent />
          </form>
          <div v-if="docked && selectionText" class="selection-action">
            <span>已选「{{ selectionText }}」</span>
            <button @pointerdown.prevent @click="emit('querySelection')">查询</button>
          </div>
          <div class="flex flex-col flex-1 min-h-0" aria-live="polite">
            <Motion><div v-if="error" class="p-4 text-sm text-zhuhong"><p>{{ error }}</p><button @click="lookup(word)" :disabled="store.idiomLoading" class="mt-3 underline">重试查询</button></div></Motion>
            <p v-if="visible && store.idiomLoading && !content && !docked" class="p-4 text-sm text-ink-mute animate-pulse">{{ pending ? '接下来查询' : '正在查询' }}「{{ word }}」…</p>
            <div v-if="visible && store.idiomLoading && !content && docked" class="lookup-skeleton" role="status" :aria-label="`${pending ? '接下来查询' : '正在查询'}${word}`">
              <div class="lookup-skeleton-heading">
                <div class="min-w-0 flex-1">
                  <div class="skeleton-block skeleton-word" />
                  <div class="skeleton-block skeleton-pinyin" />
                </div>
                <div class="skeleton-block skeleton-action" />
                <div class="skeleton-block skeleton-action" />
              </div>
              <div class="lookup-skeleton-tabs" aria-hidden="true">
                <div v-for="index in 5" :key="index" class="skeleton-block skeleton-tab" />
              </div>
              <div class="lookup-skeleton-copy" aria-hidden="true">
                <div class="skeleton-block skeleton-line is-full" />
                <div class="skeleton-block skeleton-line is-full" />
                <div class="skeleton-block skeleton-line is-medium" />
                <div class="skeleton-block skeleton-line is-short" />
              </div>
              <div class="lookup-skeleton-footer"><span class="skeleton-dot" />{{ pending ? '等待当前查询完成…' : `正在整理「${word}」的学习内容…` }}</div>
            </div>
            <Transition name="lookup-result" mode="out-in">
              <DailyWordContent v-if="content && (visible || !docked)" :key="word" :idiom="content" :loading="store.idiomLoading" @related-click="lookup" @regenerate="lookup(word, true)" />
            </Transition>
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
.daily-sheet.is-docked { position: relative; inset: auto; z-index: auto; width: 100%; height: 100%; border-radius: 20px; box-shadow: none; padding-bottom: 0; transition: none; }
.lookup-form { flex-shrink: 0; margin: 12px; }
.selection-action { display: flex; align-items: center; gap: 8px; padding: 0 16px 12px; font-size: 13px; flex-shrink: 0; }
.selection-action span { min-width: 0; overflow-wrap: anywhere; }
.selection-action button { margin-left: auto; padding: 10px 12px; flex-shrink: 0; border-radius: 12px; background: var(--zhuhong-soft); color: var(--zhuhong); }
.lookup-skeleton { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.lookup-skeleton-heading { display: flex; align-items: center; gap: 8px; padding: 14px 16px 10px; }
.lookup-skeleton-tabs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; padding: 0 12px 10px; }
.lookup-skeleton-copy { display: flex; flex: 1; flex-direction: column; gap: 11px; padding: 14px 18px; }
.skeleton-block { position: relative; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--ink-mute) 12%, var(--soft)); }
.skeleton-block::after { content: ''; position: absolute; inset: 0; transform: translateX(-110%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--card) 72%, transparent), transparent); animation: lookup-shimmer 1.55s ease-in-out infinite; }
.skeleton-word { width: min(68%, 132px); height: 24px; border-radius: 8px; }
.skeleton-pinyin { width: min(46%, 88px); height: 10px; margin-top: 8px; }
.skeleton-action { width: 34px; height: 34px; flex: none; }
.skeleton-tab { height: 32px; }
.skeleton-line { height: 12px; border-radius: 6px; }
.skeleton-line.is-full { width: 100%; }
.skeleton-line.is-medium { width: 82%; }
.skeleton-line.is-short { width: 56%; }
.lookup-skeleton-footer { display: flex; align-items: center; gap: 7px; min-height: 33px; padding: 7px 16px; border-top: 1px solid var(--line); color: var(--ink-mute); font-size: 10px; }
.skeleton-dot { width: 6px; height: 6px; flex: none; border-radius: 999px; background: var(--zhuhong); animation: lookup-dot 1.2s ease-in-out infinite; }
@keyframes lookup-shimmer { to { transform: translateX(110%); } }
@keyframes lookup-dot { 50% { opacity: .35; transform: scale(.8); } }
.lookup-result-enter-active, .lookup-result-leave-active { transition: opacity 160ms ease; }
.lookup-result-enter-from, .lookup-result-leave-to { opacity: 0; }
@media (min-width: 960px) { .daily-scrim { display: none; } }
@media (prefers-reduced-motion: reduce) { .daily-sheet { transition: none; } .skeleton-block::after, .skeleton-dot { animation: none; } }
.daily-blur-enter-active,.daily-blur-leave-active { transition: backdrop-filter 520ms ease, background 520ms ease; }
.daily-blur-enter-from,.daily-blur-leave-to { backdrop-filter: blur(0); background: transparent; }
@media (prefers-reduced-motion: reduce) { .daily-blur-enter-active,.daily-blur-leave-active { transition-duration: 1ms; } }
</style>

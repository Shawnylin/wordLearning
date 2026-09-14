<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Sparkles, Link, X, ArrowRight } from 'lucide-vue-next'
import { articleLink } from '../api/daily'
const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{ generate: [link?: string]; cancel: []; pdf: [] }>()
const trigger = ref<HTMLButtonElement>(), panel = ref<HTMLElement>()
const opened = ref(false), morphing = ref(false), link = ref(''), error = ref('')
const placement = ref({ left: '0px', top: '0px', width: '340px' })
let origin: DOMRect | undefined
function position() {
  origin = trigger.value?.getBoundingClientRect()
  if (!origin) return
  const width = Math.min(360, window.innerWidth - 32)
  placement.value = { left: `${Math.max(16, Math.min(origin.right - width, window.innerWidth - width - 16))}px`, top: `${Math.max(12, origin.top)}px`, width: `${width}px` }
}
async function open() {
  if (props.loading) { emit('cancel'); return }
  if (morphing.value) return
  position(); opened.value = true; error.value = ''
  await nextTick(); panel.value?.focus()
}
function close() { opened.value = false }
function restoreFocus() { void nextTick(() => trigger.value?.focus()) }
function start(fromLink = false) {
  if (props.loading) return
  let url: string | undefined
  if (fromLink) { try { url = articleLink(link.value) } catch (e) { error.value = (e as Error).message; return } }
  close(); emit('generate', url)
}
function morph(el: Element, done: () => void, leaving = false) {
  morphing.value = true
  const element = el as HTMLElement
  element.getAnimations().forEach(a => a.cancel())
  const end = element.getBoundingClientRect(), start = trigger.value?.getBoundingClientRect() || origin || end
  const small = { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, borderRadius: '24px', backgroundColor: 'var(--zhuhong)' }
  const large = { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`, borderRadius: '24px', backgroundColor: 'var(--card)' }
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 440
  const inner = element.firstElementChild as HTMLElement
  inner.getAnimations().forEach(a => a.cancel())
  inner.animate(leaving ? [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration })
  const animation = element.animate(leaving ? [large, small] : [small, large], { duration, easing: 'cubic-bezier(.22,1,.36,1)' })
  animation.onfinish = () => { morphing.value = false; done() }
  animation.oncancel = () => { morphing.value = false; done() }
}
function keydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key !== 'Tab') return
  const controls = [...(panel.value?.querySelectorAll<HTMLElement>('button,input') || [])]
  const first = controls[0], last = controls[controls.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { e.preventDefault(); last?.focus() }
  else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { e.preventDefault(); first?.focus() }
}
window.addEventListener('resize', position)
onBeforeUnmount(() => window.removeEventListener('resize', position))
</script>

<template>
  <button ref="trigger" @click="open" class="btn-primary h-10 rounded-full px-4 text-xs flex items-center justify-center gap-1.5" :style="{ visibility: opened || morphing ? 'hidden' : 'visible' }" :aria-expanded="opened" aria-haspopup="dialog" :aria-label="loading ? '取消生成日报' : '生成日报'"><Sparkles :size="16" />{{ loading ? '取消生成' : '生成日报' }}</button>
  <Teleport to="body">
    <div v-if="opened" class="daily-menu-outside" @pointerdown="close" />
    <Transition :css="false" @enter="(el, done) => morph(el, done)" @leave="(el, done) => morph(el, done, true)" @after-leave="restoreFocus">
      <section v-if="opened" ref="panel" role="dialog" aria-modal="true" aria-label="生成日报方式" tabindex="-1" class="daily-generate-menu" :style="placement" @keydown="keydown">
        <div class="p-4">
          <header class="flex items-center justify-between mb-3"><span class="flex items-center gap-2 text-sm font-medium"><Sparkles :size="16" class="text-zhuhong" />生成日报</span><button @click="close" class="p-2 rounded-full bg-soft text-ink-mute" aria-label="关闭生成面板"><X :size="16" /></button></header>
          <button @click="start()" class="w-full flex items-center justify-between gap-3 rounded-2xl bg-soft p-3.5 text-left hover:bg-zhuhong-soft transition-colors"><span><span class="block text-sm font-medium">直接生成</span><span class="block mt-1 text-xs text-ink-mute">联网精选一篇文章，提取精读文段</span></span><ArrowRight :size="17" class="text-zhuhong shrink-0" /></button>
          <button @click="close(); emit('pdf')" class="mt-3 w-full flex items-center justify-between gap-3 rounded-2xl bg-soft p-3.5 text-left"><span><span class="block text-sm font-medium">PDF 日报导入</span><span class="block mt-1 text-xs text-ink-mute">完整保留版面文章 · 独立解析模型</span></span><ArrowRight :size="17" class="text-zhuhong shrink-0" /></button>
          <form @submit.prevent="start(true)" class="mt-4 pt-4 border-t border-line">
            <label for="daily-article-link" class="flex items-center gap-2 text-sm font-medium"><Link :size="15" class="text-zhuhong" />链接解析</label>
            <p class="mt-1.5 text-xs leading-5 text-ink-mute">读取指定文章并解析，省去联网搜索</p>
            <input id="daily-article-link" v-model="link" @input="error = ''" type="text" inputmode="url" autocomplete="url" placeholder="粘贴文章网址 https://…" class="daily-link-input mt-3 w-full rounded-xl bg-soft px-3 py-3 text-sm" :aria-invalid="!!error" :aria-describedby="error ? 'daily-link-error' : undefined" />
            <p v-if="error" id="daily-link-error" role="alert" class="mt-2 text-xs text-zhuhong">{{ error }}</p>
            <button type="submit" class="btn-primary w-full rounded-full py-2.5 mt-3 text-sm" :disabled="!link.trim()">解析并生成</button>
          </form>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.daily-menu-outside { position: fixed; inset: 0; z-index: 70; background: transparent; }
.daily-generate-menu { position: fixed; z-index: 71; max-height: calc(100dvh - 48px); overflow: auto; border: 1px solid var(--line); border-radius: 24px; background: var(--card); color: var(--ink); box-shadow: 0 14px 48px #0002; outline: none; }
.daily-link-input { border: 1px solid var(--line); color: var(--ink); outline: none; }
.daily-link-input:focus { border-color: var(--zhuhong); box-shadow: 0 0 0 2px var(--zhuhong-soft); }
.daily-generate-menu button:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
</style>

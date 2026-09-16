<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, ref, useId, watch } from 'vue'
import { ArrowUp, BookOpen, GitCompare, Plus, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  expanded: boolean
  loading: boolean
  hasContent: boolean
  kind: 'idiom' | 'compare'
  canAdd: boolean
  canSend: boolean
}>()
const emit = defineEmits<{ toggle: []; add: []; submit: [] }>()
const surface = ref<HTMLElement>()
const stageBody = ref<HTMLElement>()
const closing = ref(false)
const animating = ref(false)
const closingWidth = ref('')
const frameMinHeight = ref('')
const contentWidth = ref('')
const filterId = `orb-liquid-${useId()}`
let animation: Animation | undefined
let layoutAnimation: Animation | undefined
let revision = 0

function stopAnimation() {
  revision++
  animation?.cancel()
  layoutAnimation?.cancel()
  closing.value = false
  animating.value = false
  contentWidth.value = ''
}

watch(() => props.expanded, async expanded => {
  if (!surface.value || !stageBody.value) return
  const token = ++revision
  // Measure the currently rendered frame, including an interrupted animation.
  const from = surface.value.getBoundingClientRect()
  const bodyFrom = stageBody.value.getBoundingClientRect()
  const fromRadius = getComputedStyle(surface.value).borderRadius
  animation?.cancel()
  layoutAnimation?.cancel()
  closingWidth.value = `${from.width}px`
  if (expanded) {
    // The first rectangle shares the orb's center and reaches the reading area's
    // top edge. Longer cards subsequently extend downward without moving the orb.
    frameMinHeight.value = `${Math.max(80, (from.y + from.height / 2 - bodyFrom.y) * 2)}px`
  }
  closing.value = !expanded
  animating.value = true
  await nextTick()
  if (token !== revision || !surface.value || !stageBody.value) return
  const to = surface.value.getBoundingClientRect()
  const bodyTo = stageBody.value.getBoundingClientRect()
  contentWidth.value = `${expanded ? to.width : from.width}px`
  const centerX = expanded ? from.x + from.width / 2 : to.x + to.width / 2
  const centerY = expanded ? from.y + from.height / 2 : to.y + to.height / 2
  const frameWidth = expanded ? to.width : from.width
  const frameHeight = Math.min(expanded ? to.height : from.height, Math.max(80, 2 * (centerY - (expanded ? to.y : from.y))))
  const options = { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720, easing: 'cubic-bezier(.4,0,.2,1)' }
  animation = surface.value.animate([
    { offset: 0, width: `${from.width}px`, height: `${from.height}px`, transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)`, borderRadius: fromRadius },
    { offset: expanded ? .7 : .3, width: `${frameWidth}px`, height: `${frameHeight}px`, transform: `translate(${centerX - frameWidth / 2 - to.x}px, ${centerY - frameHeight / 2 - to.y}px)`, borderRadius: '24px' },
    { offset: 1, width: `${to.width}px`, height: `${to.height}px`, transform: 'translate(0,0)', borderRadius: expanded ? '24px' : '40px' }
  ], options)
  layoutAnimation = stageBody.value.animate([{ height: `${bodyFrom.height}px` }, { height: `${bodyTo.height}px` }], options)
  await animation.finished.catch(() => {})
  if (token !== revision) return
  closing.value = false
  animating.value = false
  contentWidth.value = ''
})
onBeforeUnmount(stopAnimation)
onDeactivated(stopAnimation)
</script>

<template>
  <div class="generation-stage" :class="{ 'is-active': expanded, 'is-compare': kind === 'compare', 'is-morphing': animating }" :style="{ '--frame-min-height': frameMinHeight || undefined }">
    <div ref="stageBody" class="generation-body">
      <div class="orb-satellites" :class="{ visible: kind === 'compare' && !expanded }" :inert="kind !== 'compare' || expanded" :aria-hidden="kind !== 'compare' || expanded">
        <svg width="0" height="0" aria-hidden="true"><defs>
          <filter :id="filterId" x="-150%" y="-80%" width="400%" height="350%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9.5" />
          </filter>
        </defs></svg>
        <div class="orb-liquid" :style="{ filter: `url(#${filterId})` }" aria-hidden="true"><i class="orb-core" /><i class="satellite-shape left" /><i class="satellite-shape right" /></div>
        <button class="satellite left" :disabled="!canAdd" :tabindex="kind === 'compare' && !expanded ? 0 : -1" :aria-label="canAdd ? '添加对比词语' : '最多四个词语，生成时不可添加'" @click="emit('add')"><Plus :size="23" /></button>
        <button class="satellite right" :disabled="!canSend" :tabindex="kind === 'compare' && !expanded ? 0 : -1" :aria-label="loading ? '正在生成对比' : '发送对比'" @click="emit('submit')"><RefreshCw v-if="loading" :size="21" class="word-command-refresh" /><ArrowUp v-else :size="23" /></button>
      </div>
      <div ref="surface" class="generation-surface">
        <button class="mode-orb" :class="{ concealed: expanded }" :inert="expanded" :tabindex="expanded ? -1 : 0" :aria-label="kind === 'idiom' ? '当前学习，点击切换对比' : '当前对比，点击切换学习'" :title="kind === 'idiom' ? '切换到对比' : '切换到学习'" @click="emit('toggle')">
          <BookOpen class="mode-icon learning-icon" :size="32" /><GitCompare class="mode-icon compare-icon" :size="32" />
        </button>
        <div v-if="expanded || closing" class="generation-content" :class="{ 'is-closing': closing }" :inert="closing || animating" :style="{ width: contentWidth || (closing ? closingWidth : undefined) }">
          <div v-if="!hasContent && loading" class="generation-skeleton" role="status" aria-label="正在生成内容">
            <div class="animate-pulse-custom space-y-6">
              <div class="h-6 bg-soft rounded-full w-32" /><div class="h-12 bg-soft rounded-xl w-48 max-w-full" />
              <div v-for="n in 3" :key="n" class="space-y-4"><div class="h-4 bg-soft rounded-full w-20" /><div class="h-4 bg-soft rounded-full" /><div class="h-4 bg-soft rounded-full w-3/4" /></div>
            </div>
          </div>
          <div v-else-if="hasContent" class="generation-result"><slot /></div>
          <p v-else class="generation-empty text-ink-mute">暂未生成内容，请收起卡片后重试。</p>
        </div>
      </div>
    </div>
    <div class="orb-caption" :class="{ concealed: expanded }" :inert="expanded" :aria-hidden="expanded">
      <p class="text-sm text-ink-soft" aria-live="polite">{{ kind === 'idiom' ? '学习' : '对比' }}</p>
      <p class="text-xs text-ink-mute mt-2">点击圆球切换{{ kind === 'idiom' ? '对比' : '学习' }}</p>
      <slot name="empty" />
    </div>
  </div>
</template>

<style scoped>
.generation-stage { --orb-top: clamp(64px, 16vh, 160px); --orb-fill: color-mix(in srgb, var(--soft) 92%, var(--ink) 8%); position: relative; width: 100%; margin: 0 auto; }
.generation-body { position: relative; padding-top: var(--orb-top); }
.is-active .generation-body { padding-top: 0; }
.generation-surface { position: relative; left: calc(50% - 40px); z-index: 1; width: 80px; height: 80px; border: 1px solid var(--line); background: var(--orb-fill); border-radius: 40px; overflow: hidden; transform-origin: top left; }
.is-active .generation-surface { left: 0; width: 100%; height: auto; border-radius: 24px; background: var(--glass-fill); }
.is-active:not(.is-morphing) .generation-surface { min-height: var(--frame-min-height, 0px); }
.generation-result :deep(.animate-card-enter) { animation: none; }
.generation-content { padding: clamp(20px, 3vw, 32px); min-height: var(--frame-min-height, 0px); opacity: 1; transition: opacity 220ms ease; }
.is-morphing .generation-content { opacity: 0; }
.generation-content.is-closing { position: absolute; top: 0; left: 0; }
.generation-skeleton { min-height: 400px; }
.generation-empty { min-height: 220px; display: grid; place-items: center; }
.mode-orb { position: absolute; z-index: 2; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; border-radius: 50%; color: var(--ink-soft); transition: opacity 180ms ease; }
.mode-orb.concealed { opacity: 0; pointer-events: none; }
.mode-icon { position: absolute; top: 23px; left: 23px; transition: transform 620ms cubic-bezier(.22,1,.36,1), opacity 350ms ease; }
.compare-icon { opacity: 0; transform: rotate(-135deg) scale(.4); }
.is-compare .learning-icon { opacity: 0; transform: rotate(135deg) scale(.4); }
.is-compare .compare-icon { opacity: 1; transform: rotate(0) scale(1); }
.orb-satellites { position: absolute; top: var(--orb-top); left: calc(50% - 40px); width: 80px; height: 80px; transition: opacity 300ms ease; }
.orb-satellites > svg { position: absolute; }
.orb-liquid { position: absolute; inset: 0; pointer-events: none; }
.orb-core { position: absolute; inset: 0; border-radius: 50%; background: var(--orb-fill); }
.satellite, .satellite-shape { position: absolute; top: 16px; left: 16px; width: 48px; height: 48px; border-radius: 50%; transform: translate(0,0) scale(.7); transition: transform 620ms cubic-bezier(.22,1,.36,1), opacity 300ms ease; }
.satellite-shape { background: var(--orb-fill); }
.satellite { display: grid; place-items: center; color: var(--ink-soft); opacity: 0; pointer-events: none; }
.visible .left { transform: translate(-62px,70px) scale(1); }
.visible .right { transform: translate(62px,70px) scale(1); }
.visible .satellite { opacity: 1; pointer-events: auto; }
.satellite:disabled { color: var(--ink-mute); cursor: not-allowed; }
.satellite:not(:disabled):hover { color: var(--zhuhong); }
.satellite:focus-visible, .mode-orb:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: -4px; }
.is-active .orb-satellites { opacity: 0; }
.orb-caption { text-align: center; padding-top: 24px; padding-bottom: 24px; transition: padding-top 620ms cubic-bezier(.22,1,.36,1), opacity 200ms ease; }
.is-compare .orb-caption { padding-top: 88px; }
.orb-caption.concealed { display: none; }
@media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
</style>

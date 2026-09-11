<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
const props = defineProps<{ source: HTMLElement | null }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const panel = ref<HTMLElement>()
const content = ref<HTMLElement>()
const animations: Animation[] = []
let closing = false
let disposed = false
let oldOverflow = ''
let oldVisibility = ''
let targetRect: DOMRect
let rowGhost: HTMLElement | undefined
let hiddenTitles: HTMLElement[] = []
let opening: Promise<unknown> = Promise.resolve()
const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 680
const easing = 'cubic-bezier(.22,1,.36,1)'
function animate(element: HTMLElement, frames: Keyframe[], ms = duration(), curve = easing) {
  const animation = element.animate(frames, { duration: ms, easing: curve, fill: 'forwards' })
  animations.push(animation)
  return animation.finished.catch(() => {})
}
function frame(rect: DOMRect, radius: number): Keyframe {
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: `${radius}px` }
}
function textFrame(element: HTMLElement): Keyframe {
  const range = document.createRange()
  range.selectNodeContents(element)
  const rect = range.getBoundingClientRect()
  const style = getComputedStyle(element)
  return { left: `${rect.left}px`, top: `${rect.top}px`, fontSize: style.fontSize, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing, color: style.color }
}
async function moveTitles(reverse: boolean) {
  const sourceTitles = [...(props.source?.querySelectorAll<HTMLElement>('[data-morph-word]') || [])]
  const targetTitles = [...panel.value!.querySelectorAll<HTMLElement>('[data-morph-word]')]
  const tasks = sourceTitles.map(async source => {
    const target = targetTitles.find(t => t.dataset.morphWord === source.dataset.morphWord)
    if (!target) return
    const from = textFrame(reverse ? target : source)
    const to = textFrame(reverse ? source : target)
    const floating = document.createElement('span')
    floating.className = 'record-shared-title'
    floating.setAttribute('aria-hidden', 'true')
    floating.textContent = source.textContent
    floating.style.fontFamily = getComputedStyle(target).fontFamily
    dialog.value!.append(floating)
    // Range rectangles describe glyphs, not line boxes. Align both endpoints
    // after applying their typography so there is no baseline jump at handoff.
    const align = (keyframe: Keyframe): Keyframe => {
      Object.assign(floating.style, keyframe)
      const range = document.createRange()
      range.selectNodeContents(floating)
      const glyph = range.getBoundingClientRect()
      return { ...keyframe, left: `${2 * parseFloat(String(keyframe.left)) - glyph.left}px`, top: `${2 * parseFloat(String(keyframe.top)) - glyph.top}px` }
    }
    const alignedFrom = align(from)
    const alignedTo = align(to)
    Object.assign(floating.style, alignedFrom)
    target.style.visibility = 'hidden'
    hiddenTitles.push(target)
    await animate(floating, [alignedFrom, alignedTo])
    if (!disposed && !reverse) target.style.visibility = ''
    floating.remove()
  })
  await Promise.all(tasks)
}
onMounted(() => {
  const app = document.getElementById('app')!
  oldOverflow = app.style.overflowY
  app.style.overflowY = 'hidden'
  dialog.value!.showModal()
  targetRect = panel.value!.getBoundingClientRect()
  const sourceRect = props.source?.getBoundingClientRect() || targetRect
  // Pin geometry before animating so changing width cannot recenter the panel.
  Object.assign(panel.value!.style, frame(targetRect, 24))
  if (props.source) {
    oldVisibility = props.source.style.visibility
    rowGhost = props.source.cloneNode(true) as HTMLElement
    rowGhost.inert = true
    rowGhost.removeAttribute('tabindex')
    rowGhost.removeAttribute('role')
    rowGhost.setAttribute('aria-hidden', 'true')
    rowGhost.classList.add('record-row-ghost')
    Object.assign(rowGhost.style, frame(sourceRect, 16), { margin: '0', visibility: 'visible', background: 'transparent', borderColor: 'transparent', boxShadow: 'none' })
    rowGhost.querySelectorAll<HTMLElement>('[data-morph-word]').forEach(t => { t.style.visibility = 'hidden' })
    dialog.value!.append(rowGhost)
    props.source.style.visibility = 'hidden'
  }
  // Measure the actual title before the panel starts moving.
  const titles = moveTitles(false)
  opening = Promise.all([
    titles,
    animate(panel.value!, [frame(sourceRect, 16), frame(targetRect, 24)]),
    animate(content.value!, [{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], duration(), 'linear'),
    rowGhost ? animate(rowGhost, [{ opacity: 1 }, { opacity: 0, offset: .28 }, { opacity: 0 }], duration(), 'linear') : Promise.resolve()
  ])
})
async function close() {
  if (closing) return
  closing = true
  // Let a quick back tap finish the shared motion before reversing it.
  await opening
  if (disposed) return
  dialog.value!.classList.add('closing')
  const sourceRect = props.source?.getBoundingClientRect() || targetRect
  if (rowGhost) {
    Object.assign(rowGhost.style, frame(sourceRect, 16))
    const currentWords = [...panel.value!.querySelectorAll<HTMLElement>('[data-morph-word]')].map(t => t.dataset.morphWord)
    rowGhost.querySelectorAll<HTMLElement>('[data-morph-word]').forEach(t => {
      t.style.visibility = currentWords.includes(t.dataset.morphWord) ? 'hidden' : 'visible'
    })
  }
  const titles = moveTitles(true)
  await Promise.all([
    titles,
    animate(panel.value!, [frame(targetRect, 24), frame(sourceRect, 16)]),
    animate(content.value!, [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }]),
    rowGhost ? animate(rowGhost, [{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], duration(), 'linear') : Promise.resolve()
  ])
  if (!disposed) emit('close')
}
onBeforeUnmount(() => {
  disposed = true
  animations.forEach(animation => animation.cancel())
  hiddenTitles.forEach(title => { title.style.visibility = '' })
  rowGhost?.remove()
  if (props.source) props.source.style.visibility = oldVisibility
  dialog.value?.close()
  document.getElementById('app')!.style.overflowY = oldOverflow
  // The row becomes interactive again on the following Vue update.
  requestAnimationFrame(() => props.source?.focus({ preventScroll: true }))
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="record-dialog" aria-label="记录详情" @cancel.prevent="close" @click.self="close">
      <section ref="panel" class="record-panel">
        <div ref="content" class="record-content">
          <button autofocus class="record-back" @click="close">← 返回记录</button>
          <slot />
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style>
.record-dialog { position: fixed; inset: 0; width: 100%; height: 100dvh; max-width: none; max-height: none; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); border: 0; outline: none; background: transparent; color: var(--ink); overflow: hidden; }
.record-dialog::backdrop { background: rgb(20 19 17 / .25); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); animation: record-backdrop 680ms ease both; }
.record-dialog.closing::backdrop { animation: record-backdrop-out 680ms ease both; }
.record-panel { position: fixed; left: max(16px, calc((100vw - 512px) / 2)); top: max(16px, env(safe-area-inset-top)); width: min(calc(100% - 32px), 512px); height: calc(100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))); border-radius: 24px; background: var(--card); border: 1px solid var(--line); box-shadow: 0 24px 80px rgb(0 0 0 / .22); overflow: hidden; transition: none; }
.record-content { height: 100%; overflow-y: auto; overscroll-behavior: contain; transition: none; }
.record-back { display: block; position: sticky; top: 0; z-index: 2; padding: 16px 20px; width: 100%; text-align: left; color: var(--ink-soft); background: var(--card); border: 0; outline: none; box-shadow: none; -webkit-tap-highlight-color: transparent; }
.record-back:focus-visible { outline: 2px solid var(--ink-mute); outline-offset: -6px; border-radius: 12px; }
.record-panel .animate-card-enter, .record-panel .stagger > * { animation: none; }
.record-panel .card { border: 0; box-shadow: none; }
.record-row-ghost { position: fixed !important; pointer-events: none; transition: none !important; z-index: 3; }
.record-shared-title { position: fixed; display: block; line-height: normal; white-space: pre; pointer-events: none; z-index: 4; transition: none; }
@keyframes record-backdrop { from { backdrop-filter: blur(0); background: transparent; } }
@keyframes record-backdrop-out { to { backdrop-filter: blur(0); background: transparent; } }
@media (prefers-reduced-motion: reduce) { .record-dialog::backdrop { animation: none !important; } }
</style>

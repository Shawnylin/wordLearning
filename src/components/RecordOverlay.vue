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
// Keep icon and timestamp on independent tracks; the title has its own shared motion.
function moveRowDetails(reverse: boolean) {
  if (!rowGhost) return Promise.resolve()
  const tasks: Promise<unknown>[] = []
  rowGhost.style.opacity = '1'
  const icon = rowGhost.querySelector<HTMLElement>('[data-row-icon]')
  const time = rowGhost.querySelector<HTMLElement>('[data-row-time]')
  if (icon) tasks.push(animate(icon, reverse
    ? [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }]
    : [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }], duration(), 'linear'))
  if (time) tasks.push(animate(time, reverse
    ? [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 0, transform: 'translateY(10px)', offset: .5 }, { opacity: 1, transform: 'translateY(0)' }]
    : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(10px)', offset: .4 }, { opacity: 0, transform: 'translateY(10px)' }], duration(), 'linear'))
  // Remaining row controls follow a quiet fade, without shifting the title.
  rowGhost.querySelectorAll<HTMLElement>('button, :scope > svg, [data-row-aux], [data-morph-word]').forEach(element => {
    tasks.push(animate(element, reverse
      ? [{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: 0, offset: .28 }, { opacity: 0 }], duration(), 'linear'))
  })
  return Promise.all(tasks)
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
function matchingTitle(source: HTMLElement, targets: HTMLElement[]) {
  return targets.find(target => target.dataset.morphWord === source.dataset.morphWord && target.dataset.morphIndex === source.dataset.morphIndex)
}
function singleLine(element: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(element)
  const lines = [...range.getClientRects()].filter(rect => rect.width > 0)
  return lines.length > 0 && lines.every(rect => Math.abs(rect.top - lines[0].top) < 2)
}
function canShare(source: HTMLElement, target?: HTMLElement): target is HTMLElement {
  return !!target && singleLine(source) && singleLine(target)
}
async function moveTitles(reverse: boolean) {
  const sourceTitles = [...(props.source?.querySelectorAll<HTMLElement>('[data-morph-word]') || [])]
  const targetTitles = [...panel.value!.querySelectorAll<HTMLElement>('[data-morph-word]')]
  const tasks = sourceTitles.map(async source => {
    const target = matchingTitle(source, targetTitles)
    if (!canShare(source, target)) return
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
    const targets = [...panel.value!.querySelectorAll<HTMLElement>('[data-morph-word]')]
    rowGhost.querySelectorAll<HTMLElement>('[data-morph-word]').forEach(t => {
      const source = [...props.source!.querySelectorAll<HTMLElement>('[data-morph-word]')].find(s => s.dataset.morphWord === t.dataset.morphWord && s.dataset.morphIndex === t.dataset.morphIndex)!
      t.style.visibility = canShare(source, matchingTitle(source, targets)) ? 'hidden' : 'visible'
    })
    dialog.value!.append(rowGhost)
    props.source.style.visibility = 'hidden'
  }
  // Measure the actual title before the panel starts moving.
  const titles = moveTitles(false)
  opening = Promise.all([
    titles,
    animate(panel.value!, [frame(sourceRect, 16), frame(targetRect, 24)]),
    animate(content.value!, [{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], duration(), 'linear'),
    moveRowDetails(false)
  ]).then(() => {
    if (disposed) return
    // Return geometry to CSS after the shared transition so rotation and
    // Split View resizing keep the open panel inside the current viewport.
    animations.forEach(animation => animation.cancel())
    animations.length = 0
    panel.value!.removeAttribute('style')
    if (rowGhost) rowGhost.style.opacity = '0'
  })
})
async function close() {
  if (closing) return
  closing = true
  // Let a quick back tap finish the shared motion before reversing it.
  await opening
  if (disposed) return
  targetRect = panel.value!.getBoundingClientRect()
  Object.assign(panel.value!.style, frame(targetRect, 24))
  dialog.value!.classList.add('closing')
  const sourceRect = props.source?.getBoundingClientRect() || targetRect
  if (rowGhost) {
    Object.assign(rowGhost.style, frame(sourceRect, 16))
    const currentTitles = [...panel.value!.querySelectorAll<HTMLElement>('[data-morph-word]')]
    rowGhost.querySelectorAll<HTMLElement>('[data-morph-word]').forEach(t => {
      t.style.visibility = canShare(t, matchingTitle(t, currentTitles)) ? 'hidden' : 'visible'
    })
  }
  const titles = moveTitles(true)
  await Promise.all([
    titles,
    animate(panel.value!, [frame(targetRect, 24), frame(sourceRect, 16)]),
    animate(content.value!, [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }]),
    moveRowDetails(true)
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
      <section ref="panel" class="record-panel glass-card">
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
.record-panel { position: fixed; left: max(16px, calc((100vw - 512px) / 2)); top: max(16px, env(safe-area-inset-top)); width: min(calc(100% - 32px), 512px); height: calc(100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))); border-radius: 24px; background: var(--glass-fill); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow), 0 24px 64px rgb(0 0 0 / .12); overflow: hidden; transition: none; }
.record-content { height: 100%; overflow-y: auto; overscroll-behavior: contain; transition: none; }
.record-back { display: block; position: sticky; top: 0; z-index: 2; padding: 16px 20px; width: 100%; text-align: left; color: var(--ink-soft); background: var(--glass-fill); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 0; outline: none; box-shadow: none; -webkit-tap-highlight-color: transparent; }
.record-back:focus, .record-back:focus-visible, .record-back:active { outline: none; box-shadow: none; }
.record-back:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
.record-panel .animate-card-enter, .record-panel .stagger > * { animation: none; }
.record-panel .card { border: 0; box-shadow: none; background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
.record-panel .idiom-heading { position: relative; margin: 0 24px 24px; padding: 22px 0 18px; text-align: left; background: none; border-bottom: 1px solid var(--line); }
.record-panel .idiom-heading .study-heading-row { display: block; min-height: 34px; margin-bottom: 0; padding-right: 124px; }
.record-panel .idiom-heading .study-heading-row > p { margin: 0 0 3px; color: var(--zhuhong); font-size: 14px; line-height: 1.45; letter-spacing: .08em; overflow-wrap: anywhere; }
.record-panel .idiom-heading .study-heading-actions { position: absolute; top: 18px; right: -8px; display: flex; align-items: center; gap: 2px; }
.record-panel .idiom-heading h1 { margin: 0; color: var(--ink); font-size: clamp(40px, 11vw, 52px); line-height: 1.18; letter-spacing: .06em; text-align: left; overflow-wrap: anywhere; }
.record-panel .idiom-heading .token-usage { justify-content: flex-start; margin-top: 6px; }
.record-panel .idiom-sections { display: grid; gap: 24px; padding: 0 24px 28px; }
.record-panel .idiom-sections > div { min-width: 0; margin: 0; }
.record-panel .idiom-sections .pl-9 { padding-left: 0; }
.record-panel .idiom-sections p { font-size: 15px; line-height: 1.9; overflow-wrap: anywhere; }
.record-panel .idiom-sections .grid { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.record-panel .idiom-sections .grid button { width: auto; padding: 4px 0; border-radius: 0; background: transparent; color: var(--zhuhong); white-space: normal; overflow: visible; overflow-wrap: anywhere; text-align: left; }
.record-panel .idiom-sections .grid button:hover { text-decoration: underline; }
.record-panel .compare-heading { position: relative; margin: 0 24px 24px; padding: 22px 0 18px; text-align: left; background: none; border-bottom: 1px solid var(--line); }
.record-panel .compare-heading .study-heading-row { display: block; min-height: 48px; padding-right: 44px; }
.record-panel .compare-heading .study-heading-actions { position: absolute; top: 18px; right: -8px; }
.record-panel .compare-heading .compare-words { justify-content: flex-start; color: var(--ink); font-weight: 700; letter-spacing: .04em; }
.record-panel .compare-heading .compare-word { line-height: 1.18; }
.record-panel .compare-heading .compare-word-divider { font-size: 14px; letter-spacing: 0; }
.record-panel .compare-heading .compare-words--count-2 { flex-wrap: nowrap; gap: 6px 10px; font-size: clamp(24px, 7.5vw, 48px); }
.record-panel .compare-heading .compare-words--count-3 { flex-wrap: nowrap; gap: 4px 6px; font-size: clamp(15px, 4.8vw, 32px); }
.record-panel .compare-heading .compare-words--count-2 .compare-word,
.record-panel .compare-heading .compare-words--count-3 .compare-word { flex: 0 1 auto; white-space: nowrap; overflow-wrap: normal; }
.record-panel .compare-heading .compare-words--count-4 { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px 10px; width: 100%; font-size: clamp(22px, 7vw, 42px); }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(1),
.record-panel .compare-heading .compare-words--count-4 > :nth-child(5) { justify-self: end; text-align: right; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(3),
.record-panel .compare-heading .compare-words--count-4 > :nth-child(7) { justify-self: start; text-align: left; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(2) { grid-column: 2; grid-row: 1; align-self: center; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(4) { display: none; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(5) { grid-column: 1; grid-row: 2; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(6) { grid-column: 2; grid-row: 2; align-self: center; }
.record-panel .compare-heading .compare-words--count-4 > :nth-child(7) { grid-column: 3; grid-row: 2; }
.record-panel .compare-heading .token-usage { justify-content: flex-start; margin-top: 6px; }
.record-panel .compare-sections { display: grid; gap: 24px; padding: 0 24px 28px; }
.record-panel .compare-sections > div { min-width: 0; margin: 0; }
.record-panel .compare-sections .pl-9 { padding-left: 0; }
.record-panel .compare-sections p { font-size: 15px; line-height: 1.9; overflow-wrap: anywhere; }
.record-row-ghost { position: fixed !important; pointer-events: none; transition: none !important; z-index: 3; }
.record-shared-title { position: fixed; display: block; line-height: normal; white-space: pre; pointer-events: none; z-index: 4; transition: none; }
@media (min-width: 768px) {
  .record-panel {
    left: calc((100vw - min(760px, 100vw - 64px)) / 2);
    top: max(32px, env(safe-area-inset-top));
    width: min(760px, calc(100vw - 64px));
    height: calc(100dvh - max(32px, env(safe-area-inset-top)) - max(32px, env(safe-area-inset-bottom)));
  }
  .record-content > .max-w-lg { max-width: none; }
  .record-panel .idiom-heading { margin: 0 32px 28px; padding-top: 28px; }
  .record-panel .idiom-heading .study-heading-actions { top: 24px; }
  .record-panel .idiom-heading h1 { font-size: 56px; }
  .record-panel .idiom-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 36px; padding: 0 32px 32px; }
  .record-panel .compare-heading { margin: 0 32px 28px; padding-top: 28px; }
  .record-panel .compare-heading .study-heading-actions { top: 24px; }
  .record-panel .compare-heading .compare-words--count-2 { font-size: 48px; }
  .record-panel .compare-heading .compare-words--count-3 { font-size: 32px; }
  .record-panel .compare-heading .compare-words--count-4 { font-size: 42px; }
  .record-panel .compare-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 36px; padding: 0 32px 32px; }
  .record-back { padding: 18px 28px; }
}
@keyframes record-backdrop { from { backdrop-filter: blur(0); background: transparent; } }
@keyframes record-backdrop-out { to { backdrop-filter: blur(0); background: transparent; } }
@media (prefers-reduced-motion: reduce) { .record-dialog::backdrop { animation: none !important; } }
</style>

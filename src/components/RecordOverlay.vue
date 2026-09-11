<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
const props = defineProps<{ source: HTMLElement | null }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const panel = ref<HTMLElement>()
let animation: Animation | undefined
let closing = false
let oldOverflow = ''
function origin() {
  const target = panel.value!.getBoundingClientRect()
  const source = props.source?.getBoundingClientRect() || target
  return { transform: `translate(${source.x - target.x}px, ${source.y - target.y}px)`, width: `${source.width}px`, height: `${source.height}px`, borderRadius: '16px' }
}
const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 460
onMounted(() => {
  oldOverflow = document.getElementById('app')!.style.overflowY
  document.getElementById('app')!.style.overflowY = 'hidden'
  dialog.value!.showModal()
  const target = panel.value!.getBoundingClientRect()
  animation = panel.value!.animate([origin(), { transform: 'translate(0, 0)', width: `${target.width}px`, height: `${target.height}px`, borderRadius: '24px' }], { duration: duration(), easing: 'cubic-bezier(.22,1,.36,1)' })
})
async function close() {
  if (closing) return
  closing = true
  animation?.cancel()
  dialog.value!.classList.add('closing')
  const rect = panel.value!.getBoundingClientRect()
  animation = panel.value!.animate([{ transform: 'translate(0, 0)', width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: '24px' }, origin()], { duration: duration(), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
  await animation.finished.catch(() => {})
  emit('close')
}
onBeforeUnmount(() => {
  animation?.cancel()
  dialog.value?.close()
  document.getElementById('app')!.style.overflowY = oldOverflow
  props.source?.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="record-dialog" aria-label="记录详情" @cancel.prevent="close" @click.self="close">
      <section ref="panel" class="record-panel">
        <div class="record-content">
          <button autofocus class="record-back" @click="close">← 返回记录</button>
          <slot />
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style>
.record-dialog { position: fixed; inset: 0; width: 100%; height: 100dvh; max-width: none; max-height: none; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); border: 0; background: transparent; color: var(--ink); overflow: hidden; }
.record-dialog::backdrop { background: rgb(20 19 17 / .25); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); animation: record-backdrop 460ms ease both; }
.record-dialog.closing::backdrop { animation: record-backdrop-out 460ms ease both; }
.record-panel { width: min(100%, 512px); height: 100%; margin: 0 auto; border-radius: 24px; background: var(--card); border: 1px solid var(--line); box-shadow: 0 24px 80px rgb(0 0 0 / .22); overflow: hidden; transform-origin: top left; transition: none; }
.record-content { height: 100%; overflow-y: auto; overscroll-behavior: contain; animation: record-content-in 460ms ease both; }
.closing .record-content { opacity: 0; transition: opacity 160ms ease; }
.record-back { display: block; position: sticky; top: 0; z-index: 2; padding: 16px 20px; width: 100%; text-align: left; background: var(--card); border-bottom: 1px solid var(--line); }
.record-panel .animate-card-enter, .record-panel .stagger > * { animation: none; }
.record-panel .card { border: 0; box-shadow: none; }
@keyframes record-backdrop { from { backdrop-filter: blur(0); background: transparent; } }
@keyframes record-backdrop-out { to { backdrop-filter: blur(0); background: transparent; } }
@keyframes record-content-in { from { opacity: .1; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .record-dialog::backdrop, .record-content { animation: none !important; } }
</style>

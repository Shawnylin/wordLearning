<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { ArrowUp, RefreshCw, X } from 'lucide-vue-next'
const props = defineProps<{
  modelValue: string
  words: { id: number; value: string }[]
  mode: 'idiom' | 'compare'
  expanded: boolean
  loading: boolean
  canSend: boolean
  hasQueryChanges: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update-word': [id: number, value: string]
  remove: [id: number]
  submit: []
  close: []
}>()
const root = ref<HTMLElement>()
const focused = ref(false)
const comparing = computed(() => props.mode === 'compare')
const actionVisible = computed(() => props.expanded || (!comparing.value && (focused.value || !!props.modelValue.trim() || props.loading)))
const submitLabel = computed(() => comparing.value ? '发送对比' : '发送词语')
const submitAction = computed(() => !props.expanded || (!props.loading && props.canSend && props.hasQueryChanges))
const liquidId = `study-input-${useId()}`
const firstValue = computed(() => comparing.value ? props.words[0]?.value || '' : props.modelValue)
function updateFirst(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (comparing.value && props.words[0]) emit('update-word', props.words[0].id, value)
  else emit('update:modelValue', value)
}
function enter(event: KeyboardEvent) {
  if (event.isComposing || props.loading || (props.expanded && !submitAction.value)) return
  emit('submit')
}
function focusWord(id: number) {
  root.value?.querySelector<HTMLInputElement>(`[data-word-id="${id}"]`)?.focus({ preventScroll: true })
}
defineExpose({ focusWord })
</script>

<template>
  <div ref="root" class="study-command" :class="{ 'is-compare': comparing, 'has-action': actionVisible, 'has-extra': comparing && words.length > 2 }">
    <svg width="0" height="0" class="liquid-defs" aria-hidden="true"><defs>
      <filter :id="liquidId" x="-20%" y="-60%" width="140%" height="220%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" />
      </filter>
    </defs></svg>
    <div class="capsule-backgrounds" :style="{ filter: `url(#${liquidId})` }" aria-hidden="true">
      <div class="background-inputs">
        <div class="capsule first" /><div class="capsule second" />
        <div class="capsule third" :class="{ visible: comparing && words.length > 2 }" />
        <div class="capsule fourth" :class="{ visible: comparing && words.length > 3 }" />
      </div>
      <div class="command-drop" />
    </div>
    <div class="input-area">
      <label class="study-field glass-control first">
        <input :value="firstValue" :disabled="loading" :aria-label="comparing ? '输入词语 1' : '输入成语或词语'" :placeholder="comparing ? '输入词语 1' : '输入成语或词语…'"
          @input="updateFirst" @focus="focused = true" @blur="focused = false" @keydown.enter="enter" />
        <Transition name="remove-icon"><button v-if="comparing && words.length > 2" type="button" :disabled="loading" aria-label="移除词语 1" @click="emit('remove', words[0]!.id)"><X :size="16" /></button></Transition>
      </label>
      <label class="study-field glass-control second" :inert="!comparing" :aria-hidden="!comparing">
        <input :value="words[1]?.value" :disabled="loading || !comparing" aria-label="输入词语 2" placeholder="输入词语 2" @input="emit('update-word', words[1]!.id, ($event.target as HTMLInputElement).value)" @keydown.enter="enter" />
        <Transition name="remove-icon"><button v-if="comparing && words.length > 2" type="button" :disabled="loading" aria-label="移除词语 2" @click="emit('remove', words[1]!.id)"><X :size="16" /></button></Transition>
      </label>
      <TransitionGroup name="extra-field" tag="div" class="extra-fields">
        <label v-for="(item, index) in comparing ? words.slice(2) : []" :key="item.id" class="study-field glass-control extra" :class="index === 0 ? 'third' : 'fourth'">
          <input :data-word-id="item.id" :value="item.value" :disabled="loading" :aria-label="`输入词语 ${index + 3}`" :placeholder="`输入词语 ${index + 3}`" @input="emit('update-word', item.id, ($event.target as HTMLInputElement).value)" @keydown.enter="enter" />
          <button type="button" :disabled="loading" :aria-label="`移除词语 ${index + 3}`" @click="emit('remove', item.id)"><X :size="16" /></button>
        </label>
      </TransitionGroup>
    </div>
    <button class="study-top-action glass-control" :class="{ ready: submitAction && canSend }" :inert="!actionVisible" :tabindex="actionVisible ? 0 : -1" :disabled="submitAction ? !canSend : false" :aria-label="submitAction ? (loading ? (comparing ? '正在生成对比' : '正在生成') : submitLabel) : '收起卡片'" @pointerdown.prevent @click="submitAction ? emit('submit') : emit('close')">
      <Transition name="action-icon" mode="out-in">
        <X v-if="expanded && !submitAction" key="close" :size="22" />
        <RefreshCw v-else-if="loading" key="loading" :size="20" class="word-command-refresh" />
        <ArrowUp v-else key="send" :size="22" />
      </Transition>
    </button>
  </div>
</template>

<style scoped>
.study-command { --motion: 560ms cubic-bezier(.22,1,.36,1); --fill: color-mix(in srgb, var(--soft) 92%, var(--ink) 8%); position: relative; max-width: 760px; margin: 8px auto 20px; height: 56px; transition: height var(--motion); isolation: isolate; }
.study-command.has-extra { height: 124px; }
.liquid-defs { position: absolute; pointer-events: none; }
.input-area, .background-inputs { position: relative; width: 100%; height: 100%; transition: width var(--motion); }
.has-action .input-area, .has-action .background-inputs { width: calc(100% - 64px); }
.capsule-backgrounds { position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .42; contain: paint; will-change: opacity; }
.has-action .capsule-backgrounds { animation: command-liquid-release var(--motion) both; }
.command-drop { position: absolute; right: 0; top: 0; width: 56px; height: 56px; border-radius: 50%; background: var(--fill); transform: translateX(-28px) scale(.72); transition: transform var(--motion), opacity 300ms ease; will-change: transform; }
.is-compare:not(.has-action) .command-drop { opacity: 0; }
.has-action .command-drop { transform: translateX(0) scale(1); }
.capsule, .study-field { position: absolute; top: 0; height: 56px; border-radius: 28px; transition: width var(--motion), left var(--motion), transform var(--motion), opacity 300ms ease; }
.capsule { background: var(--fill); }
.first { left: 0; width: 100%; z-index: 1; }
.is-compare .first { width: calc((100% - 12px) / 2); }
.second, .third, .fourth { width: calc((100% - 12px) / 2); }
.second { left: 0; opacity: 0; transform: scale(.86, .72); }
.is-compare .second { left: calc((100% + 12px) / 2); opacity: 1; transform: none; }
.third { top: 68px; left: 0; --split-x: 0px; --split-y: -68px; }
.fourth { top: 68px; left: calc((100% + 12px) / 2); --split-x: calc(-100% - 12px); --split-y: 0px; }
.capsule.third, .capsule.fourth { opacity: 0; transform: translate(var(--split-x), var(--split-y)) scale(.88, .72); }
.capsule.visible { opacity: 1; transform: none; }
.study-field { display: flex; align-items: center; padding: 0 16px; gap: 0; background: linear-gradient(rgb(0 0 0 / .07), rgb(0 0 0 / .07)), var(--control-glass-fill); }
.study-field input { min-width: 0; width: 100%; height: 100%; background: none; border: 0; outline: none; color: var(--ink); font-size: 16px; }
.study-field input::placeholder { color: var(--ink-mute); }
.study-field button { flex: 0 0 28px; width: 28px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: var(--ink-mute); }
.study-field button:hover { color: var(--zhuhong); background: var(--zhuhong-soft); }
.extra-fields { position: absolute; inset: 0; pointer-events: none; }
.extra-fields .study-field { pointer-events: auto; }
.extra-field-enter-active, .extra-field-leave-active { transition: transform var(--motion), opacity 400ms ease; }
.extra-field-enter-from, .extra-field-leave-to { opacity: 0; transform: translate(var(--split-x), var(--split-y)) scale(.88,.72); }
.extra-field-leave-active { pointer-events: none !important; }
.extra-field-enter-active button { animation: delete-reveal 420ms 120ms both; }
.remove-icon-enter-active, .remove-icon-leave-active { transition: opacity 220ms ease, transform 300ms ease, flex-basis 300ms ease, width 300ms ease; }
.remove-icon-enter-from, .remove-icon-leave-to { opacity: 0; transform: scale(.4) rotate(-60deg); flex-basis: 0 !important; width: 0 !important; }
.study-top-action { --control-glass-fill: color-mix(in srgb, var(--card) 82%, var(--ink) 18%); position: absolute; right: 0; top: 0; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--ink-soft); opacity: 0; transform: translateX(-28px) scale(.7); pointer-events: none; transition: transform var(--motion), opacity 240ms ease, background 240ms ease, color 180ms ease; }
.has-action .study-top-action { opacity: 1; transform: none; pointer-events: auto; }
.study-top-action.ready { --control-glass-fill: var(--zhuhong-solid); --control-glass-edge: color-mix(in srgb, var(--zhuhong-solid) 76%, black); color: #fff; }
.has-action .study-top-action:disabled { opacity: 1; }
.study-field input:disabled, .study-field button:disabled { opacity: .55; }
button:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 3px; }
.action-icon-enter-active, .action-icon-leave-active { transition: transform 180ms ease, opacity 180ms ease; }
.action-icon-enter-from { opacity: 0; transform: rotate(-90deg) scale(.5); }
.action-icon-leave-to { opacity: 0; transform: rotate(90deg) scale(.5); }
@keyframes delete-reveal { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
@keyframes command-liquid-release {
  0%, 42% { opacity: .42; }
  66% { opacity: .34; }
  82% { opacity: .16; }
  100% { opacity: 0; }
}
@media (max-width: 380px) { .study-field { padding-inline: 12px; } .study-field button { flex-basis: 24px; width: 24px; } }
@media (prefers-reduced-motion: reduce) { *, *::before { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-delay: 0ms !important; } .capsule-backgrounds { opacity: 0; } }
</style>

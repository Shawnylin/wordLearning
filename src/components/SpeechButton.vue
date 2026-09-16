<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Volume2, Square, LoaderCircle, X } from 'lucide-vue-next'
import { useSpeech } from '../composables/useSpeech'
import { useSettingsStore } from '../stores/settings'
import type { SpeechConfig } from '../api/speech'

const props = withDefaults(defineProps<{ text: string; label?: string; config?: SpeechConfig; showLabel?: boolean }>(), { label: '朗读' })
const settings = useSettingsStore()
const speech = useSpeech()
const id = Symbol('speech')
const error = ref('')
const active = computed(() => speech.owner.value === id)
const loading = computed(() => active.value && speech.phase.value === 'loading')
const title = computed(() => active.value ? (loading.value ? '生成语音中，点击取消' : '停止朗读') : props.label)
async function toggle() {
  error.value = ''
  if (active.value) { speech.stop(id); return }
  try { await speech.play(id, props.text, { ...(props.config || settings.speechConfig) }) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '朗读失败，请重试' }
}
watch(() => props.text, () => { speech.stop(id); error.value = '' })
onBeforeUnmount(() => speech.stop(id))
onDeactivated(() => speech.stop(id))
</script>

<template>
  <span class="speech-control">
    <button type="button" @click="toggle" :title="title" :aria-label="title" :aria-pressed="active" :disabled="!text.trim()" class="speech-button" :class="{ active }">
      <LoaderCircle v-if="loading" :size="18" class="animate-spin" /><Square v-else-if="active" :size="18" /><Volume2 v-else :size="18" />
      <span v-if="showLabel" class="text-xs">{{ active ? (loading ? '生成中' : '停止') : label }}</span>
    </button>
    <span v-if="error" class="speech-error" role="alert">
      <span>{{ error }}</span>
      <RouterLink to="/profile/models#speech" class="text-zhuhong underline">朗读设置</RouterLink>
      <button type="button" @click="error = ''" aria-label="关闭朗读提示"><X :size="16" /></button>
    </span>
  </span>
</template>

<style scoped>
.speech-control { position: relative; display: inline-flex; flex: none; }
.speech-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 36px; min-height: 36px; padding: 8px; border-radius: 999px; color: var(--ink-mute); }
.speech-button:hover,.speech-button.active { background: var(--zhuhong-soft); color: var(--zhuhong); }
.speech-button:disabled { opacity: .4; }
.speech-error { position: absolute; right: 0; top: 100%; z-index: 30; width: min(250px, 75vw); display: flex; flex-wrap: wrap; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); text-align: left; font-size: 12px; box-shadow: 0 4px 20px #0002; }
</style>

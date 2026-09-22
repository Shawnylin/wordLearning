<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { defaultSpeechConfig } from '../api/speech'

const settings = useSettingsStore()
const draft = ref({ ...defaultSpeechConfig, ...settings.speechConfig })
watch(draft, value => {
  settings.speechConfig = { ...settings.speechConfig, voice: value.voice, rate: value.rate }
}, { deep: true })
watch(() => [settings.speechConfig.apiKey, settings.speechConfig.baseUrl, settings.speechConfig.model], ([apiKey, baseUrl, model]) => {
  draft.value.apiKey = apiKey
  draft.value.baseUrl = baseUrl
  draft.value.model = model
})
onMounted(() => { if (location.hash.endsWith('#speech')) document.getElementById('speech')?.scrollIntoView() })

</script>

<template>
  <section id="speech-advanced" class="card settings-card speech-settings">
    <div class="settings-form">
      <label class="settings-label">音色<select v-model="draft.voice"><option value="mimo_default">默认音色</option><option v-for="voice in ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean']" :key="voice" :value="voice">{{ voice }}</option></select></label>
      <fieldset><legend class="settings-label mb-2">语速</legend><div class="rate-options"><button v-for="option in [{ value: 'slow', label: '慢速' }, { value: 'normal', label: '标准' }, { value: 'fast', label: '快速' }]" :key="option.value" type="button" @click="draft.rate = option.value as typeof draft.rate" :class="{ active: draft.rate === option.value }" :aria-pressed="draft.rate === option.value">{{ option.label }}</button></div></fieldset>
    </div>
  </section>
</template>

<style scoped>
input,select { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
.settings-label { display: block; color: var(--ink-soft); font-size: 11px; font-weight: 600; line-height: 1.45; }
.rate-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.rate-options button { padding: 8px; border-radius: 10px; background: var(--soft); color: var(--ink-soft); font-size: 13px; }
.rate-options button.active { background: var(--zhuhong-soft); color: var(--zhuhong); }
@media (min-width:768px) { input,select { margin-top:4px; padding:9px 11px; font-size:15px; } }
</style>

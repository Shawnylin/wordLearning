<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Volume2 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { defaultSpeechConfig, speechEndpoint } from '../api/speech'
import { useSpeech } from '../composables/useSpeech'
import SpeechButton from './SpeechButton.vue'
import ApiKeyInput from './ApiKeyInput.vue'

const settings = useSettingsStore()
const draft = ref({ ...defaultSpeechConfig, ...settings.speechConfig })
const message = ref('')
const editing = ref(!settings.speechConfig.apiKey)
watch(draft, () => { message.value = '' }, { deep: true })
onMounted(() => { if (location.hash.endsWith('#speech')) document.getElementById('speech')?.scrollIntoView() })
function save() {
  try {
    speechEndpoint({ ...draft.value, apiKey: draft.value.apiKey.trim() || 'validate' })
    useSpeech().stop()
    settings.speechConfig = { apiKey: draft.value.apiKey.trim(), baseUrl: draft.value.baseUrl.trim().replace(/\/+$/, ''), model: draft.value.model.trim(), voice: draft.value.voice.trim(), rate: draft.value.rate }
    editing.value = false
    message.value = settings.speechConfig.apiKey ? '朗读设置已保存' : '已清除朗读密钥'
  } catch (error) { message.value = error instanceof Error ? error.message : '保存失败' }
}
function edit() { editing.value = true; message.value = '' }
function cancelEdit() {
  draft.value = { ...defaultSpeechConfig, ...settings.speechConfig }
  editing.value = false
  message.value = ''
}
</script>

<template>
  <section id="speech-advanced" class="card settings-card speech-settings">
    <header class="settings-card-header"><h2 class="settings-title flex items-center gap-2"><Volume2 :size="17" />MiMo 朗读</h2></header>
    <div v-if="!editing" class="settings-summary" aria-label="当前朗读配置">
      <div class="settings-summary-row"><span>API 地址</span><strong class="break-all">{{ draft.baseUrl }}</strong></div>
      <div class="settings-summary-key"><span>API Key</span><ApiKeyInput v-model="draft.apiKey" readonly /></div>
      <div class="settings-summary-row"><span>模型</span><strong class="break-all">{{ draft.model }}</strong></div>
      <div class="settings-summary-row"><span>音色 / 语速</span><strong>{{ draft.voice === 'mimo_default' ? '默认音色' : draft.voice }} · {{ draft.rate === 'slow' ? '慢速' : draft.rate === 'fast' ? '快速' : '标准' }}</strong></div>
    </div>
    <form v-if="editing" @submit.prevent="save" class="settings-form">
      <label class="settings-label">API 地址<input v-model="draft.baseUrl" type="url" required placeholder="https://api.xiaomimimo.com/v1" /></label>
      <label class="settings-label">API Key<ApiKeyInput v-model="draft.apiKey" placeholder="填写小米 MiMo API Key" /></label>
      <div class="settings-pair"><label class="settings-label">模型<input v-model="draft.model" required placeholder="mimo-v2.5-tts" /></label><label class="settings-label">音色<select v-model="draft.voice"><option value="mimo_default">默认音色</option><option v-for="voice in ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean']" :key="voice" :value="voice">{{ voice }}</option></select></label></div>
      <fieldset><legend class="settings-label mb-2">语速</legend><div class="rate-options"><button v-for="option in [{ value: 'slow', label: '慢速' }, { value: 'normal', label: '标准' }, { value: 'fast', label: '快速' }]" :key="option.value" type="button" @click="draft.rate = option.value as typeof draft.rate" :class="{ active: draft.rate === option.value }" :aria-pressed="draft.rate === option.value">{{ option.label }}</button></div></fieldset>
      <div class="settings-actions"><button type="submit" class="btn-primary">保存</button><button v-if="settings.speechConfig.apiKey" type="button" class="settings-secondary" @click="cancelEdit">取消</button><SpeechButton v-else text="欢迎使用朗读。" label="试听" :config="draft" show-label /></div>
      <p v-if="message" role="status" class="settings-status text-zhuhong">{{ message }}</p>
    </form>
    <div v-else class="settings-actions"><button class="btn-primary" @click="edit">编辑</button><SpeechButton text="欢迎使用朗读。" label="试听" :config="draft" show-label /></div>
    <p v-if="!editing && message" role="status" class="settings-status text-zhuhong">{{ message }}</p>
    <p class="settings-footnote">密钥仅保存在本机。<a href="https://mimo.mi.com" target="_blank" rel="noopener noreferrer" class="text-zhuhong underline">获取密钥</a></p>
  </section>
</template>

<style scoped>
input,select { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
.rate-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.rate-options button { padding: 8px; border-radius: 10px; background: var(--soft); color: var(--ink-soft); font-size: 13px; }
.rate-options button.active { background: var(--zhuhong-soft); color: var(--zhuhong); }
@media (min-width:768px) { input,select { margin-top:4px; padding:9px 11px; font-size:15px; } }
</style>

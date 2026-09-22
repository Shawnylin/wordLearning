<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { defaultSpeechConfig, speechEndpoint } from '../api/speech'
import { useSpeech } from '../composables/useSpeech'
import SpeechButton from './SpeechButton.vue'

const settings = useSettingsStore()
const draft = ref({ ...defaultSpeechConfig, ...settings.speechConfig })
const message = ref('')
const editing = ref(!settings.speechConfig.apiKey)

interface ModelChoice {
  key: string
  profileId: string
  provider: string
  model: string
  baseUrl: string
}

const modelChoices = computed<ModelChoice[]>(() => {
  const seen = new Set<string>()
  const choices: ModelChoice[] = []
  for (const profile of settings.profiles) {
    const models = profile.models.length ? profile.models : [profile.model]
    const isMiMoProfile = /xiaomimimo\.com|mimo/i.test(profile.baseUrl) || [profile.name, ...models].some(value => /mimo/i.test(value))
    if (!isMiMoProfile) continue
    for (const model of models) {
      const normalizedModel = model.trim()
      if (!normalizedModel) continue
      const key = `${profile.id}:${normalizedModel}`
      if (seen.has(key)) continue
      seen.add(key)
      choices.push({
        key,
        profileId: profile.id,
        provider: profile.name || profile.model || '模型服务商',
        model: normalizedModel,
        baseUrl: profile.baseUrl
      })
    }
  }
  return choices
})

const speechModelKey = computed(() => settings.speechProfileId ? `${settings.speechProfileId}:${settings.speechConfig.model}` : modelChoices.value.find(choice => choice.baseUrl === settings.speechConfig.baseUrl && choice.model === settings.speechConfig.model)?.key || '')
const currentModelLabel = computed(() => {
  const choice = modelChoices.value.find(item => item.key === speechModelKey.value)
  return choice ? `${choice.provider} · ${choice.model}` : settings.speechConfig.model || '未选择模型'
})
const previewConfig = computed(() => ({ ...settings.speechConfig, ...draft.value }))

watch(draft, () => { message.value = '' }, { deep: true })
watch(() => [settings.speechConfig.apiKey, settings.speechConfig.baseUrl, settings.speechConfig.model], ([apiKey, baseUrl, model]) => {
  draft.value.apiKey = apiKey
  draft.value.baseUrl = baseUrl
  draft.value.model = model
})
onMounted(() => { if (location.hash.endsWith('#speech')) document.getElementById('speech')?.scrollIntoView() })

function selectModel(key: string) {
  const choice = modelChoices.value.find(item => item.key === key)
  const profile = choice && settings.profiles.find(item => item.id === choice.profileId)
  if (!choice || !profile) return
  useSpeech().stop()
  settings.speechProfileId = profile.id
  settings.speechConfig = { ...settings.speechConfig, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model: choice.model }
}

function save() {
  try {
    if (!settings.speechConfig.apiKey.trim()) throw new Error('请先在上方模型服务商中配置小米 MiMo API Key')
    speechEndpoint({ ...settings.speechConfig, ...draft.value })
    useSpeech().stop()
    settings.speechConfig = { ...settings.speechConfig, voice: draft.value.voice.trim(), rate: draft.value.rate }
    editing.value = false
    message.value = '朗读设置已保存'
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
    <label class="settings-label">朗读模型<select :value="speechModelKey" :disabled="!modelChoices.length" @change="selectModel(($event.target as HTMLSelectElement).value)"><option value="" disabled>{{ modelChoices.length ? '选择模型服务商与模型' : '请先添加小米 MiMo 服务商' }}</option><option v-for="choice in modelChoices" :key="choice.key" :value="choice.key">{{ choice.provider }} · {{ choice.model }}</option></select></label>
    <div v-if="!editing" class="settings-summary" aria-label="当前朗读配置">
      <div class="settings-summary-row"><span>当前模型</span><strong class="break-all">{{ currentModelLabel }}</strong></div>
      <div class="settings-summary-row"><span>音色 / 语速</span><strong>{{ draft.voice === 'mimo_default' ? '默认音色' : draft.voice }} · {{ draft.rate === 'slow' ? '慢速' : draft.rate === 'fast' ? '快速' : '标准' }}</strong></div>
    </div>
    <form v-if="editing" @submit.prevent="save" class="settings-form">
      <label class="settings-label">音色<select v-model="draft.voice"><option value="mimo_default">默认音色</option><option v-for="voice in ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean']" :key="voice" :value="voice">{{ voice }}</option></select></label>
      <fieldset><legend class="settings-label mb-2">语速</legend><div class="rate-options"><button v-for="option in [{ value: 'slow', label: '慢速' }, { value: 'normal', label: '标准' }, { value: 'fast', label: '快速' }]" :key="option.value" type="button" @click="draft.rate = option.value as typeof draft.rate" :class="{ active: draft.rate === option.value }" :aria-pressed="draft.rate === option.value">{{ option.label }}</button></div></fieldset>
      <div class="settings-actions speech-edit-actions"><button type="submit" class="btn-primary">保存</button><button type="button" class="settings-secondary" @click="cancelEdit">取消</button><SpeechButton text="欢迎使用朗读。" label="试听" :config="previewConfig" show-label /></div>
      <p v-if="message" role="status" class="settings-status text-zhuhong">{{ message }}</p>
    </form>
    <div v-else class="settings-actions"><button class="btn-primary" @click="edit">调整音色与语速</button><SpeechButton text="欢迎使用朗读。" label="试听" :config="previewConfig" show-label /></div>
    <p v-if="!editing && message" role="status" class="settings-status text-zhuhong">{{ message }}</p>
  </section>
</template>

<style scoped>
.speech-settings .speech-edit-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.settings-actions :deep(.speech-control) { display: flex; min-width: 0; width: 100%; }
.settings-actions :deep(.speech-button) { width: 100%; min-height: 40px; }
.settings-summary { display: grid; gap: 8px; }
.settings-summary-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ink-soft); }
.settings-summary-row strong { font-weight: 500; text-align: right; }

input,select { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
.settings-label { display: block; color: var(--ink-soft); font-size: 11px; font-weight: 600; line-height: 1.45; }
.rate-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.rate-options button { padding: 8px; border-radius: 10px; background: var(--soft); color: var(--ink-soft); font-size: 13px; }
.rate-options button.active { background: var(--zhuhong-soft); color: var(--zhuhong); }
@media (min-width:768px) { input,select { margin-top:4px; padding:9px 11px; font-size:15px; } }
</style>

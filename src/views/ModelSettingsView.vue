<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import SpeechButton from '../components/SpeechButton.vue'
import ModelSettings from '../components/ModelSettings.vue'
import SpeechSettings from '../components/SpeechSettings.vue'
import { providerCapabilities } from '../api/providers'

interface ModelChoice {
  key: string
  profileId: string
  provider: string
  model: string
  baseUrl: string
}

const router = useRouter()
const settings = useSettingsStore()
const modelChoices = computed<ModelChoice[]>(() => {
  const seen = new Set<string>()
  const choices: ModelChoice[] = []
  for (const profile of settings.profiles) {
    const models = profile.models.length ? profile.models : [profile.model]
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

function findChoice(baseUrl: string, model: string) {
  return modelChoices.value.find(choice => choice.baseUrl === baseUrl && choice.model === model)
}

const learningModelKey = computed(() => {
  const active = settings.profiles.find(profile => profile.id === settings.activeProfileId)
  return active ? `${active.id}:${active.model}` : ''
})

const pdfModelKey = computed(() => {
  if (settings.pdfUseLearningModel) return 'learning'
  return settings.pdfProfileId ? `${settings.pdfProfileId}:${settings.pdfConfig.model}` : findChoice(settings.pdfConfig.baseUrl, settings.pdfConfig.model)?.key || ''
})

const speechModelChoices = computed(() => modelChoices.value.filter(choice => {
  const profile = settings.profiles.find(item => item.id === choice.profileId)
  return providerCapabilities({ baseUrl: choice.baseUrl, model: choice.model, name: `${choice.provider} ${profile?.name || ''}` }).supportsSpeech
}))

const speechModelKey = computed(() => settings.speechProfileId
  ? `${settings.speechProfileId}:${settings.speechConfig.model}`
  : speechModelChoices.value.find(choice => choice.baseUrl === settings.speechConfig.baseUrl && choice.model === settings.speechConfig.model)?.key || '')

function getChoice(key: string) {
  return modelChoices.value.find(choice => choice.key === key)
}

function selectLearningModel(key: string) {
  const choice = getChoice(key)
  const profile = choice && settings.profiles.find(item => item.id === choice.profileId)
  if (!choice || !profile) return
  settings.saveProfile({ ...profile, model: choice.model })
  settings.selectProfile(profile.id)
}

function selectPdfModel(key: string) {
  if (key === 'learning') {
    settings.pdfUseLearningModel = true
    return
  }
  const choice = getChoice(key)
  const profile = choice && settings.profiles.find(item => item.id === choice.profileId)
  if (!choice || !profile) return
  settings.pdfProfileId = profile.id
  settings.pdfConfig = { ...settings.pdfConfig, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model: choice.model, thinkingEnabled: false }
  settings.pdfUseLearningModel = false
}

function selectSpeechModel(key: string) {
  const choice = getChoice(key)
  const profile = choice && settings.profiles.find(item => item.id === choice.profileId)
  if (!choice || !profile) return
  settings.speechProfileId = profile.id
  settings.speechConfig = { ...settings.speechConfig, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model: choice.model }
}

</script>

<template>
  <div class="settings-page min-h-screen">
    <div class="settings-shell">
      <header class="settings-page-header">
        <button class="settings-back" type="button" @click="router.push('/profile')"><ArrowLeft :size="17" /><span>返回</span></button>
        <h1>模型与 API</h1>
        <span class="settings-header-spacer" aria-hidden="true" />
      </header>

      <main class="settings-content">
        <ModelSettings />

        <section class="settings-panel settings-model-roles" aria-label="模型用途">
          <div class="settings-model-row"><label for="learning-model-select">学习模型</label><div class="settings-select-wrap">
            <select id="learning-model-select" :value="learningModelKey" :disabled="!modelChoices.length" @change="selectLearningModel(($event.target as HTMLSelectElement).value)">
              <option value="" disabled>{{ modelChoices.length ? '选择服务商与模型' : '请先添加模型服务商' }}</option>
              <option v-for="choice in modelChoices" :key="choice.key" :value="choice.key">{{ choice.provider }} · {{ choice.model }}</option>
            </select>
          </div></div>
          <div class="settings-model-row"><label for="pdf-model-select">PDF 模型</label><div class="settings-select-wrap">
            <select id="pdf-model-select" :value="pdfModelKey" @change="selectPdfModel(($event.target as HTMLSelectElement).value)">
              <option value="" disabled>选择服务商与模型</option>
              <option value="learning">跟随学习查词模型</option>
              <option v-for="choice in modelChoices" :key="choice.key" :value="choice.key">{{ choice.provider }} · {{ choice.model }}</option>
            </select>
          </div></div>
          <div class="settings-model-row"><label for="speech-model-select">朗读模型</label><div class="settings-select-wrap">
            <select id="speech-model-select" :value="speechModelKey" :disabled="!speechModelChoices.length" @change="selectSpeechModel(($event.target as HTMLSelectElement).value)">
              <option value="" disabled>{{ speechModelChoices.length ? '选择服务商与模型' : '请先添加 MiMo 服务商' }}</option>
              <option v-for="choice in speechModelChoices" :key="choice.key" :value="choice.key">{{ choice.provider }} · {{ choice.model }}</option>
            </select>
          </div></div>
        </section>

        <section class="settings-panel settings-voice-panel" aria-labelledby="speech-tools-title">
          <div class="settings-panel-heading">
            <div><h2 id="speech-tools-title">语音测试与调试</h2></div>
            <SpeechButton text="欢迎使用朗读。" label="语音测试" :config="settings.speechConfig" />
          </div>
          <div id="speech" class="settings-advanced-body"><SpeechSettings /></div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-page { background: var(--paper); color: var(--ink); }
.settings-shell { width: min(100%, 620px); margin: 0 auto; padding: 20px 16px calc(88px + env(safe-area-inset-bottom)); }
.settings-page-header { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; min-height: 44px; align-items: center; margin-bottom: 16px; }
.settings-page-header h1 { grid-column: 2; color: var(--ink); font-family: var(--font-kai); font-size: var(--subpage-title-size); font-weight: 600; line-height: 1.3; white-space: nowrap; }
.settings-back { display: inline-flex; grid-column: 1; width: fit-content; align-items: center; gap: 4px; min-height: 40px; padding: 8px 4px; color: var(--ink-soft); font-size: 13px; }
.settings-back:hover { color: var(--zhuhong); }
.settings-header-spacer { grid-column: 3; }
.settings-content { display: grid; gap: 12px; }
.settings-content :deep(.settings-card) { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 22px; background: var(--card); box-shadow: 0 8px 26px rgb(49 39 26 / 4%); }
.settings-content :deep(.settings-card-header) { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 0 0 13px; border-bottom: 1px solid var(--line); }
.settings-content :deep(.settings-overline) { margin-bottom: 2px; color: var(--ink-mute); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.settings-content :deep(.settings-title) { color: var(--ink); font-size: 16px; font-weight: 600; line-height: 1.35; }
.settings-content :deep(.settings-description) { max-width: 34ch; margin-top: 4px; color: var(--ink-mute); font-size: 12px; line-height: 1.55; }
.settings-content :deep(.settings-icon-button) { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 50%; background: var(--zhuhong); color: var(--paper); }
.settings-content :deep(.settings-icon-button:hover) { background: var(--zhuhong-solid); }
.settings-content :deep(.settings-provider-list) { overflow: hidden; }
.settings-content :deep(.settings-provider-row) { display: flex; min-width: 0; align-items: center; gap: 6px; min-height: 54px; border-bottom: 1px solid var(--line); }
.settings-content :deep(.settings-provider-row:last-child) { border-bottom: 0; }
.settings-content :deep(.settings-provider-main) { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; min-height: 52px; padding: 5px 0; color: var(--ink); text-align: left; }
.settings-content :deep(.settings-provider-icon), .settings-content :deep(.settings-panel-icon) { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 11px; background: var(--soft); color: var(--zhuhong); }
.settings-content :deep(.settings-provider-copy) { display: grid; min-width: 0; flex: 1; gap: 3px; }
.settings-content :deep(.settings-provider-copy strong) { overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.settings-content :deep(.settings-provider-copy small) { overflow: hidden; color: var(--ink-mute); font-size: 12px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.settings-content :deep(.settings-provider-state) { flex: none; color: var(--bamboo); font-size: 12px; }
.settings-content :deep(.settings-provider-actions) { display: flex; flex: none; gap: 2px; }
.settings-content :deep(.settings-row-icon) { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; color: var(--ink-mute); }
.settings-content :deep(.settings-row-icon:hover) { background: var(--soft); color: var(--ink); }
.settings-content :deep(.settings-row-icon-danger:hover) { color: var(--zhuhong); }
.settings-content :deep(.settings-empty-row) { display: flex; align-items: center; gap: 11px; min-height: 56px; color: var(--ink-mute); font-size: 12px; }
.settings-content :deep(.settings-editor) { display: grid; gap: 12px; padding-top: 2px; border-top: 1px solid var(--line); }
.settings-content :deep(.settings-editor-heading) { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--ink-soft); font-size: 12px; }
.settings-content :deep(.settings-form) { display: grid; gap: 11px; }
.settings-content :deep(.settings-label), .settings-content :deep(.settings-select-label) { display: block; color: var(--ink-soft); font-size: 13px; font-weight: 500; line-height: 1.45; }
.settings-content :deep(.settings-label input), .settings-content :deep(.settings-label select), .settings-content :deep(.settings-form input), .settings-content :deep(.settings-form select) { width: 100%; min-width: 0; }
.settings-content :deep(.settings-actions) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.settings-content :deep(.settings-actions.speech-edit-actions) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.settings-content :deep(.settings-actions > button) { min-height: 40px; border-radius: 11px; padding: 9px 10px; font-size: 12px; }
.settings-content :deep(.settings-secondary) { border-radius: 11px; background: var(--soft); color: var(--ink-soft); }
.settings-content :deep(.settings-text-button) { color: var(--zhuhong); font-size: 12px; }
.settings-content :deep(.settings-model-picker) { display: grid; gap: 7px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--soft); }
.settings-content :deep(.settings-model-picker-head) { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--ink-soft); font-size: 13px; font-weight: 500; }
.settings-content :deep(.settings-model-picker select), .settings-content :deep(.settings-select-wrap select) { min-width: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); }
.settings-content :deep(.settings-status) { padding: 8px 10px; border-radius: 10px; background: var(--soft); font-size: 12px; line-height: 1.5; }
.settings-content :deep(.settings-footnote) { color: var(--ink-mute); font-size: 12px; line-height: 1.6; }
.settings-panel { display: grid; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 22px; background: var(--card); box-shadow: 0 8px 26px rgb(49 39 26 / 4%); }
.settings-panel-heading { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 11px; }
.settings-panel-heading h2 { color: var(--ink); font-size: 16px; font-weight: 600; line-height: 1.4; }
.settings-panel-heading p { margin-top: 3px; color: var(--ink-mute); font-size: 12px; line-height: 1.5; }
.settings-model-roles { gap: 0; }
.settings-model-row { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 66px; border-bottom: 1px solid var(--line); color: var(--ink); font-size: 13px; font-weight: 500; }
.settings-model-row:last-child { border-bottom: 0; }
.settings-select-label { margin-top: 2px; }
.settings-select-wrap { position: relative; display: flex; align-items: center; }
.settings-select-wrap > svg { position: absolute; left: 14px; z-index: 1; color: var(--zhuhong); pointer-events: none; }
.settings-select-wrap select { width: 100%; min-height: 50px; padding: 10px 32px 10px 12px; font-size: 13px; }
.settings-select-wrap select:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
.settings-voice-panel :deep(.speech-button) { width: 38px; min-width: 38px; height: 38px; min-height: 38px; border-radius: 50%; background: var(--zhuhong); color: var(--paper); }
.settings-voice-panel :deep(.speech-button:hover) { background: var(--zhuhong-solid); }
.settings-voice-help { color: var(--ink-mute); font-size: 12px; line-height: 1.55; }
.settings-advanced { overflow: hidden; margin-top: 2px; border-top: 1px solid var(--line); }
.settings-advanced summary { display: flex; min-height: 40px; align-items: center; justify-content: space-between; gap: 10px; color: var(--ink-soft); cursor: pointer; font-size: 13px; font-weight: 500; list-style: none; }
.settings-advanced summary::-webkit-details-marker { display: none; }
.settings-advanced[open] summary > svg { transform: rotate(180deg); }
.settings-advanced-body { padding-top: 8px; }
.settings-advanced-body :deep(.settings-card) { margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
@media (min-width: 520px) { .settings-shell { padding-inline: 24px; } }
@media (max-width: 420px) { .settings-model-row { grid-template-columns: 68px minmax(0, 1fr); gap: 8px; } }
@media (prefers-reduced-motion: reduce) { .settings-advanced summary > svg { transition: none; } }
</style>

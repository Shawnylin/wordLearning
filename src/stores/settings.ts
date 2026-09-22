import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { defaultSpeechConfig } from '../api/speech'
import type { ApiConfig, ReasoningEffort } from '../api/deepseek'

export const useSettingsStore = defineStore('settings', () => {
  const speechConfig = ref({ ...defaultSpeechConfig })
  const apiKey = ref('')
  const baseUrl = ref('https://api.deepseek.com')
  const model = ref('deepseek-flash')
  const thinkingEnabled = ref(false)
  const reasoningEffort = ref<ReasoningEffort>('high')
  const profiles = ref<(ApiConfig & { id: string; name: string; models: string[] })[]>([])
  const activeProfileId = ref('')
  const pdfProfileId = ref('')
  const speechProfileId = ref('')
  const pdfConfig = ref<ApiConfig>({ apiKey: '', baseUrl: 'https://api.xiaomimimo.com/v1', model: '', thinkingEnabled: false })
  const pdfUseLearningModel = ref(false)
  const pdfApiConfig = computed(() => pdfUseLearningModel.value ? { ...apiConfig.value, thinkingEnabled: false } : { ...pdfConfig.value, thinkingEnabled: false })
  const apiConfig = computed<ApiConfig>(() => ({ apiKey: apiKey.value, baseUrl: baseUrl.value, model: model.value, thinkingEnabled: thinkingEnabled.value, reasoningEffort: reasoningEffort.value }))
  function saveProfile(profile: ApiConfig & { id: string; name: string; models: string[] }) {
    const index = profiles.value.findIndex(p => p.id === profile.id)
    const previous = profiles.value[index]
    if (previous) {
      if (!pdfProfileId.value && pdfConfig.value.apiKey === previous.apiKey && pdfConfig.value.baseUrl === previous.baseUrl) pdfProfileId.value = previous.id
      if (!speechProfileId.value && speechConfig.value.apiKey === previous.apiKey && speechConfig.value.baseUrl === previous.baseUrl) speechProfileId.value = previous.id
    }
    if (index < 0) profiles.value.push({ ...profile })
    else profiles.value[index] = { ...profile }
    if (activeProfileId.value === profile.id) selectProfile(profile.id)
    if (pdfProfileId.value === profile.id) pdfConfig.value = { ...pdfConfig.value, apiKey: profile.apiKey, baseUrl: profile.baseUrl }
    if (speechProfileId.value === profile.id) speechConfig.value = { ...speechConfig.value, apiKey: profile.apiKey, baseUrl: profile.baseUrl }
  }
  function selectProfile(id: string) {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) return
    activeProfileId.value = id
    apiKey.value = profile.apiKey
    baseUrl.value = profile.baseUrl
    model.value = profile.model
  }
  function deleteProfile(id: string) {
    const previous = profiles.value.find(profile => profile.id === id)
    if (previous) {
      if (!pdfProfileId.value && pdfConfig.value.apiKey === previous.apiKey && pdfConfig.value.baseUrl === previous.baseUrl) pdfProfileId.value = id
      if (!speechProfileId.value && speechConfig.value.apiKey === previous.apiKey && speechConfig.value.baseUrl === previous.baseUrl) speechProfileId.value = id
    }
    if (pdfProfileId.value === id) { pdfProfileId.value = ''; pdfConfig.value.apiKey = '' }
    if (speechProfileId.value === id) { speechProfileId.value = ''; speechConfig.value.apiKey = '' }
    profiles.value = profiles.value.filter(p => p.id !== id)
    if (activeProfileId.value === id) {
      activeProfileId.value = ''
      apiKey.value = ''
    }
  }
  /** 每次复习的词数（0 = 全部） */
  const reviewTarget = ref(10)

  function setApiKey(key: string) {
    apiKey.value = key.trim()
  }

  function clearApiKey() {
    apiKey.value = ''
  }

  function hasApiKey(): boolean {
    return apiKey.value.length > 0
  }

  function setReviewTarget(n: number) {
    reviewTarget.value = n
  }

  return {
    pdfProfileId, speechProfileId, speechConfig, apiKey, baseUrl, model, thinkingEnabled, reasoningEffort, profiles, activeProfileId, apiConfig, saveProfile, selectProfile, deleteProfile, pdfConfig, pdfUseLearningModel, pdfApiConfig,
    reviewTarget,
    setApiKey,
    clearApiKey,
    hasApiKey,
    setReviewTarget
  }
}, {
  persist: {
    key: 'settings-store',
    paths: ['pdfProfileId', 'speechProfileId', 'apiKey', 'reviewTarget', 'baseUrl', 'model', 'thinkingEnabled', 'reasoningEffort', 'profiles', 'activeProfileId', 'pdfConfig', 'pdfUseLearningModel', 'speechConfig']
  }
})

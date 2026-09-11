import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiConfig } from '../api/deepseek'

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref('')
  const baseUrl = ref('https://api.deepseek.com')
  const model = ref('deepseek-flash')
  const profiles = ref<(ApiConfig & { id: string; name: string; models: string[] })[]>([])
  const activeProfileId = ref('')
  const apiConfig = computed<ApiConfig>(() => ({ apiKey: apiKey.value, baseUrl: baseUrl.value, model: model.value }))
  function saveProfile(profile: ApiConfig & { id: string; name: string; models: string[] }) {
    const index = profiles.value.findIndex(p => p.id === profile.id)
    if (index < 0) profiles.value.push({ ...profile })
    else profiles.value[index] = { ...profile }
    selectProfile(profile.id)
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
    profiles.value = profiles.value.filter(p => p.id !== id)
    if (activeProfileId.value === id) {
      activeProfileId.value = ''
      apiKey.value = ''
      if (profiles.value[0]) selectProfile(profiles.value[0].id)
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
    apiKey, baseUrl, model, profiles, activeProfileId, apiConfig, saveProfile, selectProfile, deleteProfile,
    reviewTarget,
    setApiKey,
    clearApiKey,
    hasApiKey,
    setReviewTarget
  }
}, {
  persist: {
    key: 'settings-store',
    paths: ['apiKey', 'reviewTarget', 'baseUrl', 'model', 'profiles', 'activeProfileId']
  }
})

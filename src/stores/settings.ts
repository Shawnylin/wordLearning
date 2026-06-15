import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref('')

  function setApiKey(key: string) {
    apiKey.value = key.trim()
  }

  function clearApiKey() {
    apiKey.value = ''
  }

  function hasApiKey(): boolean {
    return apiKey.value.length > 0
  }

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    hasApiKey
  }
}, {
  persist: {
    key: 'settings-store',
    paths: ['apiKey']
  }
})

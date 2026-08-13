import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref('')
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
    apiKey,
    reviewTarget,
    setApiKey,
    clearApiKey,
    hasApiKey,
    setReviewTarget
  }
}, {
  persist: {
    key: 'settings-store',
    paths: ['apiKey', 'reviewTarget']
  }
})

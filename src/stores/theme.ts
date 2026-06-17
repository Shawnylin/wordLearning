import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'word-learning-theme'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>('light')
  const followSystem = ref(true)

  function applyTheme() {
    const html = document.documentElement
    if (theme.value === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      followSystem: followSystem.value
    }))
  }

  function loadFromStorage(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.theme) theme.value = data.theme
        if (typeof data.followSystem === 'boolean') followSystem.value = data.followSystem
        return true
      }
    } catch {}
    return false
  }

  function getSystemTheme(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // 初始化主题（同步调用，在 App 的 setup 中执行）
  function initTheme() {
    const hasSaved = loadFromStorage()
    if (!hasSaved || followSystem.value) {
      theme.value = getSystemTheme()
    }
    applyTheme()
  }

  // 手动切换主题（关闭跟随系统）
  function toggleTheme() {
    followSystem.value = false
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
    saveToStorage()
  }

  // 设置指定主题（关闭跟随系统）
  function setTheme(mode: ThemeMode) {
    followSystem.value = false
    theme.value = mode
    applyTheme()
    saveToStorage()
  }

  // 设置跟随系统
  function setFollowSystem(value: boolean) {
    followSystem.value = value
    if (value) {
      theme.value = getSystemTheme()
    }
    applyTheme()
    saveToStorage()
  }

  // 监听系统主题变化
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (followSystem.value) {
        theme.value = e.matches ? 'dark' : 'light'
        applyTheme()
        saveToStorage()
      }
    })
  }

  return {
    theme,
    followSystem,
    initTheme,
    toggleTheme,
    setTheme,
    setFollowSystem,
    watchSystemTheme
  }
})

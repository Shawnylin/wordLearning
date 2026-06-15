import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>('light')
  const followSystem = ref(true)

  // 应用主题到 DOM
  function applyTheme() {
    const html = document.documentElement
    if (theme.value === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  // 获取系统主题
  function getSystemTheme(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // 初始化主题
  function initTheme() {
    if (followSystem.value) {
      theme.value = getSystemTheme()
    }
    applyTheme()
  }

  // 手动切换主题（关闭跟随系统）
  function toggleTheme() {
    followSystem.value = false
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
  }

  // 设置跟随系统
  function setFollowSystem(value: boolean) {
    followSystem.value = value
    if (value) {
      theme.value = getSystemTheme()
      applyTheme()
    }
  }

  // 监听系统主题变化
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (followSystem.value) {
        theme.value = e.matches ? 'dark' : 'light'
        applyTheme()
      }
    })
  }

  return {
    theme,
    followSystem,
    initTheme,
    toggleTheme,
    setFollowSystem,
    watchSystemTheme
  }
}, {
  persist: {
    key: 'theme-store',
    paths: ['theme', 'followSystem']
  }
})

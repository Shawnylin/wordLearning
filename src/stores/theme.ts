import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>('light')

  // 初始化时检查系统偏好
  function initTheme() {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode | null
    if (savedTheme) {
      theme.value = savedTheme
    } else {
      // 检查系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  // 应用主题
  function applyTheme() {
    const html = document.documentElement
    if (theme.value === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  // 切换主题
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme-mode', theme.value)
    applyTheme()
  }

  // 设置指定主题
  function setTheme(newTheme: ThemeMode) {
    theme.value = newTheme
    localStorage.setItem('theme-mode', theme.value)
    applyTheme()
  }

  // 监听系统主题变化
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // 只在用户没有手动设置时跟随系统
      if (!localStorage.getItem('theme-mode')) {
        theme.value = e.matches ? 'dark' : 'light'
        applyTheme()
      }
    })
  }

  return {
    theme,
    initTheme,
    toggleTheme,
    setTheme,
    watchSystemTheme
  }
}, {
  persist: {
    key: 'theme-store',
    paths: ['theme']
  }
})

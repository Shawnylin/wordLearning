import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const FOREGROUND_CHECK_INTERVAL = 30 * 60 * 1000

let registration: ServiceWorkerRegistration | undefined
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined
let initialized = false
let lastForegroundCheck = 0

export const useAppUpdateStore = defineStore('app-update', () => {
  const needRefresh = ref(false)
  const offlineReady = ref(false)
  const checking = ref(false)
  const applying = ref(false)
  const promptVisible = ref(false)
  const statusMessage = ref('')
  const supported = ref(typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  const currentVersion = __APP_VERSION__

  const statusText = computed(() => {
    if (!supported.value) return '当前浏览器不支持应用更新检查'
    if (needRefresh.value) return '发现新版本，立即更新'
    return statusMessage.value || '可手动检查是否有新版本'
  })

  function initialize() {
    if (initialized || !supported.value) return
    initialized = true

    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh.value = true
        promptVisible.value = true
        statusMessage.value = '发现新版本，立即更新'
      },
      onOfflineReady() {
        offlineReady.value = true
      },
      onRegisteredSW(_swUrl, swRegistration) {
        registration = swRegistration
      },
      onRegisterError() {
        statusMessage.value = '更新服务暂时不可用，不影响正常使用'
      }
    })
  }

  async function checkForUpdate(options: { silent?: boolean } = {}) {
    if (checking.value) return
    if (!supported.value) {
      statusMessage.value = '当前浏览器不支持应用更新检查'
      return
    }

    checking.value = true
    if (!options.silent) statusMessage.value = '正在检查更新…'
    try {
      if (!registration) {
        registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      }
      if (!registration) {
        statusMessage.value = '更新服务尚未就绪，请稍后再试'
        return
      }

      await registration.update()
      if (registration.waiting) {
        needRefresh.value = true
        promptVisible.value = true
      }
      statusMessage.value = needRefresh.value ? '发现新版本，立即更新' : '当前已是最新版'
    } catch {
      statusMessage.value = '检查更新失败，请稍后再试'
    } finally {
      checking.value = false
    }
  }

  async function applyUpdate() {
    if (!needRefresh.value || applying.value) return
    applying.value = true
    statusMessage.value = '正在更新…'
    try {
      await updateServiceWorker?.(true)
    } catch {
      applying.value = false
      statusMessage.value = '更新失败，请稍后重试'
    }
  }

  function dismissPrompt() {
    promptVisible.value = false
  }

  function checkOnForeground(now = Date.now()) {
    if (document.visibilityState !== 'visible' || now - lastForegroundCheck < FOREGROUND_CHECK_INTERVAL) return
    lastForegroundCheck = now
    void checkForUpdate({ silent: true })
  }

  return {
    needRefresh,
    offlineReady,
    checking,
    applying,
    promptVisible,
    statusMessage,
    statusText,
    supported,
    currentVersion,
    initialize,
    checkForUpdate,
    applyUpdate,
    dismissPrompt,
    checkOnForeground
  }
})

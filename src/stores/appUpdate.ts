import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const FOREGROUND_CHECK_INTERVAL = 5 * 60 * 1000
const UPDATE_INSTALL_TIMEOUT = 30_000
const UPDATE_ACTIVATE_TIMEOUT = 12_000

let registration: ServiceWorkerRegistration | undefined
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined
let initialized = false
let lastForegroundCheck = 0

function waitForWorkerState(worker: ServiceWorker, target: ServiceWorkerState, timeout: number) {
  if (worker.state === target) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const finish = (matched: boolean) => {
      clearTimeout(timer)
      worker.removeEventListener('statechange', handleStateChange)
      resolve(matched)
    }
    const handleStateChange = () => {
      if (worker.state === target) finish(true)
      else if (worker.state === 'redundant') finish(false)
    }
    const timer = window.setTimeout(() => finish(false), timeout)
    worker.addEventListener('statechange', handleStateChange)
  })
}

async function findWaitingWorker(swRegistration: ServiceWorkerRegistration) {
  if (swRegistration.waiting) return swRegistration.waiting

  const installing = swRegistration.installing
  if (installing) {
    await waitForWorkerState(installing, 'installed', UPDATE_INSTALL_TIMEOUT)
    return swRegistration.waiting
  }

  return undefined
}

function waitForControllerChange(timeout: number) {
  return new Promise<boolean>((resolve) => {
    const finish = (changed: boolean) => {
      clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      resolve(changed)
    }
    const handleControllerChange = () => finish(true)
    const timer = window.setTimeout(() => finish(false), timeout)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
  })
}

function waitForUpdateFound(swRegistration: ServiceWorkerRegistration, timeout: number) {
  return new Promise<ServiceWorker | undefined>((resolve) => {
    const finish = (worker?: ServiceWorker) => {
      clearTimeout(timer)
      swRegistration.removeEventListener('updatefound', handleUpdateFound)
      resolve(worker)
    }
    const handleUpdateFound = () => finish(swRegistration.installing ?? undefined)
    const timer = window.setTimeout(() => finish(), timeout)
    swRegistration.addEventListener('updatefound', handleUpdateFound)
  })
}

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

      const updateFound = waitForUpdateFound(registration, 1500)
      await registration.update()
      let waitingWorker = await findWaitingWorker(registration)
      if (!waitingWorker) {
        const discoveredWorker = await updateFound
        if (discoveredWorker) {
          await waitForWorkerState(discoveredWorker, 'installed', UPDATE_INSTALL_TIMEOUT)
          waitingWorker = registration.waiting
        }
      }
      if (waitingWorker) {
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
      sessionStorage.setItem('app-update-transition', '1')
      document.documentElement.classList.add('app-update-leaving')
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise(resolve => setTimeout(resolve, 480))
      }
      if (!registration) {
        registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      }
      const waitingWorker = registration ? await findWaitingWorker(registration) : undefined
      if (!waitingWorker) throw new Error('waiting worker unavailable')

      const controllerChanged = waitForControllerChange(UPDATE_ACTIVATE_TIMEOUT)
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      // Keep the plugin bridge as a compatibility fallback for Workbox-managed updates.
      await updateServiceWorker?.(false)
      if (!await controllerChanged) throw new Error('worker activation timed out')
      window.location.reload()
    } catch {
      applying.value = false
      sessionStorage.removeItem('app-update-transition')
      document.documentElement.classList.remove('app-update-leaving')
      statusMessage.value = '更新未能完成，请关闭后重新打开应用再试'
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

import { readonly, ref } from 'vue'

export const BETA_KEY = 'word-learning-developer-beta-ui'
export const BETA_PATH = '/profile/developer'
const enabled = ref(false)
const unlocked = ref(false)
const pending = ref(false)
const message = ref('')
let style: HTMLStyleElement | undefined
let revision = 0

export const betaEnabled = readonly(enabled)
export const betaUnlocked = readonly(unlocked)
export const betaPending = readonly(pending)
export const betaMessage = readonly(message)
export function unlockBeta() { unlocked.value = true }

// CSS is imported as text, never as a side-effect stylesheet. Disabling removes
// both the actual style element and the selector gate, including Teleport UIs.
export async function setBetaEnabled(value: boolean, persist = true) {
  const request = ++revision
  message.value = ''
  if (!value) {
    document.documentElement.removeAttribute('data-developer-beta')
    style?.remove()
    style = undefined
    enabled.value = false
    pending.value = false
  } else {
    pending.value = true
    try {
      const { default: css } = await import('./theme.css?inline')
      if (request !== revision) return
      if (!style) {
        style = document.createElement('style')
        style.dataset.developerBeta = 'true'
        style.textContent = css
        document.head.append(style)
      }
      document.documentElement.setAttribute('data-developer-beta', 'true')
      enabled.value = true
    } catch {
      if (request !== revision) return
      message.value = 'Beta 界面加载失败，已保留原界面，请重试。'
      return
    } finally {
      if (request === revision) pending.value = false
    }
  }
  if (persist) {
    try { localStorage.setItem(BETA_KEY, value ? '1' : '0') }
    catch { message.value = '已在本次使用中切换，但浏览器未能保存设置。' }
  }
}

export function disposeBeta() {
  ++revision
  style?.remove()
  style = undefined
  document.documentElement.removeAttribute('data-developer-beta')
  enabled.value = false
  pending.value = false
  unlocked.value = false
}

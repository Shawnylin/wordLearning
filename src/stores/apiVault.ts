import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useSettingsStore } from './settings'
import { decryptApiSettings, deriveVaultKey, deviceVaultKey, encryptApiSettings, newVaultSalt, readEncryptedApiSettings } from '../utils/apiVaultCrypto'
import type { EncryptedApiSettings } from '../utils/apiVaultCrypto'

const fields = ['profiles', 'activeProfileId', 'apiKey', 'baseUrl', 'model', 'thinkingEnabled', 'reasoningEffort', 'pdfConfig', 'pdfUseLearningModel', 'pdfProfileId', 'speechConfig', 'speechProfileId'] as const
type Settings = ReturnType<typeof useSettingsStore>
type Snapshot = Pick<Settings, typeof fields[number]>
const storageKey = (id: string) => `word-learning-api-vault:${id}`
export const API_VAULT_CHANGED = 'word-learning-api-vault-changed'

function snapshot(settings: Settings): Snapshot {
  return JSON.parse(JSON.stringify(Object.fromEntries(fields.map(field => [field, settings[field]])))) as Snapshot
}

function validateSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('API 配置格式无效')
  const item = value as Record<string, unknown>
  for (const field of ['activeProfileId', 'apiKey', 'baseUrl', 'model', 'pdfProfileId', 'speechProfileId']) {
    if (typeof item[field] !== 'string') throw new Error('API 配置格式无效')
  }
  const configValid = (value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const config = value as Record<string, unknown>
    if (!['apiKey', 'baseUrl', 'model'].every(key => typeof config[key] === 'string')) return false
    try { return ['https:', 'http:'].includes(new URL(String(config.baseUrl)).protocol) } catch { return false }
  }
  if (!Array.isArray(item.profiles) || !item.profiles.every(profile => configValid(profile)
    && typeof profile.id === 'string' && typeof profile.name === 'string' && Array.isArray(profile.models)
    && profile.models.every((model: unknown) => typeof model === 'string'))
    || !configValid(item.pdfConfig) || !configValid(item.speechConfig)
    || typeof item.thinkingEnabled !== 'boolean' || typeof item.pdfUseLearningModel !== 'boolean'
    || !['low', 'high', 'max'].includes(String(item.reasoningEffort))) throw new Error('API 配置格式无效')
  const speech = item.speechConfig as Record<string, unknown>
  if (typeof speech.voice !== 'string' || !['slow', 'normal', 'fast'].includes(String(speech.rate))) throw new Error('朗读配置格式无效')
  return Object.fromEntries(fields.map(field => [field, item[field]])) as Snapshot
}

export const useApiVaultStore = defineStore('apiVault', () => {
  const owner = ref('')
  const envelope = ref<EncryptedApiSettings>()
  const unlocked = ref(false)
  const busy = ref(false)
  const error = ref('')
  let key: CryptoKey | undefined
  let salt = ''
  let lastPlaintext = ''
  let changedAt = 0
  let unsubscribe: (() => void) | undefined
  let generation = 0
  const status = computed(() => unlocked.value ? '已解锁' : envelope.value ? '待解锁' : '未开启')

  function persist(value: EncryptedApiSettings) {
    localStorage.setItem(storageKey(owner.value), JSON.stringify(value))
    envelope.value = value
  }
  function observe() {
    unsubscribe?.()
    unsubscribe = useSettingsStore().$subscribe(() => {
      if (unlocked.value && JSON.stringify(snapshot(useSettingsStore())) !== lastPlaintext) {
        changedAt = Math.max(Date.now(), (envelope.value?.updatedAt || 0) + 1)
        window.dispatchEvent(new Event(API_VAULT_CHANGED))
      }
    }, { detached: true, flush: 'sync' })
  }
  async function initialize(userId: string) {
    if (owner.value === userId) return
    reset()
    owner.value = userId
    const previousOwner = localStorage.getItem('word-learning-api-owner')
    if (previousOwner && previousOwner !== userId) {
      const settings = useSettingsStore()
      settings.$patch({ profiles: [], activeProfileId: '', apiKey: '', pdfProfileId: '', speechProfileId: '',
        pdfConfig: { ...settings.pdfConfig, apiKey: '' }, speechConfig: { ...settings.speechConfig, apiKey: '' } })
    }
    localStorage.setItem('word-learning-api-owner', userId)
    const stored = localStorage.getItem(storageKey(userId))
    envelope.value = stored ? readEncryptedApiSettings(JSON.parse(stored)) : undefined
    observe()
    const epoch = generation
    try {
      const device = await deviceVaultKey(userId)
      if (epoch !== generation) return
      if (device && envelope.value && device.salt === envelope.value.salt) {
        const decoded = validateSnapshot(await decryptApiSettings(envelope.value, device.key, userId))
        if (epoch !== generation) return
        key = device.key; salt = device.salt
        if (previousOwner && previousOwner !== userId) useSettingsStore().$patch(decoded)
        // Keep unsynchronized local edits on the same device.
        lastPlaintext = JSON.stringify(decoded)
        unlocked.value = true
        if (JSON.stringify(snapshot(useSettingsStore())) !== lastPlaintext) changedAt = Math.max(Date.now(), envelope.value.updatedAt + 1)
      }
    } catch { error.value = '此设备需要重新输入同步口令' }
  }
  async function capture(): Promise<EncryptedApiSettings | undefined> {
    if (!unlocked.value || !key) return envelope.value
    const data = snapshot(useSettingsStore())
    const serialized = JSON.stringify(data)
    if (serialized === lastPlaintext && envelope.value) return envelope.value
    const epoch = generation
    const next = await encryptApiSettings(data, key, salt, owner.value, changedAt || Date.now())
    if (epoch !== generation) throw new Error('账号已切换，请重新同步')
    persist(next); lastPlaintext = serialized
    return next
  }
  async function accept(value?: EncryptedApiSettings) {
    if (!value || (envelope.value && envelope.value.updatedAt > value.updatedAt)) return
    if (envelope.value?.ciphertext === value.ciphertext) return
    const epoch = generation
    if (key && salt === value.salt) {
      const decoded = validateSnapshot(await decryptApiSettings(value, key, owner.value))
      if (epoch !== generation) throw new Error('账号已切换，请重新同步')
      lastPlaintext = JSON.stringify(decoded)
      useSettingsStore().$patch(decoded)
      changedAt = value.updatedAt
    } else { key = undefined; unlocked.value = false }
    persist(value)
  }
  async function unlock(passphrase: string, remember: boolean) {
    if (!owner.value) throw new Error('请先登录')
    if (!envelope.value && passphrase.length < 12) throw new Error('同步口令至少需要 12 个字符')
    busy.value = true; error.value = ''
    const epoch = generation
    try {
      const nextSalt = envelope.value?.salt || newVaultSalt()
      const nextKey = await deriveVaultKey(passphrase, nextSalt)
      const decoded = envelope.value ? validateSnapshot(await decryptApiSettings(envelope.value, nextKey, owner.value)) : null
      if (epoch !== generation) throw new Error('账号已切换，请重新解锁')
      await deviceVaultKey(owner.value, remember ? { key: nextKey, salt: nextSalt } : null)
      if (epoch !== generation) throw new Error('账号已切换，请重新解锁')
      if (decoded) { lastPlaintext = JSON.stringify(decoded); useSettingsStore().$patch(decoded) }
      key = nextKey; salt = nextSalt; unlocked.value = true
      await capture()
      window.dispatchEvent(new Event(API_VAULT_CHANGED))
    } finally { busy.value = false }
  }
  async function lock() {
    await capture()
    await deviceVaultKey(owner.value, null)
    key = undefined; unlocked.value = false
  }
  function reset() {
    generation++; unsubscribe?.(); unsubscribe = undefined
    owner.value = ''; envelope.value = undefined; key = undefined; salt = ''; lastPlaintext = ''; changedAt = 0
    unlocked.value = false; error.value = ''
  }
  return { owner, envelope, unlocked, busy, error, status, initialize, capture, accept, unlock, lock, reset }
})

export interface EncryptedApiSettings {
  version: 1
  salt: string
  iv: string
  ciphertext: string
  updatedAt: number
}

const iterations = 600_000
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0))

export function readEncryptedApiSettings(value: unknown): EncryptedApiSettings | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') throw new Error('加密配置格式无效')
  const item = value as Record<string, unknown>
  if (item.version !== 1 || typeof item.salt !== 'string' || typeof item.iv !== 'string'
    || typeof item.ciphertext !== 'string' || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)
    || item.ciphertext.length > 2_000_000) throw new Error('加密配置格式无效')
  try {
    if (decode(item.salt).length !== 16 || decode(item.iv).length !== 12 || decode(item.ciphertext).length < 16) throw new Error()
  } catch { throw new Error('加密配置格式无效') }
  return { version: 1, salt: item.salt, iv: item.iv, ciphertext: item.ciphertext, updatedAt: item.updatedAt }
}

export function newVaultSalt(): string { return encode(crypto.getRandomValues(new Uint8Array(16))) }

export async function deriveVaultKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: decode(salt), iterations, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptApiSettings(value: unknown, key: CryptoKey, salt: string, userId: string, updatedAt: number): Promise<EncryptedApiSettings> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: new TextEncoder().encode(`word-learning:api-settings:1:${userId}:${updatedAt}`) }, key, new TextEncoder().encode(JSON.stringify(value)))
  return { version: 1, salt, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)), updatedAt }
}

export async function decryptApiSettings(value: EncryptedApiSettings, key: CryptoKey, userId: string): Promise<unknown> {
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(value.iv),
      additionalData: new TextEncoder().encode(`word-learning:api-settings:1:${userId}:${value.updatedAt}`) }, key, decode(value.ciphertext))
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown
  } catch { throw new Error('同步口令不正确，或云端配置已损坏；本机配置未被覆盖') }
}

// Structured cloning stores a non-extractable CryptoKey, never the passphrase.
export async function deviceVaultKey(userId: string, value?: { key: CryptoKey; salt: string } | null): Promise<{ key: CryptoKey; salt: string } | undefined> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('word-learning-api-vault', 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('keys')
    opening.onerror = () => reject(new Error('无法访问设备密钥存储'))
    opening.onsuccess = () => {
      const db = opening.result
      const transaction = db.transaction('keys', value === undefined ? 'readonly' : 'readwrite')
      const store = transaction.objectStore('keys')
      const request = value === undefined ? store.get(userId) : value === null ? store.delete(userId) : store.put(value, userId)
      transaction.oncomplete = () => { db.close(); resolve(value === undefined ? request.result : undefined) }
      transaction.onerror = () => { db.close(); reject(new Error('设备密钥保存失败，请关闭“记住此设备”后重试')) }
    }
  })
}

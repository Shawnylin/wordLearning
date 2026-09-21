const PROFILE_AVATAR_STORAGE_KEY = 'word-learning-profile-avatar'
const PROFILE_AVATAR_UPDATED_AT_KEY = 'word-learning-profile-avatar-updated-at'
const PROFILE_NAME_STORAGE_KEY = 'word-learning-profile-name'
const PROFILE_NAME_UPDATED_AT_KEY = 'word-learning-profile-name-updated-at'

export interface ProfileIdentity {
  name: string
  nameUpdatedAt: number
  avatarDataUrl: string
  avatarUpdatedAt: number
}

export const PROFILE_IDENTITY_CHANGED_EVENT = 'word-learning-profile-identity-changed'

function readTimestamp(key: string): number {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : 0
}

function announceChange() {
  window.dispatchEvent(new Event(PROFILE_IDENTITY_CHANGED_EVENT))
}

export function readProfileAvatar(): string {
  try {
    return localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function readProfileIdentity(fallbackName = ''): ProfileIdentity {
  try {
    const accountName = fallbackName.trim()
    const storedName = localStorage.getItem(PROFILE_NAME_STORAGE_KEY)?.trim() || ''
    const accountNameIsNewer = Boolean(accountName && accountName !== storedName)
    return {
      name: accountNameIsNewer ? accountName : storedName || accountName,
      nameUpdatedAt: accountNameIsNewer ? Date.now() : readTimestamp(PROFILE_NAME_UPDATED_AT_KEY),
      avatarDataUrl: localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) ?? '',
      avatarUpdatedAt: readTimestamp(PROFILE_AVATAR_UPDATED_AT_KEY)
    }
  } catch {
    return { name: fallbackName.trim(), nameUpdatedAt: 0, avatarDataUrl: '', avatarUpdatedAt: 0 }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('头像读取失败'))
    reader.onerror = () => reject(new Error('头像读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function prepareProfileAvatar(file: File): Promise<string> {
  try {
    const image = await createImageBitmap(file)
    const scale = Math.min(1, 512 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理头像')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.close()
    return canvas.toDataURL('image/webp', .82)
  } catch {
    return readFileAsDataUrl(file)
  }
}

export function saveProfileName(name: string, updatedAt = Date.now()): boolean {
  try {
    localStorage.setItem(PROFILE_NAME_STORAGE_KEY, name.trim())
    localStorage.setItem(PROFILE_NAME_UPDATED_AT_KEY, String(updatedAt))
    announceChange()
    return true
  } catch {
    return false
  }
}

export function saveProfileAvatar(dataUrl: string, updatedAt = Date.now()): boolean {
  try {
    localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, dataUrl)
    localStorage.setItem(PROFILE_AVATAR_UPDATED_AT_KEY, String(updatedAt))
    announceChange()
    return true
  } catch {
    return false
  }
}

export function saveProfileIdentity(identity: ProfileIdentity): boolean {
  const nameSaved = saveProfileName(identity.name, identity.nameUpdatedAt)
  const avatarSaved = saveProfileAvatar(identity.avatarDataUrl, identity.avatarUpdatedAt)
  return nameSaved && avatarSaved
}

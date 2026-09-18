const PROFILE_AVATAR_STORAGE_KEY = 'word-learning-profile-avatar'

export function readProfileAvatar(): string {
  try {
    return localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveProfileAvatar(dataUrl: string): boolean {
  try {
    localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

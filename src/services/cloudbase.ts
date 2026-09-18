import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim()
const publishableKey = import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY?.trim()
const region = import.meta.env.VITE_CLOUDBASE_REGION?.trim() || 'ap-shanghai'

const config = envId && publishableKey
  ? {
      env: envId,
      region,
      accessKey: publishableKey,
      auth: { detectSessionInUrl: true }
    }
  : null

export const cloudbaseConfigured = config !== null
export const cloudbaseApp = config ? cloudbase.init(config) : null
export const cloudbaseAuth = cloudbaseApp
  ? cloudbaseApp.auth({ persistence: 'local' })
  : null
export const cloudbaseRdb = cloudbaseApp ? cloudbaseApp.rdb() : null

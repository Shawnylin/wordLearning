import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ResetPasswordForEmailRes, SignUpRes } from '@cloudbase/js-sdk/auth'
import { cloudbaseAuth, cloudbaseConfigured } from '../services/cloudbase'

export interface CloudbaseUser {
  id: string
  email?: string
  username?: string
  displayName: string
}

type RegistrationVerifier = NonNullable<SignUpRes['data']['verifyOtp']>
type PasswordResetUpdater = NonNullable<ResetPasswordForEmailRes['data']['updateUser']>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function messageFrom(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const message = readString(error.message)
    if (message) return message
  }
  return fallback
}

function normalizeUser(session: unknown): CloudbaseUser | null {
  if (!isRecord(session) || !isRecord(session.user)) return null
  const rawUser = session.user
  if (rawUser.is_anonymous === true) return null

  const id = readString(rawUser.id)
  if (!id) return null

  const metadata = isRecord(rawUser.user_metadata) ? rawUser.user_metadata : null
  const email = readString(rawUser.email)
  const username = readString(rawUser.username) || readString(metadata?.username)
  const displayName = username || email || '已登录用户'
  return { id, email, username, displayName }
}

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false)
  const initializing = ref(false)
  const loading = ref(false)
  const initializationError = ref('')
  const currentUser = ref<CloudbaseUser | null>(null)
  const registrationPending = ref(false)
  const resetPending = ref(false)

  let initializationPromise: Promise<void> | null = null
  let registrationVerifier: RegistrationVerifier | null = null
  let passwordResetUpdater: PasswordResetUpdater | null = null

  const configured = computed(() => cloudbaseConfigured)
  const signedIn = computed(() => currentUser.value !== null)

  function setSession(session: unknown): boolean {
    const user = normalizeUser(session)
    currentUser.value = user
    return user !== null
  }

  function requireAuth() {
    const auth = cloudbaseAuth
    if (!auth) {
      throw new Error('当前构建未配置 CloudBase 认证，请补充环境变量后重新构建。')
    }
    return auth
  }

  async function initialize() {
    if (initialized.value) return
    if (initializationPromise) return initializationPromise

    initializationPromise = (async () => {
      initializing.value = true
      initializationError.value = ''
      const auth = cloudbaseAuth
      if (!auth) {
        initialized.value = true
        return
      }

      const result = await auth.getSession()
      if (result.error) {
        initializationError.value = messageFrom(result.error, '读取 CloudBase 登录状态失败')
      } else {
        setSession(result.data?.session)
      }

      auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })
      initialized.value = true
    })()
      .catch((error: unknown) => {
        initializationError.value = messageFrom(error, '初始化 CloudBase 认证失败')
        initialized.value = true
      })
      .finally(() => {
        initializing.value = false
      })

    return initializationPromise
  }

  async function signIn(email: string, password: string) {
    await initialize()
    loading.value = true
    try {
      const result = await requireAuth().signInWithPassword({ email, password })
      if (result.error) throw new Error(messageFrom(result.error, '登录失败'))
      if (!setSession(result.data?.session)) throw new Error('登录未建立有效会话，请稍后重试')
    } finally {
      loading.value = false
    }
  }

  async function beginRegistration(email: string, password: string): Promise<'signed-in' | 'verification-required'> {
    await initialize()
    loading.value = true
    registrationPending.value = false
    registrationVerifier = null
    try {
      const result = await requireAuth().signUp({ email, password })
      if (result.error) throw new Error(messageFrom(result.error, '注册失败'))
      if (setSession(result.data?.session)) return 'signed-in'

      const verifier = result.data?.verifyOtp
      if (typeof verifier !== 'function') throw new Error('注册请求未返回邮箱验证码步骤，请稍后重试')
      registrationVerifier = verifier
      registrationPending.value = true
      return 'verification-required'
    } finally {
      loading.value = false
    }
  }

  async function verifyRegistration(code: string) {
    const verifier = registrationVerifier
    if (!verifier) throw new Error('请先发送注册验证码')
    loading.value = true
    try {
      const result = await verifier({ token: code })
      if (result.error) throw new Error(messageFrom(result.error, '验证码验证失败'))
      if (!setSession(result.data?.session)) throw new Error('验证码已验证，但未建立有效会话，请重新登录')
      registrationVerifier = null
      registrationPending.value = false
    } finally {
      loading.value = false
    }
  }

  async function beginPasswordReset(email: string) {
    await initialize()
    loading.value = true
    resetPending.value = false
    passwordResetUpdater = null
    try {
      const result = await requireAuth().resetPasswordForEmail(email)
      if (result.error) throw new Error(messageFrom(result.error, '发送重置验证码失败'))
      const updater = result.data?.updateUser
      if (typeof updater !== 'function') throw new Error('重置请求未返回验证码步骤，请稍后重试')
      passwordResetUpdater = updater
      resetPending.value = true
    } finally {
      loading.value = false
    }
  }

  async function finishPasswordReset(code: string, password: string) {
    const updater = passwordResetUpdater
    if (!updater) throw new Error('请先发送密码重置验证码')
    loading.value = true
    try {
      const result = await updater({ nonce: code, password })
      if (result.error) throw new Error(messageFrom(result.error, '密码重置失败'))
      if (!setSession(result.data?.session)) throw new Error('密码已更新，但未建立有效会话，请重新登录')
      passwordResetUpdater = null
      resetPending.value = false
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    await initialize()
    const auth = requireAuth()
    loading.value = true
    try {
      const result = await auth.signOut()
      if (isRecord(result) && result.error) throw new Error(messageFrom(result.error, '退出登录失败'))
      currentUser.value = null
      registrationVerifier = null
      passwordResetUpdater = null
      registrationPending.value = false
      resetPending.value = false
    } finally {
      loading.value = false
    }
  }

  function cancelPending() {
    registrationVerifier = null
    passwordResetUpdater = null
    registrationPending.value = false
    resetPending.value = false
  }

  return {
    configured,
    initialized,
    initializing,
    loading,
    initializationError,
    currentUser,
    signedIn,
    registrationPending,
    resetPending,
    initialize,
    signIn,
    beginRegistration,
    verifyRegistration,
    beginPasswordReset,
    finishPasswordReset,
    signOut,
    cancelPending
  }
})

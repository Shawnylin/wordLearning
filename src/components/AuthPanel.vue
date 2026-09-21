<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ChevronRight, KeyRound, LoaderCircle, LogIn, LogOut, Mail, RotateCcw, ShieldCheck
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { PROFILE_IDENTITY_CHANGED_EVENT, prepareProfileAvatar, readProfileAvatar, saveProfileAvatar } from '../utils/profileAvatar'

type AuthMode = 'login' | 'register' | 'reset'

const auth = useAuthStore()
const mode = ref<AuthMode>('login')
const props = withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false
})
const showAuthForm = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const verificationCode = ref('')
const notice = ref('')
const errorMessage = ref('')
const avatarError = ref('')
const avatarDataUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)

const pendingVerification = computed(() => auth.registrationPending || auth.resetPending)
const submitLabel = computed(() => {
  if (mode.value === 'register') return auth.registrationPending ? '完成注册' : '发送注册验证码'
  if (mode.value === 'reset') return auth.resetPending ? '更新密码' : '发送重置验证码'
  return '登录'
})

function refreshAvatar() {
  avatarDataUrl.value = readProfileAvatar()
}

onMounted(() => {
  void auth.initialize()
  refreshAvatar()
  window.addEventListener(PROFILE_IDENTITY_CHANGED_EVENT, refreshAvatar)
})
onBeforeUnmount(() => window.removeEventListener(PROFILE_IDENTITY_CHANGED_EVENT, refreshAvatar))

function openAvatarPicker() {
  avatarInput.value?.click()
}

async function handleAvatarChange(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarError.value = '请选择图片文件'
    return
  }
  if (file.size > 4 * 1024 * 1024) {
    avatarError.value = '头像需小于 4 MB'
    return
  }

  try {
    const dataUrl = await prepareProfileAvatar(file)
    if (saveProfileAvatar(dataUrl)) {
      avatarDataUrl.value = dataUrl
      avatarError.value = ''
    } else {
      avatarError.value = '头像保存失败，请换一张图片'
    }
  } catch {
    avatarError.value = '头像读取失败，请重试'
  }
}

function switchMode(nextMode: AuthMode) {
  auth.cancelPending()
  mode.value = nextMode
  password.value = ''
  confirmPassword.value = ''
  verificationCode.value = ''
  notice.value = ''
  errorMessage.value = ''
}

function validateEmail() {
  if (!email.value.trim()) {
    errorMessage.value = '请输入邮箱'
    return false
  }
  return true
}

function validatePassword(value: string) {
  if (value.length < 8) {
    errorMessage.value = '密码至少需要 8 位'
    return false
  }
  return true
}

async function handleSubmit() {
  notice.value = ''
  errorMessage.value = ''
  if (!validateEmail()) return

  try {
    if (mode.value === 'login') {
      if (!validatePassword(password.value)) return
      await auth.signIn(email.value.trim(), password.value)
      notice.value = '登录成功，请选择学习数据的同步方式'
      return
    }

    if (mode.value === 'register') {
      if (auth.registrationPending) {
        if (!verificationCode.value.trim()) {
          errorMessage.value = '请输入邮箱验证码'
          return
        }
        await auth.verifyRegistration(verificationCode.value.trim())
        notice.value = '注册成功，请选择学习数据的同步方式'
        return
      }
      if (!validatePassword(password.value)) return
      const result = await auth.beginRegistration(email.value.trim(), password.value)
      notice.value = result === 'verification-required'
        ? '验证码已发送到邮箱，请输入后完成注册'
        : '注册成功，请选择学习数据的同步方式'
      return
    }

    if (auth.resetPending) {
      if (!verificationCode.value.trim()) {
        errorMessage.value = '请输入密码重置验证码'
        return
      }
      if (!validatePassword(password.value)) return
      if (password.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      await auth.finishPasswordReset(verificationCode.value.trim(), password.value)
      notice.value = '密码已更新并登录'
      return
    }

    await auth.beginPasswordReset(email.value.trim())
    notice.value = '重置验证码已发送到邮箱'
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '认证操作失败，请稍后重试'
  }
}

async function handleSignOut() {
  notice.value = ''
  errorMessage.value = ''
  try {
    await auth.signOut()
    notice.value = '已退出 CloudBase，学习数据仍保留在本机'
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '退出登录失败，请稍后重试'
  }
}
</script>

<template>
  <section :class="props.compact ? 'auth-panel auth-panel-compact' : 'auth-panel card rounded-2xl p-5'" data-testid="auth-panel">
    <div v-if="props.compact" class="profile-account-header">
      <button class="profile-account-avatar" type="button" aria-label="更换头像" @click="openAvatarPicker">
        <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="" />
        <span v-else>{{ auth.currentUser?.displayName.slice(0, 1) || '我' }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <p class="profile-eyebrow">{{ auth.currentUser ? '已登录' : '个人信息' }}</p>
        <h2 class="truncate text-lg font-semibold text-ink">{{ auth.currentUser?.displayName || '本机学习空间' }}</h2>
        <p class="truncate text-xs text-ink-mute">{{ auth.currentUser?.email || '登录后同步名称和头像' }}</p>
      </div>
      <button
        v-if="auth.currentUser"
        class="profile-account-action"
        :disabled="auth.loading"
        type="button"
        @click="handleSignOut"
      >
        <LoaderCircle v-if="auth.loading" :size="15" class="animate-spin" />
        <LogOut v-else :size="15" />
        退出
      </button>
      <button v-else class="profile-account-action" type="button" @click="showAuthForm = true">登录 / 注册</button>
    </div>

    <p v-if="props.compact && avatarError" class="mt-3 rounded-xl bg-zhuhong-soft p-3 text-sm leading-6 text-zhuhong" role="alert">{{ avatarError }}</p>

    <RouterLink v-if="props.compact" class="profile-account-edit-link" to="/profile/account">
      <span>设置名称和头像</span>
      <ChevronRight :size="17" aria-hidden="true" />
    </RouterLink>

    <div v-if="!props.compact" class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zhuhong-soft text-zhuhong">
          <ShieldCheck :size="20" />
        </div>
        <div class="min-w-0">
          <h2 class="font-semibold text-ink">账号</h2>
          <p class="mt-1 text-xs leading-5 text-ink-mute">登录可使用云同步，本机数据不受影响</p>
        </div>
      </div>
      <span v-if="auth.signedIn" class="shrink-0 rounded-full bg-bamboo-soft px-2.5 py-1 text-xs text-bamboo">已登录</span>
      <span v-else-if="auth.configured" class="shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs text-ink-mute">本地模式</span>
    </div>

    <div v-if="!auth.configured" class="mt-4 rounded-xl bg-soft p-3 text-sm leading-6 text-ink-soft">
      当前构建未配置 CloudBase 认证参数，仍可正常使用本地学习功能。
    </div>

    <div v-else-if="auth.initializing" class="mt-4 flex items-center gap-2 rounded-xl bg-soft p-3 text-sm text-ink-soft">
      <LoaderCircle :size="16" class="animate-spin" />正在检查登录状态…
    </div>

    <div v-else-if="auth.currentUser && !props.compact" class="mt-4 flex items-center justify-between gap-3 rounded-xl bg-soft p-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-ink">{{ auth.currentUser.displayName }}</p>
        <p class="mt-1 truncate text-xs text-ink-mute">{{ auth.currentUser.email || auth.currentUser.id }}</p>
      </div>
      <button
        class="flex shrink-0 items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:text-zhuhong disabled:opacity-50"
        :disabled="auth.loading"
        type="button"
        @click="handleSignOut"
      >
        <LoaderCircle v-if="auth.loading" :size="15" class="animate-spin" />
        <LogOut v-else :size="15" />
        退出
      </button>
    </div>

    <div v-else-if="auth.currentUser && props.compact" class="hidden" />

    <div v-else-if="props.compact && !showAuthForm" class="hidden" />

    <div v-else class="mt-4">
      <div class="mb-4 flex gap-2 rounded-xl bg-soft p-1" role="tablist" aria-label="认证方式">
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="mode === 'login' ? 'bg-card text-ink shadow-sm' : 'text-ink-mute'"
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          @click="switchMode('login')"
        >登录</button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="mode === 'register' ? 'bg-card text-ink shadow-sm' : 'text-ink-mute'"
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          @click="switchMode('register')"
        >注册</button>
      </div>

      <form class="space-y-3" @submit.prevent="handleSubmit">
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-ink-soft">邮箱</span>
          <span class="relative block">
            <Mail :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              v-model.trim="email"
              autocomplete="email"
              class="w-full rounded-xl border border-line bg-soft py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-colors focus:border-zhuhong"
              placeholder="name@example.com"
              type="email"
              required
            />
          </span>
        </label>

        <template v-if="mode !== 'reset' || auth.resetPending">
          <label v-if="mode !== 'reset' || auth.resetPending" class="block">
            <span class="mb-1.5 block text-xs font-medium text-ink-soft">{{ mode === 'reset' ? '新密码' : '密码' }}</span>
            <span class="relative block">
              <KeyRound :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input
                v-model="password"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                class="w-full rounded-xl border border-line bg-soft py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-colors focus:border-zhuhong"
                placeholder="至少 8 位"
                type="password"
                required
              />
            </span>
          </label>
          <label v-if="mode === 'reset' && auth.resetPending" class="block">
            <span class="mb-1.5 block text-xs font-medium text-ink-soft">确认新密码</span>
            <input
              v-model="confirmPassword"
              autocomplete="new-password"
              class="w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-zhuhong"
              placeholder="再次输入新密码"
              type="password"
              required
            />
          </label>
        </template>

        <label v-if="(mode === 'register' && auth.registrationPending) || (mode === 'reset' && auth.resetPending)" class="block">
          <span class="mb-1.5 block text-xs font-medium text-ink-soft">邮箱验证码</span>
          <input
            v-model="verificationCode"
            autocomplete="one-time-code"
            class="w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm tracking-[0.2em] text-ink outline-none transition-colors focus:border-zhuhong"
            inputmode="numeric"
            placeholder="输入验证码"
            type="text"
            required
          />
        </label>

        <p v-if="auth.initializationError" class="rounded-xl bg-zhuhong-soft p-3 text-sm leading-6 text-zhuhong" role="alert">{{ auth.initializationError }}</p>
        <p v-if="errorMessage" class="rounded-xl bg-zhuhong-soft p-3 text-sm leading-6 text-zhuhong" role="alert">{{ errorMessage }}</p>
        <p v-if="notice" class="rounded-xl bg-bamboo-soft p-3 text-sm leading-6 text-bamboo" role="status">{{ notice }}</p>

        <button
          class="flex w-full items-center justify-center gap-2 rounded-xl btn-primary py-2.5 text-sm font-medium disabled:opacity-50"
          :disabled="auth.loading || pendingVerification && mode === 'login'"
          type="submit"
        >
          <LoaderCircle v-if="auth.loading" :size="16" class="animate-spin" />
          <LogIn v-else-if="mode === 'login'" :size="16" />
          <RotateCcw v-else-if="mode === 'reset'" :size="16" />
          <Mail v-else :size="16" />
          {{ submitLabel }}
        </button>
      </form>

      <div class="mt-3 flex items-center justify-between gap-3 text-xs text-ink-mute">
        <button v-if="mode === 'login'" class="hover:text-zhuhong" type="button" @click="switchMode('reset')">忘记密码？</button>
        <button v-else class="hover:text-zhuhong" type="button" @click="switchMode('login')">返回登录</button>
        <span class="text-right">登录后可在云同步中自行选择数据去向</span>
      </div>
    </div>

    <input v-if="props.compact" ref="avatarInput" class="sr-only" type="file" accept="image/*" @change="handleAvatarChange" />
  </section>
</template>

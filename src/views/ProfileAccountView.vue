<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, LoaderCircle, Save } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AuthPanel from '../components/AuthPanel.vue'
import { useAuthStore } from '../stores/auth'
import { readProfileAvatar, saveProfileAvatar } from '../utils/profileAvatar'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const avatarDataUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarError = ref('')
const errorMessage = ref('')
const notice = ref('')

onMounted(() => {
  void auth.initialize()
  avatarDataUrl.value = readProfileAvatar()
})

watch(() => auth.currentUser, (user) => {
  name.value = user?.username ?? ''
}, { immediate: true })

function openAvatarPicker() {
  avatarInput.value?.click()
}

function handleAvatarChange(event: Event) {
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

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    if (!saveProfileAvatar(reader.result)) {
      avatarError.value = '头像保存失败，请换一张图片'
      return
    }
    avatarDataUrl.value = reader.result
    avatarError.value = ''
  }
  reader.onerror = () => { avatarError.value = '头像读取失败，请重试' }
  reader.readAsDataURL(file)
}

async function saveName() {
  errorMessage.value = ''
  notice.value = ''
  try {
    await auth.updateProfileName(name.value)
    notice.value = '名称已同步到服务器'
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '名称保存失败，请稍后重试'
  }
}
</script>

<template>
  <div class="profile-account-page px-4 pb-5 pt-5 sm:pt-7">
    <div class="profile-account-layout mx-auto">
      <header class="profile-title-row">
        <button class="profile-back-button" type="button" aria-label="返回个人" @click="router.push('/profile')">
          <ArrowLeft :size="17" aria-hidden="true" />
        </button>
        <h1 class="font-kai text-3xl text-ink">个人资料</h1>
      </header>

      <section class="profile-section profile-account-editor" aria-labelledby="profile-account-title">
        <div class="profile-section-heading">
          <h2 id="profile-account-title">名称和头像</h2>
        </div>

        <div class="profile-account-avatar-editor">
          <button class="profile-account-avatar profile-account-avatar-large" type="button" aria-label="更换头像" @click="openAvatarPicker">
            <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="" />
            <span v-else>{{ auth.currentUser?.displayName.slice(0, 1) || '我' }}</span>
          </button>
          <div>
            <p class="profile-row-title">头像</p>
            <p class="profile-row-caption">点击头像更换，仅保存在本机</p>
          </div>
        </div>
        <p v-if="avatarError" class="profile-inline-feedback is-error" role="alert">{{ avatarError }}</p>

        <form class="profile-account-form" @submit.prevent="saveName">
          <label class="profile-form-field">
            <span>名称</span>
            <input v-model="name" class="profile-form-input" maxlength="32" placeholder="例如：小林" type="text" :disabled="!auth.signedIn" />
          </label>
          <p class="profile-form-hint">{{ auth.signedIn ? '名称会保存到账号，并在登录后保持同步。' : '登录后可以设置并同步账号名称。' }}</p>
          <p v-if="errorMessage" class="profile-inline-feedback is-error" role="alert">{{ errorMessage }}</p>
          <p v-if="notice" class="profile-inline-feedback is-success" role="status">{{ notice }}</p>
          <button class="btn-primary profile-account-save" type="submit" :disabled="auth.loading || !auth.signedIn || !name.trim()">
            <LoaderCircle v-if="auth.loading" :size="16" class="animate-spin" />
            <Save v-else :size="16" />
            {{ auth.loading ? '保存中…' : '保存名称' }}
          </button>
        </form>
      </section>

      <AuthPanel v-if="!auth.signedIn" />
    </div>
    <input ref="avatarInput" class="sr-only" type="file" accept="image/*" @change="handleAvatarChange" />
  </div>
</template>

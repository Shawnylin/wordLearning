<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, LoaderCircle, Save } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AuthPanel from '../components/AuthPanel.vue'
import { useAuthStore } from '../stores/auth'
import { PROFILE_IDENTITY_CHANGED_EVENT, prepareProfileAvatar, readProfileAvatar, readProfileIdentity, saveProfileAvatar } from '../utils/profileAvatar'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const avatarDataUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarError = ref('')
const errorMessage = ref('')
const notice = ref('')

function refreshAvatar() {
  avatarDataUrl.value = readProfileAvatar()
  name.value = readProfileIdentity().name
}

onMounted(() => {
  void auth.initialize()
  refreshAvatar()
  window.addEventListener(PROFILE_IDENTITY_CHANGED_EVENT, refreshAvatar)
})
onBeforeUnmount(() => window.removeEventListener(PROFILE_IDENTITY_CHANGED_EVENT, refreshAvatar))

watch(() => auth.currentUser, () => refreshAvatar(), { immediate: true })

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
    if (!saveProfileAvatar(dataUrl)) {
      avatarError.value = '头像保存失败，请换一张图片'
      return
    }
    avatarDataUrl.value = dataUrl
    avatarError.value = ''
  } catch {
    avatarError.value = '头像读取失败，请重试'
  }
}

async function saveName() {
  errorMessage.value = ''
  notice.value = ''
  try {
    await auth.updateProfileName(name.value)
    notice.value = auth.signedIn ? '名称已保存，将随云同步更新' : '名称已保存'
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '名称保存失败，请稍后重试'
  }
}
</script>

<template>
  <div class="profile-account-page px-4 pb-5 pt-6 sm:pt-7">
    <div class="profile-account-layout mx-auto">
      <header class="profile-title-row">
        <button class="profile-back-button" type="button" aria-label="返回个人" @click="router.push('/profile')">
          <ArrowLeft :size="17" aria-hidden="true" />
        </button>
        <h1 class="app-subpage-title font-kai text-ink">个人资料</h1>
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
            <p class="profile-row-caption">点击更换；开启云同步后会同步到其他设备</p>
          </div>
        </div>
        <p v-if="avatarError" class="profile-inline-feedback is-error" role="alert">{{ avatarError }}</p>

        <form class="profile-account-form" @submit.prevent="saveName">
          <label class="profile-form-field">
            <span>名称</span>
            <input v-model="name" class="profile-form-input" maxlength="32" placeholder="例如：小林" type="text" />
          </label>
          <p class="profile-form-hint">昵称独立于登录邮箱，支持中文；登录后可随个人资料同步。</p>
          <p v-if="errorMessage" class="profile-inline-feedback is-error" role="alert">{{ errorMessage }}</p>
          <p v-if="notice" class="profile-inline-feedback is-success" role="status">{{ notice }}</p>
          <button class="btn-primary profile-account-save" type="submit" :disabled="auth.loading || !name.trim()">
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

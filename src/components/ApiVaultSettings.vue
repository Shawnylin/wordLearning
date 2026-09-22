<script setup lang="ts">
import { ref } from 'vue'
import { useApiVaultStore } from '../stores/apiVault'
import { useCloudSyncStore } from '../stores/cloudSync'
const vault = useApiVaultStore()
const sync = useCloudSyncStore()
const passphrase = ref('')
const confirmation = ref('')
const remember = ref(true)
const message = ref('')
const expanded = ref(false)
async function submit() {
  message.value = ''
  try {
    if (!vault.envelope && passphrase.value !== confirmation.value) throw new Error('两次口令不一致')
    await vault.unlock(passphrase.value, remember.value)
    passphrase.value = ''; confirmation.value = ''; expanded.value = false
    await sync.uploadNow()
  } catch (error) { message.value = error instanceof Error ? error.message : '解锁失败' }
}
async function lock() {
  try { await vault.lock() } catch (error) { message.value = error instanceof Error ? error.message : '锁定失败' }
}
</script>

<template>
  <div class="vault-settings">
    <div class="vault-heading"><span>API 加密同步</span><button type="button" :disabled="sync.preparing || sync.syncing || vault.busy" @click="expanded = !expanded">{{ vault.status }}</button></div>
    <form v-if="expanded && !vault.unlocked" class="vault-form" @submit.prevent="submit">
      <p>{{ vault.envelope ? '输入同步口令，恢复云端 API 配置。' : '设置独立口令，新设备首次恢复时使用。遗忘口令无法解密，请妥善保存。' }}</p>
      <label>同步口令<input v-model="passphrase" type="password" :autocomplete="vault.envelope ? 'current-password' : 'new-password'" :minlength="vault.envelope ? undefined : 12" required /></label>
      <label v-if="!vault.envelope">确认口令<input v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required /></label>
      <label class="vault-remember"><input v-model="remember" type="checkbox" />记住此设备</label>
      <button class="btn-primary" :disabled="vault.busy || sync.preparing || sync.syncing" type="submit">{{ vault.busy ? '处理中…' : vault.envelope ? '解锁并恢复' : '开启加密同步' }}</button>
    </form>
    <div v-else-if="expanded" class="vault-form"><button type="button" @click="lock">忘记此设备的解锁密钥</button><p>本机 API 配置仍可使用，下次同步需输入口令。</p></div>
    <p v-if="message || vault.error" role="alert" class="vault-error">{{ message || vault.error }}</p>
  </div>
</template>

<style scoped>
.vault-settings { border-top: 1px solid var(--line); padding-top: 12px; }
.vault-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
.vault-heading button { padding: 6px 0 6px 12px; color: var(--zhuhong); }
.vault-form { display: grid; gap: 12px; padding-top: 10px; font-size: 13px; }
.vault-form p { color: var(--ink-mute); font-size: 12px; line-height: 1.6; }
.vault-form label { display: grid; gap: 6px; }
.vault-form input[type=password] { min-width: 0; width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--soft); font-size: 16px; }
.vault-form .vault-remember { display: flex; align-items: center; gap: 8px; }
.vault-error { padding-top: 8px; font-size: 12px; color: var(--zhuhong); }
</style>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { apiEndpoint, fetchModels, testConnection } from '../api/deepseek'

const settings = useSettingsStore()
const draft = reactive({ id: '', name: '', apiKey: '', baseUrl: '', model: '', models: [] as string[] })
const busy = ref('')
const message = ref('')
const failed = ref(false)
function load() {
  const profile = settings.profiles.find(p => p.id === settings.activeProfileId)
  Object.assign(draft, profile ? { ...profile, models: [...profile.models] } : { ...settings.apiConfig, id: '', name: 'DeepSeek', models: [] })
  message.value = ''
}
load()
watch(() => [draft.baseUrl, draft.apiKey], () => { draft.models = []; message.value = '' }, { flush: 'sync' })
function select(event: Event) {
  settings.selectProfile((event.target as HTMLSelectElement).value)
  load()
}
function add() {
  Object.assign(draft, { id: '', name: '', apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', models: [] })
  message.value = ''
}
async function run(action: 'models' | 'test') {
  busy.value = action
  message.value = ''
  failed.value = false
  try {
    const config = { ...draft }
    if (action === 'models') {
      draft.models = await fetchModels(config)
      if (!draft.models.includes(draft.model)) draft.model = draft.models[0]
      message.value = `已获取 ${draft.models.length} 个模型，请选择后保存`
    } else message.value = await testConnection(config)
  } catch (error) {
    failed.value = true
    message.value = error instanceof Error ? error.message : '请求失败'
  } finally { busy.value = '' }
}
function save() {
  try {
    apiEndpoint(draft.baseUrl, 'models')
    if (!draft.apiKey.trim() || !draft.model.trim()) throw new Error('请填写 API Key 和模型名称')
    settings.saveProfile({ ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim() || draft.model.trim(), apiKey: draft.apiKey.trim(), baseUrl: draft.baseUrl.trim(), model: draft.model.trim(), models: [...draft.models] })
    draft.id = settings.activeProfileId
    failed.value = false
    message.value = '已保存并启用，后续生成将使用此模型'
  } catch (error) { failed.value = true; message.value = (error as Error).message }
}
function remove() { settings.deleteProfile(draft.id); load() }
</script>

<template>
  <section class="card rounded-2xl p-6 space-y-4 model-settings">
    <div><h3 class="font-semibold text-ink">模型与 API</h3><p class="text-xs text-ink-mute mt-1">兼容 OpenAI Chat Completions 接口</p></div>
    <p class="text-sm text-ink-soft break-all">当前模型：{{ settings.model }}</p>
    <label v-if="settings.profiles.length" class="block text-sm">切换已保存配置
      <select :value="settings.activeProfileId" @change="select" :disabled="!!busy"><option v-for="p in settings.profiles" :key="p.id" :value="p.id">{{ p.name }} · {{ p.model }}</option></select>
    </label>
    <fieldset :disabled="!!busy" class="space-y-3">
      <label class="block text-sm">配置名称<input v-model="draft.name" placeholder="例如：DeepSeek 日常学习" /></label>
      <label class="block text-sm">API URL<input v-model="draft.baseUrl" type="url" placeholder="https://api.deepseek.com" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
      <p class="text-xs text-ink-mute">填写服务商 API 基础地址（按需包含 /v1），也支持完整 /chat/completions 地址。</p>
      <label class="block text-sm">API Key<input v-model="draft.apiKey" type="password" placeholder="输入 API Key" autocomplete="off" /></label>
      <button class="bg-soft text-ink-soft rounded-xl px-4 py-2 text-sm" @click="run('models')">{{ busy === 'models' ? '获取中…' : '获取模型' }}</button>
      <label v-if="draft.models.length" class="block text-sm">可用模型<select v-model="draft.model"><option v-for="model in draft.models" :key="model" :value="model">{{ model }}</option></select></label>
      <label class="block text-sm">模型名称<input v-model="draft.model" placeholder="也可手动输入模型名称" autocapitalize="off" spellcheck="false" /></label>
      <div class="flex gap-2">
        <button class="flex-1 btn-primary rounded-xl py-2 text-sm" @click="save">保存并启用</button>
        <button class="flex-1 bg-soft rounded-xl py-2 text-sm" @click="run('test')">{{ busy === 'test' ? '测试中…' : '测试连接' }}</button>
      </div>
      <div class="flex justify-between text-sm"><button @click="add" class="text-dai">新增配置</button><button v-if="draft.id" @click="remove" class="text-zhuhong">删除此配置</button></div>
    </fieldset>
    <p v-if="message" role="status" class="text-sm break-words" :class="failed ? 'text-zhuhong' : 'text-bamboo'">{{ message }}</p>
    <p class="text-xs text-ink-mute">配置保存在此浏览器；密钥仅随请求发送到你填写的 API 地址。测试会发起一次简短请求，可能产生少量费用。</p>
  </section>
</template>

<style scoped>
input, select { display: block; width: 100%; min-width: 0; margin-top: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
input:focus, select:focus { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
fieldset:disabled { opacity: .65; }
</style>

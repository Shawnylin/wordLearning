<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { reactive, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { apiEndpoint, fetchModels, testConnection } from '../api/deepseek'
import ApiKeyInput from './ApiKeyInput.vue'

const settings = useSettingsStore()
const draft = reactive({ id: '', name: '', apiKey: '', baseUrl: '', model: '', models: [] as string[] })
const busy = ref('')
const message = ref('')
const failed = ref(false)
const editing = ref(false)
function load() {
  const profile = settings.profiles.find(p => p.id === settings.activeProfileId)
  Object.assign(draft, profile ? { ...profile, models: [...profile.models] } : { ...settings.apiConfig, id: '', name: 'DeepSeek', models: [] })
  editing.value = !profile
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
  editing.value = true
  message.value = ''
}
function edit() { editing.value = true; message.value = '' }
function cancelEdit() { load() }
function persistModel(text = '模型已切换') {
  if (!draft.id) return
  const profile = settings.profiles.find(p => p.id === draft.id)
  if (!profile) return
  settings.saveProfile({ ...profile, model: draft.model, models: [...draft.models] })
  failed.value = false
  message.value = text
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
      if (!editing.value && draft.id) persistModel(`已获取 ${draft.models.length} 个模型，当前为 ${draft.model}`)
      else message.value = `已获取 ${draft.models.length} 个模型`
    } else message.value = await testConnection(config)
  } catch (error) {
    failed.value = true
    message.value = error instanceof Error ? error.message : '请求失败'
  } finally { busy.value = '' }
}
function save() {
  try {
    apiEndpoint(draft.baseUrl, 'models')
    if (!draft.apiKey.trim() || !draft.model.trim()) throw new Error('请填写 API Key 和模型')
    settings.saveProfile({ ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim() || draft.model.trim(), apiKey: draft.apiKey.trim(), baseUrl: draft.baseUrl.trim(), model: draft.model.trim(), models: [...draft.models] })
    draft.id = settings.activeProfileId
    editing.value = false
    failed.value = false
    message.value = '已保存并启用'
  } catch (error) { failed.value = true; message.value = (error as Error).message }
}
function remove() { settings.deleteProfile(draft.id); load() }
</script>

<template>
  <section class="card settings-card model-settings">
    <header class="settings-card-header"><h2 class="settings-title">学习模型</h2></header>
    <Motion><label v-if="settings.profiles.length" class="settings-label">配置
      <select :value="settings.activeProfileId" @change="select" :disabled="!!busy"><option v-for="p in settings.profiles" :key="p.id" :value="p.id">{{ p.name }} · {{ p.model }}</option></select>
    </label></Motion>
    <div v-if="!editing && draft.id" class="settings-summary" aria-label="当前配置详情">
      <div class="settings-summary-row"><span>名称</span><strong>{{ draft.name }}</strong></div>
      <div class="settings-summary-row"><span>API 地址</span><strong class="break-all">{{ draft.baseUrl }}</strong></div>
      <div class="settings-summary-key"><span>API Key</span><ApiKeyInput v-model="draft.apiKey" readonly /></div>
    </div>

    <fieldset v-if="editing" :disabled="!!busy" class="settings-form">
      <label class="settings-label">名称<input v-model="draft.name" placeholder="例如：DeepSeek" /></label>
      <label class="settings-label">API 地址<input v-model="draft.baseUrl" type="url" placeholder="https://api.deepseek.com" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
      <label class="settings-label">API Key<ApiKeyInput v-model="draft.apiKey" /></label>
      <label class="settings-label">模型<input v-model="draft.model" placeholder="选择或输入模型" autocapitalize="off" spellcheck="false" /></label>
      <div class="settings-actions">
        <button class="btn-primary" @click="save">保存并启用</button>
        <button v-if="draft.id" class="settings-secondary" @click="cancelEdit">取消</button>
        <button v-else class="settings-secondary" @click="run('test')">{{ busy === 'test' ? '测试中…' : '测试连接' }}</button>
      </div>
      <div class="settings-text-actions"><button v-if="draft.id" @click="remove" class="text-zhuhong">删除此配置</button></div>
    </fieldset>

    <div v-if="!editing || draft.id" class="settings-model-picker">
      <div class="settings-model-picker-head"><span>模型</span><button class="settings-text-button" :disabled="!!busy" @click="run('models')">{{ busy === 'models' ? '获取中…' : '获取列表' }}</button></div>
      <select v-if="draft.models.length" v-model="draft.model" :disabled="!!busy" @change="!editing && persistModel()"><option v-for="model in draft.models" :key="model" :value="model">{{ model }}</option></select>
      <p v-else class="settings-model-current break-all">{{ draft.model }}<span>未获取列表</span></p>
    </div>

    <div v-if="!editing && draft.id" class="settings-actions">
      <button class="btn-primary" @click="edit">编辑</button>
      <button class="settings-secondary" :disabled="!!busy" @click="run('test')">{{ busy === 'test' ? '测试中…' : '测试连接' }}</button>
    </div>
    <div v-if="!editing" class="settings-text-actions"><button @click="add" class="text-dai">新增</button></div>
    <Motion><p v-if="message" role="status" class="settings-status break-words" :class="failed ? 'text-zhuhong' : 'text-bamboo'">{{ message }}</p></Motion>
    <p class="settings-footnote">配置仅保存在本机；密钥只发送至所填地址。测试可能产生费用。</p>
  </section>
</template>

<style scoped>
input, select { display: block; width: 100%; min-width: 0; margin-top: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
input:focus, select:focus { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
fieldset:disabled { opacity: .65; }
@media (min-width: 768px) {
  input, select { margin-top: 4px; padding: 9px 11px; font-size: 15px; }
}
</style>

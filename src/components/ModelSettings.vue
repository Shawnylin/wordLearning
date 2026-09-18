<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { reactive, ref, watch } from 'vue'
import { Bot, Pencil, Plus, Trash2 } from 'lucide-vue-next'
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
function selectProvider(id: string) {
  settings.selectProfile(id)
  load()
}
function editProfile(id: string) {
  settings.selectProfile(id)
  load()
  editing.value = true
}
function add() {
  Object.assign(draft, { id: '', name: '', apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', models: [] })
  editing.value = true
  message.value = ''
}
function cancelEdit() { load() }
function closeEditor() {
  if (draft.id) cancelEdit()
  else { editing.value = false; message.value = '' }
}
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
function removeProfile(id: string) {
  settings.deleteProfile(id)
  if (draft.id === id || !settings.profiles.length) load()
}
</script>

<template>
  <section class="card settings-card model-settings">
    <header class="settings-card-header">
      <div>
        <p class="settings-overline">服务商</p>
        <h2 class="settings-title">模型</h2>
        <p class="settings-description">配置可用于学习、PDF 和语音功能的模型服务商</p>
      </div>
      <button class="settings-icon-button settings-add-button" type="button" aria-label="添加模型服务商" @click="add"><Plus :size="18" /></button>
    </header>

    <div v-if="settings.profiles.length" class="settings-provider-list" aria-label="模型服务商列表">
      <div v-for="profile in settings.profiles" :key="profile.id" class="settings-provider-row">
        <button class="settings-provider-main" type="button" @click="selectProvider(profile.id)">
          <span class="settings-provider-icon"><Bot :size="17" /></span>
          <span class="settings-provider-copy"><strong>{{ profile.name || profile.model }}</strong><small class="break-all">{{ profile.baseUrl }}</small></span>
          <span v-if="profile.id === settings.activeProfileId" class="settings-provider-state">使用中</span>
        </button>
        <div class="settings-provider-actions">
          <button class="settings-row-icon" type="button" aria-label="编辑模型服务商" @click="editProfile(profile.id)"><Pencil :size="16" /></button>
          <button class="settings-row-icon settings-row-icon-danger" type="button" aria-label="删除模型服务商" @click="removeProfile(profile.id)"><Trash2 :size="16" /></button>
        </div>
      </div>
    </div>
    <div v-else class="settings-empty-row">
      <span class="settings-provider-icon"><Bot :size="17" /></span>
      <span>还没有模型服务商，请点击右上角添加</span>
    </div>

    <div v-if="editing" class="settings-editor">
      <div class="settings-editor-heading"><strong>{{ draft.id ? '编辑服务商' : '添加服务商' }}</strong><button class="settings-text-button" type="button" @click="closeEditor">取消</button></div>
      <fieldset :disabled="!!busy" class="settings-form">
        <label class="settings-label">名称<input v-model="draft.name" placeholder="例如：DeepSeek" /></label>
        <label class="settings-label">API 地址<input v-model="draft.baseUrl" type="url" placeholder="https://api.deepseek.com" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
        <label class="settings-label">API Key<ApiKeyInput v-model="draft.apiKey" /></label>
        <label class="settings-label">模型<input v-model="draft.model" placeholder="选择或输入模型" autocapitalize="off" spellcheck="false" /></label>
        <div class="settings-actions">
          <button class="btn-primary" type="button" @click="save">保存并启用</button>
          <button v-if="draft.id" class="settings-secondary" type="button" @click="remove">删除此配置</button>
          <button v-else class="settings-secondary" type="button" @click="run('test')">{{ busy === 'test' ? '测试中…' : '测试连接' }}</button>
        </div>
      </fieldset>
    </div>

    <div v-if="editing || draft.id" class="settings-model-picker">
      <div class="settings-model-picker-head"><span>模型</span><button class="settings-text-button" :disabled="!!busy" @click="run('models')">{{ busy === 'models' ? '获取中…' : '获取列表' }}</button></div>
      <select v-if="draft.models.length" v-model="draft.model" :disabled="!!busy" @change="!editing && persistModel()"><option v-for="model in draft.models" :key="model" :value="model">{{ model }}</option></select>
      <p v-else class="settings-model-current break-all">{{ draft.model }}<span>未获取列表</span></p>
    </div>
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

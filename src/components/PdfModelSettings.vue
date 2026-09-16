<script setup lang="ts">
import { reactive, ref } from 'vue'
import { apiEndpoint, fetchModels, testConnection } from '../api/deepseek'
import { useSettingsStore } from '../stores/settings'
import ApiKeyInput from './ApiKeyInput.vue'
import LiquidToggle from './LiquidToggle.vue'
const settings = useSettingsStore()
const draft = reactive({ ...settings.pdfConfig })
const models = ref<string[]>([]), busy = ref(false), message = ref(''), error = ref(false)
const editing = ref(!settings.pdfUseLearningModel && !settings.pdfConfig.apiKey)
const draftUseLearningModel = ref(settings.pdfUseLearningModel)
async function run(action: 'models' | 'test' | 'save') {
  busy.value = true; message.value = ''; error.value = false
  try {
    const config = { ...draft, thinkingEnabled: false }
    if (action === 'models') { models.value = await fetchModels(config); message.value = '已获取模型，请选择后保存' }
    else if (action === 'test') message.value = await testConnection(config)
    else {
      if (draftUseLearningModel.value) {
        settings.pdfUseLearningModel = true
        editing.value = false
        message.value = 'PDF 解析已改用当前学习模型'
        return
      }
      apiEndpoint(config.baseUrl, 'chat/completions')
      if (!config.apiKey.trim() || !config.model.trim()) throw new Error('请填写解析 API Key 与模型名称')
      settings.pdfConfig = { ...config, apiKey: config.apiKey.trim(), model: config.model.trim(), baseUrl: config.baseUrl.trim() }
      settings.pdfUseLearningModel = false
      editing.value = false
      message.value = '解析配置已保存；查词仍使用学习模型'
    }
  } catch (e) { error.value = true; message.value = (e as Error).message }
  finally { busy.value = false }
}
function edit() { editing.value = true; message.value = '' }
function cancelEdit() {
  Object.assign(draft, settings.pdfConfig)
  draftUseLearningModel.value = settings.pdfUseLearningModel
  editing.value = false
  message.value = ''
}
</script>
<template>
  <section class="card settings-card pdf-model-settings">
    <header class="settings-card-header"><div><h2 class="settings-title">PDF 解析模型</h2><p class="settings-description">只负责报纸分篇和排序，不重写正文</p></div></header>
    <div v-if="!editing" class="settings-summary" aria-label="当前 PDF 解析配置">
      <div class="settings-summary-row"><span>使用方式</span><strong>{{ settings.pdfUseLearningModel ? '当前学习模型' : '独立解析模型' }}</strong></div>
      <template v-if="!settings.pdfUseLearningModel">
        <div class="settings-summary-row"><span>API 地址</span><strong class="break-all">{{ draft.baseUrl }}</strong></div>
        <div class="settings-summary-key"><span>API Key</span><ApiKeyInput v-model="draft.apiKey" readonly /></div>
        <div class="settings-summary-row"><span>模型名称</span><strong class="break-all">{{ draft.model }}</strong></div>
      </template>
    </div>
    <template v-if="editing">
    <div class="settings-switch"><LiquidToggle v-model="draftUseLearningModel" label="使用当前学习模型" /><span>使用当前学习模型</span></div>
    <fieldset :disabled="busy || draftUseLearningModel" class="settings-form" :class="{ 'settings-form-muted': draftUseLearningModel }">
      <label class="settings-label">API 地址<input v-model="draft.baseUrl" type="url" autocomplete="off" spellcheck="false" /></label>
      <label class="settings-label">API Key<ApiKeyInput v-model="draft.apiKey" placeholder="输入解析 API Key" /></label>
      <div class="settings-inline"><button @click="run('models')" class="settings-secondary">获取模型列表</button></div>
      <label v-if="models.length" class="settings-label">可用模型<select v-model="draft.model"><option v-for="model in models" :key="model">{{ model }}</option></select></label>
      <label class="settings-label">模型名称<input v-model="draft.model" placeholder="获取后选择，或手动输入" spellcheck="false" /></label>
    </fieldset>
    <div class="settings-actions"><button @click="run('save')" class="btn-primary">保存配置</button><button v-if="settings.pdfConfig.apiKey || settings.pdfUseLearningModel" @click="cancelEdit" class="settings-secondary">取消编辑</button><button v-else :disabled="draftUseLearningModel" @click="run('test')" class="settings-secondary">测试连接</button></div>
    </template>
    <div v-else class="settings-actions"><button class="btn-primary" @click="edit">编辑配置</button><button v-if="!settings.pdfUseLearningModel" class="settings-secondary" :disabled="busy" @click="run('test')">{{ busy ? '测试中…' : '测试连接' }}</button></div>
    <p v-if="message" role="status" class="settings-status break-words" :class="error ? 'text-zhuhong' : 'text-bamboo'">{{ message }}</p>
    <p class="settings-footnote">独立配置仅在关闭“使用当前学习模型”时生效。分篇默认关闭深度思考。</p>
  </section>
</template>
<style scoped>
input:not([type=checkbox]),select { display:block; width:100%; min-width:0; margin-top:6px; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--soft); color:var(--ink); font-size:16px; }
input:focus-visible,select:focus-visible { outline:2px solid var(--zhuhong); outline-offset:2px; }
fieldset:disabled { opacity:.65; }
@media (min-width:768px) { input:not([type=checkbox]),select { margin-top:4px; padding:9px 11px; font-size:15px; } }
</style>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { apiEndpoint, fetchModels, testConnection } from '../api/deepseek'
import { useSettingsStore } from '../stores/settings'
const settings = useSettingsStore()
const draft = reactive({ ...settings.pdfConfig })
const models = ref<string[]>([]), busy = ref(false), message = ref(''), error = ref(false)
async function run(action: 'models' | 'test' | 'save') {
  busy.value = true; message.value = ''; error.value = false
  try {
    const config = { ...draft, thinkingEnabled: false }
    if (action === 'models') { models.value = await fetchModels(config); message.value = '已获取模型，请选择后保存' }
    else if (action === 'test') message.value = await testConnection(config)
    else {
      apiEndpoint(config.baseUrl, 'chat/completions')
      if (!config.apiKey.trim() || !config.model.trim()) throw new Error('请填写解析 API Key 与模型名称')
      settings.pdfConfig = { ...config, apiKey: config.apiKey.trim(), model: config.model.trim(), baseUrl: config.baseUrl.trim() }
      settings.pdfUseLearningModel = false
      message.value = '解析配置已保存；查词仍使用学习模型'
    }
  } catch (e) { error.value = true; message.value = (e as Error).message }
  finally { busy.value = false }
}
</script>
<template>
  <section class="card rounded-2xl p-5 space-y-3 pdf-model-settings">
    <h3 class="font-semibold">PDF 解析模型</h3>
    <p class="text-xs text-ink-mute leading-6">只负责报纸分篇和排序，不重写正文。查词、释义和对比继续使用上方学习模型。可配置 MiMo 等兼容 Chat Completions 的服务。</p>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settings.pdfUseLearningModel" />PDF 也使用当前学习模型（{{ settings.model }}）</label>
    <fieldset :disabled="busy" class="space-y-3">
      <label class="block text-sm">解析 API URL<input v-model="draft.baseUrl" type="url" autocomplete="off" spellcheck="false" /></label>
      <label class="block text-sm">解析 API Key<input v-model="draft.apiKey" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
      <button @click="run('models')" class="bg-soft rounded-xl px-4 py-2 text-sm">获取解析模型</button>
      <label v-if="models.length" class="block text-sm">可用解析模型<select v-model="draft.model"><option v-for="model in models" :key="model">{{ model }}</option></select></label>
      <label class="block text-sm">解析模型名称<input v-model="draft.model" placeholder="获取模型后选择，或手动输入" spellcheck="false" /></label>
      <div class="flex gap-2"><button @click="run('save')" class="btn-primary flex-1 rounded-xl py-2 text-sm">保存解析配置</button><button @click="run('test')" class="bg-soft flex-1 rounded-xl py-2 text-sm">测试解析连接</button></div>
    </fieldset>
    <p v-if="message" role="status" class="text-sm break-words" :class="error ? 'text-zhuhong' : 'text-bamboo'">{{ message }}</p>
    <p class="text-xs leading-6 text-ink-mute">密钥保存在此浏览器，仅发往对应 API。测试会产生少量费用。分篇默认关闭深度思考；实际计费以服务商为准。</p>
  </section>
</template>
<style scoped>
input:not([type=checkbox]),select { display:block; width:100%; min-width:0; margin-top:6px; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--soft); color:var(--ink); font-size:16px; }
input:focus-visible,select:focus-visible { outline:2px solid var(--zhuhong); outline-offset:2px; }
fieldset:disabled { opacity:.65; }
@media (min-width:768px) { input:not([type=checkbox]),select { margin-top:4px; padding:9px 11px; } }
</style>

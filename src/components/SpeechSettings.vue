<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Volume2 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { defaultSpeechConfig, speechEndpoint } from '../api/speech'
import { useSpeech } from '../composables/useSpeech'
import SpeechButton from './SpeechButton.vue'

const settings = useSettingsStore()
const draft = ref({ ...defaultSpeechConfig, ...settings.speechConfig })
const message = ref('')
watch(draft, () => { message.value = '' }, { deep: true })
onMounted(() => { if (location.hash.endsWith('#speech')) document.getElementById('speech')?.scrollIntoView() })
function save() {
  try {
    speechEndpoint({ ...draft.value, apiKey: draft.value.apiKey.trim() || 'validate' })
    useSpeech().stop()
    settings.speechConfig = { apiKey: draft.value.apiKey.trim(), baseUrl: draft.value.baseUrl.trim().replace(/\/+$/, ''), model: draft.value.model.trim(), voice: draft.value.voice.trim() }
    message.value = settings.speechConfig.apiKey ? '朗读设置已保存' : '已清除朗读密钥'
  } catch (error) { message.value = error instanceof Error ? error.message : '保存失败' }
}
</script>

<template>
  <section id="speech" class="card rounded-2xl p-5 mt-4 space-y-4">
    <h2 class="flex items-center gap-2 font-semibold"><Volume2 :size="20" />小米 MiMo 朗读</h2>
    <p class="text-xs text-ink-mute leading-6">用于词语发音和日报阅读。密钥仅保存在此浏览器，独立于学习模型配置。官方当前为限时免费，额度和价格以平台为准。</p>
    <form @submit.prevent="save" class="space-y-3">
      <label class="block text-sm">API 地址<input v-model="draft.baseUrl" type="url" required placeholder="https://api.xiaomimimo.com/v1" /></label>
      <label class="block text-sm">API Key<input v-model="draft.apiKey" type="password" autocomplete="off" placeholder="填写小米 MiMo API Key" /></label>
      <label class="block text-sm">语音模型<input v-model="draft.model" required placeholder="mimo-v2.5-tts" /></label>
      <label class="block text-sm">音色<select v-model="draft.voice"><option value="mimo_default">默认音色</option><option v-for="voice in ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean']" :key="voice" :value="voice">{{ voice }}</option></select></label>
      <div class="flex items-center justify-between gap-3"><button type="submit" class="btn-primary rounded-full px-5 py-2 text-sm">保存设置</button><SpeechButton text="学而时习之，不亦说乎。欢迎使用词语朗读。" label="试听配置" :config="draft" show-label /></div>
      <p v-if="message" role="status" class="text-xs text-zhuhong">{{ message }}</p>
    </form>
    <a href="https://mimo.mi.com" target="_blank" rel="noopener noreferrer" class="inline-block text-xs text-zhuhong underline">前往小米 MiMo 开放平台获取密钥</a>
  </section>
</template>

<style scoped>
input,select { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 14px; }
</style>

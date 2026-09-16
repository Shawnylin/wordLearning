<script setup lang="ts">
import { useRouter } from 'vue-router'
import ModelSettings from '../components/ModelSettings.vue'
import SpeechSettings from '../components/SpeechSettings.vue'
import PdfModelSettings from '../components/PdfModelSettings.vue'
const router = useRouter()
</script>
<template>
  <div class="min-h-screen px-4 pt-3 pb-5 settings-page">
    <div class="mx-auto max-w-6xl">
      <header class="settings-page-header"><button @click="router.push('/profile')" class="settings-back">← 返回个人</button><div><h1>模型与 API</h1><p>管理学习、朗读和 PDF 解析服务</p></div></header>
      <div class="settings-grid">
        <ModelSettings />
        <div class="settings-side">
          <SpeechSettings />
          <PdfModelSettings />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page-header { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.settings-page-header h1 { color:var(--ink); font-size:20px; font-weight:650; line-height:1.3; }
.settings-page-header p { margin-top:2px; color:var(--ink-mute); font-size:12px; line-height:1.5; }
.settings-back { flex:none; padding:8px 10px; border-radius:10px; color:var(--ink-soft); font-size:13px; }
.settings-back:hover { background:var(--soft); }
.settings-grid,.settings-side { display:grid; gap:14px; }
.settings-grid :deep(.settings-card) { display:grid; gap:14px; padding:18px; border-radius:20px; }
.settings-grid :deep(.settings-card-header) { display:flex; min-width:0; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--line); }
.settings-grid :deep(.settings-title) { color:var(--ink); font-size:15px; font-weight:650; line-height:1.4; }
.settings-grid :deep(.settings-description) { margin-top:3px; color:var(--ink-mute); font-size:12px; line-height:1.55; }
.settings-grid :deep(.settings-badge) { max-width:48%; padding:4px 8px; border-radius:999px; background:var(--soft); color:var(--ink-mute); font-size:10px; line-height:1.35; text-align:right; }
.settings-grid :deep(.settings-form) { display:grid; gap:12px; }
.settings-grid :deep(.settings-label) { display:block; color:var(--ink-soft); font-size:12px; font-weight:550; line-height:1.45; }
.settings-grid :deep(.settings-help) { display:block; margin-top:5px; color:var(--ink-mute); font-size:10.5px; font-weight:400; line-height:1.55; }
.settings-grid :deep(.settings-pair) { display:grid; grid-template-columns:minmax(0,1fr) minmax(120px,.58fr); gap:10px; }
.settings-grid :deep(.settings-inline) { display:flex; justify-content:flex-start; }
.settings-grid :deep(.settings-actions) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding-top:2px; }
.settings-grid :deep(.settings-actions > button),.settings-grid :deep(.settings-actions .speech-button) { min-height:38px; border-radius:11px; padding:8px 12px; font-size:12px; }
.settings-grid :deep(.settings-actions .speech-control),.settings-grid :deep(.settings-actions .speech-button) { width:100%; }
.settings-grid :deep(.settings-secondary) { border-radius:10px; padding:8px 12px; background:var(--soft); color:var(--ink-soft); font-size:12px; }
.settings-grid :deep(.settings-text-actions) { display:flex; justify-content:space-between; font-size:11.5px; }
.settings-grid :deep(.settings-status) { padding:8px 10px; border-radius:10px; background:var(--soft); font-size:11px; line-height:1.55; }
.settings-grid :deep(.settings-footnote) { color:var(--ink-mute); font-size:10.5px; line-height:1.65; }
.settings-grid :deep(.settings-switch) { display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:11px; background:var(--soft); color:var(--ink-soft); font-size:12px; }
.settings-grid :deep(.settings-switch input) { accent-color:var(--zhuhong); }
.settings-grid :deep(.settings-form-muted) { opacity:.72; }
@media (min-width:768px) {
  .settings-page { padding-inline:24px; }
  .settings-grid { grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr); align-items:start; }
  .settings-page-header { margin-bottom:16px; }
}
@media (min-width:1180px) { .settings-grid { grid-template-columns:minmax(0,1fr) minmax(420px,.82fr); gap:20px; } }
</style>

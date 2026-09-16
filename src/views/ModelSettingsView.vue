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
      <button @click="router.push('/profile')" class="text-sm text-ink-soft px-2 py-2 mb-2">← 返回个人</button>
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
.settings-grid,.settings-side { display:grid; gap:16px; }
@media (min-width:768px) {
  .settings-page { padding-inline:24px; }
  .settings-grid { grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr); align-items:start; }
  .settings-side { gap:14px; }
}
@media (min-width:1180px) { .settings-grid { grid-template-columns:minmax(0,1fr) minmax(420px,.82fr); gap:20px; } }
</style>

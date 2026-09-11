<script setup lang="ts">
import { useRouter } from 'vue-router'
import ModelSettings from '../components/ModelSettings.vue'
const router = useRouter()
</script>
<template>
  <div class="min-h-screen px-4 pt-4 pb-4">
    <div class="mx-auto max-w-lg">
      <button @click="router.push('/profile')" class="text-sm text-ink-soft px-2 py-3 mb-2">← 返回个人</button>
      <ModelSettings />
    </div>
  </div>
</template>

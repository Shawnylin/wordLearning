<script setup lang="ts">
import ReportView from './ReportView.vue'
import { Settings } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="px-4 pt-6 pb-4">
    <div class="mx-auto max-w-lg space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="font-kai text-3xl">个人</h1>
        <button @click="router.push('/profile/settings')" aria-label="打开设置" class="w-11 h-11 rounded-full card flex items-center justify-center"><Settings :size="20" /></button>
      </header>
      <ReportView />
    </div>
  </div>
</template>

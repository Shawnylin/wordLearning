<script setup lang="ts">
import ReportView from './ReportView.vue'
import ProfileSettingsView from './ProfileSettingsView.vue'
import AuthPanel from '../components/AuthPanel.vue'
</script>

<template>
  <div class="px-4 pt-6 pb-4">
    <div class="mx-auto max-w-lg space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="font-kai text-3xl">个人</h1>
      </header>
      <AuthPanel />
      <ReportView />
      <ProfileSettingsView embedded />
    </div>
  </div>
</template>

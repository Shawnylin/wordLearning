<script setup lang="ts">
import ProfileSettingsView from './ProfileSettingsView.vue'
import AuthPanel from '../components/AuthPanel.vue'
import CloudSyncPanel from '../components/CloudSyncPanel.vue'
</script>

<template>
  <div class="profile-page px-4 pb-5 pt-5 sm:pt-7">
    <div class="profile-shell mx-auto">
      <header class="profile-title-row">
        <div>
          <h1 class="font-kai text-[2rem] leading-none tracking-wide text-ink">个人</h1>
        </div>
      </header>

      <section class="profile-section profile-identity-card" aria-label="个人信息">
        <AuthPanel compact />
      </section>

      <section class="profile-section profile-sync-card" aria-label="云同步">
        <CloudSyncPanel compact />
      </section>

      <ProfileSettingsView embedded />
    </div>
  </div>
</template>

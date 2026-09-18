<script setup lang="ts">
import { FileText, History } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ReportView from './ReportView.vue'
import ProfileSettingsView from './ProfileSettingsView.vue'
import AuthPanel from '../components/AuthPanel.vue'
import CloudSyncPanel from '../components/CloudSyncPanel.vue'

const router = useRouter()

function go(path: string) {
  void router.push(path)
}
</script>

<template>
  <div class="profile-page px-4 pb-5 pt-5 sm:pt-7">
    <div class="profile-shell mx-auto max-w-lg">
      <header class="profile-title-row">
        <div>
          <p class="profile-eyebrow">MY SPACE</p>
          <h1 class="font-kai text-[2rem] leading-none tracking-wide text-ink">个人</h1>
        </div>
        <FileText :size="18" class="text-ink-mute" aria-hidden="true" />
      </header>

      <AuthPanel compact />

      <section class="profile-section" aria-labelledby="profile-learning-title">
        <div class="profile-section-heading">
          <h2 id="profile-learning-title">学习与记录</h2>
        </div>
        <ReportView compact />
        <button class="profile-list-row" type="button" @click="go('/record')">
          <span class="profile-row-icon"><History :size="18" /></span>
          <span class="profile-row-main"><span class="profile-row-title">词语记录</span><span class="profile-row-caption">查看已生成内容</span></span>
          <span class="profile-row-value">查看</span>
          <span class="profile-row-chevron" aria-hidden="true">›</span>
        </button>
      </section>

      <section class="profile-section" aria-labelledby="profile-account-title">
        <div class="profile-section-heading">
          <h2 id="profile-account-title">账户与同步</h2>
        </div>
        <CloudSyncPanel compact />
      </section>

      <ProfileSettingsView embedded />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useThemeStore } from './stores/theme'
import { useAppUpdateStore } from './stores/appUpdate'
import { useAuthStore } from './stores/auth'
import { useCloudSyncStore } from './stores/cloudSync'
import BottomNav from './components/BottomNav.vue'
import AppUpdatePrompt from './components/AppUpdatePrompt.vue'
import CloudSyncPrompt from './components/CloudSyncPrompt.vue'

const themeStore = useThemeStore()
const appUpdate = useAppUpdateStore()
const authStore = useAuthStore()
const cloudSync = useCloudSyncStore()
const navCollapsed = ref(false)
try { navCollapsed.value = localStorage.getItem('word-learning-nav-collapsed') === 'true' } catch {}
watch(navCollapsed, value => {
  try { localStorage.setItem('word-learning-nav-collapsed', String(value)) } catch {}
})
const handleForeground = () => {
  appUpdate.checkOnForeground()
  cloudSync.handleForeground('foreground')
}
const handleResume = () => {
  appUpdate.checkOnForeground()
  cloudSync.handleForeground('resume')
}
const handleVisibilityChange = () => {
  appUpdate.checkOnForeground()
  if (document.hidden) cloudSync.handleBackground()
  else cloudSync.handleForeground('resume')
}
const handleOnline = () => {
  appUpdate.checkOnForeground()
  cloudSync.handleForeground('online')
}
const resetPageScroll = () => {
  document.getElementById('app')?.scrollTo({ top: 0, behavior: 'instant' })
}

// 同步初始化，避免闪烁
themeStore.initTheme()

onMounted(() => {
  themeStore.watchSystemTheme()
  void authStore.initialize()
  appUpdate.initialize()
  window.addEventListener('focus', handleForeground)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pageshow', handleResume)
  window.addEventListener('online', handleOnline)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleForeground)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('pageshow', handleResume)
  window.removeEventListener('online', handleOnline)
})
</script>

<template>
  <div class="app-shell min-h-screen bg-paper text-ink transition-colors duration-300" :class="{ 'nav-collapsed': navCollapsed }">
    <main class="app-main pb-safe">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in" @after-enter="resetPageScroll">
          <KeepAlive include="LearnView,DailyView">
            <component :is="Component" />
          </KeepAlive>
        </transition>
      </router-view>
    </main>
    <BottomNav :collapsed="navCollapsed" @toggle="navCollapsed = !navCollapsed" />
    <AppUpdatePrompt />
    <CloudSyncPrompt />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useThemeStore } from './stores/theme'
import { useAppUpdateStore } from './stores/appUpdate'
import BottomNav from './components/BottomNav.vue'
import AppUpdatePrompt from './components/AppUpdatePrompt.vue'

const themeStore = useThemeStore()
const appUpdate = useAppUpdateStore()
const handleForeground = () => appUpdate.checkOnForeground()

// 同步初始化，避免闪烁
themeStore.initTheme()

onMounted(() => {
  themeStore.watchSystemTheme()
  appUpdate.initialize()
  window.addEventListener('focus', handleForeground)
  document.addEventListener('visibilitychange', handleForeground)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleForeground)
  document.removeEventListener('visibilitychange', handleForeground)
})
</script>

<template>
  <div class="min-h-screen bg-paper text-ink transition-colors duration-300">
    <main class="pb-safe">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <KeepAlive include="LearnView,CompareView,DailyView">
            <component :is="Component" />
          </KeepAlive>
        </transition>
      </router-view>
    </main>
    <BottomNav />
    <AppUpdatePrompt />
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

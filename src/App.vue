<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useThemeStore } from './stores/theme'
import { useAppUpdateStore } from './stores/appUpdate'
import BottomNav from './components/BottomNav.vue'
import AppUpdatePrompt from './components/AppUpdatePrompt.vue'

const themeStore = useThemeStore()
const appUpdate = useAppUpdateStore()
const navCollapsed = ref(false)
try { navCollapsed.value = localStorage.getItem('word-learning-nav-collapsed') === 'true' } catch {}
watch(navCollapsed, value => {
  try { localStorage.setItem('word-learning-nav-collapsed', String(value)) } catch {}
})
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
  <div class="app-shell min-h-screen bg-paper text-ink transition-colors duration-300" :class="{ 'nav-collapsed': navCollapsed }">
    <main class="app-main pb-safe">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <KeepAlive include="LearnView,CompareView,DailyView">
            <component :is="Component" />
          </KeepAlive>
        </transition>
      </router-view>
    </main>
    <BottomNav :collapsed="navCollapsed" @toggle="navCollapsed = !navCollapsed" />
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

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, History, User } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

interface NavItem {
  name: string
  label: string
  icon: typeof BookOpen
  path: string
}

const navItems: NavItem[] = [
  { name: 'learn', label: '学习', icon: BookOpen, path: '/learn' },
  { name: 'record', label: '记录', icon: History, path: '/record' },
  { name: 'profile', label: '个人', icon: User, path: '/profile' }
]

const activeIndex = computed(() => {
  const index = navItems.findIndex(item => item.name === route.name)
  return index >= 0 ? index : 0
})

const itemPercent = computed(() => 100 / navItems.length)

function navigateTo(item: NavItem) {
  router.push(item.path)
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
    <div class="mx-auto max-w-md px-4 pb-2 pt-1">
      <div class="relative flex items-center justify-around rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-1.5 overflow-hidden">
        <!-- Animated indicator -->
        <div
          class="nav-indicator absolute top-1.5 bottom-1.5 rounded-full bg-red-700/10 dark:bg-red-500/15"
          :style="{
            width: `${itemPercent}%`,
            left: `${activeIndex * itemPercent}%`
          }"
        />

        <!-- Nav items -->
        <button
          v-for="(item, index) in navItems"
          :key="item.name"
          @click="navigateTo(item)"
          class="relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors duration-200"
          :class="activeIndex === index ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'"
        >
          <component
            :is="item.icon"
            :size="20"
            :stroke-width="activeIndex === index ? 2.5 : 2"
          />
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

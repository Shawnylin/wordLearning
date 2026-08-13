<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, GitCompare, History, BarChart3, User } from 'lucide-vue-next'

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
  { name: 'compare', label: '对比', icon: GitCompare, path: '/compare' },
  { name: 'report', label: '报告', icon: BarChart3, path: '/report' },
  { name: 'record', label: '记录', icon: History, path: '/record' },
  { name: 'profile', label: '个人', icon: User, path: '/profile' }
]

const activeIndex = computed(() => {
  // 复习页归属「报告」分组，保持高亮
  if (route.name === 'review') return navItems.findIndex(item => item.name === 'report')
  const index = navItems.findIndex(item => item.name === route.name)
  return index >= 0 ? index : 0
})

const count = navItems.length

// 指示器定位：绝对定位的百分比相对容器的 padding-box（不含 1px 边框），
// 而按钮平分的是内容区（padding-box 减去两侧 p-1.5 = 6px 内边距）。
// 因此按“100% - 12px”均分、偏移 6px，指示器才能与每个 flex-1 按钮严格同心。
const indicatorStyle = computed(() => ({
  width: `calc((100% - 12px) / ${count})`,
  left: `calc((100% - 12px) * ${activeIndex.value} / ${count} + 6px)`,
  transition: 'left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
}))

function navigateTo(item: NavItem) {
  router.push(item.path)
  document.getElementById('app')?.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50" style="padding-bottom: 34px">
    <div class="mx-auto max-w-md px-4 pt-1" style="padding-bottom: 4px">
      <div class="relative flex items-center rounded-full bg-card/95 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(42,36,28,0.4)] border border-line p-1.5">
        <!-- 印章滑动指示器 -->
        <div
          class="absolute top-1 bottom-1 rounded-full bg-zhuhong-solid shadow-[0_2px_8px_-2px_rgba(178,58,44,0.6)]"
          :style="indicatorStyle"
        />

        <!-- Nav items -->
        <button
          v-for="(item, index) in navItems"
          :key="item.name"
          @click="navigateTo(item)"
          class="relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors duration-300"
          :class="activeIndex === index ? 'text-paper-ink' : 'text-ink-mute'"
        >
          <component
            :is="item.icon"
            :size="20"
            :stroke-width="activeIndex === index ? 2.4 : 1.8"
          />
          <span class="text-[11px] font-medium tracking-wide">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

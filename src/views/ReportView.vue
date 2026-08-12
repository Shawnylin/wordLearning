<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import {
  BookOpen, Heart, GitCompare, Search, CalendarDays, Coins, Zap,
  TrendingUp, Hash, Clock, BarChart3
} from 'lucide-vue-next'

const router = useRouter()
const idiomStore = useIdiomStore()

// —— 基础统计 ——
const learnedCount = computed(() => Object.keys(idiomStore.idiomCache).length)
const favoriteCount = computed(() => idiomStore.favorites.length)
const searchWordCount = computed(() => idiomStore.searchHistory.length)
const compareCount = computed(() => idiomStore.compareHistory.length)
const totalTokens = computed(() => idiomStore.tokenStats.totalTokens)
const requestCount = computed(() => idiomStore.tokenStats.requestCount)

const hasData = computed(
  () => learnedCount.value > 0 || searchWordCount.value > 0 || compareCount.value > 0
)

// 某天 0 点的时间戳
function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// 活跃天数：搜索记录 + 对比记录涉及的不同日期
const activeDays = computed(() => {
  const days = new Set<number>()
  for (const r of idiomStore.searchHistory) days.add(startOfDay(r.timestamp))
  for (const r of idiomStore.compareHistory) days.add(startOfDay(r.createdAt))
  return days.size
})

// —— 7 日学习趋势 ——
interface TrendPoint {
  label: string
  count: number
  fullLabel: string
}

const weeklyTrend = computed<TrendPoint[]>(() => {
  const today = startOfDay(Date.now())
  const points: TrendPoint[] = []

  for (let i = 6; i >= 0; i--) {
    const dayStart = today - i * 24 * 60 * 60 * 1000
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    let count = 0

    for (const r of idiomStore.searchHistory) {
      if (r.timestamp >= dayStart && r.timestamp < dayEnd) count++
    }
    for (const r of idiomStore.compareHistory) {
      if (r.createdAt >= dayStart && r.createdAt < dayEnd) count++
    }

    const date = new Date(dayStart)
    const fullLabel = `${date.getMonth() + 1}/${date.getDate()}`
    const label = i === 0 ? '今天' : i === 1 ? '昨天' : fullLabel
    points.push({ label, count, fullLabel })
  }

  return points
})

const maxTrendCount = computed(() => {
  const max = Math.max(...weeklyTrend.value.map(p => p.count), 0)
  return max || 1
})

// 柱状图最大高度（像素）
const MAX_BAR_HEIGHT = 72

function barHeight(count: number): number {
  if (count <= 0) return 4
  return Math.max(8, Math.round((count / maxTrendCount.value) * MAX_BAR_HEIGHT))
}

// —— 词长分布 ——
interface LengthBucket {
  label: string
  count: number
  percent: number
}

const lengthDistribution = computed<LengthBucket[]>(() => {
  const buckets = [
    { label: '2 字', min: 2, max: 2, count: 0 },
    { label: '3 字', min: 3, max: 3, count: 0 },
    { label: '4 字', min: 4, max: 4, count: 0 },
    { label: '5 字及以上', min: 5, max: Infinity, count: 0 }
  ]

  for (const word of Object.keys(idiomStore.idiomCache)) {
    const len = word.length
    const bucket = buckets.find(b => len >= b.min && len <= b.max)
    if (bucket) bucket.count++
  }

  const total = learnedCount.value || 1
  return buckets.map(b => ({
    label: b.label,
    count: b.count,
    percent: Math.round((b.count / total) * 100)
  }))
})

// —— 最近学习 ——
const recentWords = computed(() => {
  return [...idiomStore.searchHistory]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5)
})

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function goLearn() {
  router.push('/learn')
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Header -->
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">学习报告</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">基于你的搜索数据自动生成</p>
    </div>

    <!-- Empty state -->
    <div v-if="!hasData" class="mx-auto max-w-lg text-center py-16">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <BarChart3 :size="32" class="text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        还没有学习数据，先去学习几个成语吧
      </p>
      <button
        @click="goLearn"
        class="mt-4 px-6 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
      >
        开始学习
      </button>
    </div>

    <div v-else class="mx-auto max-w-lg space-y-4">
      <!-- 总览卡片 -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-4 text-center">
          <div class="flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <BookOpen :size="18" />
          </div>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{{ learnedCount }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">已学词语</p>
        </div>
        <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-4 text-center">
          <div class="flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400">
            <Heart :size="18" fill="currentColor" />
          </div>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{{ favoriteCount }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">收藏</p>
        </div>
        <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-4 text-center">
          <div class="flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <GitCompare :size="18" />
          </div>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{{ compareCount }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">对比次数</p>
        </div>
      </div>

      <!-- 学习指标 -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-5">
        <div class="flex items-center gap-2 mb-4">
          <TrendingUp :size="16" class="text-gray-500 dark:text-gray-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">学习指标</h3>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
              <Search :size="16" />
            </div>
            <div>
              <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ searchWordCount }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">搜索词语</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CalendarDays :size="16" />
            </div>
            <div>
              <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ activeDays }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">活跃天数</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Coins :size="16" />
            </div>
            <div>
              <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ totalTokens.toLocaleString() }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Token 消耗</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 shrink-0">
              <Zap :size="16" />
            </div>
            <div>
              <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ requestCount }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">API 调用</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 7 日学习趋势 -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <BarChart3 :size="16" class="text-red-600 dark:text-red-400" />
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">7 日学习趋势</h3>
          </div>
          <span class="text-xs text-gray-400 dark:text-gray-500">近 7 天</span>
        </div>
        <div class="flex items-end justify-between gap-2">
          <div
            v-for="point in weeklyTrend"
            :key="point.fullLabel"
            class="flex-1 flex flex-col items-center gap-1.5"
          >
            <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {{ point.count }}
            </span>
            <div
              class="w-full max-w-9 rounded-t-lg transition-all duration-300"
              :class="point.count > 0 ? 'bg-red-600 dark:bg-red-500' : 'bg-gray-200 dark:bg-gray-700'"
              :style="{ height: `${barHeight(point.count)}px` }"
              :title="`${point.fullLabel}：${point.count} 次`"
            />
            <span class="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {{ point.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- 词长分布 -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-5">
        <div class="flex items-center gap-2 mb-4">
          <Hash :size="16" class="text-blue-600 dark:text-blue-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">词长分布</h3>
        </div>
        <div class="space-y-3">
          <div v-for="bucket in lengthDistribution" :key="bucket.label">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ bucket.label }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                {{ bucket.count }} 个 · {{ bucket.percent }}%
              </span>
            </div>
            <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                class="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
                :style="{ width: `${bucket.percent}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 最近学习 -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-5">
        <div class="flex items-center gap-2 mb-4">
          <Clock :size="16" class="text-emerald-600 dark:text-emerald-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">最近学习</h3>
        </div>
        <div v-if="recentWords.length > 0" class="space-y-2">
          <button
            v-for="record in recentWords"
            :key="record.id"
            @click="idiomStore.setCurrentIdiom(record.word); router.push('/learn')"
            class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0">
              <BookOpen :size="16" />
            </div>
            <span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ record.word }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ formatRelative(record.timestamp) }}</span>
          </button>
        </div>
        <p v-else class="text-sm text-gray-400 dark:text-gray-500">暂无学习记录</p>
      </div>
    </div>
  </div>
</template>

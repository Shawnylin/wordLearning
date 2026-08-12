<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIdiomStore } from '../stores/idiom'
import {
  BookOpen, Search, CalendarDays, Coins, Zap,
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

// 活跃天数
const activeDays = computed(() => {
  const days = new Set<number>()
  for (const r of idiomStore.searchHistory) days.add(startOfDay(r.timestamp))
  for (const r of idiomStore.compareHistory) days.add(startOfDay(r.createdAt))
  return days.size
})

// —— 7 日趋势数据 ——
interface TrendPoint {
  label: string
  fullLabel: string
  count: number
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
    points.push({ label, fullLabel, count })
  }
  return points
})

const total7d = computed(() => weeklyTrend.value.reduce((s, p) => s + p.count, 0))

// —— SVG 折线图坐标 ——
const CHART_W = 340
const CHART_H = 160
const PAD_L = 14
const PAD_R = 14
const PAD_T = 22
const PAD_B = 14

const plotMax = computed(() => {
  const max = Math.max(...weeklyTrend.value.map(p => p.count), 0)
  return max > 0 ? Math.ceil(max * 1.25) : 1
})

const points = computed(() => {
  const stepX = (CHART_W - PAD_L - PAD_R) / 6
  const innerH = CHART_H - PAD_T - PAD_B
  return weeklyTrend.value.map((p, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + (1 - p.count / plotMax.value) * innerH
  }))
})

const baselineY = CHART_H - PAD_B

const gridYs = computed(() => {
  const innerH = CHART_H - PAD_T - PAD_B
  return [PAD_T, PAD_T + innerH / 2, baselineY]
})

const linePoints = computed(() => points.value.map(p => `${p.x},${p.y}`).join(' '))

const areaPath = computed(() => {
  if (points.value.length === 0) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const d = [`M ${first.x} ${baselineY}`]
  for (const p of points.value) d.push(`L ${p.x} ${p.y}`)
  d.push(`L ${last.x} ${baselineY} Z`)
  return d.join(' ')
})

const hoverIdx = ref(-1)

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
const recentWords = computed(() =>
  [...idiomStore.searchHistory].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
)

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
  <div class="min-h-screen px-4 pt-8 pb-4">
    <!-- Header -->
    <div class="text-center mb-6">
      <div class="seal w-12 h-12 text-3xl mx-auto mb-3">报</div>
      <h1 class="font-kai text-4xl text-ink leading-tight">学习报告</h1>
      <p class="text-sm text-ink-mute mt-1 tracking-wide">温故知新 · 积微成著</p>
    </div>

    <!-- Empty state -->
    <div v-if="!hasData" class="mx-auto max-w-lg text-center py-16">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-card border border-line flex items-center justify-center">
        <BarChart3 :size="32" class="text-ink-mute" />
      </div>
      <p class="text-ink-mute text-sm">还没有学习数据，先去学习几个成语吧</p>
      <button
        @click="goLearn"
        class="mt-4 px-6 py-2 rounded-full btn-primary text-sm font-medium transition-colors"
      >
        开始学习
      </button>
    </div>

    <div v-else class="mx-auto max-w-lg space-y-4 stagger">
      <!-- 总览 Hero -->
      <div class="card rounded-3xl p-6">
        <div class="flex items-center gap-4">
          <div class="seal w-14 h-14 text-3xl shrink-0">学</div>
          <div>
            <p class="text-xs text-ink-mute tracking-wide">已学词语</p>
            <p class="font-serif text-4xl font-bold text-ink leading-none mt-1">{{ learnedCount }}</p>
          </div>
        </div>
        <div class="mt-5 pt-5 border-t border-line grid grid-cols-3 gap-3 text-center">
          <div>
            <p class="font-serif text-xl font-bold text-zhuhong">{{ favoriteCount }}</p>
            <p class="text-xs text-ink-mute mt-0.5">收藏</p>
          </div>
          <div>
            <p class="font-serif text-xl font-bold text-dai">{{ compareCount }}</p>
            <p class="text-xs text-ink-mute mt-0.5">对比</p>
          </div>
          <div>
            <p class="font-serif text-xl font-bold text-gold">{{ activeDays }}</p>
            <p class="text-xs text-ink-mute mt-0.5">活跃天数</p>
          </div>
        </div>
      </div>

      <!-- 学习指标 -->
      <div class="card rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <TrendingUp :size="16" class="text-ink-mute" />
          <h3 class="text-sm font-semibold text-ink-soft tracking-wide">学习指标</h3>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-soft">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-dai-soft text-dai shrink-0">
              <Search :size="16" />
            </div>
            <div>
              <p class="font-serif text-lg font-bold text-ink">{{ searchWordCount }}</p>
              <p class="text-xs text-ink-mute">搜索词语</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-soft">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-bamboo-soft text-bamboo shrink-0">
              <CalendarDays :size="16" />
            </div>
            <div>
              <p class="font-serif text-lg font-bold text-ink">{{ activeDays }}</p>
              <p class="text-xs text-ink-mute">活跃天数</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-soft">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-soft text-gold shrink-0">
              <Coins :size="16" />
            </div>
            <div>
              <p class="font-serif text-lg font-bold text-ink">{{ totalTokens.toLocaleString() }}</p>
              <p class="text-xs text-ink-mute">Token 消耗</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-soft">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-soft text-violet shrink-0">
              <Zap :size="16" />
            </div>
            <div>
              <p class="font-serif text-lg font-bold text-ink">{{ requestCount }}</p>
              <p class="text-xs text-ink-mute">API 调用</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 7 日学习趋势 -->
      <div class="card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <BarChart3 :size="16" class="text-zhuhong" />
            <h3 class="text-sm font-semibold text-ink-soft tracking-wide">7 日学习趋势</h3>
          </div>
          <span class="text-xs text-ink-mute">共 {{ total7d }} 次</span>
        </div>

        <div class="relative select-none" @mouseleave="hoverIdx = -1">
          <!-- 纵轴最大值 -->
          <span class="absolute -top-0 left-0 text-[10px] text-ink-mute">{{ plotMax }}</span>

          <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" class="w-full h-auto block" preserveAspectRatio="none">
            <!-- 网格线 -->
            <line
              v-for="(gy, i) in gridYs"
              :key="i"
              :x1="PAD_L" :x2="CHART_W - PAD_R" :y1="gy" :y2="gy"
              stroke="var(--line)" stroke-width="1"
            />
            <!-- 面积 -->
            <path :d="areaPath" fill="var(--zhuhong)" opacity="0.10" />
            <!-- 折线 -->
            <polyline
              :points="linePoints"
              fill="none" stroke="var(--zhuhong)" stroke-width="2"
              stroke-linejoin="round" stroke-linecap="round"
            />
            <!-- 数据点 -->
            <circle
              v-for="(p, i) in points"
              :key="i"
              :cx="p.x" :cy="p.y"
              :r="hoverIdx === i ? 5 : 3.5"
              fill="var(--zhuhong)" stroke="var(--card)" stroke-width="2"
            />
            <!-- 悬停十字线 -->
            <line
              v-if="hoverIdx >= 0"
              :x1="points[hoverIdx].x" :x2="points[hoverIdx].x"
              :y1="PAD_T" :y2="baselineY"
              stroke="var(--ink-mute)" stroke-width="1"
            />
          </svg>

          <!-- 悬停命中区 -->
          <div class="absolute inset-0 flex">
            <div
              v-for="(_p, i) in points"
              :key="i"
              class="flex-1 h-full"
              @mouseenter="hoverIdx = i"
              @click="hoverIdx = i"
            />
          </div>

          <!-- 悬停提示 -->
          <div
            v-if="hoverIdx >= 0"
            class="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded-lg bg-ink text-paper text-xs whitespace-nowrap shadow-lg transition-none"
            :style="{
              left: `${(points[hoverIdx].x / CHART_W) * 100}%`,
              top: `${(points[hoverIdx].y / CHART_H) * 100}%`,
              transform: 'translate(-50%, -130%)'
            }"
          >
            {{ weeklyTrend[hoverIdx].fullLabel }} · {{ weeklyTrend[hoverIdx].count }} 次
          </div>
        </div>

        <!-- 横轴标签 -->
        <div class="flex mt-2">
          <span
            v-for="(p, i) in weeklyTrend"
            :key="i"
            class="flex-1 text-center text-[11px]"
            :class="hoverIdx === i ? 'text-zhuhong' : 'text-ink-mute'"
          >
            {{ p.label }}
          </span>
        </div>
      </div>

      <!-- 词长分布 -->
      <div class="card rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Hash :size="16" class="text-dai" />
          <h3 class="text-sm font-semibold text-ink-soft tracking-wide">词长分布</h3>
        </div>
        <div class="space-y-3">
          <div v-for="bucket in lengthDistribution" :key="bucket.label">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-ink-soft">{{ bucket.label }}</span>
              <span class="text-xs text-ink-mute">{{ bucket.count }} 个 · {{ bucket.percent }}%</span>
            </div>
            <div class="h-3 rounded-full bg-soft">
              <div
                class="h-full rounded-r-full bg-dai transition-all duration-500"
                :style="{ width: `${bucket.percent}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 最近学习 -->
      <div class="card rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Clock :size="16" class="text-bamboo" />
          <h3 class="text-sm font-semibold text-ink-soft tracking-wide">最近学习</h3>
        </div>
        <div v-if="recentWords.length > 0" class="space-y-2">
          <button
            v-for="record in recentWords"
            :key="record.id"
            @click="idiomStore.setCurrentIdiom(record.word); router.push('/learn')"
            class="w-full flex items-center gap-3 p-3 rounded-xl bg-soft hover:bg-zhuhong-soft transition-colors text-left"
          >
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-zhuhong-soft text-zhuhong shrink-0">
              <BookOpen :size="16" />
            </div>
            <span class="flex-1 text-sm font-medium text-ink">{{ record.word }}</span>
            <span class="text-xs text-ink-mute">{{ formatRelative(record.timestamp) }}</span>
          </button>
        </div>
        <p v-else class="text-sm text-ink-mute">暂无学习记录</p>
      </div>
    </div>
  </div>
</template>

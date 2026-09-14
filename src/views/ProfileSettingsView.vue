<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { onMounted, ref, watch } from 'vue'
import { fetchBalance, type ApiBalance } from '../api/deepseek'
import { useThemeStore } from '../stores/theme'
import { useIdiomStore } from '../stores/idiom'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { useReviewStore } from '../stores/review'
import { useDailyStore } from '../stores/daily'
import { useAppUpdateStore } from '../stores/appUpdate'
import { validateDailyIssue } from '../api/dailyBackup'
import {
  Sun, Moon, Trash2,
  Download, Upload, Monitor, Coins, RefreshCw, Key, ChevronRight, Smartphone
} from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()
const appUpdate = useAppUpdateStore()

const themeStore = useThemeStore()
const idiomStore = useIdiomStore()
const reviewStore = useReviewStore()

const showClearConfirm = ref(false)
const showClearCacheConfirm = ref(false)
const importResult = ref<{ success: boolean; message: string } | null>(null)
const daily = useDailyStore()

const balances = ref<ApiBalance[]>([])
const balanceLoading = ref(false)
const balanceMessage = ref('')

function formatBalance(balance: ApiBalance): string {
  const amount = Number(balance.totalBalance)
  const value = Number.isFinite(amount) ? amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : balance.totalBalance
  const symbol = balance.currency === 'CNY' ? '¥' : balance.currency === 'USD' ? '$' : `${balance.currency} `
  return `${symbol}${value}`
}

async function loadBalance() {
  balances.value = []
  if (!settings.hasApiKey()) { balanceMessage.value = '请先配置 API'; return }
  balanceLoading.value = true
  balanceMessage.value = ''
  try {
    balances.value = await fetchBalance({ ...settings.apiConfig })
    if (!balances.value.length) balanceMessage.value = '暂无余额信息'
  } catch (error: any) {
    balanceMessage.value = error.message || '余额查询失败'
  } finally {
    balanceLoading.value = false
  }
}

onMounted(loadBalance)
watch(() => settings.activeProfileId, loadBalance)



function handleClearHistory() {
  idiomStore.clearHistory()
  idiomStore.clearCompareHistory()
  showClearConfirm.value = false
}

function handleClearCache() {
  idiomStore.clearCache()
  idiomStore.clearHistory()
  idiomStore.clearCompareHistory()
  reviewStore.resetAll()
  daily.cancel()
  daily.issues = []
  daily.selectedId = ''
  showClearCacheConfirm.value = false
}

function handleRefresh() {
  location.reload()
}

function handleExport() {
  const json = JSON.stringify({ ...JSON.parse(idiomStore.exportData()), dailyIssues: daily.issues }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `成语学习_备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      try {
        const data = JSON.parse(content)
        const issues = (data.dailyIssues || []).map(validateDailyIssue)
        importResult.value = idiomStore.importData(content)
        if (importResult.value.success) {
          daily.issues = [...daily.issues, ...issues.filter((issue: any) => !daily.issues.some(i => i.id === issue.id))].sort((a, b) => b.createdAt - a.createdAt)
        }
      } catch { importResult.value = { success: false, message: '备份格式不正确，未导入日报' } }
      setTimeout(() => { importResult.value = null }, 3000)
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<template>
  <div class="min-h-screen px-4 pt-8 pb-4">
    <div class="mx-auto max-w-lg space-y-4">
<header class="flex items-center gap-3"><button @click="router.push('/profile')" class="p-3 rounded-full bg-soft" aria-label="返回个人">←</button><h1 class="font-kai text-3xl">设置</h1></header>
        <!-- Token Stats -->
        <div class="card p-5 rounded-2xl">
          <div class="flex items-center gap-2 mb-3">
            <Coins :size="16" class="text-gold" />
            <span class="text-sm font-medium text-ink-soft">Token 消耗统计</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="font-serif text-xl font-bold text-gold">{{ idiomStore.tokenStats.totalTokens.toLocaleString() }}</p>
              <p class="text-xs text-ink-mute">总消耗 Tokens</p>
            </div>
            <div>
              <p class="font-serif text-xl font-bold text-gold">{{ idiomStore.tokenStats.requestCount }}</p>
              <p class="text-xs text-ink-mute">API 调用次数</p>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gold/20">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-ink-soft">深度思考</p>
                <p class="text-xs text-ink-mute mt-0.5">关闭后响应更快，开启后分析更充分</p>
              </div>
              <button
                @click="settings.thinkingEnabled = !settings.thinkingEnabled"
                class="relative w-11 h-6 rounded-full transition-colors duration-300 border shrink-0"
                :class="settings.thinkingEnabled ? 'bg-gold border-gold' : 'bg-soft border-line'"
                role="switch"
                :aria-checked="settings.thinkingEnabled"
                aria-label="深度思考"
              >
                <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper-ink shadow-sm transition-all duration-300" :style="{ transform: settings.thinkingEnabled ? 'translateX(20px)' : 'translateX(0)' }" />
              </button>
            </div>
            <Motion><div v-if="settings.thinkingEnabled" class="grid grid-cols-3 gap-2 mt-3">
              <button v-for="effort in ['low', 'high', 'max']" :key="effort" @click="settings.reasoningEffort = effort as any" class="py-2 rounded-lg text-xs font-medium transition-colors" :class="settings.reasoningEffort === effort ? 'bg-gold text-paper-ink' : 'bg-soft text-ink-soft'">
                {{ effort === 'low' ? '低' : effort === 'high' ? '高' : '最高' }}
              </button>
            </div></Motion>
          </div>

          <div class="mt-3 pt-3 border-t border-gold/20 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-ink-mute mb-1">当前 API 余额</p>
              <p v-if="balances.length" class="font-serif text-lg font-bold text-gold truncate">
                {{ balances.map(formatBalance).join(' · ') }}
              </p>
              <p v-else class="text-sm text-ink-mute">{{ balanceLoading ? '查询中…' : balanceMessage }}</p>
            </div>
            <button
              @click="loadBalance"
              :disabled="balanceLoading"
              class="p-2 rounded-full text-gold hover:bg-gold-soft transition-colors disabled:opacity-50 shrink-0"
              aria-label="刷新 API 余额"
              title="刷新余额"
            >
              <RefreshCw :size="16" :class="{ 'animate-spin': balanceLoading }" />
            </button>
          </div>
        </div>
      <button @click="router.push('/profile/models')" class="card rounded-2xl p-4 w-full flex items-center gap-3 text-left" aria-label="模型与 API">
        <div class="w-10 h-10 rounded-xl bg-dai-soft text-dai flex items-center justify-center shrink-0"><Key :size="20" /></div>
        <div class="min-w-0 flex-1"><h3 class="font-semibold text-ink">模型与 API</h3><p class="text-xs text-ink-mute mt-1 truncate">{{ settings.model }} · 配置与切换</p></div>
        <ChevronRight :size="18" class="text-ink-mute shrink-0" />
      </button>

      <!-- Theme Setting -->
      <div class="card rounded-2xl p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gold-soft text-gold">
            <component :is="themeStore.followSystem ? Monitor : (themeStore.theme === 'dark' ? Moon : Sun)" :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">主题模式</h3>
            <p class="text-xs text-ink-mute">
              {{ themeStore.followSystem ? '跟随系统' : (themeStore.theme === 'dark' ? '深色模式' : '浅色模式') }}
            </p>
          </div>
        </div>

        <!-- Follow system toggle -->
        <div class="flex items-center justify-between p-3 rounded-xl bg-soft">
          <div class="flex items-center gap-2">
            <Monitor :size="16" class="text-ink-soft" />
            <span class="text-sm text-ink">跟随系统</span>
          </div>
          <button
            @click="themeStore.setFollowSystem(!themeStore.followSystem)"
            class="relative w-11 h-6 rounded-full transition-colors duration-300 border"
            :class="themeStore.followSystem ? 'bg-zhuhong border-zhuhong' : 'bg-soft border-line'"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper-ink shadow-sm transition-all duration-300"
              :style="{ transform: themeStore.followSystem ? 'translateX(20px)' : 'translateX(0)' }"
            />
          </button>
        </div>

        <!-- Manual theme selector -->
        <Motion><div v-if="!themeStore.followSystem" class="flex gap-2">
          <button
            @click="themeStore.setTheme('light')"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="themeStore.theme === 'light'
              ? 'btn-primary'
              : 'bg-soft text-ink-soft'"
          >
            <Sun :size="16" />
            浅色
          </button>
          <button
            @click="themeStore.setTheme('dark')"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="themeStore.theme === 'dark'
              ? 'btn-primary'
              : 'bg-soft text-ink-soft'"
          >
            <Moon :size="16" />
            深色
          </button>
        </div></Motion>
      </div>

      <!-- App Update -->
      <div class="card rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-dai-soft text-dai"><Smartphone :size="20" /></div>
          <div class="min-w-0">
            <h3 class="font-semibold text-ink">应用更新</h3>
            <p class="text-xs text-ink-mute">当前版本 v{{ appUpdate.currentVersion }}</p>
          </div>
        </div>
        <p class="mb-3 text-sm" :class="appUpdate.needRefresh ? 'text-zhuhong' : 'text-ink-mute'">{{ appUpdate.statusText }}</p>
        <button
          v-if="appUpdate.needRefresh"
          class="btn-primary w-full rounded-xl py-2.5 text-sm font-medium"
          :disabled="appUpdate.applying"
          @click="appUpdate.applyUpdate"
        >{{ appUpdate.applying ? '正在更新…' : '发现新版本，立即更新' }}</button>
        <button
          v-else
          class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft disabled:opacity-50"
          :disabled="appUpdate.checking || !appUpdate.supported"
          @click="appUpdate.checkForUpdate()"
        ><RefreshCw :size="16" :class="{ 'animate-spin': appUpdate.checking }" />{{ appUpdate.checking ? '检查中…' : '检查更新' }}</button>
      </div>

      <!-- Data Management -->
      <div class="card rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-soft text-ink-soft">
            <Trash2 :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">数据管理</h3>
            <p class="text-xs text-ink-mute">导入导出与清理</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="handleExport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              <Download :size="16" />
              导出数据
            </button>
            <button
              @click="handleImport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              <Upload :size="16" />
              导入数据
            </button>
          </div>

          <Motion><div
            v-if="importResult"
            class="p-3 rounded-xl text-sm"
            :class="importResult.success ? 'bg-bamboo-soft text-bamboo' : 'bg-zhuhong-soft text-zhuhong'"
          >
            {{ importResult.message }}
          </div></Motion>

          <button
            @click="handleRefresh"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
          >
            <RefreshCw :size="16" />
            刷新应用
          </button>
          <button
            @click="showClearConfirm = true"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
          >
            清空搜索历史
          </button>
          <button
            @click="showClearCacheConfirm = true"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-zhuhong bg-zhuhong-soft hover:opacity-85 transition-colors"
          >
            清空所有缓存
          </button>
        </div>
      </div>
    </div>

    <!-- Clear History Confirm Modal -->
    <Teleport to="body">
      <Motion><div
        v-if="showClearConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showClearConfirm = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
          <h3 class="text-lg font-semibold text-ink mb-2">清空搜索历史？</h3>
          <p class="text-sm text-ink-soft mb-6">
            此操作将清空所有搜索记录，但已缓存的成语内容不会被删除。
          </p>
          <div class="flex gap-3">
            <button
              @click="showClearConfirm = false"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              取消
            </button>
            <button
              @click="handleClearHistory"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium btn-primary transition-colors"
            >
              确认清空
            </button>
          </div>
        </div>
      </div></Motion>
    </Teleport>

    <!-- Clear Cache Confirm Modal -->
    <Teleport to="body">
      <Motion><div
        v-if="showClearCacheConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showClearCacheConfirm = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
          <h3 class="text-lg font-semibold text-ink mb-2">清空所有缓存？</h3>
          <p class="text-sm text-ink-soft mb-6">
            此操作将删除所有已缓存的成语内容、日报和搜索记录，且不可恢复。
          </p>
          <div class="flex gap-3">
            <button
              @click="showClearCacheConfirm = false"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              取消
            </button>
            <button
              @click="handleClearCache"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium btn-primary transition-colors"
            >
              确认清空
            </button>
          </div>
        </div>
      </div></Motion>
    </Teleport>

    <!-- Version -->
    <div class="text-center mt-8 mb-4">
      <p class="text-xs text-ink-mute">v{{ appUpdate.currentVersion }}</p>
    </div>
  </div>
</template>

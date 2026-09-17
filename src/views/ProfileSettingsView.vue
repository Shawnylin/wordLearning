<script setup lang="ts">
import Motion from '../components/Motion.vue'
import LiquidToggle from '../components/LiquidToggle.vue'
import { onMounted, ref, watch } from 'vue'
import { fetchBalance, type ApiBalance } from '../api/deepseek'
import { themeColorOptions, useThemeStore } from '../stores/theme'
import { useIdiomStore } from '../stores/idiom'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { useReviewStore } from '../stores/review'
import { useDailyStore } from '../stores/daily'
import { useAppUpdateStore } from '../stores/appUpdate'
import { validateDailyIssue } from '../api/dailyBackup'
import {
  Sun, Moon, Trash2,
  Download, Upload, Monitor, Coins, RefreshCw, Key, ChevronRight, Smartphone, FileText
} from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()
const appUpdate = useAppUpdateStore()

withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false
})

const themeStore = useThemeStore()
const idiomStore = useIdiomStore()
const reviewStore = useReviewStore()

const showClearConfirm = ref(false)
const showClearCacheConfirm = ref(false)
const showCleanupOptions = ref(false)
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
  if (!settings.hasApiKey()) { balanceMessage.value = '未配置 API'; return }
  balanceLoading.value = true
  balanceMessage.value = ''
  try {
    balances.value = await fetchBalance({ ...settings.apiConfig })
    if (!balances.value.length) balanceMessage.value = '暂无余额'
  } catch (error: any) {
    balanceMessage.value = error.message || '查询失败'
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
  daily.groups = []
  daily.selectedId = ''
  showClearCacheConfirm.value = false
}

function handleExport() {
  const json = JSON.stringify({ ...JSON.parse(idiomStore.exportData()), dailyIssues: daily.issues, dailyGroups: daily.groups }, null, 2)
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
          if (Array.isArray(data.dailyGroups)) daily.restoreGroups(data.dailyGroups)
          else daily.ensureGroups()
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
  <div :class="embedded ? 'pb-4' : 'min-h-screen px-4 pt-8 pb-4'">
    <div class="settings-layout mx-auto max-w-lg space-y-4" :class="{ 'is-profile-embedded': embedded }">
<header v-if="!embedded" class="flex items-center gap-3"><button @click="router.push('/profile')" class="p-3 rounded-full bg-soft" aria-label="返回个人">←</button><h1 class="font-kai text-3xl">设置</h1></header>
        <!-- Learning Stats -->
        <div class="settings-card-token card p-5 rounded-2xl">
          <div class="flex items-center gap-2 mb-3">
            <Coins :size="16" class="text-gold" />
            <span class="text-sm font-medium text-ink-soft">学习统计</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="font-serif text-xl font-bold text-gold">{{ idiomStore.tokenStats.totalTokens.toLocaleString() }}</p>
              <p class="text-xs text-ink-mute">Tokens</p>
            </div>
            <div>
              <p class="font-serif text-xl font-bold text-gold">{{ idiomStore.tokenStats.requestCount }}</p>
              <p class="text-xs text-ink-mute">次调用</p>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gold/20">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-ink-soft">深度思考</p>
              </div>
              <LiquidToggle v-model="settings.thinkingEnabled" label="深度思考" tone="gold" />
            </div>
            <Motion><div v-if="settings.thinkingEnabled" class="grid grid-cols-3 gap-2 mt-3">
              <button v-for="effort in ['low', 'high', 'max']" :key="effort" @click="settings.reasoningEffort = effort as any" class="py-2 rounded-lg text-xs font-medium transition-colors" :class="settings.reasoningEffort === effort ? 'bg-gold text-paper-ink' : 'bg-soft text-ink-soft'">
                {{ effort === 'low' ? '低' : effort === 'high' ? '高' : '最高' }}
              </button>
            </div></Motion>
          </div>

          <div class="mt-3 pt-3 border-t border-gold/20 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-ink-mute mb-1">API 余额</p>
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
      <button @click="router.push('/profile/models')" class="settings-card-model card rounded-2xl p-4 w-full flex items-center gap-3 text-left" aria-label="模型与 API">
        <div class="settings-theme-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0"><Key :size="20" /></div>
        <div class="min-w-0 flex-1"><h3 class="font-semibold text-ink">模型与 API</h3><p class="text-xs text-ink-mute mt-1 truncate">{{ settings.model }}</p></div>
        <ChevronRight :size="18" class="text-ink-mute shrink-0" />
      </button>

      <!-- Theme Setting -->
      <div class="settings-card-theme card rounded-2xl p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="settings-theme-icon flex items-center justify-center w-10 h-10 rounded-xl">
            <component :is="themeStore.followSystem ? Monitor : (themeStore.theme === 'dark' ? Moon : Sun)" :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">外观</h3>
          </div>
        </div>

        <!-- Follow system toggle -->
        <div class="flex items-center justify-between p-3 rounded-xl bg-soft">
          <div class="flex items-center gap-2">
            <Monitor :size="16" class="text-ink-soft" />
            <span class="text-sm text-ink">跟随系统</span>
          </div>
          <LiquidToggle :model-value="themeStore.followSystem" label="跟随系统" @update:model-value="themeStore.setFollowSystem" />
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

        <div class="border-t border-line pt-4">
          <p class="mb-3 text-xs font-medium text-ink-mute">颜色</p>
          <div class="grid grid-cols-4 gap-2" role="radiogroup" aria-label="主题颜色">
            <button
              v-for="option in themeColorOptions"
              :key="option.value"
              class="flex min-w-0 flex-col items-center gap-2 rounded-xl border px-1 py-2.5 text-xs transition-colors"
              :class="themeStore.themeColor === option.value ? 'border-zhuhong bg-zhuhong-soft text-zhuhong' : 'border-line bg-soft text-ink-mute'"
              role="radio"
              :aria-checked="themeStore.themeColor === option.value"
              :aria-label="`${option.label}主题色`"
              @click="themeStore.setThemeColor(option.value)"
            >
              <span class="h-5 w-5 rounded-full border-2 border-white/70 shadow-sm" :style="{ backgroundColor: option.preview }" />
              <span class="truncate">{{ option.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- App Update -->
      <div class="settings-card-update card rounded-2xl p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="flex min-w-0 items-center gap-3">
            <div class="settings-theme-icon flex items-center justify-center w-10 h-10 rounded-xl shrink-0"><Smartphone :size="20" /></div>
            <div class="min-w-0">
              <h3 class="font-semibold text-ink">版本 v{{ appUpdate.currentVersion }}</h3>
            </div>
          </div>
          <button
            class="settings-theme-action flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity"
            aria-label="查看更新日志"
            @click="router.push('/profile/changelog')"
          ><FileText :size="15" />更新日志</button>
        </div>
        <p v-if="!appUpdate.supported || appUpdate.checking || appUpdate.needRefresh || appUpdate.statusMessage" class="mb-3 text-sm" :class="appUpdate.needRefresh ? 'text-zhuhong' : 'text-ink-mute'">{{ appUpdate.statusText }}</p>
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
      <div class="settings-card-data card rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="settings-theme-icon flex items-center justify-center w-10 h-10 rounded-xl">
            <Trash2 :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">数据</h3>
          </div>
        </div>

        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="handleExport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              <Download :size="16" />
              导出备份
            </button>
            <button
              @click="handleImport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              <Upload :size="16" />
              导入备份
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
            @click="showCleanupOptions = !showCleanupOptions"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            :aria-expanded="showCleanupOptions"
          >
            <Trash2 :size="16" />
            清理数据
          </button>
          <Motion><div v-if="showCleanupOptions" class="grid grid-cols-2 gap-2">
            <button
              @click="showClearConfirm = true"
              class="py-2.5 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >清空搜索历史</button>
            <button
              @click="showClearCacheConfirm = true"
              class="py-2.5 rounded-xl text-sm font-medium text-zhuhong bg-zhuhong-soft hover:opacity-85 transition-colors"
            >清空全部数据</button>
          </div></Motion>
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
            已生成的学习内容不会删除。
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
              清空
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
          <h3 class="text-lg font-semibold text-ink mb-2">清空全部数据？</h3>
          <p class="text-sm text-ink-soft mb-6">
            将删除成语、日报和学习记录，且无法恢复。
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
              清空全部数据
            </button>
          </div>
        </div>
      </div></Motion>
    </Teleport>

  </div>
</template>

<style scoped>
.settings-theme-icon,
.settings-theme-action {
  color: var(--zhuhong);
  background: var(--zhuhong-soft);
}
</style>

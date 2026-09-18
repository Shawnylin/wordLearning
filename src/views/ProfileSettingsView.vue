<script setup lang="ts">
import Motion from '../components/Motion.vue'
import LiquidToggle from '../components/LiquidToggle.vue'
import { onMounted, ref, watch, computed } from 'vue'
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
  ChevronDown, ChevronRight, Coins, Download, FileText, Gauge, Key, Monitor, Moon, RefreshCw, Smartphone, Sun, Trash2, Upload
} from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()
const appUpdate = useAppUpdateStore()

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false
})

const themeStore = useThemeStore()
const idiomStore = useIdiomStore()
const reviewStore = useReviewStore()
const daily = useDailyStore()

const showClearConfirm = ref(false)
const showClearCacheConfirm = ref(false)
const showCleanupOptions = ref(false)
const showAppearanceOptions = ref(false)
const showUpdateOptions = ref(false)
const showDataOptions = ref(false)
const importResult = ref<{ success: boolean; message: string } | null>(null)

const balances = ref<ApiBalance[]>([])
const balanceLoading = ref(false)
const balanceMessage = ref('')
const appearanceLabel = computed(() => themeStore.followSystem ? '跟随系统' : themeStore.theme === 'dark' ? '深色' : '浅色')

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
  } catch (error: unknown) {
    balanceMessage.value = error instanceof Error ? error.message : '查询失败'
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
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result as string
      try {
        const data = JSON.parse(content)
        const issues = (data.dailyIssues || []).map(validateDailyIssue)
        importResult.value = idiomStore.importData(content)
        if (importResult.value.success) {
          daily.issues = [...daily.issues, ...issues.filter((issue: typeof daily.issues[number]) => !daily.issues.some(item => item.id === issue.id))].sort((a, b) => b.createdAt - a.createdAt)
          if (Array.isArray(data.dailyGroups)) daily.restoreGroups(data.dailyGroups)
          else daily.ensureGroups()
        }
      } catch {
        importResult.value = { success: false, message: '备份格式不正确，未导入日报' }
      }
      setTimeout(() => { importResult.value = null }, 3000)
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<template>
  <div :class="props.embedded ? 'profile-settings' : 'min-h-screen px-4 pb-5 pt-8'">
    <div class="profile-settings-layout mx-auto max-w-lg">
      <header v-if="!props.embedded" class="profile-title-row">
        <button class="profile-back-button" type="button" aria-label="返回个人" @click="router.push('/profile')">←</button>
        <h1 class="font-kai text-3xl text-ink">设置</h1>
      </header>

      <section class="profile-section" aria-labelledby="profile-stats-title">
        <div class="profile-section-heading"><h2 id="profile-stats-title">学习与统计</h2></div>
        <div class="profile-list">
          <div class="profile-list-row profile-settings-row">
            <span class="profile-row-icon text-gold"><Coins :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">学习统计</span><span class="profile-row-caption">{{ idiomStore.tokenStats.requestCount }} 次调用</span></span>
            <span class="profile-row-value">{{ idiomStore.tokenStats.totalTokens.toLocaleString() }} tokens</span>
          </div>

          <div class="profile-list-row profile-settings-row">
            <span class="profile-row-icon text-gold"><Gauge :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">深度思考</span><span class="profile-row-caption">{{ settings.thinkingEnabled ? '已开启' : '已关闭' }}</span></span>
            <LiquidToggle v-model="settings.thinkingEnabled" label="深度思考" tone="gold" />
          </div>
          <Motion><div v-if="settings.thinkingEnabled" class="profile-inline-panel profile-effort-panel">
            <span class="profile-row-caption">强度</span>
            <div class="profile-effort-options">
              <button v-for="effort in ['low', 'high', 'max']" :key="effort" type="button" :class="settings.reasoningEffort === effort ? 'is-selected' : ''" @click="settings.reasoningEffort = effort as 'low' | 'high' | 'max'">
                {{ effort === 'low' ? '低' : effort === 'high' ? '高' : '最高' }}
              </button>
            </div>
          </div></Motion>

          <div class="profile-list-row profile-settings-row">
            <span class="profile-row-icon text-gold"><Coins :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">API 余额</span><span class="profile-row-caption">{{ balanceLoading ? '查询中…' : balanceMessage || '已更新' }}</span></span>
            <span v-if="balances.length" class="profile-row-value max-w-[46%] truncate">{{ balances.map(formatBalance).join(' · ') }}</span>
            <button class="profile-row-icon-button" type="button" :disabled="balanceLoading" aria-label="刷新 API 余额" @click="loadBalance"><RefreshCw :size="16" :class="{ 'animate-spin': balanceLoading }" /></button>
          </div>
        </div>
      </section>

      <section class="profile-section" aria-labelledby="profile-settings-title">
        <div class="profile-section-heading"><h2 id="profile-settings-title">应用设置</h2></div>
        <div class="profile-list">
          <button class="profile-list-row" type="button" aria-label="模型与 API" @click="router.push('/profile/models')">
            <span class="profile-row-icon"><Key :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">模型与 API</span><span class="profile-row-caption">{{ settings.model || '未配置' }}</span></span>
            <ChevronRight :size="18" class="profile-row-chevron" />
          </button>

          <button class="profile-list-row" type="button" :aria-expanded="showAppearanceOptions" @click="showAppearanceOptions = !showAppearanceOptions">
            <span class="profile-row-icon"><component :is="themeStore.followSystem ? Monitor : themeStore.theme === 'dark' ? Moon : Sun" :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">外观</span><span class="profile-row-caption">{{ appearanceLabel }} · {{ themeStore.themeColor }}</span></span>
            <ChevronDown :size="17" class="profile-row-chevron" :class="{ 'rotate-180': showAppearanceOptions }" />
          </button>
          <Motion><div v-if="showAppearanceOptions" class="profile-inline-panel profile-appearance-panel">
            <div class="profile-setting-line"><span>跟随系统</span><LiquidToggle :model-value="themeStore.followSystem" label="跟随系统" @update:model-value="themeStore.setFollowSystem" /></div>
            <div v-if="!themeStore.followSystem" class="profile-effort-options">
              <button type="button" :class="themeStore.theme === 'light' ? 'is-selected' : ''" @click="themeStore.setTheme('light')"><Sun :size="15" />浅色</button>
              <button type="button" :class="themeStore.theme === 'dark' ? 'is-selected' : ''" @click="themeStore.setTheme('dark')"><Moon :size="15" />深色</button>
            </div>
            <div class="profile-color-options" role="radiogroup" aria-label="主题颜色">
              <button v-for="option in themeColorOptions" :key="option.value" type="button" role="radio" :aria-checked="themeStore.themeColor === option.value" :class="themeStore.themeColor === option.value ? 'is-selected' : ''" :aria-label="`${option.label}主题色`" @click="themeStore.setThemeColor(option.value)">
                <span :style="{ backgroundColor: option.preview }" />{{ option.label }}
              </button>
            </div>
          </div></Motion>
        </div>
      </section>

      <section class="profile-section" aria-labelledby="profile-app-title">
        <div class="profile-section-heading"><h2 id="profile-app-title">版本与数据</h2></div>
        <div class="profile-list">
          <button class="profile-list-row" type="button" :aria-expanded="showUpdateOptions" @click="showUpdateOptions = !showUpdateOptions">
            <span class="profile-row-icon"><Smartphone :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">版本 v{{ appUpdate.currentVersion }}</span><span class="profile-row-caption">{{ appUpdate.needRefresh ? '发现新版本' : '检查更新与日志' }}</span></span>
            <span class="profile-row-value" :class="{ 'text-zhuhong': appUpdate.needRefresh }">{{ appUpdate.needRefresh ? '更新' : '当前' }}</span>
            <ChevronDown :size="17" class="profile-row-chevron" :class="{ 'rotate-180': showUpdateOptions }" />
          </button>
          <Motion><div v-if="showUpdateOptions" class="profile-inline-panel profile-update-panel">
            <div class="flex items-center justify-between gap-3">
              <span class="profile-row-caption">{{ appUpdate.statusText }}</span>
              <button class="profile-link-button" type="button" @click="router.push('/profile/changelog')"><FileText :size="15" />更新日志</button>
            </div>
            <button v-if="appUpdate.needRefresh" class="btn-primary profile-wide-action" type="button" :disabled="appUpdate.applying" @click="appUpdate.applyUpdate">{{ appUpdate.applying ? '正在更新…' : '立即更新' }}</button>
            <button v-else class="profile-wide-action" type="button" :disabled="appUpdate.checking || !appUpdate.supported" @click="appUpdate.checkForUpdate()"><RefreshCw :size="16" :class="{ 'animate-spin': appUpdate.checking }" />{{ appUpdate.checking ? '检查中…' : '检查更新' }}</button>
          </div></Motion>

          <button class="profile-list-row" type="button" :aria-expanded="showDataOptions" @click="showDataOptions = !showDataOptions">
            <span class="profile-row-icon"><Download :size="18" /></span>
            <span class="profile-row-main"><span class="profile-row-title">备份与清理</span><span class="profile-row-caption">导入、导出或清理本机数据</span></span>
            <ChevronDown :size="17" class="profile-row-chevron" :class="{ 'rotate-180': showDataOptions }" />
          </button>
          <Motion><div v-if="showDataOptions" class="profile-inline-panel profile-data-panel">
            <div class="profile-data-actions">
              <button type="button" @click="handleExport"><Download :size="16" />导出备份</button>
              <button type="button" @click="handleImport"><Upload :size="16" />导入备份</button>
            </div>
            <p v-if="importResult" class="profile-inline-feedback" :class="importResult.success ? 'is-success' : 'is-error'" role="status">{{ importResult.message }}</p>
            <button class="profile-wide-action" type="button" :aria-expanded="showCleanupOptions" @click="showCleanupOptions = !showCleanupOptions"><Trash2 :size="16" />清理数据</button>
            <div v-if="showCleanupOptions" class="profile-data-actions">
              <button type="button" @click="showClearConfirm = true">清空搜索历史</button>
              <button class="is-danger" type="button" @click="showClearCacheConfirm = true">清空全部数据</button>
            </div>
          </div></Motion>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <Motion><div v-if="showClearConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" @click.self="showClearConfirm = false">
        <div class="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-xl">
          <h3 class="mb-2 text-lg font-semibold text-ink">清空搜索历史？</h3>
          <p class="mb-6 text-sm text-ink-soft">已生成的学习内容不会删除。</p>
          <div class="flex gap-3"><button class="flex-1 rounded-xl bg-soft py-2.5 text-sm font-medium text-ink-soft" type="button" @click="showClearConfirm = false">取消</button><button class="btn-primary flex-1 rounded-xl py-2.5 text-sm font-medium" type="button" @click="handleClearHistory">清空</button></div>
        </div>
      </div></Motion>
    </Teleport>

    <Teleport to="body">
      <Motion><div v-if="showClearCacheConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" @click.self="showClearCacheConfirm = false">
        <div class="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-xl">
          <h3 class="mb-2 text-lg font-semibold text-ink">清空全部数据？</h3>
          <p class="mb-6 text-sm text-ink-soft">将删除成语、日报和学习记录，且无法恢复。</p>
          <div class="flex gap-3"><button class="flex-1 rounded-xl bg-soft py-2.5 text-sm font-medium text-ink-soft" type="button" @click="showClearCacheConfirm = false">取消</button><button class="btn-primary flex-1 rounded-xl py-2.5 text-sm font-medium" type="button" @click="handleClearCache">清空全部数据</button></div>
        </div>
      </div></Motion>
    </Teleport>
  </div>
</template>

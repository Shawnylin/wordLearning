<script setup lang="ts">
import ReportView from './ReportView.vue'
import { Settings } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { useIdiomStore } from '../stores/idiom'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { fetchBalance, type ApiBalance } from '../api/deepseek'
import { BookOpen, RefreshCw, Coins } from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()



const idiomStore = useIdiomStore()

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

</script>
<template><div class="px-4 pt-6 pb-4"><div class="mx-auto max-w-lg space-y-4"><header class="flex items-center justify-between"><h1 class="font-kai text-3xl">个人</h1><button @click="router.push('/profile/settings')" aria-label="打开设置" class="w-11 h-11 rounded-full card flex items-center justify-center"><Settings :size="20" /></button></header>      <!-- Stats Card -->
      <div class="card rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-zhuhong-soft text-zhuhong">
            <BookOpen :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">学习统计</h3>
            <p class="text-xs text-ink-mute">你的学习进度</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 rounded-xl bg-soft text-center">
            <p class="font-serif text-2xl font-bold text-zhuhong">{{ idiomStore.learnedCount }}</p>
            <p class="text-xs text-ink-mute mt-1">已学成语</p>
          </div>
          <div class="p-3 rounded-xl bg-soft text-center">
            <p class="font-serif text-2xl font-bold text-dai">{{ idiomStore.sortedCompareHistory.length }}</p>
            <p class="text-xs text-ink-mute mt-1">对比次数</p>
          </div>
        </div>

        <!-- Token Stats -->
        <div class="mt-4 p-4 rounded-xl bg-gold-soft border border-gold/20">
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
      </div>

<ReportView /></div></div></template>
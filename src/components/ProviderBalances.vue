<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw, WalletCards } from 'lucide-vue-next'
import { fetchBalance, type ApiBalance } from '../api/deepseek'
import { providerCapabilities } from '../api/providers'
import { useSettingsStore } from '../stores/settings'
const settings = useSettingsStore()
const rows = ref<{ id: string; name: string; balances: ApiBalance[]; message: string; url?: string; loading: boolean }[]>([])
const loading = computed(() => rows.value.some(row => row.loading))
const providers = computed(() => {
  const candidates = [...settings.profiles]
  if (settings.apiKey && !candidates.some(p => p.apiKey === settings.apiKey && p.baseUrl === settings.baseUrl)) {
    candidates.push({ ...settings.apiConfig, id: 'legacy-learning', name: '学习模型', models: [] })
  }
  for (const [id, name, config] of [['legacy-pdf', 'PDF', settings.pdfConfig], ['legacy-speech', 'MiMo 朗读', settings.speechConfig]] as const) {
    if (config.apiKey && !candidates.some(p => p.apiKey === config.apiKey && p.baseUrl === config.baseUrl)) candidates.push({ ...config, id, name, models: [] })
  }
  const seen = new Set<string>()
  return candidates.filter(provider => {
    if (!providerCapabilities(provider).supportsBalanceQuery) return false
    const key = `${provider.baseUrl.replace(/\/+$/, '')}:${provider.apiKey}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
})
let generation = 0
function formatBalance(balance: ApiBalance) {
  const amount = Number(balance.totalBalance)
  const prefix = balance.currency === 'CNY' ? '¥' : balance.currency === 'USD' ? '$' : `${balance.currency} `
  return prefix + (Number.isFinite(amount) ? amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : balance.totalBalance)
}
async function refresh() {
  const epoch = ++generation
  const list = providers.value.map(provider => ({ ...provider }))
  rows.value = list.map(provider => ({ id: provider.id, name: provider.name, balances: [], message: '', loading: true }))
  await Promise.all(list.map(async (provider, index) => {
    const row = rows.value[index]
    try {
      const result = await fetchBalance(provider)
      if (epoch !== generation) return
      row.balances = result.filter(balance => String(balance.totalBalance).trim())
      if (!row.balances.length) row.message = '暂无余额'
    } catch (error) {
      if (epoch === generation) row.message = error instanceof Error ? error.message : '查询失败'
    } finally { if (epoch === generation) row.loading = false }
  }))
}
watch(providers, refresh, { immediate: true, deep: true })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <div class="provider-balances">
    <div v-for="(row, index) in rows" :key="row.id" class="profile-list-row profile-settings-row balance-row">
      <span class="profile-row-icon text-gold"><WalletCards :size="18" /></span>
      <span class="profile-row-main"><span class="profile-row-title">API 余额</span><span class="profile-row-caption">{{ row.name }}</span></span>
      <span v-if="row.loading" class="profile-row-value">查询中…</span>
      <span v-else-if="row.balances.length" class="profile-row-value balance-amount"><span v-for="balance in row.balances" :key="balance.currency">{{ formatBalance(balance) }}</span></span>
      <span v-else class="profile-row-value">{{ row.message }}</span>
      <button v-if="index === 0" class="balance-refresh" type="button" :disabled="loading" aria-label="刷新 API 余额" @click="refresh"><RefreshCw :size="16" :class="{ 'animate-spin': loading }" /></button>
    </div>
    <div v-if="!rows.length" class="profile-list-row profile-settings-row balance-row">
      <span class="profile-row-icon text-gold"><WalletCards :size="18" /></span>
      <span class="profile-row-main"><span class="profile-row-title">API 余额</span><span class="profile-row-caption">未配置服务商</span></span>
    </div>
  </div>
</template>

<style scoped>
.provider-balances { min-width: 0; }
.balance-row { padding: 0; }
.balance-amount { display: grid; gap: 2px; font-variant-numeric: tabular-nums; }
.balance-refresh { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 10px; color: var(--ink-mute); }
.balance-refresh:hover { background: var(--soft); color: var(--ink); }
</style>

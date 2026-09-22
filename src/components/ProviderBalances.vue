<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { fetchBalance, type ApiBalance } from '../api/deepseek'
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
      const host = new URL(provider.baseUrl).hostname
      if (host === 'api.xiaomimimo.com' || host.endsWith('.xiaomimimo.com')) {
        row.url = 'https://platform.xiaomimimo.com/#/console/balance'
        row.message = '在 MiMo 查看'
        return
      }
      const result = await fetchBalance(provider)
      if (epoch !== generation) return
      row.balances = result
      if (!result.length) row.message = '暂无余额'
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
    <div class="balance-heading"><span>API 余额</span><button type="button" :disabled="loading" aria-label="刷新 API 余额" @click="refresh"><RefreshCw :size="16" :class="{ 'animate-spin': loading }" /></button></div>
    <p v-if="!rows.length" class="balance-empty">未配置服务商</p>
    <div v-for="row in rows" :key="row.id" class="balance-row">
      <span class="balance-provider">{{ row.name }}</span>
      <span v-if="row.loading" class="balance-message">查询中…</span>
      <a v-else-if="row.url" :href="row.url" target="_blank" rel="noopener noreferrer">{{ row.message }} ↗</a>
      <span v-else-if="row.balances.length" class="balance-amount"><span v-for="balance in row.balances" :key="balance.currency">{{ formatBalance(balance) }}</span></span>
      <span v-else class="balance-message">{{ row.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.provider-balances { padding: 12px 0; border-top: 1px solid var(--line); }
.balance-heading { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 500; }
.balance-heading button { display: grid; place-items: center; width: 36px; height: 36px; color: var(--ink-mute); }
.balance-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: baseline; gap: 12px; padding: 8px 0; font-size: 13px; }
.balance-provider { overflow-wrap: anywhere; color: var(--ink-soft); }
.balance-row > :last-child { text-align: right; }
.balance-row a { color: var(--zhuhong); }
.balance-amount { display: grid; gap: 4px; font-variant-numeric: tabular-nums; }
.balance-message, .balance-empty { color: var(--ink-mute); font-size: 12px; overflow-wrap: anywhere; }
</style>

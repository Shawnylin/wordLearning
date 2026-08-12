<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import {
  Sun, Moon, Key, BookOpen, Trash2, Eye, EyeOff, Check, Info,
  Download, Upload, Monitor, Coins, RefreshCw
} from 'lucide-vue-next'

const APP_VERSION = '0.2.0'

const themeStore = useThemeStore()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const showApiKey = ref(false)
const editingApiKey = ref(false)
const tempApiKey = ref(settingsStore.apiKey)
const showClearConfirm = ref(false)
const showClearCacheConfirm = ref(false)
const apiKeySaved = ref(false)
const importResult = ref<{ success: boolean; message: string } | null>(null)

const maskedApiKey = computed(() => {
  if (!settingsStore.apiKey) return '未设置'
  if (settingsStore.apiKey.length <= 8) return '********'
  return settingsStore.apiKey.substring(0, 4) + '****' + settingsStore.apiKey.substring(settingsStore.apiKey.length - 4)
})

function startEditApiKey() {
  tempApiKey.value = settingsStore.apiKey
  editingApiKey.value = true
  apiKeySaved.value = false
}

function saveApiKey() {
  settingsStore.setApiKey(tempApiKey.value)
  editingApiKey.value = false
  apiKeySaved.value = true
  setTimeout(() => { apiKeySaved.value = false }, 2000)
}

function cancelEditApiKey() {
  editingApiKey.value = false
  tempApiKey.value = settingsStore.apiKey
}

function clearApiKey() {
  settingsStore.clearApiKey()
  tempApiKey.value = ''
  editingApiKey.value = false
}

function handleClearHistory() {
  idiomStore.clearHistory()
  idiomStore.clearCompareHistory()
  showClearConfirm.value = false
}

function handleClearCache() {
  idiomStore.clearCache()
  idiomStore.clearHistory()
  idiomStore.clearCompareHistory()
  showClearCacheConfirm.value = false
}

function handleRefresh() {
  location.reload()
}

function handleExport() {
  const json = idiomStore.exportData()
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
      importResult.value = idiomStore.importData(content)
      setTimeout(() => { importResult.value = null }, 3000)
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<template>
  <div class="min-h-screen px-4 pt-8 pb-4">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="seal w-12 h-12 text-3xl mx-auto mb-3">我</div>
      <h1 class="font-kai text-4xl text-ink leading-tight">个人设置</h1>
    </div>

    <div class="mx-auto max-w-lg space-y-4">
      <!-- Stats Card -->
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
        </div>
      </div>

      <!-- API Key Setting -->
      <div class="card rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-dai-soft text-dai">
            <Key :size="20" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-ink">DeepSeek API Key</h3>
            <p class="text-xs text-ink-mute">用于生成成语学习内容</p>
          </div>
          <div v-if="apiKeySaved" class="flex items-center gap-1 text-bamboo">
            <Check :size="14" />
            <span class="text-xs">已保存</span>
          </div>
        </div>

        <div v-if="!editingApiKey">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-soft">
            <div class="flex-1">
              <p class="text-sm text-ink-soft font-mono">
                {{ showApiKey ? settingsStore.apiKey || '未设置' : maskedApiKey }}
              </p>
            </div>
            <button
              v-if="settingsStore.apiKey"
              @click="showApiKey = !showApiKey"
              class="p-1.5 rounded-lg text-ink-mute hover:text-ink transition-colors"
            >
              <component :is="showApiKey ? EyeOff : Eye" :size="16" />
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              @click="startEditApiKey"
              class="flex-1 py-2 rounded-xl text-sm font-medium btn-primary transition-colors"
            >
              {{ settingsStore.apiKey ? '修改' : '设置 API Key' }}
            </button>
            <button
              v-if="settingsStore.apiKey"
              @click="clearApiKey"
              class="px-4 py-2 rounded-xl text-sm font-medium text-zhuhong bg-zhuhong-soft hover:opacity-85 transition-colors"
            >
              清除
            </button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <input
            v-model="tempApiKey"
            type="password"
            placeholder="输入 DeepSeek API Key"
            class="w-full px-4 py-3 rounded-xl bg-soft text-sm text-ink placeholder-ink-mute outline-none border border-line focus:border-zhuhong focus:ring-2 focus:ring-zhuhong/15"
          />
          <div class="flex gap-2">
            <button
              @click="saveApiKey"
              class="flex-1 py-2 rounded-xl text-sm font-medium btn-primary transition-colors"
            >
              保存
            </button>
            <button
              @click="cancelEditApiKey"
              class="px-4 py-2 rounded-xl text-sm font-medium text-ink-soft bg-soft hover:opacity-80 transition-colors"
            >
              取消
            </button>
          </div>
          <div class="flex items-start gap-2 p-3 rounded-xl bg-dai-soft">
            <Info :size="14" class="text-dai shrink-0 mt-0.5" />
            <p class="text-xs text-ink-soft">
              API Key 仅保存在本地浏览器中，不会上传到任何服务器。
            </p>
          </div>
        </div>
      </div>

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
        <div v-if="!themeStore.followSystem" class="flex gap-2">
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
        </div>
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

          <div
            v-if="importResult"
            class="p-3 rounded-xl text-sm"
            :class="importResult.success ? 'bg-bamboo-soft text-bamboo' : 'bg-zhuhong-soft text-zhuhong'"
          >
            {{ importResult.message }}
          </div>

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
      <div
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
      </div>
    </Teleport>

    <!-- Clear Cache Confirm Modal -->
    <Teleport to="body">
      <div
        v-if="showClearCacheConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showClearCacheConfirm = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
          <h3 class="text-lg font-semibold text-ink mb-2">清空所有缓存？</h3>
          <p class="text-sm text-ink-soft mb-6">
            此操作将删除所有已缓存的成语内容和搜索记录，且不可恢复。
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
      </div>
    </Teleport>

    <!-- Version -->
    <div class="text-center mt-8 mb-4">
      <p class="text-xs text-ink-mute">v{{ APP_VERSION }}</p>
    </div>
  </div>
</template>

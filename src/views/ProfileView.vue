<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import {
  Sun, Moon, Key, BookOpen, Trash2, Eye, EyeOff, Check, Info,
  Download, Upload, Monitor
} from 'lucide-vue-next'

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
  showClearConfirm.value = false
}

function handleClearCache() {
  idiomStore.clearCache()
  idiomStore.clearHistory()
  showClearCacheConfirm.value = false
}

// 导出 JSON
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

// 导入 JSON
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
  <div class="min-h-screen px-4 pt-6 pb-4">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">个人设置</h1>
    </div>

    <div class="mx-auto max-w-lg space-y-6">
      <!-- Stats Card -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <BookOpen :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">学习统计</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">你的学习进度</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-center">
            <p class="text-3xl font-bold text-red-600 dark:text-red-400">
              {{ idiomStore.learnedCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">已学成语</p>
          </div>
          <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-center">
            <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {{ idiomStore.searchHistory.length }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">搜索次数</p>
          </div>
        </div>
      </div>

      <!-- API Key Setting -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <Key :size="20" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">DeepSeek API Key</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">用于生成成语学习内容</p>
          </div>
          <div v-if="apiKeySaved" class="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Check :size="14" />
            <span class="text-xs">已保存</span>
          </div>
        </div>

        <div v-if="!editingApiKey">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="flex-1">
              <p class="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {{ showApiKey ? settingsStore.apiKey || '未设置' : maskedApiKey }}
              </p>
            </div>
            <button
              v-if="settingsStore.apiKey"
              @click="showApiKey = !showApiKey"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <component :is="showApiKey ? EyeOff : Eye" :size="16" />
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              @click="startEditApiKey"
              class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              {{ settingsStore.apiKey ? '修改' : '设置 API Key' }}
            </button>
            <button
              v-if="settingsStore.apiKey"
              @click="clearApiKey"
              class="px-4 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
            class="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none border border-gray-200 dark:border-gray-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          <div class="flex gap-2">
            <button
              @click="saveApiKey"
              class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              保存
            </button>
            <button
              @click="cancelEditApiKey"
              class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
          <div class="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <Info :size="14" class="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p class="text-xs text-blue-700 dark:text-blue-300">
              API Key 仅保存在本地浏览器中，不会上传到任何服务器。
            </p>
          </div>
        </div>
      </div>

      <!-- Theme Setting -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <component :is="themeStore.followSystem ? Monitor : (themeStore.theme === 'dark' ? Moon : Sun)" :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">主题模式</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ themeStore.followSystem ? '跟随系统' : (themeStore.theme === 'dark' ? '深色模式' : '浅色模式') }}
            </p>
          </div>
        </div>

        <!-- Follow system toggle -->
        <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
          <div class="flex items-center gap-2">
            <Monitor :size="16" class="text-gray-500 dark:text-gray-400" />
            <span class="text-sm text-gray-700 dark:text-gray-300">跟随系统</span>
          </div>
          <button
            @click="themeStore.setFollowSystem(!themeStore.followSystem)"
            class="relative w-11 h-6 rounded-full transition-colors duration-300"
            :class="themeStore.followSystem ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
              :style="{ transform: themeStore.followSystem ? 'translateX(20px)' : 'translateX(0)' }"
            />
          </button>
        </div>

        <!-- Manual theme selector (only when not following system) -->
        <div v-if="!themeStore.followSystem" class="flex gap-2">
          <button
            @click="themeStore.theme === 'dark' && themeStore.toggleTheme()"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="themeStore.theme === 'light'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
          >
            <Sun :size="16" />
            浅色
          </button>
          <button
            @click="themeStore.theme === 'light' && themeStore.toggleTheme()"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200"
            :class="themeStore.theme === 'dark'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
          >
            <Moon :size="16" />
            深色
          </button>
        </div>
      </div>

      <!-- Data Management -->
      <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            <Trash2 :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">数据管理</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">导入导出与清理</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="handleExport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Download :size="16" />
              导出数据
            </button>
            <button
              @click="handleImport"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Upload :size="16" />
              导入数据
            </button>
          </div>

          <!-- Import result message -->
          <div
            v-if="importResult"
            class="p-3 rounded-xl text-sm"
            :class="importResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'"
          >
            {{ importResult.message }}
          </div>

          <button
            @click="showClearConfirm = true"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            清空搜索历史
          </button>
          <button
            @click="showClearCacheConfirm = true"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
        <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            清空搜索历史？
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            此操作将清空所有搜索记录，但已缓存的成语内容不会被删除。
          </p>
          <div class="flex gap-3">
            <button
              @click="showClearConfirm = false"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
            <button
              @click="handleClearHistory"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
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
        <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            清空所有缓存？
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            此操作将删除所有已缓存的成语内容和搜索记录，且不可恢复。
          </p>
          <div class="flex gap-3">
            <button
              @click="showClearCacheConfirm = false"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
            <button
              @click="handleClearCache"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              确认清空
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

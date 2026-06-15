import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IdiomData, SearchRecord } from '../types/idiom'
import { generateIdiomContent } from '../api/deepseek'

export const useIdiomStore = defineStore('idiom', () => {
  // 已缓存的成语数据（使用普通对象代替 Map，确保 JSON 序列化正常）
  const idiomCache = ref<Record<string, IdiomData>>({})

  // 搜索历史
  const searchHistory = ref<SearchRecord[]>([])

  // 当前显示的成语
  const currentIdiom = ref<IdiomData | null>(null)

  // 加载状态
  const isLoading = ref(false)

  // 错误信息
  const errorMessage = ref('')

  // 已学习成语数量
  const learnedCount = computed(() => Object.keys(idiomCache.value).length)

  // 搜索历史（按时间倒序）
  const sortedHistory = computed(() =>
    [...searchHistory.value].sort((a, b) => b.timestamp - a.timestamp)
  )

  /**
   * 搜索成语
   */
  async function searchIdiom(word: string, apiKey: string): Promise<IdiomData | null> {
    const trimmedWord = word.trim()
    if (!trimmedWord) return null

    // 检查缓存
    const cached = idiomCache.value[trimmedWord]
    if (cached) {
      currentIdiom.value = cached
      updateSearchTimestamp(trimmedWord)
      return cached
    }

    // 调用 API
    isLoading.value = true
    errorMessage.value = ''

    try {
      const result = await generateIdiomContent(trimmedWord, apiKey)

      const idiomData: IdiomData = {
        id: `idiom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word: trimmedWord,
        pinyin: result.pinyin,
        explanation: result.explanation,
        origin: result.origin,
        example: result.example,
        usage: result.usage,
        relatedIdioms: result.relatedIdioms,
        createdAt: Date.now()
      }

      idiomCache.value[trimmedWord] = idiomData
      addSearchRecord(trimmedWord)
      currentIdiom.value = idiomData

      return idiomData
    } catch (error: any) {
      errorMessage.value = error.message || '生成失败，请重试'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 重新生成成语内容
   */
  async function regenerateIdiom(word: string, apiKey: string): Promise<IdiomData | null> {
    const trimmedWord = word.trim()
    if (!trimmedWord) return null

    isLoading.value = true
    errorMessage.value = ''

    try {
      const result = await generateIdiomContent(trimmedWord, apiKey)

      const idiomData: IdiomData = {
        id: `idiom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word: trimmedWord,
        pinyin: result.pinyin,
        explanation: result.explanation,
        origin: result.origin,
        example: result.example,
        usage: result.usage,
        relatedIdioms: result.relatedIdioms,
        createdAt: Date.now()
      }

      idiomCache.value[trimmedWord] = idiomData
      currentIdiom.value = idiomData

      return idiomData
    } catch (error: any) {
      errorMessage.value = error.message || '重新生成失败，请重试'
      return null
    } finally {
      isLoading.value = false
    }
  }

  function addSearchRecord(word: string) {
    const existingIndex = searchHistory.value.findIndex(r => r.word === word)
    if (existingIndex >= 0) {
      searchHistory.value[existingIndex].timestamp = Date.now()
    } else {
      searchHistory.value.push({
        id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word,
        timestamp: Date.now()
      })
    }
  }

  function updateSearchTimestamp(word: string) {
    const record = searchHistory.value.find(r => r.word === word)
    if (record) {
      record.timestamp = Date.now()
    }
  }

  function getIdiomFromCache(word: string): IdiomData | null {
    return idiomCache.value[word] || null
  }

  function deleteSearchRecord(recordId: string) {
    const index = searchHistory.value.findIndex(r => r.id === recordId)
    if (index >= 0) {
      searchHistory.value.splice(index, 1)
    }
  }

  function clearHistory() {
    searchHistory.value = []
  }

  function clearCache() {
    idiomCache.value = {}
    currentIdiom.value = null
  }

  function setCurrentIdiom(word: string) {
    const cached = idiomCache.value[word]
    if (cached) {
      currentIdiom.value = cached
      updateSearchTimestamp(word)
    }
  }

  function clearError() {
    errorMessage.value = ''
  }

  // JSON 导出
  function exportData(): string {
    return JSON.stringify({
      idiomCache: idiomCache.value,
      searchHistory: searchHistory.value
    }, null, 2)
  }

  // JSON 导入
  function importData(json: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(json)
      if (!data.idiomCache || !data.searchHistory) {
        return { success: false, message: '数据格式不正确' }
      }
      // 合并缓存（不覆盖已有的）
      for (const [word, idiom] of Object.entries(data.idiomCache)) {
        if (!idiomCache.value[word]) {
          idiomCache.value[word] = idiom as IdiomData
        }
      }
      // 合并历史（不重复添加）
      for (const record of data.searchHistory as SearchRecord[]) {
        if (!searchHistory.value.find(r => r.word === record.word)) {
          searchHistory.value.push(record)
        }
      }
      return { success: true, message: `成功导入 ${Object.keys(data.idiomCache).length} 个成语` }
    } catch {
      return { success: false, message: 'JSON 解析失败，请检查文件格式' }
    }
  }

  return {
    idiomCache,
    searchHistory,
    currentIdiom,
    isLoading,
    errorMessage,
    learnedCount,
    sortedHistory,
    searchIdiom,
    regenerateIdiom,
    getIdiomFromCache,
    deleteSearchRecord,
    clearHistory,
    clearCache,
    setCurrentIdiom,
    clearError,
    exportData,
    importData
  }
}, {
  persist: {
    key: 'idiom-store',
    paths: ['idiomCache', 'searchHistory']
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IdiomData, SearchRecord } from '../types/idiom'
import { generateIdiomContent } from '../api/deepseek'

export const useIdiomStore = defineStore('idiom', () => {
  // 已缓存的成语数据
  const idiomCache = ref<Map<string, IdiomData>>(new Map())

  // 搜索历史
  const searchHistory = ref<SearchRecord[]>([])

  // 当前显示的成语
  const currentIdiom = ref<IdiomData | null>(null)

  // 加载状态
  const isLoading = ref(false)

  // 错误信息
  const errorMessage = ref('')

  // 已学习成语数量
  const learnedCount = computed(() => idiomCache.value.size)

  // 搜索历史（按时间倒序）
  const sortedHistory = computed(() =>
    [...searchHistory.value].sort((a, b) => b.timestamp - a.timestamp)
  )

  /**
   * 搜索成语
   * 先检查缓存，如果有直接返回；否则调用 API
   */
  async function searchIdiom(word: string, apiKey: string): Promise<IdiomData | null> {
    const trimmedWord = word.trim()
    if (!trimmedWord) return null

    // 检查缓存
    const cached = idiomCache.value.get(trimmedWord)
    if (cached) {
      currentIdiom.value = cached
      // 更新搜索记录时间
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

      // 存入缓存
      idiomCache.value.set(trimmedWord, idiomData)

      // 添加搜索记录
      addSearchRecord(trimmedWord)

      // 设置当前成语
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

      // 更新缓存
      idiomCache.value.set(trimmedWord, idiomData)

      // 设置当前成语
      currentIdiom.value = idiomData

      return idiomData
    } catch (error: any) {
      errorMessage.value = error.message || '重新生成失败，请重试'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 添加搜索记录
   */
  function addSearchRecord(word: string) {
    const existingIndex = searchHistory.value.findIndex(r => r.word === word)
    if (existingIndex >= 0) {
      // 已存在，更新时间
      searchHistory.value[existingIndex].timestamp = Date.now()
    } else {
      // 新记录
      searchHistory.value.push({
        id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 更新搜索记录时间戳
   */
  function updateSearchTimestamp(word: string) {
    const record = searchHistory.value.find(r => r.word === word)
    if (record) {
      record.timestamp = Date.now()
    }
  }

  /**
   * 从缓存获取成语
   */
  function getIdiomFromCache(word: string): IdiomData | null {
    return idiomCache.value.get(word) || null
  }

  /**
   * 删除搜索记录
   */
  function deleteSearchRecord(recordId: string) {
    const index = searchHistory.value.findIndex(r => r.id === recordId)
    if (index >= 0) {
      searchHistory.value.splice(index, 1)
    }
  }

  /**
   * 清空所有历史记录
   */
  function clearHistory() {
    searchHistory.value = []
  }

  /**
   * 清空所有缓存
   */
  function clearCache() {
    idiomCache.value.clear()
    currentIdiom.value = null
  }

  /**
   * 设置当前成语（从缓存中）
   */
  function setCurrentIdiom(word: string) {
    const cached = idiomCache.value.get(word)
    if (cached) {
      currentIdiom.value = cached
      updateSearchTimestamp(word)
    }
  }

  /**
   * 清除错误信息
   */
  function clearError() {
    errorMessage.value = ''
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
    clearError
  }
}, {
  persist: {
    key: 'idiom-store',
    paths: ['idiomCache', 'searchHistory']
  }
})

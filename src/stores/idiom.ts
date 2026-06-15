import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IdiomData, SearchRecord, CompareRecord, TokenStats } from '../types/idiom'
import { generateIdiomContent, generateComparison } from '../api/deepseek'

export const useIdiomStore = defineStore('idiom', () => {
  // 已缓存的成语数据
  const idiomCache = ref<Record<string, IdiomData>>({})

  // 搜索历史
  const searchHistory = ref<SearchRecord[]>([])

  // 对比缓存（key 为排序后的词语 join）
  const compareCache = ref<Record<string, CompareRecord>>({})

  // 对比历史
  const compareHistory = ref<CompareRecord[]>([])

  // Token 统计
  const tokenStats = ref<TokenStats>({ totalTokens: 0, requestCount: 0 })

  // 当前显示的成语
  const currentIdiom = ref<IdiomData | null>(null)

  // 当前显示的对比
  const currentCompare = ref<CompareRecord | null>(null)

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

  // 对比历史（按时间倒序）
  const sortedCompareHistory = computed(() =>
    [...compareHistory.value].sort((a, b) => b.createdAt - a.createdAt)
  )

  // 生成对比缓存 key
  function getCompareKey(words: string[]): string {
    return [...words].sort().join('|')
  }

  // 累加 token 统计
  function addTokenUsage(tokens: number) {
    tokenStats.value.totalTokens += tokens
    tokenStats.value.requestCount += 1
  }

  /**
   * 搜索成语
   */
  async function searchIdiom(word: string, apiKey: string): Promise<IdiomData | null> {
    const trimmedWord = word.trim()
    if (!trimmedWord) return null

    const cached = idiomCache.value[trimmedWord]
    if (cached) {
      currentIdiom.value = cached
      updateSearchTimestamp(trimmedWord)
      return cached
    }

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

  /**
   * 生成词语对比
   */
  async function compareIdioms(words: string[], apiKey: string): Promise<CompareRecord | null> {
    const trimmedWords = words.map(w => w.trim()).filter(w => w.length > 0)
    if (trimmedWords.length < 2) {
      errorMessage.value = '至少需要两个词语进行对比'
      return null
    }

    // 检查缓存
    const key = getCompareKey(trimmedWords)
    const cached = compareCache.value[key]
    if (cached) {
      currentCompare.value = cached
      updateCompareTimestamp(key)
      return cached
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      const result = await generateComparison(trimmedWords, apiKey)
      addTokenUsage(result.tokenUsage)

      const compareRecord: CompareRecord = {
        id: `compare_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        words: trimmedWords,
        content: result.comparison,
        tokenUsage: result.tokenUsage,
        createdAt: Date.now()
      }

      compareCache.value[key] = compareRecord
      addCompareRecord(compareRecord)
      currentCompare.value = compareRecord

      return compareRecord
    } catch (error: any) {
      errorMessage.value = error.message || '对比生成失败，请重试'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 重新生成对比
   */
  async function regenerateComparison(words: string[], apiKey: string): Promise<CompareRecord | null> {
    const trimmedWords = words.map(w => w.trim()).filter(w => w.length > 0)
    if (trimmedWords.length < 2) return null

    isLoading.value = true
    errorMessage.value = ''

    try {
      const result = await generateComparison(trimmedWords, apiKey)
      addTokenUsage(result.tokenUsage)

      const compareRecord: CompareRecord = {
        id: `compare_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        words: trimmedWords,
        content: result.comparison,
        tokenUsage: result.tokenUsage,
        createdAt: Date.now()
      }

      const key = getCompareKey(trimmedWords)
      compareCache.value[key] = compareRecord
      currentCompare.value = compareRecord

      return compareRecord
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

  function addCompareRecord(record: CompareRecord) {
    const key = getCompareKey(record.words)
    const existingIndex = compareHistory.value.findIndex(r => getCompareKey(r.words) === key)
    if (existingIndex >= 0) {
      compareHistory.value[existingIndex] = record
    } else {
      compareHistory.value.push(record)
    }
  }

  function updateSearchTimestamp(word: string) {
    const record = searchHistory.value.find(r => r.word === word)
    if (record) {
      record.timestamp = Date.now()
    }
  }

  function updateCompareTimestamp(key: string) {
    const record = compareHistory.value.find(r => getCompareKey(r.words) === key)
    if (record) {
      record.createdAt = Date.now()
    }
  }

  function getIdiomFromCache(word: string): IdiomData | null {
    return idiomCache.value[word] || null
  }

  function setCurrentIdiom(word: string) {
    const cached = idiomCache.value[word]
    if (cached) {
      currentIdiom.value = cached
      updateSearchTimestamp(word)
    }
  }

  function setCurrentCompare(id: string) {
    const record = compareHistory.value.find(r => r.id === id)
    if (record) {
      currentCompare.value = record
    }
  }

  function deleteSearchRecord(recordId: string) {
    const index = searchHistory.value.findIndex(r => r.id === recordId)
    if (index >= 0) {
      searchHistory.value.splice(index, 1)
    }
  }

  function deleteCompareRecord(recordId: string) {
    const index = compareHistory.value.findIndex(r => r.id === recordId)
    if (index >= 0) {
      compareHistory.value.splice(index, 1)
    }
  }

  function clearHistory() {
    searchHistory.value = []
  }

  function clearCompareHistory() {
    compareHistory.value = []
  }

  function clearCache() {
    idiomCache.value = {}
    compareCache.value = {}
    currentIdiom.value = null
    currentCompare.value = null
  }

  function clearError() {
    errorMessage.value = ''
  }

  // JSON 导出
  function exportData(): string {
    return JSON.stringify({
      idiomCache: idiomCache.value,
      searchHistory: searchHistory.value,
      compareCache: compareCache.value,
      compareHistory: compareHistory.value,
      tokenStats: tokenStats.value
    }, null, 2)
  }

  // JSON 导入
  function importData(json: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(json)
      if (!data.idiomCache || !data.searchHistory) {
        return { success: false, message: '数据格式不正确' }
      }
      // 合并成语缓存
      for (const [word, idiom] of Object.entries(data.idiomCache)) {
        if (!idiomCache.value[word]) {
          idiomCache.value[word] = idiom as IdiomData
        }
      }
      // 合并搜索历史
      for (const record of data.searchHistory as SearchRecord[]) {
        if (!searchHistory.value.find(r => r.word === record.word)) {
          searchHistory.value.push(record)
        }
      }
      // 合并对比缓存和历史
      if (data.compareCache) {
        for (const [key, record] of Object.entries(data.compareCache)) {
          if (!compareCache.value[key]) {
            compareCache.value[key] = record as CompareRecord
          }
        }
      }
      if (data.compareHistory) {
        for (const record of data.compareHistory as CompareRecord[]) {
          const key = getCompareKey(record.words)
          if (!compareHistory.value.find(r => getCompareKey(r.words) === key)) {
            compareHistory.value.push(record)
          }
        }
      }
      // 合并 token 统计
      if (data.tokenStats) {
        tokenStats.value.totalTokens += data.tokenStats.totalTokens || 0
        tokenStats.value.requestCount += data.tokenStats.requestCount || 0
      }

      return { success: true, message: `成功导入 ${Object.keys(data.idiomCache).length} 个成语` }
    } catch {
      return { success: false, message: 'JSON 解析失败，请检查文件格式' }
    }
  }

  return {
    idiomCache,
    searchHistory,
    compareCache,
    compareHistory,
    tokenStats,
    currentIdiom,
    currentCompare,
    isLoading,
    errorMessage,
    learnedCount,
    sortedHistory,
    sortedCompareHistory,
    searchIdiom,
    regenerateIdiom,
    compareIdioms,
    regenerateComparison,
    getIdiomFromCache,
    setCurrentIdiom,
    setCurrentCompare,
    deleteSearchRecord,
    deleteCompareRecord,
    clearHistory,
    clearCompareHistory,
    clearCache,
    clearError,
    exportData,
    importData
  }
}, {
  persist: {
    key: 'idiom-store',
    paths: ['idiomCache', 'searchHistory', 'compareCache', 'compareHistory', 'tokenStats']
  }
})

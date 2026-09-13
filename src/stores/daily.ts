import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateDaily, type DailyIssue, type DailyProgressPhase } from '../api/daily'
import type { ApiConfig } from '../api/deepseek'
import { useIdiomStore } from './idiom'

export const useDailyStore = defineStore('daily', () => {
  const issues = ref<DailyIssue[]>([])
  const loading = ref(false), error = ref(''), selectedId = ref('')
  const progressPhase = ref<DailyProgressPhase>('searching'), streamedText = ref('')
  let controller: AbortController | undefined
  async function generate(config: ApiConfig) {
    if (loading.value) return
    loading.value = true; error.value = ''; progressPhase.value = 'searching'; streamedText.value = ''; controller = new AbortController()
    let consumedTokens = 0
    try {
      const issue = await generateDaily(
        { ...config }, issues.value.flatMap(i => i.articles.map(a => a.url)), controller.signal,
        tokens => { consumedTokens += tokens },
        progress => { progressPhase.value = progress.phase; if (progress.text !== undefined) streamedText.value = progress.text }
      )
      if (controller.signal.aborted) throw new Error('已取消生成')
      // Write before showing success: storage quota errors must never masquerade as a saved issue.
      const next = [issue, ...issues.value]
      localStorage.setItem('daily-store', JSON.stringify({ issues: next, selectedId: issue.id }))
      issues.value = next; selectedId.value = issue.id
    } catch (e) { error.value = e instanceof Error ? e.message : '日报生成失败' }
    finally {
      if (consumedTokens > 0) {
        useIdiomStore().addTokenUsage(consumedTokens)
        if (error.value) error.value += `（本次接口已报告消耗 ${consumedTokens.toLocaleString()} tokens）`
      }
      loading.value = false; streamedText.value = ''; controller = undefined
    }
  }
  function cancel() { controller?.abort() }
  return { issues, loading, error, selectedId, progressPhase, streamedText, generate, cancel }
}, { persist: { key: 'daily-store', paths: ['issues', 'selectedId'] } })

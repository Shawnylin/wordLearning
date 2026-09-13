import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateDaily, type DailyIssue } from '../api/daily'
import type { ApiConfig } from '../api/deepseek'
import { useIdiomStore } from './idiom'

export const useDailyStore = defineStore('daily', () => {
  const issues = ref<DailyIssue[]>([])
  const loading = ref(false), error = ref(''), selectedId = ref('')
  let controller: AbortController | undefined
  async function generate(config: ApiConfig) {
    if (loading.value) return
    loading.value = true; error.value = ''; controller = new AbortController()
    try {
      const issue = await generateDaily({ ...config }, issues.value.flatMap(i => i.articles.map(a => a.url)), controller.signal)
      if (controller.signal.aborted) throw new Error('已取消生成')
      // Write before showing success: storage quota errors must never masquerade as a saved issue.
      const next = [issue, ...issues.value]
      localStorage.setItem('daily-store', JSON.stringify({ issues: next, selectedId: issue.id }))
      issues.value = next; selectedId.value = issue.id
      useIdiomStore().addTokenUsage(issue.tokenUsage)
    } catch (e) { error.value = e instanceof Error ? e.message : '日报生成失败' }
    finally { loading.value = false; controller = undefined }
  }
  function cancel() { controller?.abort() }
  return { issues, loading, error, selectedId, generate, cancel }
}, { persist: { key: 'daily-store', paths: ['issues', 'selectedId'] } })

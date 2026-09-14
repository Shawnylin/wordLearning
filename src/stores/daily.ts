import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateDaily, type DailyIssue, type DailyProgressPhase } from '../api/daily'
import { generateDailyFromLink } from '../api/dailyLink'
import type { ApiConfig } from '../api/deepseek'
import { useIdiomStore } from './idiom'

export const useDailyStore = defineStore('daily', () => {
  const issues = ref<DailyIssue[]>([])
  const loading = ref(false), error = ref(''), selectedId = ref('')
  const progressPhase = ref<DailyProgressPhase>('searching'), streamedText = ref('')
  let controller: AbortController | undefined
  function saveIssue(issue: DailyIssue) {
    if (issue.pdf && issues.value.some(i => i.pdf?.fingerprint === issue.pdf!.fingerprint)) throw new Error('这份 PDF 已导入，请在历史日报中继续学习')
    const next = [issue, ...issues.value]
    localStorage.setItem('daily-store', JSON.stringify({ issues: next, selectedId: issue.id }))
    issues.value = next; selectedId.value = issue.id
  }
  function toggleCompleted(issueId: string, index: number) {
    error.value = ''
    const next = issues.value.map(issue => issue.id !== issueId ? issue : { ...issue, articles: issue.articles.map((a, i) => i !== index ? a : { ...a, completedAt: a.completedAt ? undefined : Date.now() }) })
    try {
      localStorage.setItem('daily-store', JSON.stringify({ issues: next, selectedId: selectedId.value }))
      issues.value = next
    } catch { error.value = '学习进度保存失败，本机空间可能不足，请先导出备份' }
  }
  async function generate(config: ApiConfig, link?: string) {
    if (loading.value) return
    loading.value = true; error.value = ''; progressPhase.value = link ? 'reading' : 'searching'; streamedText.value = ''; controller = new AbortController()
    let consumedTokens = 0
    try {
      const runner: typeof generateDaily = link ? (config, ...args) => generateDailyFromLink(config, link, ...args) : generateDaily
      const issue = await runner(
        { ...config }, issues.value.flatMap(i => i.articles.map(a => a.url)), controller.signal,
        tokens => { consumedTokens += tokens },
        progress => { progressPhase.value = progress.phase; if (progress.text !== undefined) streamedText.value = progress.text }
      )
      if (controller.signal.aborted) throw new Error('已取消生成')
      // Write before showing success: storage quota errors must never masquerade as a saved issue.
      saveIssue(issue)
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
  return { issues, loading, error, selectedId, progressPhase, streamedText, generate, cancel, saveIssue, toggleCompleted }
}, { persist: { key: 'daily-store', paths: ['issues', 'selectedId'] } })

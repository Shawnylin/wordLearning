import { validateArticles, type DailyArticle, type DailyIssue } from './daily'

export function validateDailyIssue(value: unknown): DailyIssue {
  const issue = value as any
  const fail = () => { throw new Error('日报备份格式错误') }
  if (!issue || typeof issue.id !== 'string' || !issue.id || !Number.isFinite(issue.createdAt)) return fail()
  let articles: DailyArticle[]
  let pdf: DailyIssue['pdf']
  if (issue.pdf) {
    const p = issue.pdf
    if (typeof p.filename !== 'string' || !/^[a-f0-9]{64}$/.test(p.fingerprint) || !Number.isInteger(p.pages) || p.pages < 1 || p.pages > 32 || typeof p.remainder !== 'string' || p.remainder.length > 500000 || typeof p.model !== 'string') return fail()
    if (!Array.isArray(issue.articles) || !issue.articles.length || issue.articles.length > 3000) return fail()
    articles = issue.articles.map((a: any) => {
      if (!a || a.origin !== 'pdf' || typeof a.title !== 'string' || !a.title.trim() || a.title.length > 20000 || typeof a.content !== 'string' || !a.content.trim() || a.content.length > 250000 || !Number.isInteger(a.page) || a.page < 1 || a.page > p.pages) return fail()
      const words = Array.isArray(a.words) ? a.words.filter((w: unknown) => typeof w === 'string' && /^[\u3400-\u9fff]{2,12}$/.test(w) && a.content.includes(w)).slice(0, 6) : []
      return { title: a.title, content: a.content, page: a.page, source: '导入 PDF', url: '', publishedAt: '', analysis: '', words, origin: 'pdf' }
    })
    if (p.rawText !== undefined && (typeof p.rawText !== 'string' || p.rawText.length > 500000)) return fail()
    pdf = { filename: p.filename, fingerprint: p.fingerprint, pages: p.pages, remainder: p.remainder, model: p.model, usageEstimated: p.usageEstimated === true, ...(p.rawText ? { rawText: p.rawText } : {}) }
  } else articles = validateArticles(issue.articles)
  articles = articles.map((a, index) => {
    const completedAt = issue.articles[index].completedAt
    return { ...a, ...(Number.isFinite(completedAt) && completedAt > 0 && completedAt <= Date.now() ? { completedAt } : {}) }
  })
  return { id: issue.id, createdAt: issue.createdAt, articles, tokenUsage: Number.isFinite(issue.tokenUsage) ? Math.max(0, issue.tokenUsage) : 0, ...(pdf ? { pdf } : {}) }
}

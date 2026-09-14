import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { planBatches, textLines, type PdfDraft, type TextItem } from './pdfPlan'
GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdf(file: File, signal: AbortSignal, onProgress: (text: string) => void): Promise<PdfDraft> {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 50 * 1024 * 1024) throw new Error('请选择不超过 50 MB 的 PDF 文件')
  const bytes = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('文件不是有效的 PDF')
  const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
  const task = getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false })
  const abort = () => { void task.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    const doc = await task.promise
    if (doc.numPages > 32) throw new Error('单次最多导入 32 页，请按日期拆分报纸')
    const draft: PdfDraft = { filename: file.name, fingerprint, pages: doc.numPages, batches: [], tokenUsage: 0, usageEstimated: false, models: [] }
    let chars = 0
    for (let page = 1; page <= doc.numPages; page++) {
      signal.throwIfAborted(); onProgress(`本机读取 ${page}/${doc.numPages} 页`)
      const pdfPage = await doc.getPage(page)
      const content = await pdfPage.getTextContent()
      const lines = textLines(content.items.filter((item): item is TextItem & { dir: string; fontName: string } => 'str' in item))
      if (lines.reduce((n, line) => n + line.text.replace(/\s/g, '').length, 0) < 40) throw new Error(`第 ${page} 页没有可提取的文字层，暂不支持扫描件 OCR；请下载文字版 PDF`)
      chars += lines.reduce((n, line) => n + line.text.length, 0)
      if (chars > 250000) throw new Error('文字超过 25 万字，请拆分 PDF 后导入')
      draft.batches.push(...planBatches(page, lines)); pdfPage.cleanup()
    }
    return draft
  } catch (e) {
    if (signal.aborted) throw new Error('已取消读取')
    if (e instanceof Error && e.name === 'PasswordException') throw new Error('PDF 有密码保护，请先解锁后导入')
    throw e
  } finally { signal.removeEventListener('abort', abort); await task.destroy() }
}

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Newspaper, ExternalLink, Clock, X } from 'lucide-vue-next'
import Motion from '../components/Motion.vue'
import DailyGenerateMenu from '../components/DailyGenerateMenu.vue'
import DailyStudySheet from '../components/DailyStudySheet.vue'
import DailyPdfImport from '../components/DailyPdfImport.vue'
import type { DailyIssue } from '../api/daily'
import { useDailyStore } from '../stores/daily'
import { useSettingsStore } from '../stores/settings'
const daily = useDailyStore(), settings = useSettingsStore()
const sheet = ref<InstanceType<typeof DailyStudySheet>>()
const pdfImporter = ref<InstanceType<typeof DailyPdfImport>>()
function completed(issue: DailyIssue) { return issue.articles.filter(a => a.completedAt).length }
function jumpArticle(index: number) { document.getElementById(`daily-article-${index}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }) }
function nextUnread() { const index = selected.value?.articles.findIndex(a => !a.completedAt) ?? -1; if (index >= 0) jumpArticle(index) }
const selected = computed(() => daily.issues.find(i => i.id === daily.selectedId) || daily.issues[0])
const history = ref<HTMLDialogElement>()
const selectedText = ref('')
const progressLabel = computed(() => ({
  searching: '联网搜索中',
  reading: '正在读取文章',
  generating: '正在生成日报内容',
  validating: '正在校验原文并保存'
}[daily.progressPhase]))
let closingHistory = false
async function closeHistory() {
  if (!history.value?.open || closingHistory) return
  closingHistory = true
  const dialog = history.value
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await dialog.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.97)' }], { duration: 180, easing: 'ease', fill: 'forwards' }).finished.catch(() => {})
  }
  dialog.close()
  dialog.getAnimations().forEach(animation => animation.cancel())
  closingHistory = false
}
function readSelection() {
  const selection = window.getSelection()
  const nodeElement = (node: Node | null) => node instanceof Element ? node : node?.parentElement
  const start = nodeElement(selection?.anchorNode || null)?.closest('.daily-prose')
  const end = nodeElement(selection?.focusNode || null)?.closest('.daily-prose')
  const text = selection?.toString().trim() || ''
  selectedText.value = start && start === end && /^[\u3400-\u9fff]{2,12}$/.test(text) ? text : ''
}
function querySelected() {
  const text = selectedText.value
  if (!text) return
  window.getSelection()?.removeAllRanges()
  selectedText.value = ''
  sheet.value?.open(text)
}
function queryWord(word: string) {
  if (window.getSelection()?.toString().trim()) return
  sheet.value?.open(word)
}
function chooseIssue(id: string) { daily.selectedId = id; void closeHistory() }
onMounted(() => document.addEventListener('selectionchange', readSelection))
onBeforeUnmount(() => document.removeEventListener('selectionchange', readSelection))
function dateLabel(timestamp: number) { return new Date(timestamp).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
function segments(content: string, words: string[]) {
  const terms = [...words].sort((a, b) => b.length - a.length)
  const result: { text: string; word?: string }[] = []
  let plain = ''
  for (let i = 0; i < content.length;) {
    const word = terms.find(w => content.startsWith(w, i))
    if (word) { if (plain) result.push({ text: plain }); plain = ''; result.push({ text: word, word }); i += word.length }
    else plain += content[i++]
  }
  if (plain) result.push({ text: plain })
  return result
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-6"><div class="mx-auto max-w-3xl space-y-5">
    <header class="flex items-center justify-between gap-2">
      <h1 class="font-kai text-2xl text-ink whitespace-nowrap">每日精读</h1>
      <div class="flex items-center gap-2 shrink-0">
        <DailyGenerateMenu :loading="daily.loading" @generate="link => daily.generate(settings.apiConfig, link)" @cancel="daily.cancel" @pdf="pdfImporter?.open()" />
        <button @click="history?.showModal()" class="w-10 h-10 rounded-full card flex items-center justify-center text-zhuhong" aria-label="查看历史日报"><Clock :size="18" /></button>
      </div>
    </header>
    <Motion><div v-if="daily.loading" class="daily-progress rounded-2xl bg-soft p-4 text-sm text-ink-soft" role="status" aria-live="polite">
      <div class="flex items-center gap-2 text-ink"><span class="daily-progress-dot" aria-hidden="true" /><span class="font-medium">{{ progressLabel }}</span></div>
      <p v-if="daily.progressPhase === 'searching'" class="mt-2 text-xs leading-6">正在从人民网、光明网和半月谈检索并核对近三年的优质文段。</p>
      <p v-if="daily.progressPhase === 'reading'" class="mt-2 text-xs leading-6">正在读取指定网页正文，随后生成精读文段。</p>
      <pre v-if="daily.streamedText" class="daily-stream mt-3">{{ daily.streamedText }}</pre>
    </div></Motion>
    <Motion><p v-if="daily.error" role="alert" class="rounded-2xl bg-zhuhong-soft p-4 text-sm text-zhuhong">{{ daily.error }}</p></Motion>
    <Motion><div v-if="selected" :key="selected.id" class="space-y-5">
      <section class="border-y border-line py-4 space-y-3" aria-label="本期阅读进度">
        <div class="flex items-center justify-between gap-3 text-sm"><span>{{ completed(selected) === selected.articles.length ? '已学完' : '学习进度' }} · {{ completed(selected) }}/{{ selected.articles.length }} 篇</span><button v-if="completed(selected) < selected.articles.length" @click="nextUnread" class="text-zhuhong">继续未学文章</button></div>
        <progress :value="completed(selected)" :max="selected.articles.length" class="w-full h-1.5" aria-label="已学完文章数" />
        <details v-if="selected.articles.length > 1"><summary class="text-xs text-ink-mute cursor-pointer">文章目录</summary><button v-for="(a, index) in selected.articles" :key="index" @click="jumpArticle(index)" class="block text-left text-sm leading-7 mt-2">{{ a.completedAt ? '✓' : '○' }} {{ index + 1 }}. {{ a.title }}</button></details>
      </section>
      <p v-if="selected.pdf" class="text-xs leading-6 text-ink-mute">{{ selected.pdf.filename }} · {{ selected.pdf.pages }} 页 · 以下为所上传版面的文字。跨版续篇需另行导入，分篇顺序请对照原 PDF 核对。</p>
      <article v-for="(article, articleIndex) in selected.articles" :id="`daily-article-${articleIndex}`" :key="articleIndex" class="daily-article">
        <div class="text-xs text-ink-mute mb-4">{{ article.origin === 'pdf' ? `PDF 版面原文 · 第 ${article.page} 页` : '原文节选' }}<span v-if="article.completedAt" class="ml-3 text-bamboo">✓ 已学完</span></div>
        <h2 class="font-serif text-xl font-semibold leading-relaxed text-ink">{{ article.title }}</h2>
        <a v-if="article.url" :href="article.url" target="_blank" rel="noopener noreferrer" class="inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-mute mt-3 underline underline-offset-4">{{ article.source }}<template v-if="article.publishedAt"> · 发布于 {{ article.publishedAt }}</template><template v-else> · 未标注发布日期</template><ExternalLink :size="12" /></a>
        <p class="daily-prose mt-5"><template v-for="(segment, i) in segments(article.content, article.words)" :key="i"><button v-if="segment.word" @click="queryWord(segment.word)" class="daily-word" :aria-label="`学习${segment.word}`">{{ segment.text }}</button><template v-else>{{ segment.text }}</template></template></p>
        <p v-if="article.origin === 'pdf' && /下转|上接|全文见/.test(article.content)" class="text-xs text-zhuhong mt-4">原文含跨版提示；此处保留当前上传版面的内容。</p>
        <details v-if="article.analysis" class="mt-5 pt-4 border-t border-line"><summary class="text-xs text-zhuhong cursor-pointer">逻辑与表达 · AI 学习提示</summary><p class="text-sm leading-7 text-ink-soft mt-2">{{ article.analysis }}</p></details>
        <footer class="mt-6 flex items-center justify-between gap-3"><span class="text-xs text-ink-mute">{{ article.content.length.toLocaleString() }} 字符 · 读完后手动确认</span><button @click="daily.toggleCompleted(selected.id, articleIndex)" :aria-pressed="!!article.completedAt" class="rounded-full px-4 py-2 text-sm shrink-0" :class="article.completedAt ? 'bg-soft text-ink-soft' : 'bg-zhuhong-soft text-zhuhong'">{{ article.completedAt ? '撤销学完' : '标记已学完' }}</button></footer>
      </article>
      <details v-if="selected.pdf?.remainder" class="border-t border-line py-4"><summary class="text-sm cursor-pointer text-ink-soft">其他版面文字 · 图片说明、报头及未归类文字</summary><p class="daily-prose mt-4">{{ selected.pdf.remainder }}</p></details>
      <details v-if="selected.pdf?.rawText" class="border-t border-line py-4"><summary class="text-xs cursor-pointer text-ink-mute">核对原始提取文字（含排版空格）</summary><p class="daily-prose mt-4">{{ selected.pdf.rawText }}</p></details>
      <p class="text-center text-xs text-ink-mute">保存于 {{ dateLabel(selected.createdAt) }} · {{ selected.pdf?.usageEstimated ? '含估算 ' : '' }}{{ selected.tokenUsage.toLocaleString() }} tokens · 已保存到本机</p>
    </div><div v-else class="text-center py-10 text-ink-mute"><Newspaper :size="36" class="mx-auto mb-4 opacity-50" /><p class="font-kai text-xl">每天积累一段好表达</p><p class="text-xs mt-3 leading-6">生成后自动归档。点击划线词，或长按选中词语后查询。</p></div></Motion>
  </div>
  <Teleport to="body">
    <Motion><div v-if="selectedText" class="selection-query"><span class="truncate">{{ selectedText }}</span><button @pointerdown.prevent @click="querySelected" class="btn-primary rounded-full px-4 py-2 shrink-0">查询</button></div></Motion>
    <dialog ref="history" class="daily-history" aria-label="历史日报" @cancel.prevent="closeHistory" @click="event => { if (event.target === history) closeHistory() }">
      <section class="p-5"><header class="flex justify-between items-center mb-4"><h2 class="font-kai text-xl">历史日报</h2><button @click="closeHistory" class="p-2 rounded-full bg-soft" aria-label="关闭历史日报"><X :size="18" /></button></header>
        <p v-if="!daily.issues.length" class="text-sm text-ink-mute py-8 text-center">暂无历史日报，生成后自动保存在这里</p>
        <div class="space-y-2"><button v-for="issue in daily.issues" :key="issue.id" @click="chooseIssue(issue.id)" class="w-full rounded-2xl p-4 text-left transition-colors" :class="selected?.id === issue.id ? 'bg-zhuhong-soft text-zhuhong' : 'bg-soft text-ink'" :aria-current="selected?.id === issue.id ? 'true' : undefined"><span class="text-xs opacity-70">{{ dateLabel(issue.createdAt) }} · {{ issue.pdf ? 'PDF · ' : '' }}{{ issue.articles.length }} 篇</span><span class="block text-xs mt-2" :class="completed(issue) === issue.articles.length ? 'text-bamboo' : 'text-ink-mute'">{{ completed(issue) === issue.articles.length ? '✓ 已学完' : completed(issue) ? '学习中' : '未开始' }} · {{ completed(issue) }}/{{ issue.articles.length }} 篇</span><span class="block text-sm mt-2 leading-6">{{ issue.articles[0]?.title }}</span></button></div>
      </section>
    </dialog>
  </Teleport>
  <DailyStudySheet ref="sheet" /><DailyPdfImport ref="pdfImporter" /></div>
</template>

<style scoped>
.daily-article { padding: 16px 0 32px; border-bottom: 1px solid var(--line); scroll-margin-top: 24px; }
progress { accent-color: var(--zhuhong); }
.daily-prose { -webkit-user-select: text; user-select: text; font-family: var(--font-serif, serif); font-size: 17px; line-height: 2.25; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.daily-word { -webkit-user-select: text; user-select: text; display: inline; font: inherit; color: var(--zhuhong); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 1px; border-radius: 4px; transition: background .2s, color .2s; }
.daily-word:hover,.daily-word:focus-visible { background: var(--zhuhong-soft); outline: 2px solid var(--zhuhong); outline-offset: 2px; }
.daily-progress-dot { width: 8px; height: 8px; flex: none; border-radius: 999px; background: var(--zhuhong); box-shadow: 0 0 0 0 color-mix(in srgb, var(--zhuhong) 35%, transparent); animation: daily-pulse 1.4s ease-out infinite; }
.daily-stream { max-height: 32dvh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 12px; line-height: 1.8; color: var(--ink-soft); border-top: 1px solid var(--line); padding-top: 12px; }
.selection-query { position: fixed; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%); z-index: 65; display: flex; align-items: center; gap: 16px; max-width: calc(100vw - 32px); padding: 8px 8px 8px 18px; border: 1px solid var(--line); border-radius: 99px; background: var(--card); color: var(--ink); box-shadow: 0 8px 32px #0002; font-size: 14px; }
.daily-history { margin: auto; width: min(480px, calc(100vw - 24px)); max-height: 75dvh; overflow-y: auto; background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 24px; }
.daily-history::backdrop { background: #0004; backdrop-filter: blur(8px); }
.daily-history[open] { animation: history-enter .25s ease both; }
@keyframes history-enter { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes daily-pulse { 70%,100% { box-shadow: 0 0 0 8px transparent; } }
@media (prefers-reduced-motion: reduce) { .daily-history[open],.daily-progress-dot { animation: none; } }
</style>

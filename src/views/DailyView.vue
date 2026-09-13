<script setup lang="ts">
import { computed, ref } from 'vue'
import { Newspaper, Sparkles, ExternalLink, Clock } from 'lucide-vue-next'
import Motion from '../components/Motion.vue'
import DailyStudySheet from '../components/DailyStudySheet.vue'
import { useDailyStore } from '../stores/daily'
import { useSettingsStore } from '../stores/settings'
import { deepSeekSearchNotice, isOfficialDeepSeek } from '../api/daily'
const daily = useDailyStore(), settings = useSettingsStore()
const sheet = ref<InstanceType<typeof DailyStudySheet>>()
const selected = computed(() => daily.issues.find(i => i.id === daily.selectedId) || daily.issues[0])
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
  <div class="min-h-screen px-4 pt-6 pb-6"><div class="mx-auto max-w-lg space-y-5">
    <header class="flex items-center justify-between"><div><p class="text-xs tracking-[.25em] text-ink-mute mb-2">读时事 · 学表达</p><h1 class="font-kai text-3xl text-ink">每日精读</h1></div><Newspaper :size="30" class="text-zhuhong" /></header>
    <section class="card rounded-3xl p-5 space-y-4">
      <p class="text-sm leading-7 text-ink-soft">从人民日报、光明日报、半月谈中，精选适合逻辑填空的时事文段。点按划线词语，即可随文学习。</p>
      <div class="flex items-center gap-2"><button @click="daily.generate(settings.apiConfig)" :disabled="daily.loading" class="btn-primary rounded-full px-5 py-3 text-sm flex items-center gap-2 disabled:opacity-50"><Sparkles :size="16" />{{ daily.loading ? '正在联网选文…' : '生成今日日报' }}</button><button v-if="daily.loading" @click="daily.cancel" class="text-sm px-3 py-2 text-ink-mute">取消</button></div>
      <p class="text-xs text-ink-mute leading-5">当前：{{ settings.model }} · {{ isOfficialDeepSeek(settings.baseUrl) ? '已选择 DeepSeek 官方搜索接口。' : '需要支持 Responses 联网搜索的 API。' }}<RouterLink to="/profile/models" class="underline underline-offset-4">配置模型</RouterLink></p>
      <Motion><p v-if="isOfficialDeepSeek(settings.baseUrl)" class="text-xs text-ink-soft leading-6">{{ deepSeekSearchNotice }}<a href="https://api-docs.deepseek.com/zh-cn/guides/anthropic_api" target="_blank" rel="noopener noreferrer" class="underline underline-offset-4 ml-1">官方兼容说明</a></p></Motion>
    </section>
    <Motion><div v-if="daily.loading" class="rounded-2xl bg-soft p-4 text-sm text-ink-soft" role="status">正在检索近 7 天热点、核对原文与发布日期，必要时扩大至近 30 天。完成后自动保存，可离开此页。</div></Motion>
    <Motion><p v-if="daily.error" role="alert" class="rounded-2xl bg-zhuhong-soft p-4 text-sm text-zhuhong">{{ daily.error }}</p></Motion>
    <Motion><section v-if="daily.issues.length" class="space-y-3"><div class="flex items-center gap-2 text-xs text-ink-mute"><Clock :size="14" />已存日报 · {{ daily.issues.length }} 期</div><label class="block"><span class="sr-only">选择历史日报</span><select v-model="daily.selectedId" class="w-full bg-card border border-line rounded-2xl p-3 text-sm text-ink"><option v-for="issue in daily.issues" :key="issue.id" :value="issue.id">{{ dateLabel(issue.createdAt) }} · {{ issue.articles[0]?.title }}</option></select></label></section></Motion>
    <Motion><div v-if="selected" :key="selected.id" class="space-y-5">
      <article v-for="(article, index) in selected.articles" :key="article.url" class="card rounded-3xl p-5 sm:p-6">
        <div class="flex items-center justify-between text-xs text-ink-mute mb-4"><span class="text-zhuhong">精读 {{ String(index + 1).padStart(2, '0') }}</span><span>原文节选</span></div>
        <h2 class="font-serif text-xl font-semibold leading-relaxed text-ink">{{ article.title }}</h2>
        <a :href="article.url" target="_blank" rel="noopener noreferrer" class="inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-mute mt-3 underline underline-offset-4">{{ article.source }} · 发布于 {{ article.publishedAt }}<ExternalLink :size="12" /></a>
        <p class="daily-prose mt-5"><template v-for="(segment, i) in segments(article.content, article.words)" :key="i"><button v-if="segment.word" @click="sheet?.open(segment.word)" class="daily-word" :aria-label="`学习${segment.word}`">{{ segment.text }}</button><template v-else>{{ segment.text }}</template></template></p>
        <div class="mt-5 pt-4 border-t border-line"><p class="text-xs text-zhuhong mb-2">逻辑与表达 · AI 学习提示</p><p class="text-sm leading-7 text-ink-soft">{{ article.analysis }}</p></div>
      </article>
      <p class="text-center text-xs text-ink-mute">生成于 {{ dateLabel(selected.createdAt) }} · {{ selected.tokenUsage.toLocaleString() }} tokens · 已保存到本机</p>
    </div><div v-else class="text-center py-10 text-ink-mute"><Newspaper :size="36" class="mx-auto mb-4 opacity-50" /><p class="font-kai text-xl">每天积累一段好表达</p><p class="text-xs mt-3">生成后自动归档，随时回来重复学习</p></div></Motion>
  </div><DailyStudySheet ref="sheet" /></div>
</template>

<style scoped>
.daily-prose { font-family: var(--font-serif, serif); font-size: 17px; line-height: 2.25; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.daily-word { display: inline; font: inherit; color: var(--zhuhong); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 1px; border-radius: 4px; transition: background .2s, color .2s; }
.daily-word:hover,.daily-word:focus-visible { background: var(--zhuhong-soft); outline: 2px solid var(--zhuhong); outline-offset: 2px; }
</style>

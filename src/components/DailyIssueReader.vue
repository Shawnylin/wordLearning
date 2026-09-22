<script setup lang="ts">
import { ArrowRight, ExternalLink, Star } from 'lucide-vue-next'
import type { DailyIssue } from '../api/daily'
import SpeechButton from './SpeechButton.vue'

const props = defineProps<{
  issue: DailyIssue
  nextArticles: Array<{ title: string } | undefined>
}>()

const emit = defineEmits<{
  queryWord: [word: string]
  toggleStarred: []
  toggleCompleted: [articleIndex: number]
  readNext: [articleIndex: number]
}>()

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readingParagraphs(content: string) {
  return content.split(/\r\n?|\n|\u2028|\u2029/).filter(line => line.trim().length > 0)
}

function segments(content: string, words: string[]) {
  const terms = [...words].sort((a, b) => b.length - a.length)
  const result: { text: string; word?: string }[] = []
  let plain = ''
  for (let i = 0; i < content.length; ) {
    const word = terms.find(w => content.startsWith(w, i))
    if (word) {
      if (plain) result.push({ text: plain })
      plain = ''
      result.push({ text: word, word })
      i += word.length
    } else {
      plain += content[i++]
    }
  }
  if (plain) result.push({ text: plain })
  return result
}
</script>

<template>
  <div>
    <article
      v-for="(article, articleIndex) in props.issue.articles"
      :key="articleIndex"
      :id="`daily-article-${articleIndex}`"
      class="daily-article"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs text-ink-mute">
          {{ article.origin === 'pdf' ? `PDF 版面原文 · 第 ${article.page} 页` : '原文节选' }}
          <span v-if="article.completedAt" class="ml-3 text-bamboo">✓ 已学完</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <SpeechButton :text="article.title + '\n' + article.content" label="朗读日报" show-label />
          <button
            @click="emit('toggleStarred')"
            class="star-button"
            :class="{ active: article.starred }"
            :aria-label="article.starred ? '取消星标' : '添加星标'"
            :aria-pressed="!!article.starred"
          >
            <Star :size="19" :fill="article.starred ? 'currentColor' : 'none'" />
          </button>
        </div>
      </div>
      <h2 class="font-serif text-xl font-semibold leading-relaxed text-ink">
        {{ article.title }}
      </h2>
      <a
        v-if="article.url"
        :href="article.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-mute mt-3 underline underline-offset-4"
      >
        {{ article.source }}<template v-if="article.publishedAt"> · 发布于 {{ article.publishedAt }}</template><template v-else> · 未标注发布日期</template><ExternalLink :size="12" />
      </a>
      <div class="daily-body mt-5">
        <p
          v-for="(paragraph, paragraphIndex) in readingParagraphs(article.content)"
          :key="paragraphIndex"
          class="daily-prose"
        >
          <template v-for="(segment, i) in segments(paragraph, article.words)" :key="i">
            <button
              v-if="segment.word"
              @click="emit('queryWord', segment.word)"
              class="daily-word"
              :aria-label="`学习${segment.word}`"
            >
              {{ segment.text }}
            </button>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </div>
      <p
        v-if="article.origin === 'pdf' && /下转|上接|全文见/.test(article.content)"
        class="text-xs text-zhuhong mt-4"
      >
        原文含跨版提示；此处保留当前上传版面的内容。
      </p>
      <details v-if="article.analysis" class="mt-5 pt-4 border-t border-line">
        <summary class="text-xs text-zhuhong cursor-pointer">逻辑与表达 · AI 学习提示</summary>
        <p class="text-sm leading-7 text-ink-soft mt-2">{{ article.analysis }}</p>
      </details>
      <footer class="mt-6 flex items-center justify-between gap-3">
        <span class="text-xs text-ink-mute">
          {{ article.content.length.toLocaleString() }} 字符 · 读完后手动确认
        </span>
        <button
          @click="emit('toggleCompleted', articleIndex)"
          :aria-pressed="!!article.completedAt"
          class="rounded-full px-4 py-2 text-sm shrink-0"
          :class="article.completedAt ? 'bg-soft text-ink-soft' : 'bg-zhuhong-soft text-zhuhong'"
        >
          {{ article.completedAt ? '撤销学完' : '标记已学完' }}
        </button>
      </footer>
      <button
        class="read-next"
        :disabled="!props.nextArticles[articleIndex]"
        @click="emit('readNext', articleIndex)"
      >
        <span class="min-w-0">
          <span class="block text-sm">{{ props.nextArticles[articleIndex] ? '阅读下一篇' : '已是最后一篇' }}</span>
          <span
            v-if="props.nextArticles[articleIndex]"
            class="block text-xs text-ink-soft mt-1 break-words"
          >
            {{ props.nextArticles[articleIndex]?.title }}
          </span>
        </span>
        <ArrowRight v-if="props.nextArticles[articleIndex]" :size="18" class="shrink-0" />
      </button>
    </article>
    <details v-if="props.issue.pdf?.remainder" class="border-t border-line py-4">
      <summary class="text-sm cursor-pointer text-ink-soft">
        其他版面文字 · 图片说明、报头及未归类文字
      </summary>
      <div class="daily-body mt-4">
        <p
          v-for="(paragraph, index) in readingParagraphs(props.issue.pdf.remainder)"
          :key="index"
          class="daily-prose"
        >
          {{ paragraph }}
        </p>
      </div>
    </details>
    <p class="text-center text-xs text-ink-mute">
      保存于 {{ dateLabel(props.issue.createdAt) }} ·
      {{ props.issue.pdf?.usageEstimated ? '含估算 ' : '' }}{{ props.issue.tokenUsage.toLocaleString() }} tokens · 已保存到本机
    </p>
  </div>
</template>

<style scoped>
.daily-article {
  scroll-margin-top: 24px;
  padding: 2px 0 32px;
  border-bottom: 1px solid var(--line);
}
.read-next { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; margin-top: 20px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--soft); color: var(--zhuhong); text-align: left; }
.read-next:hover:not(:disabled) { background: var(--zhuhong-soft); border-color: var(--zhuhong); }
.read-next:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 3px; }
.read-next:disabled { color: var(--ink-mute); background: transparent; cursor: default; }
.star-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  color: var(--ink-mute);
  background: transparent;
}
.star-button.active {
  color: #ffc72c;
}
.daily-prose {
  -webkit-user-select: text;
  user-select: text;
  font-family: var(--font-serif, serif);
  font-size: 17px;
  line-height: 2.25;
  color: var(--ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.daily-body > .daily-prose { margin: 0; }
.daily-body > .daily-prose + .daily-prose { margin-top: .65em; }
@media (min-width: 768px) {
  .daily-prose { font-size: 16px; line-height: 1.95; }
}
@media (min-width: 1180px) {
  .daily-prose { font-size: 18px; }
}
.daily-word {
  -webkit-user-select: text;
  user-select: text;
  display: inline;
  font: inherit;
  color: var(--zhuhong);
  text-decoration: underline;
  text-underline-offset: 6px;
  text-decoration-thickness: 1px;
  border-radius: 4px;
  transition:
    background 0.2s,
    color 0.2s;
}
.daily-word:hover,
.daily-word:focus-visible {
  background: var(--zhuhong-soft);
  outline: 2px solid var(--zhuhong);
  outline-offset: 2px;
}
</style>

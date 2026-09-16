<script setup lang="ts">
import SpeechButton from '../components/SpeechButton.vue'
import { computed, nextTick, ref, onMounted, onBeforeUnmount } from "vue";
import {
  Newspaper,
  ExternalLink,
  Clock,
  Star,
  Check,
  Trash2,
  X,
  ArrowRight,
  ChevronDown,
  GripVertical,
} from "lucide-vue-next";
import Motion from "../components/Motion.vue";
import DailyGenerateMenu from "../components/DailyGenerateMenu.vue";
import DailyStudySheet from "../components/DailyStudySheet.vue";
import DailyPdfImport from "../components/DailyPdfImport.vue";
import { useDailyStore } from "../stores/daily";
import { useSettingsStore } from "../stores/settings";
import { useTabletLayout } from '../composables/useTabletLayout';
const tablet = useTabletLayout();
const daily = useDailyStore(),
  settings = useSettingsStore();
const sheet = ref<InstanceType<typeof DailyStudySheet>>(),
  pdfImporter = ref<InstanceType<typeof DailyPdfImport>>();
const selected = computed(
  () => daily.issues.find((i) => i.id === daily.selectedId) || daily.issues[0],
);
const readingOrder = computed(() => daily.issues.flatMap(issue =>
  issue.articles.map((article, index) => ({ issueId: issue.id, index, title: article.shortTitle || article.title })),
));
function nextArticle(index: number) {
  const current = readingOrder.value.findIndex(item => item.issueId === selected.value?.id && item.index === index);
  return current < 0 ? undefined : readingOrder.value[current + 1];
}
function readNext(index: number) {
  const next = nextArticle(index);
  if (!next) return;
  window.getSelection()?.removeAllRanges();
  selectedText.value = '';
  if (next.issueId !== selected.value?.id) chooseIssue(next.issueId);
  else document.getElementById(`daily-article-${next.index}`)?.scrollIntoView({
    block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
const historyTrigger = ref<HTMLButtonElement>(),
  historyPanel = ref<HTMLElement>();
const historyOpen = ref(false),
  historyMorphing = ref(false),
  historyManaging = ref(false),
  draggedIssueId = ref(""),
  dragOverGroupId = ref(""),
  selectedText = ref("");
const historyGroups = computed(() => daily.groups.map(group => ({
  ...group,
  issues: daily.issues.filter(issue => issue.groupId === group.id),
})).filter(group => historyManaging.value || group.issues.length));
const historyPlacement = ref({ left: "0px", top: "0px", width: "360px" });
let historyOrigin: DOMRect | undefined,
  appScroller: HTMLElement | null = null;
let historyAnimation: Animation | undefined, historyContentAnimation: Animation | undefined;
let swipeStart: { id: string; x: number; y: number } | undefined;
let swipeMoved = false,
  readingCompact = false;
const swipedId = ref(""),
  dragId = ref(""),
  dragOffset = ref(0);
const progressLabel = computed(
  () =>
    ({
      searching: "联网搜索中",
      reading: "正在读取文章",
      generating: "正在生成日报内容",
      validating: "正在校验原文并保存",
    })[daily.progressPhase],
);
function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function historyTitle(issue: (typeof daily.issues)[number]) {
  return (
    issue.articles[0]?.shortTitle || issue.articles[0]?.title || "未命名文章"
  );
}
function positionHistory() {
  historyOrigin = historyTrigger.value?.getBoundingClientRect();
  if (!historyOrigin) return;
  const width = Math.min(480, innerWidth - 24);
  historyPlacement.value = {
    left: `${Math.max(12, Math.min(historyOrigin.right - width, innerWidth - width - 12))}px`,
    top: `${Math.max(12, Math.min(historyOrigin.top, innerHeight - 120))}px`,
    width: `${width}px`,
  };
}
async function openHistory() {
  positionHistory();
  historyOpen.value = true;
  swipedId.value = "";
  await nextTick();
  historyPanel.value?.focus();
}
function closeHistory() {
  historyOpen.value = false;
  historyManaging.value = false;
  swipedId.value = "";
}
function toggleHistoryManagement() {
  historyManaging.value = !historyManaging.value;
  swipedId.value = "";
}
function renameHistoryGroup(groupId: string, event: Event) {
  daily.renameGroup(groupId, (event.target as HTMLInputElement).value);
}
function startHistoryDrag(issueId: string, event: DragEvent) {
  if (!historyManaging.value) return;
  draggedIssueId.value = issueId;
  event.dataTransfer?.setData("text/plain", issueId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
function dropIntoGroup(groupId: string, event: DragEvent) {
  event.preventDefault();
  const issueId = draggedIssueId.value || event.dataTransfer?.getData("text/plain") || "";
  if (issueId) daily.moveIssue(issueId, groupId);
  draggedIssueId.value = "";
  dragOverGroupId.value = "";
}
function historyKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeHistory();
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [
      ...(historyPanel.value?.querySelectorAll<HTMLElement>(
        'button:not([tabindex="-1"])',
      ) || []),
    ],
    first = controls[0],
    last = controls[controls.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === historyPanel.value)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function historyMorph(el: Element, done: () => void, leaving = false) {
  historyMorphing.value = true;
  const element = el as HTMLElement,
    end = element.getBoundingClientRect(),
    start = historyTrigger.value?.getBoundingClientRect() || historyOrigin || end;
  // Capture the current frame before reversing an interrupted opening.
  const radius = getComputedStyle(element).borderRadius;
  const inner = element.firstElementChild as HTMLElement | null;
  const innerOpacity = inner ? getComputedStyle(inner).opacity : '1';
  if (historyAnimation) {
    historyAnimation.oncancel = null;
    historyAnimation.onfinish = null;
    historyAnimation.cancel();
  }
  historyContentAnimation?.cancel();
  const small = {
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
    borderRadius: `${Math.min(start.width, start.height) / 2}px`,
    backgroundColor: "var(--card)",
    opacity: 1,
  };
  const large = {
    left: `${end.left}px`,
    top: `${end.top}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
    borderRadius: leaving ? radius : "24px",
    backgroundColor: "var(--card)",
    opacity: 1,
  };
  const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1
    : leaving ? 520 : 720;
  historyContentAnimation = inner?.animate(
    leaving
      ? [{ opacity: innerOpacity }, { opacity: 0, offset: .35 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 0, offset: .22 }, { opacity: 1, offset: .85 }, { opacity: 1 }],
    { duration, fill: "both", easing: 'linear' },
  );
  const animation = element.animate(leaving ? [large, small] : [small, large], {
    duration,
    easing: "cubic-bezier(.32,0,.18,1)",
  });
  historyAnimation = animation;
  animation.onfinish = () => {
    historyMorphing.value = false;
    done();
  };
  animation.oncancel = () => {
    historyMorphing.value = false;
    done();
  };
}
function readSelection() {
  const selection = window.getSelection(),
    nodeElement = (node: Node | null) =>
      node instanceof Element ? node : node?.parentElement;
  const start = nodeElement(selection?.anchorNode || null)?.closest(
      ".daily-prose",
    ),
    end = nodeElement(selection?.focusNode || null)?.closest(".daily-prose");
  const text = selection?.toString().trim() || "";
  selectedText.value =
    start && start === end && /^[\u3400-\u9fff]{2,12}$/.test(text) ? text : "";
}
function querySelected() {
  if (!selectedText.value) return;
  const text = selectedText.value;
  window.getSelection()?.removeAllRanges();
  selectedText.value = "";
  sheet.value?.open(text);
}
function queryWord(word: string) {
  if (!window.getSelection()?.toString().trim()) sheet.value?.open(word);
}
function chooseIssue(id: string) {
  daily.selectedId = id;
  closeHistory();
  appScroller?.scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
function rowStyle(id: string) {
  const x =
    dragId.value === id ? dragOffset.value : swipedId.value === id ? -76 : 0;
  return { transform: `translateX(${x}px)` };
}
function swipeDown(event: PointerEvent, id: string) {
  swipeStart = { id, x: event.clientX, y: event.clientY };
  swipeMoved = false;
  dragId.value = id;
  dragOffset.value = swipedId.value === id ? -76 : 0;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function swipeMove(event: PointerEvent) {
  if (!swipeStart || dragId.value !== swipeStart.id) return;
  const dx = event.clientX - swipeStart.x,
    dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) <= Math.abs(dy)) return;
  event.preventDefault();
  swipeMoved ||= Math.abs(dx) > 6;
  dragOffset.value = Math.max(
    -76,
    Math.min(0, (swipedId.value === swipeStart.id ? -76 : 0) + dx),
  );
}
function swipeEnd() {
  if (!swipeStart) return;
  swipedId.value = dragOffset.value < -38 ? swipeStart.id : "";
  dragId.value = "";
  dragOffset.value = 0;
  swipeStart = undefined;
}
function rowClick(id: string) {
  if (swipeMoved || swipedId.value) {
    swipeMoved = false;
    if (swipedId.value !== id) swipedId.value = "";
    return;
  }
  chooseIssue(id);
}
function removeIssue(id: string) {
  daily.deleteIssue(id);
  swipedId.value = "";
}
function onScroll() {
  const top = appScroller?.scrollTop || 0;
  const next = !!selected.value && (readingCompact ? top > 4 : top > 120);
  if (next === readingCompact) return;
  readingCompact = next;
  window.dispatchEvent(
    new CustomEvent("daily-reading-mode", { detail: { compact: next } }),
  );
}
// Paragraph spacing belongs to the renderer, not to blank lines in stored text.
// Keep every nonblank line verbatim and never rewrite the saved article.
function readingParagraphs(content: string) {
  return content.split(/\r\n?|\n|\u2028|\u2029/).filter(line => line.trim().length > 0);
}
function segments(content: string, words: string[]) {
  const terms = [...words].sort((a, b) => b.length - a.length),
    result: { text: string; word?: string }[] = [];
  let plain = "";
  for (let i = 0; i < content.length; ) {
    const word = terms.find((w) => content.startsWith(w, i));
    if (word) {
      if (plain) result.push({ text: plain });
      plain = "";
      result.push({ text: word, word });
      i += word.length;
    } else plain += content[i++];
  }
  if (plain) result.push({ text: plain });
  return result;
}
onMounted(() => {
  daily.normalizePdfIssues();
  daily.ensureGroups();
  document.addEventListener("selectionchange", readSelection);
  appScroller = document.getElementById("app");
  appScroller?.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  window.addEventListener("resize", positionHistory);
});
onBeforeUnmount(() => {
  historyAnimation?.cancel();
  historyContentAnimation?.cancel();
  document.removeEventListener("selectionchange", readSelection);
  appScroller?.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", positionHistory);
  readingCompact = false;
  window.dispatchEvent(
    new CustomEvent("daily-reading-mode", { detail: { compact: false } }),
  );
});
</script>

<template>
  <div class="daily-workspace min-h-screen px-4 pt-6 pb-6">
    <div
      class="daily-reader mx-auto max-w-3xl"
      :class="
        selected && !daily.loading && !daily.error ? 'space-y-0' : 'space-y-5'
      "
    >
      <header class="flex items-center justify-between gap-2">
        <h1 class="font-kai text-2xl text-ink whitespace-nowrap">每日精读</h1>
        <div class="flex items-center gap-2 shrink-0">
          <DailyGenerateMenu
            :loading="daily.loading"
            @generate="(link) => daily.generate(settings.apiConfig, link)"
            @cancel="daily.cancel"
            @pdf="pdfImporter?.open()"
          /><button
            ref="historyTrigger"
            @click="openHistory"
            class="w-10 h-10 rounded-full card flex items-center justify-center text-zhuhong"
            :style="{
              visibility: historyOpen || historyMorphing ? 'hidden' : 'visible',
            }"
            aria-label="查看历史日报"
          >
            <Clock :size="18" />
          </button>
        </div>
      </header>
      <Motion
        ><div
          v-if="daily.loading"
          class="daily-progress rounded-2xl bg-soft p-4 text-sm text-ink-soft"
          role="status"
          aria-live="polite"
        >
          <div class="flex items-center gap-2 text-ink">
            <span class="daily-progress-dot" aria-hidden="true" /><span
              class="font-medium"
              >{{ progressLabel }}</span
            >
          </div>
          <p
            v-if="daily.progressPhase === 'searching'"
            class="mt-2 text-xs leading-6"
          >
            正在从人民网、光明网和半月谈检索并核对近三年的优质文段。
          </p>
          <p
            v-if="daily.progressPhase === 'reading'"
            class="mt-2 text-xs leading-6"
          >
            正在读取指定网页正文，随后生成精读文段。
          </p>
          <pre v-if="daily.streamedText" class="daily-stream mt-3">{{
            daily.streamedText
          }}</pre>
        </div></Motion
      >
      <Motion
        ><p
          v-if="daily.error"
          role="alert"
          class="rounded-2xl bg-zhuhong-soft p-4 text-sm text-zhuhong"
        >
          {{ daily.error }}
        </p></Motion
      >
      <Motion
        ><div v-if="selected" :key="selected.id">
          <article
            v-for="(article, articleIndex) in selected.articles"
            :key="articleIndex"
            :id="`daily-article-${articleIndex}`"
            class="daily-article"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-ink-mute"
                >{{
                  article.origin === "pdf"
                    ? `PDF 版面原文 · 第 ${article.page} 页`
                    : "原文节选"
                }}<span v-if="article.completedAt" class="ml-3 text-bamboo"
                  >✓ 已学完</span
                ></span
              ><div class="flex items-center gap-1 shrink-0">
              <SpeechButton :text="article.title + '\n' + article.content" label="朗读日报" show-label />
              <button
                @click="daily.toggleStarred(selected.id)"
                class="star-button"
                :class="{ active: article.starred }"
                :aria-label="article.starred ? '取消星标' : '添加星标'"
                :aria-pressed="!!article.starred"
              >
                <Star
                  :size="19"
                  :fill="article.starred ? 'currentColor' : 'none'"
                />
              </button>
              </div>
            </div>
            <h2
              class="font-serif text-xl font-semibold leading-relaxed text-ink"
            >
              {{ article.title }}
            </h2>
            <a
              v-if="article.url"
              :href="article.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-mute mt-3 underline underline-offset-4"
              >{{ article.source
              }}<template v-if="article.publishedAt">
                · 发布于 {{ article.publishedAt }}</template
              ><template v-else> · 未标注发布日期</template
              ><ExternalLink :size="12"
            /></a>
            <div class="daily-body mt-5">
            <p v-for="(paragraph, paragraphIndex) in readingParagraphs(article.content)" :key="paragraphIndex" class="daily-prose">
              <template
                v-for="(segment, i) in segments(paragraph, article.words)"
                :key="i"
                ><button
                  v-if="segment.word"
                  @click="queryWord(segment.word)"
                  class="daily-word"
                  :aria-label="`学习${segment.word}`"
                >
                  {{ segment.text }}</button
                ><template v-else>{{ segment.text }}</template></template
              >
            </p>
            </div>
            <p
              v-if="
                article.origin === 'pdf' &&
                /下转|上接|全文见/.test(article.content)
              "
              class="text-xs text-zhuhong mt-4"
            >
              原文含跨版提示；此处保留当前上传版面的内容。
            </p>
            <details
              v-if="article.analysis"
              class="mt-5 pt-4 border-t border-line"
            >
              <summary class="text-xs text-zhuhong cursor-pointer">
                逻辑与表达 · AI 学习提示
              </summary>
              <p class="text-sm leading-7 text-ink-soft mt-2">
                {{ article.analysis }}
              </p>
            </details>
            <footer class="mt-6 flex items-center justify-between gap-3">
              <span class="text-xs text-ink-mute"
                >{{ article.content.length.toLocaleString() }} 字符 ·
                读完后手动确认</span
              ><button
                @click="daily.toggleCompleted(selected.id, articleIndex)"
                :aria-pressed="!!article.completedAt"
                class="rounded-full px-4 py-2 text-sm shrink-0"
                :class="
                  article.completedAt
                    ? 'bg-soft text-ink-soft'
                    : 'bg-zhuhong-soft text-zhuhong'
                "
              >
                {{ article.completedAt ? "撤销学完" : "标记已学完" }}
              </button>
            </footer>
            <button class="read-next" :disabled="!nextArticle(articleIndex)" @click="readNext(articleIndex)">
              <span class="min-w-0">
                <span class="block text-sm">{{ nextArticle(articleIndex) ? '阅读下一篇' : '已是最后一篇' }}</span>
                <span v-if="nextArticle(articleIndex)" class="block text-xs text-ink-soft mt-1 break-words">{{ nextArticle(articleIndex)?.title }}</span>
              </span>
              <ArrowRight v-if="nextArticle(articleIndex)" :size="18" class="shrink-0" />
            </button>
          </article>
          <details
            v-if="selected.pdf?.remainder"
            class="border-t border-line py-4"
          >
            <summary class="text-sm cursor-pointer text-ink-soft">
              其他版面文字 · 图片说明、报头及未归类文字
            </summary>
            <div class="daily-body mt-4"><p v-for="(paragraph, index) in readingParagraphs(selected.pdf.remainder)" :key="index" class="daily-prose">{{ paragraph }}</p></div>
          </details>
          <p class="text-center text-xs text-ink-mute">
            保存于 {{ dateLabel(selected.createdAt) }} ·
            {{ selected.pdf?.usageEstimated ? "含估算 " : ""
            }}{{ selected.tokenUsage.toLocaleString() }} tokens · 已保存到本机
          </p>
        </div>
        <div v-else class="text-center py-10 text-ink-mute">
          <Newspaper :size="36" class="mx-auto mb-4 opacity-50" />
          <p class="font-kai text-xl">每天积累一段好表达</p>
          <p class="text-xs mt-3 leading-6">
            生成后自动归档。点击划线词，或长按选中词语后查询。
          </p>
        </div></Motion
      >
    </div>
    <aside class="daily-lookup" aria-label="查词区域">
      <DailyStudySheet ref="sheet" :docked="tablet" :selection-text="selectedText" @query-selection="querySelected" />
    </aside>
    <Teleport to="body"
      ><Motion
        ><div v-if="selectedText && !tablet" class="selection-query">
          <span class="truncate">{{ selectedText }}</span
          ><button
            @pointerdown.prevent
            @click="querySelected"
            class="btn-primary rounded-full px-4 py-2 shrink-0"
          >
            查询
          </button>
        </div></Motion
      >
      <div
        v-if="historyOpen"
        class="history-outside"
        @pointerdown="closeHistory"
      />
      <Transition
        :css="false"
        @enter="(el, done) => historyMorph(el, done)"
        @leave="(el, done) => historyMorph(el, done, true)"
        @after-leave="historyTrigger?.focus({ preventScroll: true })"
        ><section
          v-if="historyOpen"
          ref="historyPanel"
          role="dialog"
          aria-modal="true"
          aria-label="历史日报"
          tabindex="-1"
          class="daily-history"
          :style="historyPlacement"
        @keydown="historyKeydown"
        >
          <div class="p-4">
            <header class="flex justify-between items-center gap-3 mb-4">
              <h2 class="font-kai text-xl">历史日报</h2>
              <div class="flex items-center gap-2">
                <button v-if="daily.issues.length" @click="toggleHistoryManagement" class="rounded-full bg-soft px-3 py-2 text-xs text-ink-soft">{{ historyManaging ? '完成' : '管理' }}</button>
                <button @click="closeHistory" class="p-2 rounded-full bg-soft" aria-label="关闭历史日报"><X :size="18" /></button>
              </div>
            </header>
            <p
              v-if="!daily.issues.length"
              class="text-sm text-ink-mute py-8 text-center"
            >
              暂无历史日报，生成后自动保存在这里
            </p>
            <div class="space-y-3">
              <section v-for="group in historyGroups" :key="group.id" class="history-group" :class="{ 'is-drag-over': dragOverGroupId === group.id }" @dragover.prevent="dragOverGroupId = group.id" @dragleave.self="dragOverGroupId = ''" @drop="dropIntoGroup(group.id, $event)">
                <div class="history-group-header">
                  <input v-if="historyManaging" :value="group.name" class="history-group-name" maxlength="40" aria-label="分组名称" @change="renameHistoryGroup(group.id, $event)" @keydown.enter="($event.target as HTMLInputElement).blur()" />
                  <button v-else class="history-group-toggle" :aria-expanded="!group.collapsed" @click="daily.toggleGroup(group.id)">
                    <span class="min-w-0 truncate">{{ group.name }}</span><span class="shrink-0 text-xs text-ink-mute">{{ group.issues.length }} 篇</span><ChevronDown :size="17" class="history-group-chevron" :class="{ collapsed: group.collapsed }" />
                  </button>
                  <button v-if="historyManaging" class="p-2 text-ink-mute" :aria-label="group.collapsed ? '展开分组' : '收起分组'" @click="daily.toggleGroup(group.id)"><ChevronDown :size="17" class="history-group-chevron" :class="{ collapsed: group.collapsed }" /></button>
                </div>
                <div v-if="!group.collapsed" class="space-y-2 p-2 pt-0">
                  <p v-if="historyManaging && !group.issues.length" class="rounded-xl border border-dashed border-line py-5 text-center text-xs text-ink-mute">拖动篇章到这里</p>
                  <div v-for="issue in group.issues" :key="issue.id" class="history-row" :class="{ 'is-revealed': !historyManaging && (swipedId === issue.id || (dragId === issue.id && dragOffset < 0)), 'is-dragging': draggedIssueId === issue.id }" :draggable="historyManaging" @dragstart="startHistoryDrag(issue.id, $event)" @dragend="draggedIssueId = ''; dragOverGroupId = ''">
                    <button v-if="!historyManaging" @click="removeIssue(issue.id)" class="history-delete" :tabindex="swipedId === issue.id ? 0 : -1" :aria-hidden="swipedId !== issue.id" :aria-label="`删除${historyTitle(issue)}`"><Trash2 :size="18" /><span>删除</span></button>
                    <button v-if="!historyManaging" class="history-row-body" :style="rowStyle(issue.id)" :aria-current="selected?.id === issue.id ? 'true' : undefined" @click="rowClick(issue.id)" @pointerdown="(event) => swipeDown(event, issue.id)" @pointermove="swipeMove" @pointerup="swipeEnd" @pointercancel="swipeEnd">
                      <span class="history-meta"><span class="history-date min-w-0 truncate">{{ dateLabel(issue.createdAt) }} · {{ issue.pdf ? "PDF" : "日报" }}</span><span class="history-state"><Star :size="15" :fill="issue.articles[0]?.starred ? 'currentColor' : 'none'" class="history-star" :class="{ active: issue.articles[0]?.starred }" /><span class="history-progress whitespace-nowrap" :class="issue.articles[0]?.completedAt ? 'text-bamboo' : 'text-ink-mute'"><Check v-if="issue.articles[0]?.completedAt" :size="14" :stroke-width="2.4" aria-hidden="true" />{{ issue.articles[0]?.completedAt ? "已学完" : "未学完" }}</span></span></span>
                      <span class="history-title">{{ historyTitle(issue) }}</span>
                    </button>
                    <div v-else class="history-row-body history-row-manage">
                      <GripVertical :size="18" class="history-grip" aria-hidden="true" />
                      <div class="min-w-0 flex-1"><p class="history-title mt-0">{{ historyTitle(issue) }}</p><select :value="group.id" class="history-group-select" :aria-label="`移动${historyTitle(issue)}到其他分组`" @change="daily.moveIssue(issue.id, ($event.target as HTMLSelectElement).value)"><option v-for="target in daily.groups" :key="target.id" :value="target.id">{{ target.name }}</option></select></div>
                      <button class="history-manage-delete" :aria-label="`删除${historyTitle(issue)}`" @click="removeIssue(issue.id)"><Trash2 :size="17" /></button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section></Transition
      ></Teleport
    >
    <DailyPdfImport ref="pdfImporter" />
  </div>
</template>

<style scoped>
.daily-reader { min-width: 0; width: 100%; }
.daily-lookup { display: none; }
@media (min-width: 768px) {
  .app-main > .daily-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(240px, 28vw, 360px);
    gap: clamp(16px, 2.5vw, 40px);
    align-items: start;
    max-width: 1440px;
    padding: 24px 16px;
  }
  .daily-reader { max-width: 760px; }
  .daily-lookup {
    display: block;
    position: sticky;
    top: calc(24px + env(safe-area-inset-top, 0px));
    height: calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
    min-width: 0;
  }
}
@media (min-width: 1180px) {
  .app-main > .daily-workspace { padding-inline: 32px; }
}
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
.daily-progress-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: var(--zhuhong);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--zhuhong) 35%, transparent);
  animation: daily-pulse 1.4s ease-out infinite;
}
.daily-stream {
  max-height: 32dvh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-soft);
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.selection-query {
  position: fixed;
  bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 65;
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 18px;
  border: 1px solid var(--line);
  border-radius: 99px;
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 8px 32px #0002;
  font-size: 14px;
}
.history-outside {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: transparent;
}
.daily-history {
  position: fixed;
  z-index: 71;
  max-height: 75dvh;
  overflow-y: auto;
  background: var(--card);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: 0 14px 48px #0002;
  outline: none;
}
.history-group { overflow: hidden; border: 1px solid var(--line); border-radius: 18px; transition: border-color .2s, background-color .2s; }
.history-group.is-drag-over { border-color: var(--zhuhong); background: var(--zhuhong-soft); }
.history-group-header { display: flex; min-height: 46px; align-items: center; padding: 4px 6px 4px 12px; }
.history-group-toggle { display: flex; min-width: 0; width: 100%; align-items: center; gap: 8px; color: var(--ink); text-align: left; font-size: 14px; font-weight: 600; }
.history-group-toggle > :first-child { flex: 1; }
.history-group-chevron { flex: none; transition: transform .25s cubic-bezier(.22,1,.36,1); }
.history-group-chevron.collapsed { transform: rotate(-90deg); }
.history-group-name { min-width: 0; flex: 1; border-bottom: 1px solid var(--zhuhong); padding: 6px 2px; color: var(--ink); font-size: 14px; font-weight: 600; outline: none; }
.history-row {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  isolation: isolate;
}
.history-row.is-dragging { opacity: .45; }
.history-row-manage { display: flex; align-items: center; gap: 9px; transform: none !important; touch-action: auto; }
.history-grip { flex: none; color: var(--ink-mute); cursor: grab; }
.history-group-select { width: 100%; margin-top: 7px; border: 1px solid var(--line); border-radius: 9px; padding: 6px 8px; background: var(--card); color: var(--ink-soft); font-size: 12px; outline: none; }
.history-manage-delete { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 12px; background: var(--zhuhong-soft); color: var(--zhuhong); }
.history-delete {
  background: var(--zhuhong);
  border-radius: 0 16px 16px 0;
  visibility: hidden;
  position: absolute;
  inset: 0 0 0 auto;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--color-paper-ink);
  font-size: 11px;
}
.history-row.is-revealed .history-delete { visibility: visible; }
.history-row-body {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 14px;
  text-align: left;
  border-radius: 16px;
  background: var(--soft);
  color: var(--ink);
  touch-action: pan-y;
  transition:
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.25s,
    color 0.25s;
}
.history-row-body[aria-current="true"] {
  background: var(--zhuhong-soft);
  color: var(--zhuhong);
}
.history-title {
  display: -webkit-box;
  width: 100%;
  margin-top: 3px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--ink);
}
.history-row-body[aria-current="true"] .history-title {
  color: var(--zhuhong);
}
.history-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.history-state {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.history-star {
  flex: none;
  color: var(--ink-mute);
}
.history-star.active {
  color: #ffc72c;
}
.history-date {
  color: var(--ink-mute);
}
.history-progress {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
@keyframes daily-pulse {
  70%,
  100% {
    box-shadow: 0 0 0 8px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .daily-progress-dot {
    animation: none;
  }
  .history-row-body {
    transition: none;
  }
  .history-group-chevron { transition: none; }
}
</style>

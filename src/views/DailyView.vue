<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { Newspaper, Clock } from "lucide-vue-next";
import Motion from "../components/Motion.vue";
import DailyGenerateMenu from "../components/DailyGenerateMenu.vue";
import DailyGenerationStatus from "../components/DailyGenerationStatus.vue";
import DailyHistoryContent from "../components/DailyHistoryContent.vue";
import DailyIssueReader from "../components/DailyIssueReader.vue";
import DailyStudySheet from "../components/DailyStudySheet.vue";
import DailyPdfImport from "../components/DailyPdfImport.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { useDailyStore } from "../stores/daily";
import { useSettingsStore } from "../stores/settings";
import { useMorphOverlay } from '../composables/useMorphOverlay';
import { useTabletLayout } from '../composables/useTabletLayout';
const tablet = useTabletLayout(960);
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
const nextArticles = computed(() =>
  selected.value?.articles.map((_, index) => {
    const next = nextArticle(index);
    return next ? { title: next.title } : undefined;
  }) || [],
);
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
const historyManaging = ref(false),
  draggedIssueId = ref(""),
  dragOverGroupId = ref(""),
  selectedText = ref("");
const pendingDeleteIssue = ref<string | null>(null);
const pendingDeleteTitle = computed(() => {
  const issue = daily.issues.find(item => item.id === pendingDeleteIssue.value);
  return issue?.articles[0]?.shortTitle || issue?.articles[0]?.title || '这份日报';
});
const historyGroups = computed(() => daily.groups.map(group => ({
  ...group,
  issues: daily.issues.filter(issue => issue.groupId === group.id),
})).filter(group => historyManaging.value || group.issues.length));
const {
  isOpen: historyOpen, morphing: historyMorphing, placement: historyPlacement,
  position: positionHistory, open: openHistory, close: closeHistory,
  morph: historyMorph, keydown: historyKeydown, afterLeave: historyAfterLeave,
} = useMorphOverlay({
  trigger: historyTrigger, panel: historyPanel, maxWidth: 480, initialWidth: 360,
  topLimit: height => height - 120, liveOrigin: true,
  onClose: () => { historyManaging.value = false; swipedId.value = ''; },
});
let appScroller: HTMLElement | null = null;
let swipeStart: { id: string; x: number; y: number } | undefined;
let swipeMoved = false,
  readingCompact = false;
const swipedId = ref(""),
  dragId = ref(""),
  dragOffset = ref(0);
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
  pendingDeleteIssue.value = id;
}
function confirmRemoveIssue() {
  if (!pendingDeleteIssue.value) return;
  daily.deleteIssue(pendingDeleteIssue.value);
  pendingDeleteIssue.value = null;
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
function onHistoryResize() { positionHistory(); }
onMounted(() => {
  daily.normalizePdfIssues();
  daily.ensureGroups();
  document.addEventListener("selectionchange", readSelection);
  appScroller = document.getElementById("app");
  appScroller?.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  window.addEventListener("resize", onHistoryResize);
});
onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", readSelection);
  appScroller?.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onHistoryResize);
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
        <h1 class="app-page-title font-kai text-ink whitespace-nowrap">每日精读</h1>
        <div class="flex items-center gap-2 shrink-0">
          <DailyGenerateMenu
            :loading="daily.loading"
            @generate="(link) => daily.generate(settings.apiConfig, link)"
            @cancel="daily.cancel"
            @pdf="pdfImporter?.open()"
          /><button
            ref="historyTrigger"
            @click="swipedId = ''; openHistory()"
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
      <DailyGenerationStatus
        :loading="daily.loading"
        :error="daily.error"
        :progress-phase="daily.progressPhase"
        :streamed-text="daily.streamedText"
      />
      <Motion
        ><DailyIssueReader
          v-if="selected"
          :key="selected.id"
          :issue="selected"
          :next-articles="nextArticles"
          @query-word="queryWord"
          @toggle-starred="daily.toggleStarred(selected.id)"
          @toggle-completed="(articleIndex) => daily.toggleCompleted(selected.id, articleIndex)"
          @read-next="readNext"
        />
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
        @after-leave="historyAfterLeave"
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
          <DailyHistoryContent
            :groups="historyGroups"
            :issue-count="daily.issues.length"
            :all-groups="daily.groups"
            :selected-id="selected?.id"
            :managing="historyManaging"
            :swiped-id="swipedId"
            :drag-id="dragId"
            :drag-offset="dragOffset"
            :dragged-issue-id="draggedIssueId"
            :drag-over-group-id="dragOverGroupId"
            @close="closeHistory"
            @toggle-management="toggleHistoryManagement"
            @toggle-group="daily.toggleGroup"
            @rename-group="renameHistoryGroup"
            @start-drag="startHistoryDrag"
            @end-drag="draggedIssueId = ''; dragOverGroupId = ''"
            @drag-over="dragOverGroupId = $event"
            @drag-leave="dragOverGroupId = ''"
            @drop="dropIntoGroup"
            @delete-issue="removeIssue"
            @row-click="rowClick"
            @swipe-down="swipeDown"
            @swipe-move="swipeMove"
            @swipe-end="swipeEnd"
            @move-issue="daily.moveIssue"
          />
        </section></Transition
      ></Teleport
    >
    <DailyPdfImport ref="pdfImporter" />
    <ConfirmDialog
      v-if="pendingDeleteIssue"
      title="删除日报？"
      :description="`确定要删除「${pendingDeleteTitle}」吗？删除后无法恢复，已经学习的词语会保留。`"
      @cancel="pendingDeleteIssue = null"
      @confirm="confirmRemoveIssue"
    />
  </div>
</template>

<style scoped>
.daily-reader { min-width: 0; width: 100%; }
.daily-lookup { display: none; }
@media (min-width: 960px) {
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
</style>

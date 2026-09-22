<script setup lang="ts">
import { Check, ChevronDown, GripVertical, Star, Trash2, X } from 'lucide-vue-next'
import type { DailyIssue } from '../api/daily'
import type { DailyGroup } from '../stores/daily'
import Motion from './Motion.vue'

type HistoryGroup = DailyGroup & { issues: DailyIssue[] }

const props = defineProps<{
  groups: HistoryGroup[]
  issueCount: number
  allGroups: DailyGroup[]
  selectedId?: string
  managing: boolean
  swipedId: string
  dragId: string
  dragOffset: number
  draggedIssueId: string
  dragOverGroupId: string
}>()

const emit = defineEmits<{
  close: []
  toggleManagement: []
  toggleGroup: [groupId: string]
  renameGroup: [groupId: string, event: Event]
  startDrag: [issueId: string, event: DragEvent]
  endDrag: []
  dragOver: [groupId: string]
  dragLeave: []
  drop: [groupId: string, event: DragEvent]
  deleteIssue: [issueId: string]
  rowClick: [issueId: string]
  swipeDown: [event: PointerEvent, issueId: string]
  swipeMove: [event: PointerEvent]
  swipeEnd: []
  moveIssue: [issueId: string, groupId: string]
}>()

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function historyTitle(issue: DailyIssue) {
  return issue.articles[0]?.shortTitle || issue.articles[0]?.title || '未命名文章'
}

function rowStyle(id: string) {
  const x = props.dragId === id ? props.dragOffset : props.swipedId === id ? -76 : 0
  return { transform: `translateX(${x}px)` }
}
</script>

<template>
  <div class="p-4">
    <header class="flex justify-between items-center gap-3 mb-4">
      <h2 class="font-kai text-xl">历史日报</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="props.issueCount"
          @click="emit('toggleManagement')"
          class="rounded-full bg-soft px-3 py-2 text-xs text-ink-soft"
        >
          {{ props.managing ? '完成' : '管理' }}
        </button>
        <button @click="emit('close')" class="p-2 rounded-full bg-soft" aria-label="关闭历史日报">
          <X :size="18" />
        </button>
      </div>
    </header>
    <p
      v-if="!props.issueCount"
      class="text-sm text-ink-mute py-8 text-center"
    >
      暂无历史日报，生成后自动保存在这里
    </p>
    <div class="space-y-3">
      <section
        v-for="group in props.groups"
        :key="group.id"
        class="history-group"
        :class="{ 'is-drag-over': props.dragOverGroupId === group.id }"
        @dragover.prevent="emit('dragOver', group.id)"
        @dragleave.self="emit('dragLeave')"
        @drop="emit('drop', group.id, $event)"
      >
        <div class="history-group-header">
          <input
            v-if="props.managing"
            :value="group.name"
            class="history-group-name"
            maxlength="40"
            aria-label="分组名称"
            @change="emit('renameGroup', group.id, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <button
            v-else
            class="history-group-toggle"
            :aria-expanded="!group.collapsed"
            @click="emit('toggleGroup', group.id)"
          >
            <span class="min-w-0 truncate">{{ group.name }}</span>
            <span class="shrink-0 text-xs text-ink-mute">{{ group.issues.length }} 篇</span>
            <ChevronDown :size="17" class="history-group-chevron" :class="{ collapsed: group.collapsed }" />
          </button>
          <button
            v-if="props.managing"
            class="p-2 text-ink-mute"
            :aria-label="group.collapsed ? '展开分组' : '收起分组'"
            @click="emit('toggleGroup', group.id)"
          >
            <ChevronDown :size="17" class="history-group-chevron" :class="{ collapsed: group.collapsed }" />
          </button>
        </div>
        <Motion>
          <div v-if="!group.collapsed" class="space-y-2 p-2 pt-0">
            <p
              v-if="props.managing && !group.issues.length"
              class="rounded-xl border border-dashed border-line py-5 text-center text-xs text-ink-mute"
            >
              拖动篇章到这里
            </p>
            <div
              v-for="issue in group.issues"
              :key="issue.id"
              class="history-row"
              :class="{
                'is-revealed': !props.managing && (props.swipedId === issue.id || (props.dragId === issue.id && props.dragOffset < 0)),
                'is-dragging': props.draggedIssueId === issue.id,
              }"
              :draggable="props.managing"
              @dragstart="emit('startDrag', issue.id, $event)"
              @dragend="emit('endDrag')"
            >
              <button
                v-if="!props.managing"
                @click="emit('deleteIssue', issue.id)"
                class="history-delete"
                :tabindex="props.swipedId === issue.id ? 0 : -1"
                :aria-hidden="props.swipedId !== issue.id"
                :aria-label="`删除${historyTitle(issue)}`"
              >
                <Trash2 :size="18" /><span>删除</span>
              </button>
              <button
                v-if="!props.managing"
                class="history-row-body"
                :style="rowStyle(issue.id)"
                :aria-current="props.selectedId === issue.id ? 'true' : undefined"
                @click="emit('rowClick', issue.id)"
                @pointerdown="emit('swipeDown', $event, issue.id)"
                @pointermove="emit('swipeMove', $event)"
                @pointerup="emit('swipeEnd')"
                @pointercancel="emit('swipeEnd')"
              >
                <span class="history-meta">
                  <span class="history-date min-w-0 truncate">{{ dateLabel(issue.createdAt) }} · {{ issue.pdf ? 'PDF' : '日报' }}</span>
                  <span class="history-state">
                    <Star
                      :size="15"
                      :fill="issue.articles[0]?.starred ? 'currentColor' : 'none'"
                      class="history-star"
                      :class="{ active: issue.articles[0]?.starred }"
                    />
                    <span
                      class="history-progress whitespace-nowrap"
                      :class="issue.articles[0]?.completedAt ? 'text-bamboo' : 'text-ink-mute'"
                    >
                      <Check v-if="issue.articles[0]?.completedAt" :size="14" :stroke-width="2.4" aria-hidden="true" />
                      {{ issue.articles[0]?.completedAt ? '已学完' : '未学完' }}
                    </span>
                  </span>
                </span>
                <span class="history-title">{{ historyTitle(issue) }}</span>
              </button>
              <div v-else class="history-row-body history-row-manage">
                <GripVertical :size="18" class="history-grip" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="history-title mt-0">{{ historyTitle(issue) }}</p>
                  <select
                    :value="group.id"
                    class="history-group-select"
                    :aria-label="`移动${historyTitle(issue)}到其他分组`"
                    @change="emit('moveIssue', issue.id, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="target in props.allGroups" :key="target.id" :value="target.id">
                      {{ target.name }}
                    </option>
                  </select>
                </div>
                <button
                  class="history-manage-delete"
                  :aria-label="`删除${historyTitle(issue)}`"
                  @click="emit('deleteIssue', issue.id)"
                >
                  <Trash2 :size="17" />
                </button>
              </div>
            </div>
          </div>
        </Motion>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
@media (prefers-reduced-motion: reduce) {
  .history-row-body {
    transition: none;
  }
  .history-group-chevron { transition: none; }
}
</style>

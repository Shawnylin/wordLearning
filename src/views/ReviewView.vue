<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useReviewStore } from '../stores/review'
import { useIdiomStore } from '../stores/idiom'
import { useSettingsStore } from '../stores/settings'
import {
  ArrowLeft, Check, X, Undo2, Sparkles, BookOpen, Shuffle, RotateCcw
} from 'lucide-vue-next'

const router = useRouter()
const reviewStore = useReviewStore()
const idiomStore = useIdiomStore()
const settingsStore = useSettingsStore()

const targetOptions = [5, 10, 15, 20, 0]

const flipped = ref(false)
const leaving = ref<'up' | 'down' | 'left' | 'right' | ''>('')
const drag = reactive({ active: false, x: 0, y: 0, dx: 0, dy: 0 })
const showNoPool = ref(false)

const poolSize = computed(() => Object.keys(idiomStore.idiomCache).length)
const currentWord = computed(() => reviewStore.currentWord)
const currentIdiom = computed(() =>
  currentWord.value ? idiomStore.idiomCache[currentWord.value] : null
)

const progressPct = computed(() => Math.round(reviewStore.progressRatio * 100))

// 卡片切换时复位状态；缓存缺失的词自动跳过
watch([currentWord], () => {
  flipped.value = false
  leaving.value = ''
  drag.active = false
  drag.dx = 0
  drag.dy = 0
  if (currentWord.value && !currentIdiom.value) {
    reviewStore.skipCurrent()
  }
}, { immediate: true })

onMounted(() => reviewStore.resumeClock())
onBeforeUnmount(() => reviewStore.pause())

// —— 会话控制 ——
function startReview() {
  if (poolSize.value === 0) {
    showNoPool.value = true
    return
  }
  showNoPool.value = false
  reviewStore.startSession(settingsStore.reviewTarget)
}

function goReport() {
  router.push('/report')
}

function openWord(word: string) {
  idiomStore.setCurrentIdiom(word)
  router.push('/learn')
}

// —— 手势 ——
const dragStyle = computed(() => {
  if (!drag.active) return undefined
  return {
    transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${(drag.dx * 0.06).toFixed(2)}deg)`
  }
})

const upOverlay = computed(() => {
  if (!drag.active || drag.dy >= 0 || Math.abs(drag.dy) <= Math.abs(drag.dx)) {
    return { opacity: 0 }
  }
  return { opacity: Math.min(1, Math.abs(drag.dy) / 80) }
})

const downOverlay = computed(() => {
  if (!drag.active || drag.dy <= 0 || Math.abs(drag.dy) <= Math.abs(drag.dx)) {
    return { opacity: 0 }
  }
  return { opacity: Math.min(1, Math.abs(drag.dy) / 80) }
})

function onPointerDown(e: PointerEvent) {
  if (reviewStore.phase !== 'reviewing' || !currentIdiom.value || leaving.value) return
  drag.active = true
  drag.x = e.clientX
  drag.y = e.clientY
  drag.dx = 0
  drag.dy = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!drag.active) return
  drag.dx = e.clientX - drag.x
  drag.dy = e.clientY - drag.y
}

function onPointerUp() {
  if (!drag.active) return
  drag.active = false
  const { dx, dy } = drag

  // 轻点：翻面看释义
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
    flipped.value = !flipped.value
    snapBack()
    return
  }

  // 上下滑：判定
  if (Math.abs(dy) >= 64 && Math.abs(dy) > Math.abs(dx)) {
    commit(dy < 0 ? 'up' : 'down', () => reviewStore.judge(dy < 0))
  } else if (Math.abs(dx) >= 80) {
    // 左右滑：浏览切换（不判定）
    commit(dx > 0 ? 'right' : 'left', () => reviewStore.browse(dx > 0 ? 1 : -1))
  } else {
    snapBack()
  }
}

function snapBack() {
  drag.active = false
  drag.dx = 0
  drag.dy = 0
}

function cancelDrag() {
  drag.active = false
  drag.dx = 0
  drag.dy = 0
}

function commit(dir: 'up' | 'down' | 'left' | 'right', action: () => void) {
  leaving.value = dir
  drag.dx = 0
  drag.dy = 0
  window.setTimeout(() => {
    action()
    leaving.value = ''
    flipped.value = false
  }, 170)
}

function judgeByButton(known: boolean) {
  if (reviewStore.phase !== 'reviewing' || !currentIdiom.value || leaving.value) return
  commit(known ? 'up' : 'down', () => reviewStore.judge(known))
}

// —— 完成页 ——
const encourageText = computed(() => {
  const r = reviewStore.lastResult
  if (!r) return ''
  if (r.perfect) return '全部掌握，一个不落！继续保持这股劲头 💪'
  const ratio = r.wrongCount / Math.max(1, r.words.length)
  if (ratio <= 0.3) return '表现不错，错过的词已经回到今日队列里巩固过了，明天记得再来！'
  return '温故知新，慢慢来。今天不熟的词已被标记，之后复习会优先出现。'
})

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  return `${m} 分 ${(s % 60).toString().padStart(2, '0')} 秒`
}

const confettiPieces = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i % 8) * 12 + 8}%`,
  delay: `${(i * 0.09).toFixed(2)}s`,
  color: ['var(--zhuhong)', 'var(--gold)', 'var(--bamboo)', 'var(--dai)'][i % 4]
}))
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-4">
    <div class="mx-auto max-w-lg">
      <!-- 顶部 -->
      <div class="mb-4 flex items-center justify-between">
        <button
          @click="goReport"
          class="flex items-center gap-1.5 text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft :size="18" />
          <span class="text-sm font-medium">报告</span>
        </button>
        <h1 class="font-kai text-3xl text-ink leading-tight">今日复习</h1>
        <span class="w-16 text-right text-xs text-ink-mute">
          {{ reviewStore.finishedToday > 0 ? `已完成 ${reviewStore.finishedToday} 组` : '' }}
        </span>
      </div>

      <!-- 设置页 -->
      <div v-if="reviewStore.phase === 'idle'" class="card rounded-3xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-zhuhong-soft text-zhuhong">
            <Shuffle :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">一组复习</h3>
            <p class="text-xs text-ink-mute">词库共 {{ poolSize }} 词</p>
          </div>
        </div>

        <p class="text-sm text-ink-soft leading-relaxed">
          从已学词库抽取词语复习：<span class="text-bamboo font-medium">上滑=认识</span>，
          <span class="text-zhuhong font-medium">下滑=不熟</span>。
          不熟的词会稍后重现，需<span class="text-ink font-medium">连续答对 2 次</span>
          （不熟后 3 次）才从今日列表移除；左右滑动可浏览卡片，轻点卡片查看释义。
        </p>

        <div class="mt-5">
          <p class="text-xs text-ink-mute mb-2">今日复习数量</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="n in targetOptions"
              :key="n"
              @click="settingsStore.setReviewTarget(n)"
              class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200"
              :class="settingsStore.reviewTarget === n
                ? 'btn-primary'
                : 'bg-soft text-ink-soft hover:opacity-80'"
            >
              {{ n === 0 ? `全部（${poolSize}）` : `${n} 词` }}
            </button>
          </div>
        </div>

        <p v-if="showNoPool" class="mt-4 text-sm text-zhuhong">
          词库还是空的，先去学习几个成语再来复习吧。
        </p>

        <button
          @click="startReview"
          class="w-full mt-6 py-3 rounded-2xl btn-primary text-base font-medium transition-colors flex items-center justify-center gap-2"
        >
          <BookOpen :size="18" />
          开始复习
        </button>
        <button
          v-if="poolSize === 0"
          @click="router.push('/learn')"
          class="w-full mt-2 py-2.5 rounded-2xl bg-soft text-ink-soft text-sm font-medium hover:opacity-80 transition-colors"
        >
          去学习
        </button>
      </div>

      <!-- 复习中 -->
      <div v-else-if="reviewStore.phase === 'reviewing'">
        <!-- 进度 -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-ink-mute">
            已掌握 {{ reviewStore.doneCount }}/{{ reviewStore.target }}
          </span>
          <span class="text-xs text-ink-mute">剩余 {{ reviewStore.remaining }} 词</span>
        </div>
        <div class="h-1.5 rounded-full bg-soft overflow-hidden mb-4">
          <div
            class="h-full bg-zhuhong rounded-full transition-all duration-300"
            :style="{ width: `${progressPct}%` }"
          />
        </div>

        <!-- 卡片 -->
        <div
          class="relative h-[24rem]"
          style="touch-action: none; -webkit-user-select: none; user-select: none"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
        >
          <!-- 背后的衬卡 -->
          <div class="absolute inset-0 rounded-3xl card scale-[0.97] translate-y-2 opacity-70" />

          <div
            class="absolute inset-0 will-change-transform"
            :style="dragStyle"
            :class="[
              { dragging: drag.active },
              leaving ? `leaving-${leaving}` : ''
            ]"
          >
            <div class="flip h-full" :class="{ 'is-flipped': flipped }">
              <!-- 正面 -->
              <div class="flip-face rounded-3xl card flex flex-col items-center justify-center px-6 text-center">
                <p class="text-lg tracking-widest mb-2 text-zhuhong">{{ currentIdiom?.pinyin }}</p>
                <h2 class="font-kai text-6xl font-bold text-ink tracking-widest leading-tight">
                  {{ currentWord }}
                </h2>

                <!-- 连对进度点 -->
                <div class="flex items-center justify-center gap-1.5 mt-5">
                  <span
                    v-for="i in reviewStore.thresholdOfCurrent"
                    :key="i"
                    class="w-2 h-2 rounded-full transition-colors duration-200"
                    :class="i <= reviewStore.levelOfCurrent ? 'bg-zhuhong' : 'bg-line'"
                  />
                </div>
                <p class="text-[11px] text-ink-mute mt-2">
                  {{
                    reviewStore.thresholdOfCurrent - reviewStore.levelOfCurrent > 0
                      ? `再连续答对 ${reviewStore.thresholdOfCurrent - reviewStore.levelOfCurrent} 次即完成`
                      : '完成'
                  }}
                </p>

                <p class="absolute bottom-4 inset-x-0 text-[11px] text-ink-mute">
                  轻点卡片查看释义
                </p>
              </div>

              <!-- 背面（释义） -->
              <div class="flip-face flip-back rounded-3xl card overflow-hidden">
                <div class="h-full overflow-y-auto px-6 py-6">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="flex items-center justify-center w-6 h-6 rounded-lg bg-zhuhong-soft text-zhuhong">
                      <BookOpen :size="12" />
                    </div>
                    <h3 class="text-xs font-semibold text-ink-soft">释义</h3>
                  </div>
                  <p class="text-base leading-relaxed text-ink-soft">
                    {{ currentIdiom?.explanation || '暂无释义' }}
                  </p>
                  <template v-if="currentIdiom?.usage">
                    <div class="flex items-center gap-2 mt-5 mb-2">
                      <div class="flex items-center justify-center w-6 h-6 rounded-lg bg-dai-soft text-dai">
                        <BookOpen :size="12" />
                      </div>
                      <h3 class="text-xs font-semibold text-ink-soft">用法</h3>
                    </div>
                    <p class="text-base leading-relaxed text-ink-soft">{{ currentIdiom.usage }}</p>
                  </template>
                  <p class="text-[11px] text-ink-mute mt-5">轻点卡片翻回正面</p>
                </div>
              </div>
            </div>

            <!-- 判定印章 -->
            <div
              class="absolute top-6 left-6 px-4 py-1.5 rounded-lg border-2 border-bamboo text-bamboo text-xl font-bold font-kai -rotate-12 transition-none"
              :style="upOverlay"
            >
              认识
            </div>
            <div
              class="absolute bottom-6 right-6 px-4 py-1.5 rounded-lg border-2 border-zhuhong text-zhuhong text-xl font-bold font-kai rotate-12 transition-none"
              :style="downOverlay"
            >
              不熟
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="mt-5 grid grid-cols-[1fr_auto_1fr] gap-3">
          <button
            @click="judgeByButton(false)"
            class="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-zhuhong-soft text-zhuhong text-base font-medium active:scale-95 transition-transform"
          >
            <X :size="18" />
            不熟
          </button>
          <button
            @click="reviewStore.undo()"
            :disabled="reviewStore.history.length === 0"
            class="flex flex-col items-center justify-center gap-0.5 w-16 rounded-2xl bg-soft text-ink-soft disabled:opacity-40 active:scale-95 transition-transform"
            title="撤回上一步"
          >
            <Undo2 :size="18" />
            <span class="text-[10px]">撤回</span>
          </button>
          <button
            @click="judgeByButton(true)"
            class="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-bamboo-soft text-bamboo text-base font-medium active:scale-95 transition-transform"
          >
            认识
            <Check :size="18" />
          </button>
        </div>
        <p class="text-center text-[11px] text-ink-mute mt-3">
          上滑认识 · 下滑不熟 · 左右滑浏览 · 轻点看释义
        </p>
      </div>

      <!-- 完成页 -->
      <div v-else-if="reviewStore.lastResult" class="relative">
        <!-- 彩带 -->
        <div class="absolute inset-x-0 -top-2 h-80 overflow-hidden pointer-events-none" aria-hidden="true">
          <i
            v-for="(p, i) in confettiPieces"
            :key="i"
            class="confetti-piece"
            :style="{ left: p.left, animationDelay: p.delay, background: p.color }"
          />
        </div>

        <div class="text-center pt-4">
          <div class="w-16 h-16 mx-auto rounded-full bg-zhuhong-soft text-zhuhong flex items-center justify-center">
            <Sparkles :size="30" />
          </div>
          <h2 class="font-kai text-3xl text-ink mt-4 leading-tight">今日复习完成</h2>
          <p class="text-sm text-ink-soft mt-2">{{ encourageText }}</p>

          <div class="mt-6 grid grid-cols-3 gap-3">
            <div class="p-3 rounded-2xl bg-soft">
              <p class="font-serif text-xl font-bold text-ink">{{ reviewStore.lastResult.words.length }}</p>
              <p class="text-xs text-ink-mute mt-0.5">复习词语</p>
            </div>
            <div class="p-3 rounded-2xl bg-soft">
              <p class="font-serif text-xl font-bold text-zhuhong">{{ reviewStore.lastResult.wrongCount }}</p>
              <p class="text-xs text-ink-mute mt-0.5">答错次数</p>
            </div>
            <div class="p-3 rounded-2xl bg-soft">
              <p class="font-serif text-lg font-bold text-dai whitespace-nowrap leading-none pt-0.5">{{ formatDuration(reviewStore.lastResult.elapsedMs) }}</p>
              <p class="text-xs text-ink-mute mt-1">用时</p>
            </div>
          </div>

          <div v-if="reviewStore.lastResult.wrongWords.length > 0" class="mt-5 text-left">
            <p class="text-xs text-ink-mute mb-2">需要巩固的词语（点击可查看）</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="word in reviewStore.lastResult.wrongWords.slice(0, 8)"
                :key="word"
                @click="openWord(word)"
                class="px-3.5 py-1.5 rounded-full bg-zhuhong-soft text-zhuhong text-sm font-medium hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200"
              >
                {{ word }}
              </button>
            </div>
          </div>

          <div class="mt-7 space-y-2">
            <button
              @click="startReview"
              class="w-full py-3 rounded-2xl btn-primary text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw :size="18" />
              再来一组
            </button>
            <button
              @click="goReport"
              class="w-full py-2.5 rounded-2xl bg-soft text-ink-soft text-sm font-medium hover:opacity-80 transition-colors"
            >
              返回报告
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片翻转 */
.flip {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.35s;
}
.flip.is-flipped {
  transform: rotateY(180deg);
}
.flip-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flip-back {
  transform: rotateY(180deg);
}

/* 拖拽/飞出动画 */
.absolute.inset-0.will-change-transform {
  transition: transform 0.16s ease-in, opacity 0.16s ease-in;
}
.absolute.inset-0.will-change-transform.dragging {
  transition: none;
}
.leaving-up {
  transform: translateY(-130%) rotate(-10deg) !important;
  opacity: 0;
}
.leaving-down {
  transform: translateY(130%) rotate(10deg) !important;
  opacity: 0;
}
.leaving-left {
  transform: translateX(-140%) rotate(-14deg) !important;
  opacity: 0;
}
.leaving-right {
  transform: translateX(140%) rotate(14deg) !important;
  opacity: 0;
}

/* 彩带 */
.confetti-piece {
  position: absolute;
  top: -14px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  opacity: 0;
  animation: confetti-fall 2.4s ease-out forwards;
}
@keyframes confetti-fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  100% {
    transform: translateY(320px) rotate(560deg);
    opacity: 0;
  }
}
</style>

<script setup lang="ts">
import Motion from '../components/Motion.vue'
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

const reviewWords = computed(() => Object.keys(idiomStore.idiomCache))
const poolSize = computed(() => reviewWords.value.length)
const currentWord = computed(() => reviewStore.currentWord)
const currentIdiom = computed(() =>
  currentWord.value ? idiomStore.idiomCache[currentWord.value] : null
)
const dueCount = computed(() => reviewStore.getDueCount(reviewWords.value))
const todayCompleted = computed(() => reviewStore.getTodayCompletedCount())
const todayGoal = computed(() => reviewStore.getTodayGoal(settingsStore.reviewTarget, reviewWords.value))
const todayRemainingGoal = computed(() => reviewStore.getTodayRemainingGoal(settingsStore.reviewTarget, reviewWords.value))
const todayGoalMet = computed(() =>
  todayGoal.value > 0 && todayCompleted.value >= todayGoal.value
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

onMounted(() => {
  reviewStore.ensureToday()
  reviewStore.resumeClock()
})
onBeforeUnmount(() => reviewStore.pause())

// —— 会话控制 ——
function startReview(extra = false) {
  if (poolSize.value === 0 || dueCount.value === 0) {
    showNoPool.value = true
    return
  }
  showNoPool.value = false
  let amount = extra ? settingsStore.reviewTarget : todayRemainingGoal.value
  if (!extra && amount === 0) amount = settingsStore.reviewTarget
  reviewStore.startSession(amount, reviewWords.value)
}

function goReport() {
  router.push('/profile')
}

function openWord(word: string) {
  idiomStore.setCurrentIdiom(word)
  router.push({ path: '/learn', query: { word } })
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
  if (leaving.value) return
  leaving.value = dir
  drag.dx = 0
  drag.dy = 0
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.setTimeout(() => {
    action()
    leaving.value = ''
    flipped.value = false
  }, reducedMotion ? 0 : 170)
}

function judgeByButton(known: boolean) {
  if (reviewStore.phase !== 'reviewing' || !currentIdiom.value || leaving.value) return
  commit(known ? 'up' : 'down', () => reviewStore.judge(known))
}

function deferByButton() {
  if (reviewStore.phase !== 'reviewing' || reviewStore.remaining <= 1 || leaving.value) return
  commit('left', () => reviewStore.deferCurrent())
}

function masterByButton() {
  if (reviewStore.phase !== 'reviewing' || !currentIdiom.value || leaving.value) return
  commit('up', () => reviewStore.markCurrentMastered())
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
          <span class="text-sm font-medium">个人</span>
        </button>
        <h1 class="font-kai text-3xl text-ink leading-tight">今日复习</h1>
        <span class="w-16 text-right text-xs text-ink-mute">
          {{ todayGoal > 0 ? `${todayCompleted}/${todayGoal}` : '' }}
        </span>
      </div>

      <!-- 设置页 -->
      <Motion><div v-if="reviewStore.phase === 'idle'" class="card rounded-3xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-zhuhong-soft text-zhuhong">
            <Shuffle :size="20" />
          </div>
          <div>
            <h3 class="font-semibold text-ink">今日复习计划</h3>
            <p class="text-xs text-ink-mute">词库共 {{ poolSize }} 词</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mb-5">
          <div class="rounded-2xl bg-soft px-3 py-3 text-center">
            <p class="font-serif text-xl font-bold text-ink">{{ dueCount }}</p>
            <p class="mt-0.5 text-[11px] text-ink-mute">今日待复习</p>
          </div>
          <div class="rounded-2xl bg-soft px-3 py-3 text-center">
            <p class="font-serif text-xl font-bold text-ink">{{ todayGoal }}</p>
            <p class="mt-0.5 text-[11px] text-ink-mute">今日目标</p>
          </div>
          <div class="rounded-2xl bg-soft px-3 py-3 text-center">
            <p class="font-serif text-xl font-bold text-bamboo">{{ todayCompleted }}</p>
            <p class="mt-0.5 text-[11px] text-ink-mute">今日已完成</p>
          </div>
        </div>

        <template v-if="dueCount > 0">
          <p class="text-sm text-ink-soft leading-relaxed">
            今天只安排已经到期的词语，已掌握词不会进入普通队列。
            <span class="text-bamboo font-medium">答对</span>会推进连续正确次数，
            <span class="text-zhuhong font-medium">答错</span>的词会在本组稍后重现；
            轻点卡片仍可查看释义。
          </p>

          <div class="mt-5">
            <p class="text-xs text-ink-mute mb-2">今日复习目标</p>
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
                {{ n === 0 ? `全部（${dueCount + todayCompleted}）` : `${n} 词` }}
              </button>
            </div>
          </div>

          <button
            @click="startReview(todayGoalMet)"
            class="w-full mt-6 py-3 rounded-2xl btn-primary text-base font-medium transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen :size="18" />
            {{ todayGoalMet ? '继续复习' : '开始今日复习' }}
          </button>
        </template>

        <Motion v-else><div class="mt-2 rounded-2xl bg-soft px-4 py-5 text-center">
          <Sparkles :size="24" class="mx-auto text-bamboo" />
          <p class="mt-2 font-medium text-ink">
            {{ poolSize === 0 ? '还没有可以复习的词语' : '今天没有待复习内容' }}
          </p>
          <p class="mt-1 text-xs leading-5 text-ink-mute">
            {{ poolSize === 0 ? '先学习几个词语，之后会自动进入复习安排。' : '到期词已经完成，或其余词语还没到下一次复习时间。' }}
          </p>
          <button
            v-if="poolSize === 0"
            @click="router.push('/learn')"
            class="mt-4 px-5 py-2.5 rounded-2xl bg-card text-ink-soft text-sm font-medium hover:opacity-80 transition-colors"
          >
            去学习
          </button>
        </div></Motion>

        <Motion><p v-if="showNoPool && dueCount > 0" class="mt-4 text-sm text-zhuhong">
          暂时无法开始复习，请稍后再试。
        </p></Motion>
      </div>

      <!-- 复习中 -->
      <div v-else-if="reviewStore.phase === 'reviewing'">
        <!-- 进度 -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-ink-mute">
            本组进度 {{ reviewStore.doneCount }}/{{ reviewStore.target }}
          </span>
          <span class="text-xs text-ink-mute">今日 {{ todayCompleted }}/{{ todayGoal }}</span>
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
            :key="currentWord || ''"
            class="absolute inset-0 will-change-transform review-card-enter"
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
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button
            @click="judgeByButton(false)"
            class="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-zhuhong-soft text-zhuhong text-base font-medium active:scale-95 transition-transform"
          >
            <X :size="18" />
            答错
          </button>
          <button
            @click="judgeByButton(true)"
            class="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-bamboo-soft text-bamboo text-base font-medium active:scale-95 transition-transform"
          >
            答对
            <Check :size="18" />
          </button>
        </div>
        <div class="mt-2 grid grid-cols-3 gap-2">
          <button
            @click="reviewStore.undo()"
            :disabled="reviewStore.history.length === 0 || !!leaving"
            class="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-soft text-ink-soft text-xs font-medium disabled:opacity-40 active:scale-95 transition-transform"
            title="撤回上一步"
          >
            <Undo2 :size="15" />
            撤回
          </button>
          <button
            @click="deferByButton"
            :disabled="reviewStore.remaining <= 1 || !!leaving"
            class="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-soft text-ink-soft text-xs font-medium disabled:opacity-40 active:scale-95 transition-transform"
          >
            <RotateCcw :size="15" />
            稍后复习
          </button>
          <button
            @click="masterByButton"
            :disabled="!!leaving"
            class="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-soft text-bamboo text-xs font-medium disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Sparkles :size="15" />
            已掌握
          </button>
        </div>
        <p class="text-center text-[11px] text-ink-mute mt-3">
          上滑答对 · 下滑答错 · 左右滑浏览 · 轻点看释义
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
          <h2 class="font-kai text-3xl text-ink mt-4 leading-tight">
            {{ todayGoalMet ? '今日复习目标完成' : '本组复习完成' }}
          </h2>
          <p class="text-sm text-ink-soft mt-2">{{ encourageText }}</p>

          <div class="mt-4 rounded-2xl bg-soft px-4 py-3 text-sm text-ink-soft">
            今日已完成 <span class="font-semibold text-bamboo">{{ todayCompleted }}</span>
            / {{ todayGoal }} 词
            <span v-if="dueCount > 0" class="text-ink-mute"> · 仍有 {{ dueCount }} 词到期</span>
            <span v-else class="text-bamboo"> · 当前到期内容已清空</span>
          </div>

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

          <Motion><div v-if="reviewStore.lastResult.wrongWords.length > 0" class="mt-5 text-left">
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
          </div></Motion>

          <div class="mt-7 space-y-2">
            <button
              v-if="dueCount > 0"
              @click="startReview(true)"
              class="w-full py-3 rounded-2xl btn-primary text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw :size="18" />
              {{ todayGoalMet ? '继续复习' : '继续完成今日目标' }}
            </button>
            <button
              @click="goReport"
              class="w-full py-2.5 rounded-2xl bg-soft text-ink-soft text-sm font-medium hover:opacity-80 transition-colors"
            >
              返回个人
            </button>
          </div>
        </div>
      </div></Motion>
    </div>
  </div>
</template>

<style scoped>
.review-card-enter { animation: review-arrive 220ms ease-out; }
@keyframes review-arrive { from { opacity: 0; } to { opacity: 1; } }
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

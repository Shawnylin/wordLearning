import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useIdiomStore } from './idiom'

export type ReviewPhase = 'idle' | 'reviewing' | 'finished'

interface ReviewWordStat {
  /** 历史累计答错次数（跨会话，用于选词优先级） */
  wrong: number
  /** 最近一次复习时间 */
  lastAt: number
}

interface ReviewSnapshot {
  queue: string[]
  done: string[]
  levels: Record<string, number>
  thresholds: Record<string, number>
  wrongToday: Record<string, number>
}

export interface ReviewResult {
  reviewedAt: number
  words: string[]
  wrongWords: string[]
  wrongCount: number
  elapsedMs: number
  perfect: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 今日复习会话（持久化，切页/重启均保留进度）
 *
 * 推送机制（参考背单词 App 的「连对毕业」）：
 * - 每个词初始需连续答对 2 次（threshold=2）才从今日列表移除
 * - 一旦答错：连对计数清零、所需连对次数 +1（封顶 4），并把该词插回
 *   队列前 2 位，稍后再次出现，直到连续答对足够次数
 * - 每次判断前保存快照，支持撤回上一步
 */
export const useReviewStore = defineStore('review', () => {
  const phase = ref<ReviewPhase>('idle')
  const queue = ref<string[]>([])
  const done = ref<string[]>([])
  const levels = ref<Record<string, number>>({})
  const thresholds = ref<Record<string, number>>({})
  const wrongToday = ref<Record<string, number>>({})
  const history = ref<ReviewSnapshot[]>([])
  const target = ref(0)
  const startedAt = ref(0)
  /** 在复习页面停留的累计用时（毫秒），离开页面时冻结 */
  const elapsedMs = ref(0)
  const lastTick = ref(0)
  const lastResult = ref<ReviewResult | null>(null)
  /** 今日已完成组数 */
  const finishedToday = ref(0)
  const lastFinishedDay = ref('')
  /** 每个词的长期表现（跨会话累计答错次数） */
  const wordStats = ref<Record<string, ReviewWordStat>>({})

  const currentWord = computed(() => queue.value[0] || null)
  const remaining = computed(() => queue.value.length)
  const doneCount = computed(() => done.value.length)
  const sessionActive = computed(() => phase.value === 'reviewing' && queue.value.length > 0)
  const progressRatio = computed(() =>
    target.value > 0 ? Math.min(1, done.value.length / target.value) : 0
  )
  const levelOfCurrent = computed(() =>
    currentWord.value ? levels.value[currentWord.value] ?? 0 : 0
  )
  const thresholdOfCurrent = computed(() =>
    currentWord.value ? thresholds.value[currentWord.value] ?? 2 : 2
  )

  function snapshot(): ReviewSnapshot {
    return {
      queue: [...queue.value],
      done: [...done.value],
      levels: { ...levels.value },
      thresholds: { ...thresholds.value },
      wrongToday: { ...wrongToday.value }
    }
  }

  /**
   * 开始一组复习：n 为数量（0 表示全部）。
   * 选词策略：优先挑选历史答错过的词（约 60% 名额），其余随机补齐，最后打乱顺序。
   */
  function startSession(n: number): boolean {
    const idiomStore = useIdiomStore()
    const pool = Object.keys(idiomStore.idiomCache)
    if (pool.length === 0) return false

    const size = n > 0 ? Math.min(n, pool.length) : pool.length
    const weak = pool.filter(w => (wordStats.value[w]?.wrong || 0) > 0)
    const strong = pool.filter(w => (wordStats.value[w]?.wrong || 0) === 0)
    const weakSlots = Math.min(weak.length, Math.ceil(size * 0.6))
    const picks = [
      ...shuffle(weak).slice(0, weakSlots),
      ...shuffle(strong).slice(0, size - weakSlots)
    ]

    queue.value = shuffle(picks)
    done.value = []
    levels.value = {}
    thresholds.value = {}
    wrongToday.value = {}
    history.value = []
    for (const w of queue.value) {
      levels.value[w] = 0
      thresholds.value[w] = 2
    }
    target.value = queue.value.length
    startedAt.value = Date.now()
    elapsedMs.value = 0
    lastTick.value = Date.now()
    phase.value = 'reviewing'
    return true
  }

  /** 判定当前卡片：known=true 认识，false 不熟 */
  function judge(known: boolean) {
    if (phase.value !== 'reviewing' || queue.value.length === 0) return
    const w = queue.value[0]
    history.value.push(snapshot())

    if (known) {
      levels.value[w] = (levels.value[w] || 0) + 1
      queue.value.shift()
      const passed = levels.value[w] >= thresholds.value[w]
      const st = wordStats.value[w] || { wrong: 0, lastAt: 0 }
      st.lastAt = Date.now()
      wordStats.value[w] = st
      if (passed) {
        done.value.push(w)
      } else {
        // 还没连对够次数：排到队尾稍后重现
        queue.value.push(w)
      }
    } else {
      levels.value[w] = 0
      thresholds.value[w] = Math.min((thresholds.value[w] || 2) + 1, 4)
      wrongToday.value[w] = (wrongToday.value[w] || 0) + 1
      const st = wordStats.value[w] || { wrong: 0, lastAt: 0 }
      st.wrong++
      st.lastAt = Date.now()
      wordStats.value[w] = st
      queue.value.shift()
      // 答错后尽快重现（插到第 2 位，避免立刻连续出现）
      queue.value.splice(Math.min(2, queue.value.length), 0, w)
    }

    if (queue.value.length === 0) finishSession()
  }

  /** 左右滑动浏览：不判定，仅轮转卡片顺序 */
  function browse(dir: 1 | -1) {
    if (queue.value.length === 0) return
    if (dir === 1) {
      queue.value.push(queue.value.shift()!)
    } else {
      queue.value.unshift(queue.value.pop()!)
    }
  }

  /** 撤回上一步判定（恢复队列/计数到判断前） */
  function undo() {
    const s = history.value.pop()
    if (!s) return
    queue.value = s.queue
    done.value = s.done
    levels.value = s.levels
    thresholds.value = s.thresholds
    wrongToday.value = s.wrongToday
  }

  /** 跳过当前卡片（例如缓存被清掉后兜底），不做判定 */
  function skipCurrent() {
    if (queue.value.length === 0) return
    queue.value.shift()
    if (queue.value.length === 0) finishSession()
  }

  function finishSession() {
    const today = new Date().toDateString()
    if (lastFinishedDay.value !== today) {
      lastFinishedDay.value = today
      finishedToday.value = 1
    } else {
      finishedToday.value++
    }
    const wrongWords = Object.entries(wrongToday.value)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w)
    const wrongCount = Object.values(wrongToday.value).reduce((s, c) => s + c, 0)
    elapsedMs.value += Math.max(0, Date.now() - lastTick.value)
    lastResult.value = {
      reviewedAt: Date.now(),
      words: [...done.value],
      wrongWords,
      wrongCount,
      elapsedMs: elapsedMs.value,
      perfect: wrongCount === 0
    }
    phase.value = 'finished'
    queue.value = []
  }

  /** 清空会话回到初始状态（不清理长期 wordStats） */
  function resetSession() {
    phase.value = 'idle'
    queue.value = []
    done.value = []
    levels.value = {}
    thresholds.value = {}
    wrongToday.value = {}
    history.value = []
    target.value = 0
    startedAt.value = 0
    elapsedMs.value = 0
    lastTick.value = 0
  }

  /** 全部重置（含长期表现数据） */
  function resetAll() {
    resetSession()
    wordStats.value = {}
    lastResult.value = null
    finishedToday.value = 0
    lastFinishedDay.value = ''
  }

  /** 离开复习页面：冻结用时 */
  function pause() {
    if (phase.value === 'reviewing' && lastTick.value > 0) {
      elapsedMs.value += Math.max(0, Date.now() - lastTick.value)
      lastTick.value = 0
    }
  }

  /** 进入复习页面：恢复计时 */
  function resumeClock() {
    if (phase.value === 'reviewing') {
      lastTick.value = Date.now()
    }
  }

  return {
    phase,
    queue,
    done,
    levels,
    thresholds,
    wrongToday,
    history,
    target,
    startedAt,
    elapsedMs,
    lastResult,
    finishedToday,
    wordStats,
    currentWord,
    remaining,
    doneCount,
    sessionActive,
    progressRatio,
    levelOfCurrent,
    thresholdOfCurrent,
    startSession,
    judge,
    browse,
    undo,
    skipCurrent,
    resetSession,
    resetAll,
    pause,
    resumeClock
  }
}, {
  persist: {
    key: 'review-store'
  }
})

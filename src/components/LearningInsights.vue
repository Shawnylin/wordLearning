<script setup lang="ts">
import { computed } from 'vue'
import { calculateLearningStatistics } from '../services/learningStatistics'
import { useDailyStore } from '../stores/daily'
import { useIdiomStore } from '../stores/idiom'
import { useReviewStore } from '../stores/review'
import { useStatisticsStore } from '../stores/statistics'

const idiom = useIdiomStore()
const review = useReviewStore()
const daily = useDailyStore()
const statistics = useStatisticsStore()
const snapshot = computed(() => calculateLearningStatistics({
  idiom: idiom.exportSyncData(),
  review: review.exportSyncData(),
  daily: daily.exportSyncData(),
  statistics: statistics.exportSyncData()
}))
const peak = computed(() => Math.max(1, ...snapshot.value.recent7Days.map(day => day.activityTotal)))
const accuracy = computed(() => snapshot.value.reviewAccuracy === null
  ? '—'
  : `${Math.round(snapshot.value.reviewAccuracy * 100)}%`)
</script>

<template>
  <div class="profile-insights" aria-label="学习统计">
    <div class="profile-insights-grid">
      <div><strong>{{ snapshot.totalLearnedWords }}</strong><span>已学词语</span></div>
      <div><strong>{{ snapshot.masteredWords }}</strong><span>已掌握</span></div>
      <div><strong>{{ snapshot.currentStreakDays }}</strong><span>连续学习天数</span></div>
      <div><strong>{{ accuracy }}</strong><span>复习正确率</span></div>
    </div>
    <div class="profile-insights-heading">
      <h3>学习成果趋势</h3>
      <span>近 30 日 {{ snapshot.recent30DaysLearning }} 次学习活动</span>
    </div>
    <p v-if="!snapshot.recent7DaysLearning" class="profile-insights-empty">近 7 日暂无学习活动</p>
    <div v-else class="profile-trend" role="img" :aria-label="`近 7 日共 ${snapshot.recent7DaysLearning} 次学习活动`">
      <div v-for="day in snapshot.recent7Days" :key="day.day" class="profile-trend-day" :title="`${day.day}：${day.activityTotal} 次学习活动`">
        <span class="profile-trend-count">{{ day.activityTotal || '' }}</span>
        <span class="profile-trend-bar" :style="{ height: `${Math.max(4, Math.round(day.activityTotal / peak * 64))}px` }" />
        <span class="profile-trend-date">{{ day.day.slice(5) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-insights { min-width: 0; padding: 12px 0 14px; border-top: 1px solid var(--line); }
.profile-insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.profile-insights-grid > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; background: var(--soft); }
.profile-insights-grid strong { color: var(--ink); font-size: 20px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.profile-insights-grid span, .profile-insights-heading span, .profile-insights-empty { color: var(--ink-mute); font-size: 11px; line-height: 1.5; }
.profile-insights-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; margin-top: 16px; }
.profile-insights-heading h3 { color: var(--ink-soft); font-size: 13px; font-weight: 600; line-height: 1.45; }
.profile-insights-empty { padding: 18px 0 4px; text-align: center; }
.profile-trend { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 6px; min-width: 0; margin-top: 10px; }
.profile-trend-day { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
.profile-trend-count, .profile-trend-date { color: var(--ink-mute); font-size: 10px; line-height: 1.3; font-variant-numeric: tabular-nums; white-space: nowrap; }
.profile-trend-bar { display: block; width: min(100%, 22px); min-height: 4px; border-radius: 6px 6px 3px 3px; background: var(--zhuhong); }
@media (min-width: 640px) { .profile-insights-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>

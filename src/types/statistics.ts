export type LearningActivityType = 'learn' | 'review'
export type TokenUsageSource = 'idiom' | 'comparison' | 'daily' | 'pdf' | 'other'

export interface LearningActivityEvent {
  id: string
  type: LearningActivityType
  word: string
  at: number
}

export interface TokenUsageEvent {
  id: string
  at: number
  tokens: number
  source: TokenUsageSource
}

export interface ReviewAnswerEvent {
  id: string
  word: string
  correct: boolean
  at: number
}

export interface LearningStatisticsSyncData {
  version: 1
  activities: LearningActivityEvent[]
  reviewAnswers: ReviewAnswerEvent[]
  tokenUsage: TokenUsageEvent[]
}

export interface LearningTrendPoint {
  day: string
  learnedWords: number
  reviewedWords: number
  dailyCompleted: number
  activityTotal: number
  tokens: number
}

export interface LearningStatisticsSnapshot {
  totalLearnedWords: number
  masteredWords: number
  todayLearnedWords: number
  todayReviewedWords: number
  currentStreakDays: number
  recent7DaysLearning: number
  recent30DaysLearning: number
  reviewAccuracy: number | null
  reviewCorrectCount: number
  reviewWrongCount: number
  dailyReadCount: number
  dailyCompletedCount: number
  recent7Days: LearningTrendPoint[]
  recent30Days: LearningTrendPoint[]
  tokenTrend: Array<{ day: string; tokens: number }>
}

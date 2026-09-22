import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  emptyLearningStatisticsSyncData,
  localDayKey,
  normalizeLearningStatisticsSyncData
} from '../services/learningStatistics'
import type {
  LearningActivityEvent,
  LearningStatisticsSyncData,
  ReviewAnswerEvent,
  TokenUsageEvent,
  TokenUsageSource
} from '../types/statistics'

function eventId(prefix: string, now: number): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}:${uuid}`
}

function wordDayEventId(type: 'learn' | 'review', word: string, now: number): string {
  return `${type}:${localDayKey(now)}:${encodeURIComponent(word)}`
}

export const useStatisticsStore = defineStore('statistics', () => {
  const activities = ref<LearningActivityEvent[]>([])
  const reviewAnswers = ref<ReviewAnswerEvent[]>([])
  const tokenUsage = ref<TokenUsageEvent[]>([])

  function recordLearning(word: string, now = Date.now()) {
    const normalized = word.trim()
    if (!normalized) return
    const id = wordDayEventId('learn', normalized, now)
    if (activities.value.some(item => item.id === id)) return
    activities.value.push({ id, type: 'learn', word: normalized, at: now })
  }

  function recordReview(word: string, now = Date.now()) {
    const normalized = word.trim()
    if (!normalized) return
    const id = wordDayEventId('review', normalized, now)
    if (activities.value.some(item => item.id === id)) return
    activities.value.push({ id, type: 'review', word: normalized, at: now })
  }

  function reconcileReviewDay(words: string[], day: string, now = Date.now()) {
    if (!day) return
    const keep = [...new Set(words.map(word => word.trim()).filter(Boolean))]
    activities.value = activities.value.filter(item => item.type !== 'review' || localDayKey(item.at) !== day)
    const eventAt = localDayKey(now) === day ? now : new Date(`${day}T12:00:00`).getTime()
    if (!Number.isFinite(eventAt)) return
    for (const word of keep) recordReview(word, eventAt)
  }

  function clearReviewEvents() {
    activities.value = activities.value.filter(item => item.type !== 'review')
    reviewAnswers.value = []
  }

  function recordReviewAnswer(word: string, correct: boolean, now = Date.now()): string | null {
    const normalized = word.trim()
    if (!normalized) return null
    const id = eventId('review-answer', now)
    reviewAnswers.value.push({ id, word: normalized, correct, at: now })
    return id
  }

  function removeReviewAnswer(id: string | undefined) {
    if (!id) return
    reviewAnswers.value = reviewAnswers.value.filter(item => item.id !== id)
  }

  function recordTokenUsage(tokens: number, source: TokenUsageSource = 'other', now = Date.now(), id?: string) {
    if (!Number.isFinite(tokens) || tokens <= 0) return
    const normalized = Math.floor(tokens)
    const event: TokenUsageEvent = {
      id: id?.trim() || eventId('token', now),
      at: now,
      tokens: normalized,
      source
    }
    const index = tokenUsage.value.findIndex(item => item.id === event.id)
    if (index >= 0) tokenUsage.value[index] = event
    else tokenUsage.value.push(event)
  }

  function exportSyncData(): LearningStatisticsSyncData {
    return normalizeLearningStatisticsSyncData({
      version: 1,
      activities: activities.value,
      reviewAnswers: reviewAnswers.value,
      tokenUsage: tokenUsage.value
    })
  }

  function restoreSyncData(value: unknown) {
    const normalized = normalizeLearningStatisticsSyncData(value)
    activities.value = normalized.activities
    reviewAnswers.value = normalized.reviewAnswers
    tokenUsage.value = normalized.tokenUsage
  }

  function resetAll() {
    const empty = emptyLearningStatisticsSyncData()
    activities.value = empty.activities
    reviewAnswers.value = empty.reviewAnswers
    tokenUsage.value = empty.tokenUsage
  }

  return {
    activities,
    reviewAnswers,
    tokenUsage,
    recordLearning,
    recordReview,
    reconcileReviewDay,
    clearReviewEvents,
    recordReviewAnswer,
    removeReviewAnswer,
    recordTokenUsage,
    exportSyncData,
    restoreSyncData,
    resetAll
  }
}, {
  persist: {
    key: 'statistics-store',
    paths: ['activities', 'reviewAnswers', 'tokenUsage']
  }
})

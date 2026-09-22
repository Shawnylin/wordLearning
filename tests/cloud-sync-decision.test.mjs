import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const stateSource = readFileSync(new URL('../src/stores/cloudSyncState.ts', import.meta.url), 'utf8')
const compiledState = ts.transpileModule(stateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function loadCloudSyncState(storageOverrides = {}) {
  const values = new Map()
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    ...storageOverrides
  }
  const exports = {}

  new Function('exports', 'localStorage', compiledState)(exports, localStorage)
  return { ...exports, values }
}

for (const choice of ['no-upload', 'download', 'merge-local-to-cloud', 'merge-cloud-to-local']) {
  test(`cloud sync decision preserves ${choice} after save and reload`, () => {
    const { decisionKey, readDecision, saveDecision, values } = loadCloudSyncState()
    const completedAt = 1_795_000_000_000

    saveDecision('user-a', choice, completedAt)

    assert.equal(decisionKey('user-a'), 'word-learning-cloud-sync:user-a')
    assert.equal(values.get(decisionKey('user-a')), JSON.stringify({ choice, completedAt }))
    assert.deepEqual(readDecision('user-a'), { choice, completedAt })
  })
}

test('cloud sync decision rejects malformed and unknown persisted choices', () => {
  const { decisionKey, readDecision, values } = loadCloudSyncState()
  const key = decisionKey('user-a')

  values.set(key, '{')
  assert.equal(readDecision('user-a'), null)

  values.set(key, JSON.stringify({ choice: 'unknown-choice', completedAt: 42 }))
  assert.equal(readDecision('user-a'), null)
})

test('cloud sync state preserves storage keys, defaults and sanitization', () => {
  const { deserializeSyncState, readSyncState, saveSyncState, stateKey, values } = loadCloudSyncState()
  const key = stateKey('user-a')
  assert.equal(key, 'word-learning-cloud-sync-state:user-a')

  assert.deepEqual(readSyncState('user-a', 123), {
    pendingDomains: [],
    lastLocalChangeAt: 0,
    lastSyncAt: 123,
    lastRemoteUpdatedAt: '',
    retryCount: 0,
    nextRetryAt: 0,
    lastError: ''
  })

  const state = deserializeSyncState(JSON.stringify({
    pendingDomains: ['profile', 'profile', 'invalid', 'daily'],
    lastLocalChangeAt: 20,
    lastSyncAt: 30,
    lastRemoteUpdatedAt: 'remote-1',
    retryCount: 2.9,
    nextRetryAt: 40,
    lastError: 'failed'
  }))
  assert.deepEqual(state, {
    pendingDomains: ['profile', 'daily'],
    lastLocalChangeAt: 20,
    lastSyncAt: 30,
    lastRemoteUpdatedAt: 'remote-1',
    retryCount: 2,
    nextRetryAt: 40,
    lastError: 'failed'
  })

  saveSyncState('user-a', state)
  assert.equal(values.get(key), JSON.stringify(state))
  assert.deepEqual(readSyncState('user-a'), state)
})

test('cloud sync storage read failures keep the original fallback behavior', () => {
  const storageError = () => { throw new Error('storage unavailable') }
  const { readDecision, readSyncState } = loadCloudSyncState({ getItem: storageError })

  assert.equal(readDecision('user-a'), null)
  assert.deepEqual(readSyncState('user-a', 321), {
    pendingDomains: [],
    lastLocalChangeAt: 0,
    lastSyncAt: 321,
    lastRemoteUpdatedAt: '',
    retryCount: 0,
    nextRetryAt: 0,
    lastError: ''
  })
})

test('cloud sync retry and auto-sync timing constants remain unchanged', () => {
  const { AUTO_CHANGE_DELAY, RETRY_DELAYS, autoSyncDueAt, nextRetrySchedule } = loadCloudSyncState()

  assert.equal(AUTO_CHANGE_DELAY, 45_000)
  assert.deepEqual(RETRY_DELAYS, [30_000, 120_000, 600_000])
  assert.equal(autoSyncDueAt(1_000, 0), 46_000)
  assert.equal(autoSyncDueAt(1_000, 100_000), 100_000)
  assert.deepEqual(nextRetrySchedule(0, 1_000), { retryCount: 1, nextRetryAt: 31_000 })
  assert.deepEqual(nextRetrySchedule(1, 1_000), { retryCount: 2, nextRetryAt: 121_000 })
  assert.deepEqual(nextRetrySchedule(2, 1_000), { retryCount: 3, nextRetryAt: 601_000 })
  assert.deepEqual(nextRetrySchedule(3, 1_000), { retryCount: 3, nextRetryAt: 601_000 })
})

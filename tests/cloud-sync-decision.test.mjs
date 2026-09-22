import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const storeSource = readFileSync(new URL('../src/stores/cloudSync.ts', import.meta.url), 'utf8')
  .replace('function readDecision(', 'export function readDecision(')
  .replace('function saveDecision(', 'export function saveDecision(')

const compiledStore = ts.transpileModule(storeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function loadDecisionPersistence() {
  const values = new Map()
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  }
  const exports = {}
  const mockRequire = name => {
    if (name === 'pinia') return { defineStore: () => () => ({}) }
    if (name === 'vue') return { computed: value => value, ref: value => ({ value }) }
    return {}
  }

  new Function('require', 'exports', 'localStorage', compiledStore)(mockRequire, exports, localStorage)
  return exports
}

for (const choice of ['no-upload', 'download', 'merge-local-to-cloud', 'merge-cloud-to-local']) {
  test(`cloud sync decision preserves ${choice} after save and reload`, () => {
    const { readDecision, saveDecision } = loadDecisionPersistence()
    const completedAt = 1_795_000_000_000

    saveDecision('user-a', choice, completedAt)

    assert.deepEqual(readDecision('user-a'), { choice, completedAt })
  })
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/stores/appUpdate.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', "'/wordLearning/'"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

function setup(registration) {
  let callbacks
  let updateCalls = 0
  const exports = {}
  registration.update = async () => { updateCalls++ }
  const navigator = { onLine: true, serviceWorker: { getRegistration: async () => registration } }
  const mockRequire = name => name === 'vue' ? { ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }) }
    : name === 'pinia' ? { defineStore: (_name, setup) => setup }
    : { registerSW: options => { callbacks = options; return async () => {} } }
  new Function('require', 'exports', 'navigator', 'window', 'document', '__APP_VERSION__', source)(mockRequire, exports, navigator, { setTimeout, clearTimeout }, { visibilityState: 'visible' }, 'test')
  const store = exports.useAppUpdateStore()
  store.initialize()
  return { store, registered: () => callbacks.onRegisteredSW('/sw.js', registration), calls: () => updateCalls }
}

test('no-update check completes without the former 1.5 second grace period', async () => {
  const { store, calls } = setup({})
  await Promise.race([store.checkForUpdate(), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('check did not finish promptly')), 500); timer.unref() })])
  assert.equal(calls(), 1)
  assert.equal(store.statusText.value, '当前已是最新版')
})

test('already waiting update is presented without another network request', async () => {
  const { store, calls } = setup({ waiting: { state: 'installed' } })
  await store.checkForUpdate()
  assert.equal(calls(), 0)
  assert.equal(store.needRefresh.value, true)
  assert.equal(store.promptVisible.value, true)
})

test('registration triggers a startup check and foreground events are throttled', async () => {
  const { store, registered, calls } = setup({})
  registered()
  await new Promise(resolve => setImmediate(resolve))
  store.checkOnForeground()
  assert.equal(calls(), 1)
  store.checkOnForeground(Date.now() + 31_000)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls(), 2)
})

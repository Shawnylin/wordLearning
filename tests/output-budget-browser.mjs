import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(process.env.CODEX_NODE_MODULES + '/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('settings-store', JSON.stringify({ apiKey: 'test-only', model: 'mock-model', baseUrl: 'https://example.test/v1' })))
  const idiom = { pinyin: 'huà lóng diǎn jīng', explanation: '完整解释，保留关键含义和考试用法。', origin: '出处说明', example: '这句话画龙点睛。', usage: '作谓语，强调点明要旨。', relatedIdioms: ['锦上添花', '恰到好处', '点石成金'] }
  let fail = false
  let count = 0
  const budgets = []
  await page.route('https://example.test/**', async route => {
    const request = route.request().postDataJSON()
    budgets.push(request.max_tokens)
    count++
    const truncated = fail || count === 1
    await route.fulfill({ json: { choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content: truncated ? '{"explanation":"未完成' : JSON.stringify(idiom) } }] } })
  })
  await page.goto('http://127.0.0.1:5173/wordLearning/#/learn')
  await page.getByPlaceholder('输入成语或词语…').fill('画龙点睛')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.getByText(idiom.explanation, { exact: true }).waitFor()
  assert.deepEqual(budgets, [4096, 8192])
  const before = await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    return JSON.stringify(useIdiomStore().idiomCache['画龙点睛'])
  })
  fail = true
  await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    await useIdiomStore().regenerateIdiom('画龙点睛', { apiKey: 'test-only', model: 'mock-model', baseUrl: 'https://example.test/v1' })
  })
  await page.getByText(/未保存不完整内容/).waitFor()
  await page.getByText(idiom.explanation, { exact: true }).waitFor()
  const after = await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const store = useIdiomStore()
    return { cache: JSON.stringify(store.idiomCache['画龙点睛']), loading: store.idiomLoading }
  })
  assert.equal(after.cache, before)
  assert.equal(after.loading, false)
  assert.equal(count, 4)
  await page.getByPlaceholder('输入成语或词语…').fill('一心一意')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.waitForFunction(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    return !useIdiomStore().idiomLoading && useIdiomStore().idiomError.includes('未保存')
  })
  assert.equal(await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    return !!useIdiomStore().idiomCache['一心一意']
  }), false)
  assert.equal(count, 6)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, recoveredAutomatically: true, existingCachePreserved: true, incompleteResultNotCached: true, errors }))
} finally { await browser.close() }

import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const require = createRequire(process.env.CODEX_NODE_MODULES + '/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })

await page.addInitScript(() => localStorage.setItem('settings-store', JSON.stringify({ apiKey: 'test-only', model: 'test-model', baseUrl: 'https://api.deepseek.com' })))
await page.route('https://api.deepseek.com/**', async route => {
  await new Promise(resolve => setTimeout(resolve, 2000))
  await route.fulfill({ json: { choices: [{ message: { content: '{}' } }] } })
})

function center(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function assertCenteredExpansion(trigger) {
  const surface = page.locator('.generation-surface')
  await page.waitForFunction(() => {
    const element = document.querySelector('.generation-surface')
    return element && Math.abs(element.getBoundingClientRect().width - 80) < .1 && !document.querySelector('.is-morphing')
  })
  const before = await surface.boundingBox()
  assert.equal(before.width, 80)
  const origin = center(before)
  await trigger()
  await page.waitForTimeout(140)
  const during = await surface.boundingBox()
  assert(during.width > before.width)
  const current = center(during)
  assert(Math.abs(current.x - origin.x) < 1, JSON.stringify({ origin, current, before, during }))
  assert(Math.abs(current.y - origin.y) < 1, JSON.stringify({ origin, current, before, during }))
}

await page.goto('http://127.0.0.1:5173/wordLearning/#/learn')
await page.getByPlaceholder('输入成语或词语…').fill('画龙点睛')
await assertCenteredExpansion(() => page.getByRole('button', { name: '发送词语', exact: true }).click())

await page.goto('http://127.0.0.1:5173/wordLearning/#/learn?mode=compare')
await page.getByPlaceholder('输入词语 1').fill('画龙点睛')
await page.getByPlaceholder('输入词语 2').fill('锦上添花')
await assertCenteredExpansion(() => page.getByRole('button', { name: '发送对比', exact: true }).click())

console.log(JSON.stringify({ passed: true, cases: ['search', 'compare'], centerTolerancePx: 1 }))
await browser.close()

import assert from 'node:assert/strict'

import { launchBrowser, base } from './helpers/browser.mjs'
const browser = await launchBrowser()
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
  const caption = page.locator('.orb-caption')
  await page.waitForFunction(() => {
    const element = document.querySelector('.generation-surface')
    return element && Math.abs(element.getBoundingClientRect().width - 80) < .1 && !document.querySelector('.is-morphing')
  })
  const before = await surface.boundingBox()
  const captionBefore = await caption.boundingBox()
  assert.equal(before.width, 80)
  const origin = center(before)
  await trigger()
  await page.waitForFunction(() => document.querySelector('.generation-surface').getAnimations().length > 0)
  const timing = await surface.evaluate(element => {
    const animation = element.getAnimations().find(a => a.effect?.getKeyframes().some(frame => 'width' in frame && 'left' in frame))
    return animation?.effect?.getTiming()
  })
  assert.equal(timing?.duration, 720, 'the orb expansion must retain its deliberate 720ms pacing')
  assert.equal(String(timing?.easing).replaceAll(' ', ''), 'cubic-bezier(0.4,0,0.2,1)')
  for (const time of [40, 120, 220, 300, 420, 600, 710]) {
    const sample = await page.evaluate(async time => {
      const surface = document.querySelector('.generation-surface')
      const animation = surface.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'width' in frame && 'left' in frame))
      if (!animation) throw new Error('generation geometry animation not found')
      animation.pause()
      animation.currentTime = time
      for (const a of document.querySelector('.generation-body').getAnimations()) { a.pause(); a.currentTime = time }
      await new Promise(requestAnimationFrame)
      const box = surface.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, progress: animation.effect.getComputedTiming().progress,
        bodyY: document.querySelector('.generation-body').getBoundingClientRect().y,
        captionY: document.querySelector('.orb-caption').getBoundingClientRect().y }
    }, time)
    const current = center(sample)
    assert(Math.abs(current.x - origin.x) < 1, JSON.stringify({ time, origin, sample }))
    if (sample.progress <= .7) assert(Math.abs(current.y - origin.y) < 1, JSON.stringify({ time, origin, sample }))
    else assert(Math.abs(sample.y - sample.bodyY) < 1, JSON.stringify({ time, sample }))
    assert(Math.abs(sample.captionY - captionBefore.y) < 1, JSON.stringify({ captionBefore, sample }))
  }
  await page.evaluate(() => {
    const surface = document.querySelector('.generation-surface')
    const geometry = surface.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'width' in frame && 'left' in frame))
    if (!geometry) throw new Error('generation geometry animation not found')
    geometry.finish()
    document.querySelector('.generation-body').getAnimations().forEach(a => a.finish())
  })
  await page.waitForFunction(() => !document.querySelector('.is-morphing'))
  await page.getByRole('button', { name: '收起卡片', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.is-morphing') && !document.querySelector('.generation-stage.is-active'))
  const closed = await surface.boundingBox()
  assert(Math.abs(closed.width - 80) < 1 && Math.abs(center(closed).y - origin.y) < 1)
}

await page.goto(`${base}#/learn`)
await page.getByPlaceholder('输入成语或词语…').fill('画龙点睛')
await assertCenteredExpansion(() => page.getByRole('button', { name: '发送词语', exact: true }).click())

await page.goto(`${base}#/learn?mode=compare`)
await page.getByPlaceholder('输入词语 1').fill('画龙点睛')
await page.getByPlaceholder('输入词语 2').fill('锦上添花')
await assertCenteredExpansion(() => page.locator('.generation-stage .satellite.right').click())

// Simulate the delayed visualViewport restoration that desktop mobile emulation
// does not generate when an input loses focus.
await page.goto(`${base}#/learn`)
await page.getByPlaceholder('输入成语或词语…').fill('一心一意')
await page.evaluate(() => {
  let keyboard = true
  Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => document.documentElement.clientHeight - (keyboard ? 300 : 0) })
  document.activeElement.addEventListener('blur', () => setTimeout(() => { keyboard = false }, 200), { once: true })
  document.querySelector('.study-top-action').click()
})
await page.waitForTimeout(100)
assert.equal(await page.locator('.generation-stage.is-active').count(), 0)
await page.waitForFunction(() => !!document.querySelector('.generation-stage.is-active'))
console.log(JSON.stringify({ passed: true, engine: process.env.BROWSER_ENGINE || 'chromium', cases: ['search', 'compare', 'delayed-keyboard-restoration'], samplesPerExpansion: 7, centerTolerancePx: 1 }))
await browser.close()

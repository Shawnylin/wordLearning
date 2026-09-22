import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(`${process.env.CODEX_NODE_MODULES}/package.json`)
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/wordLearning/'
try {
  for (const [route, name, selector] of [['report', '查看历史日报', '.daily-history'], ['profile/models', '添加模型服务商', '.provider-editor-dialog']]) {
    await page.goto(`${base}#/${route}`)
    const trigger = page.getByRole('button', { name, exact: true, includeHidden: true }), panel = page.locator(selector)
    await trigger.waitFor()
    const origin = await trigger.boundingBox()
    await trigger.click()
    const opening = await panel.evaluate(el => {
      const a = el.getAnimations()[0]; a.pause(); a.currentTime = 0
      const frames = a.effect.getKeyframes(), timing = a.effect.getTiming()
      const start = el.getBoundingClientRect().toJSON(); a.currentTime = 250
      const middle = el.getBoundingClientRect().toJSON()
      return { frames, timing, start, middle }
    })
    assert.equal(opening.timing.duration, 720)
    assert.equal(opening.timing.easing, 'cubic-bezier(0.32, 0, 0.18, 1)')
    assert.equal(opening.frames.at(-1).borderRadius, '24px')
    assert(Math.abs(opening.start.width - origin.width) < 1)
    assert(Math.abs(opening.start.x - origin.x) < 1)
    await page.keyboard.press('Escape')
    const closing = await panel.evaluate(el => {
      const a = el.getAnimations()[0]; a.pause(); a.currentTime = 0
      return { frame: a.effect.getKeyframes()[0], duration: a.effect.getTiming().duration }
    })
    assert.equal(closing.duration, 520)
    assert(Math.abs(parseFloat(closing.frame.width) - opening.middle.width) < 1)
    // Dispatch a second open while the trigger is intentionally hidden by the closing morph.
    await trigger.evaluate(el => el.click())
    await panel.waitFor()
    await page.waitForTimeout(850)
    assert.equal(await panel.count(), 1)
    assert.equal(await panel.evaluate(el => el.getAnimations().length), 0)
    await panel.focus(); await page.keyboard.press('Shift+Tab')
    assert(await panel.evaluate(el => el.contains(document.activeElement) && document.activeElement !== el))
    await page.keyboard.press('Tab')
    assert(await panel.evaluate(el => el.contains(document.activeElement)))
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' })
    assert(await trigger.evaluate(el => document.activeElement === el && getComputedStyle(el).visibility === 'visible'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await trigger.click(); await page.waitForTimeout(50)
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await trigger.click()
    await page.evaluate(() => { location.hash = '#/learn' })
    await panel.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.provider-editor-layer, .history-outside').count(), 0)
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, overlays: 2, checks: 'geometry, timing, reversal, reopen, focus, reduced motion, unmount', errors }))
} finally { await browser.close() }


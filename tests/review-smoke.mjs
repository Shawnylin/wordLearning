import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'

const browser = await launchBrowser()
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto(`${base}#/review`)
  await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const { useSettingsStore } = await import('/wordLearning/src/stores/settings.ts')
    const idiom = useIdiomStore()
    const review = useReviewStore()
    const settings = useSettingsStore()
    const now = Date.now()
    const makeIdiom = word => ({
      id: word, word, pinyin: 'cè shì', explanation: `${word}的测试释义。`,
      origin: '测试来源', example: `${word}测试例句。`, usage: '测试用法',
      relatedIdioms: [], createdAt: now,
    })

    idiom.idiomCache = {
      '甲词': makeIdiom('甲词'),
      '乙词': makeIdiom('乙词'),
      '已掌握词': makeIdiom('已掌握词'),
      '未到期词': makeIdiom('未到期词'),
    }
    review.resetAll()
    review.wordStats = {
      '已掌握词': {
        state: 'mastered', nextReviewAt: now - 60_000, interval: 30,
        correctCount: 5, wrongCount: 0, lastReviewedAt: now - 86_400_000,
      },
      '未到期词': {
        state: 'review', nextReviewAt: now + 86_400_000, interval: 6,
        correctCount: 3, wrongCount: 0, lastReviewedAt: now - 86_400_000,
      },
    }
    review.ensureToday(now)
    settings.setReviewTarget(2)
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.getByText('今日待复习', { exact: true }).locator('..').getByText('2', { exact: true }).waitFor()
  await page.getByText('今日目标', { exact: true }).locator('..').getByText('2', { exact: true }).waitFor()
  await page.getByText('今日已完成', { exact: true }).locator('..').getByText('0', { exact: true }).waitFor()

  await page.getByRole('button', { name: '开始今日复习', exact: true }).click()
  await page.getByRole('button', { name: '答对', exact: true }).waitFor()

  const initial = await page.evaluate(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const review = useReviewStore()
    return { queue: [...review.queue], target: review.target }
  })
  assert.equal(initial.target, 2)
  assert.equal(initial.queue.length, 2)
  assert(!initial.queue.includes('已掌握词'))
  assert(!initial.queue.includes('未到期词'))

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === '答对')
    button?.click()
    button?.click()
  })
  await page.waitForTimeout(40)
  const afterDoubleClick = await page.evaluate(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const review = useReviewStore()
    return {
      totalLevels: Object.values(review.levels).reduce((sum, value) => sum + value, 0),
      done: review.done.length,
      phase: review.phase,
    }
  })
  assert.equal(afterDoubleClick.totalLevels, 1)
  assert.equal(afterDoubleClick.done, 0)
  assert.equal(afterDoubleClick.phase, 'reviewing')

  await page.reload()
  await page.getByRole('button', { name: '答对', exact: true }).waitFor()
  const afterReload = await page.evaluate(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const review = useReviewStore()
    return {
      totalLevels: Object.values(review.levels).reduce((sum, value) => sum + value, 0),
      target: review.target,
      phase: review.phase,
    }
  })
  assert.deepEqual(afterReload, { totalLevels: 1, target: 2, phase: 'reviewing' })

  const beforeDefer = (await page.locator('.flip-face h2').first().textContent()).trim()
  await page.getByRole('button', { name: '稍后复习', exact: true }).click()
  await page.waitForTimeout(30)
  const afterDefer = (await page.locator('.flip-face h2').first().textContent()).trim()
  assert.notEqual(afterDefer, beforeDefer)

  const wrongWord = afterDefer
  await page.getByRole('button', { name: '答错', exact: true }).click()
  await page.waitForTimeout(30)
  const wrongState = await page.evaluate(async word => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const review = useReviewStore()
    return {
      wrong: review.wrongToday[word],
      threshold: review.thresholds[word],
      queue: [...review.queue],
    }
  }, wrongWord)
  assert.equal(wrongState.wrong, 1)
  assert.equal(wrongState.threshold, 3)
  assert(wrongState.queue.includes(wrongWord))

  const masteredWord = (await page.locator('.flip-face h2').first().textContent()).trim()
  assert.notEqual(masteredWord, wrongWord)
  await page.getByRole('button', { name: '已掌握', exact: true }).click()
  await page.waitForTimeout(30)
  assert.equal((await page.locator('.flip-face h2').first().textContent()).trim(), wrongWord)

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '答对', exact: true }).click()
    await page.waitForTimeout(30)
  }
  await page.getByText('今日复习目标完成', { exact: true }).waitFor()

  const completed = await page.evaluate(async ({ wrongWord, masteredWord }) => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const idiom = useIdiomStore()
    const review = useReviewStore()
    return {
      phase: review.phase,
      completed: review.getTodayCompletedCount(),
      due: review.getDueCount(Object.keys(idiom.idiomCache)),
      wrongStat: review.wordStats[wrongWord],
      masteredStat: review.wordStats[masteredWord],
    }
  }, { wrongWord, masteredWord })
  assert.equal(completed.phase, 'finished')
  assert.equal(completed.completed, 2)
  assert.equal(completed.due, 0)
  assert.equal(completed.wrongStat.state, 'learning')
  assert.equal(completed.wrongStat.wrongCount, 1)
  assert.equal(completed.masteredStat.state, 'mastered')

  await page.reload()
  await page.getByText('今日复习目标完成', { exact: true }).waitFor()
  assert(await page.getByText(/今日已完成\s*2\s*\/\s*2\s*词/).count())

  const persisted = await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const idiom = useIdiomStore()
    const review = useReviewStore()
    return { completed: review.getTodayCompletedCount(), due: review.getDueCount(Object.keys(idiom.idiomCache)), phase: review.phase }
  })
  assert.deepEqual(persisted, { completed: 2, due: 0, phase: 'finished' })

  await page.evaluate(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    useReviewStore().resetSession()
  })
  await page.getByText('今天没有待复习内容', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(errors, [])

  console.log(JSON.stringify({
    passed: true,
    initialDue: 2,
    preventedDoubleCount: true,
    refreshPersisted: true,
    masteredExcluded: true,
    wrongReappeared: true,
    reducedMotion: true,
    errors,
  }))
} finally {
  await browser.close()
}

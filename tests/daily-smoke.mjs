import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'
const browser = await launchBrowser()
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce' })
  const errors = []
  let lookupRequests = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('settings-store', JSON.stringify({ apiKey:'test-only', model:'mock-model', baseUrl:'https://example.test/v1' }))
    const pdfArticle = { title:'日报原文甲', shortTitle:'原文甲', content:'因地制宜推进高质量发展。'.repeat(30), words:['因地制宜'], source:'导入 PDF',url:'',publishedAt:'',origin:'pdf',page:1,analysis:'' }
    const linkArticle = { title:'日报原文乙', shortTitle:'原文乙', content:'守正创新促进协同发展。'.repeat(30), words:['守正创新'], source:'示例媒体',url:'https://news.example.com/article',publishedAt:'',origin:'link',analysis:'' }
    // Seed only once so a reload tests actual persistence.
    if (!localStorage.getItem('daily-store')) localStorage.setItem('daily-store', JSON.stringify({
      issues: [{ id:'a',groupId:'group-a',createdAt:1,tokenUsage:0,articles:[pdfArticle] }, { id:'b',groupId:'group-b',createdAt:2,tokenUsage:0,articles:[linkArticle] }],
      groups: [{id:'group-a',name:'第一组',createdAt:1,collapsed:false},{id:'group-b',name:'第二组',createdAt:2,collapsed:false}],selectedId:'a',
    }))
  })
  await page.route('https://example.test/**', async route => {
    lookupRequests++
    const body = route.request().postDataJSON()
    const prompt = body.messages?.[1]?.content || ''
    const word = prompt.match(/「([^」]+)」/)?.[1] || '测试词'
    const content = JSON.stringify({
      pinyin:'cè shì', explanation:`${word}的完整释义`, origin:'测试出处',
      example:`${word}测试例句`, usage:'测试用法', relatedIdioms:['相关一','相关二','相关三'],
    })
    const event = { choices:[{ delta:{ content }, finish_reason:'stop' }], usage:{ total_tokens:80 } }
    await route.fulfill({ contentType:'text/event-stream', body:`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n` })
  })
  await page.goto(`${base}#/report`)
  await page.getByRole('heading', {name:'日报原文甲',exact:true}).waitFor()

  // A free text selection in a PDF article must use the shared idiom/review pipeline.
  await page.evaluate(() => {
    const root = [...document.querySelectorAll('.daily-prose')].find(node => node.textContent?.includes('高质量'))
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf('高质量')
      if (index < 0) continue
      const range = document.createRange()
      range.setStart(node, index); range.setEnd(node, index + 3)
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      return
    }
    throw new Error('selection text not found')
  })
  const selectionQuery = page.locator('.selection-query')
  await selectionQuery.getByRole('button', { name:'查询', exact:true }).click()
  await page.waitForFunction(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    return useReviewStore().wordStats['高质量']?.state === 'new'
  })
  await page.getByRole('button', { name:'收回日报学习卡片', exact:true }).click()

  await page.getByRole('button', { name:'学习因地制宜', exact:true }).first().click()
  await page.waitForFunction(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    return !!useReviewStore().wordStats['因地制宜']
  })
  await page.getByRole('button', { name:'收回日报学习卡片', exact:true }).click()
  // Relearning the same highlighted word records another lookup but must preserve mastered progress.
  const mastered = await page.evaluate(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const review = useReviewStore()
    review.wordStats['因地制宜'] = {
      state:'mastered', nextReviewAt:9999999999999, interval:30,
      correctCount:8, wrongCount:2, lastReviewedAt:777777,
    }
    return { ...review.wordStats['因地制宜'] }
  })
  await page.getByRole('button', { name:'学习因地制宜', exact:true }).first().click()
  await page.waitForFunction(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    return useIdiomStore().queryCounts['因地制宜'] === 2
  })
  await page.getByRole('button', { name:'收回日报学习卡片', exact:true }).click()
  const pdfLearning = await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const idiom = useIdiomStore(), review = useReviewStore()
    return {
      mastered:{ ...review.wordStats['因地制宜'] },
      idiomCount:Object.keys(idiom.idiomCache).length,
      reviewCount:Object.keys(review.wordStats).length,
      queryCount:idiom.queryCounts['因地制宜'],
    }
  })
  assert.deepEqual(pdfLearning.mastered, mastered)
  assert.equal(pdfLearning.queryCount, 2)
  assert.equal(pdfLearning.idiomCount, 2)
  assert.equal(pdfLearning.reviewCount, 2)

  const trigger = page.getByRole('button', { name:'查看历史日报',exact:true })
  await trigger.click()
  const history = page.getByRole('dialog', { name:'历史日报' })
  await history.getByText('原文乙', {exact:true}).click()
  await history.waitFor({state:'detached'})
  await page.getByRole('heading', {name:'日报原文乙',exact:true}).waitFor()
  await page.getByRole('button', { name:'学习守正创新', exact:true }).first().click()
  await page.waitForFunction(async () => {
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    return !!useReviewStore().wordStats['守正创新']
  })
  await page.getByRole('button', { name:'收回日报学习卡片', exact:true }).click()

  await trigger.click()
  await history.getByRole('button', {name:'管理',exact:true}).click()
  const group = history.getByRole('textbox', {name:'分组名称'}).first()
  await group.fill('重命名分组'); await group.press('Enter')
  await history.getByLabel('移动原文甲到其他分组').selectOption('group-b')
  await history.getByRole('button', {name:'关闭历史日报',exact:true}).click(); await history.waitFor({state:'detached'})
  await page.reload(); await trigger.click()
  await history.getByRole('button', {name:'管理',exact:true}).click()
  assert.equal(await history.getByRole('textbox', {name:'分组名称'}).first().inputValue(), '重命名分组')
  assert.equal(await history.getByLabel('移动原文甲到其他分组').inputValue(), 'group-b')
  await history.getByRole('button', {name:'删除原文甲',exact:true}).click()
  await page.getByRole('dialog', {name:'删除日报？'}).getByRole('button', {name:'确认删除'}).click()
  assert.equal(await history.getByText('原文甲', {exact:true}).count(), 0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-store')))
  assert.deepEqual(saved.issues.map(issue => issue.id), ['b'])
  assert.equal(saved.issues[0].articles[0].origin, 'link')
  assert.equal(saved.issues[0].articles[0].content, '守正创新促进协同发展。'.repeat(30))
  const afterDelete = await page.evaluate(async () => {
    const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
    const { useReviewStore } = await import('/wordLearning/src/stores/review.ts')
    const idiom = useIdiomStore(), review = useReviewStore()
    return {
      words:Object.keys(review.wordStats).sort(),
      cache:Object.keys(idiom.idiomCache).sort(),
      mastered:{ ...review.wordStats['因地制宜'] },
    }
  })
  assert.deepEqual(afterDelete.words, ['因地制宜','守正创新','高质量'].sort())
  assert.deepEqual(afterDelete.cache, ['因地制宜','守正创新','高质量'].sort())
  assert.deepEqual(afterDelete.mastered, mastered)
  assert.equal(lookupRequests, 3)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({passed:true,checks:'daily selection to review, duplicate lookup, mastered preservation, PDF/link parity, history grouping/delete, review survives delete, source preservation',lookupRequests,errors}))
} finally { await browser.close() }

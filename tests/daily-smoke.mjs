import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'
const browser = await launchBrowser()
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const article = { title:'日报原文甲', shortTitle:'原文甲', content:'因地制宜推进高质量发展。'.repeat(30), words:['因地制宜'], source:'导入 PDF',url:'',publishedAt:'',origin:'pdf',page:1,analysis:'' }
    // Seed only once so a reload tests actual persistence.
    if (!localStorage.getItem('daily-store')) localStorage.setItem('daily-store', JSON.stringify({
      issues: [{ id:'a',groupId:'group-a',createdAt:1,tokenUsage:0,articles:[article] }, { id:'b',groupId:'group-b',createdAt:2,tokenUsage:0,articles:[{...article,title:'日报原文乙',shortTitle:'原文乙'}] }],
      groups: [{id:'group-a',name:'第一组',createdAt:1,collapsed:false},{id:'group-b',name:'第二组',createdAt:2,collapsed:false}],selectedId:'a',
    }))
  })
  await page.goto(`${base}#/report`)
  await page.getByRole('heading', {name:'日报原文甲',exact:true}).waitFor()
  const trigger = page.getByRole('button', { name:'查看历史日报',exact:true })
  await trigger.click()
  const history = page.getByRole('dialog', { name:'历史日报' })
  await history.getByText('原文乙', {exact:true}).click()
  await history.waitFor({state:'detached'})
  await page.getByRole('heading', {name:'日报原文乙',exact:true}).waitFor()
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
  assert.equal(await history.getByText('原文甲', {exact:true}).count(), 0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-store')))
  assert.deepEqual(saved.issues.map(issue => issue.id), ['b'])
  assert.equal(saved.issues[0].articles[0].content, '因地制宜推进高质量发展。'.repeat(30))
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({passed:true,checks:'history selection, group rename/move, reload persistence, delete, source preservation',errors}))
} finally { await browser.close() }

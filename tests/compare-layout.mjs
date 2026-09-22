import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'
const browser = await launchBrowser()
const page = await browser.newPage({viewport:{width:393,height:852},reducedMotion:'reduce'})
const errors=[]; page.on('pageerror', e=>errors.push(e.message))
const cases=[['画龙点睛','锦上添花'],['画龙点睛','锦上添花','恰到好处'],['百尺竿头更进一步','不积跬步无以至千里','锲而不舍','持之以恒','水滴石穿'],['这是一个用于验证超长词语完整显示的二十字词','ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789','画龙点睛','锦上添花','恰到好处'],['画龙点睛','画龙点睛','锦上添花','恰到好处']]
await page.goto(`${base}#/record`)
async function bounds(rootSelector) {
 const result=await page.locator(rootSelector).evaluate(root=>{
  const outer=root.getBoundingClientRect(); const failures=[]
  for(const word of root.querySelectorAll('[data-morph-word]')) {
   const range=document.createRange(); range.selectNodeContents(word)
   for(const rect of range.getClientRects()) if(rect.left<outer.left-1 || rect.right>outer.right+1) failures.push(word.textContent)
  }
  if(root.scrollWidth>root.clientWidth+1) failures.push('horizontal overflow')
  return failures
 })
 assert.deepEqual(result,[])
}
let checked=0
for(const width of [320,393,430,768]) {
 await page.setViewportSize({width,height:852})
 for(const words of cases) {
  const record={id:'layout',words,createdAt:Date.now(),tokenUsage:0,content:{meaningDiff:'测试内容'+'A'.repeat(120),usageDiff:'用法',scenarios:'场景',confusionPoints:'区别'}}
  await page.evaluate(record=>localStorage.setItem('idiom-store',JSON.stringify({idiomCache:{},searchHistory:[],compareHistory:[record],compareCache:{},favorites:[],queryCounts:{},tokenStats:{totalTokens:0,requestCount:0}})),record)
  await page.reload()
  await page.getByRole('button',{name:/对比记录/}).click()
  const row=page.locator('[role=button]').filter({hasText:words[0]}).first()
  await row.waitFor()
  await bounds('.compare-words--list')
  assert.equal(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
  await row.click()
  await page.getByRole('dialog').waitFor()
  await page.waitForFunction(() => document.querySelector('.record-panel')?.getAnimations().length === 0)
  await bounds('.compare-words--card')
  await bounds('.record-panel')
  assert.equal(await page.locator('.compare-words--card [data-morph-word]').count(),words.length)
  if(width===393 && words===cases[2]) await page.screenshot({path:'docs/.local/browser-artifacts/compare-five-words.png'})
  await page.getByRole('button',{name:'返回记录'}).click()
  await page.getByRole('dialog').waitFor({state:'detached'})
  await page.getByRole('button',{name:'管理',exact:true}).click()
  await bounds('.compare-words--list')
  assert.equal(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
  checked++
 }
}
assert.deepEqual(errors,[])
console.log(JSON.stringify({passed:true,layoutCases:checked,checked:'list, card, long body, edit mode, repeated words',errors}))
await browser.close()

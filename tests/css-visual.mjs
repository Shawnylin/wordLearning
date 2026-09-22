import { mkdir, writeFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'
const phase = process.argv[2]
assert(['before', 'after'].includes(phase), 'Usage: node tests/css-visual.mjs before|after')
const root = 'docs/.local/css-refactor'
await mkdir(`${root}/${phase}`, { recursive: true })
const browser = await launchBrowser()
const errors = [], captures = []
try {
  for (const [width, height] of [[320,852], [393,852], [820,1180], [1440,1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: 'light', locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', e => errors.push(e.message))
    await page.route('https://**/*', route => route.fulfill({ json: {} }))
    await page.addInitScript(() => {
      const now = 1790035200000
      const NativeDate = Date
      window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
      localStorage.setItem('daily-store', JSON.stringify({ issues: [{ id: 'css-daily', createdAt: now, tokenUsage: 80, articles: [{title:'因地制宜推动高质量发展', shortTitle:'高质量发展', content:'因地制宜推进高质量发展，久久为功提升基层治理效能。'.repeat(12), words:['因地制宜','久久为功'], source:'导入 PDF',url:'',publishedAt:'',origin:'pdf',page:1,analysis:''}] }], selectedId:'css-daily' }))
    })
    async function capture(name) {
      await page.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur() })
      await page.waitForTimeout(100)
      const key = `${width}-${name}`
      await page.screenshot({ path: `${root}/${phase}/${key}.png`, animations: 'disabled', caret: 'hide', fullPage: true })
      const styles = await page.evaluate(() => {
        const properties = ['display','position','width','height','padding','margin','gap','borderRadius','fontSize','lineHeight','color','backgroundColor','borderColor','boxShadow','gridTemplateColumns','transitionDuration','animationDuration']
        return [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length && !['SCRIPT','STYLE'].includes(el.tagName)).map(el => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect()
          return { tag: el.tagName, class: el.getAttribute('class'), rect: [r.x,r.y,r.width,r.height], style: Object.fromEntries(properties.map(k => [k,s[k]])) }
        })
      })
      await writeFile(`${root}/${phase}/${key}.json`, JSON.stringify(styles))
      if (phase === 'after') assert(JSON.stringify(styles) === await readFile(`${root}/before/${key}.json`, 'utf8'), `${key}: computed style or geometry changed (see JSON artifacts)`)
      captures.push(key)
    }
    await page.goto(`${base}#/learn`)
    await page.getByPlaceholder('输入成语或词语…').waitFor()
    await capture('learn-empty')
    await page.evaluate(async () => {
      const { useIdiomStore } = await import('/wordLearning/src/stores/idiom.ts')
      useIdiomStore().idiomCache['因地制宜'] = {id:'css-word',word:'因地制宜',pinyin:'yīn dì zhì yí',explanation:'根据各地的具体情况，制定适宜的办法。',origin:'结合实际，因地制宜。',example:'发展特色产业，应当因地制宜。',usage:'作谓语、宾语、状语。',relatedIdioms:['因时制宜','因势利导','实事求是'],createdAt:1790035200000,tokenUsage:120}
    })
    await page.evaluate(() => { location.hash = '#/learn?word=' + encodeURIComponent('因地制宜') })
    await page.locator('.study-heading').waitFor()
    await capture('learn-result')
    for (const route of ['profile', 'profile/account', 'profile/models', 'report']) {
      await page.goto(`${base}#/${route}`)
      await page.locator({profile:'.profile-page', 'profile/account':'.profile-account-page', 'profile/models':'.model-settings', report:'.daily-workspace'}[route]).waitFor()
      await page.waitForFunction(() => !document.querySelector('[class*="fade-leave"], [class*="fade-enter"]'))
      await capture(route.replaceAll('/','-'))
      if (route === 'profile') {
        await page.evaluate(() => document.documentElement.classList.add('dark'))
        await capture('profile-dark')
      }
      if (route === 'profile/models') {
        await page.getByRole('button', {name:'添加模型服务商',exact:true}).click()
        await page.locator('.provider-editor-dialog').waitFor()
        await capture('provider-dialog')
      }
      if (route === 'report') {
        await page.getByRole('button', {name:'查看历史日报',exact:true}).click()
        await page.locator('.daily-history').waitFor()
        await capture('history-dialog')
      }
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(`${root}/${phase}/summary.json`, JSON.stringify({phase,captures,errors}, null, 2))
  console.log(JSON.stringify({phase,captures:captures.length,widths:[320,393,820,1440],errors}))
} finally { await browser.close() }

import { chromium, webkit } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

export const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/wordLearning/'
const origin = new URL(base)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw new Error('Browser tests require a loopback test server')
const browsers = new Set()
export async function closeBrowsers() {
  await Promise.allSettled([...browsers].map(browser => browser.close()))
  browsers.clear()
}
export async function saveFailureArtifacts(name) {
  const directory = 'docs/.local/browser-artifacts'
  await mkdir(directory, { recursive: true })
  let index = 0
  for (const browser of browsers) for (const context of browser.contexts()) for (const page of context.pages()) {
    const prefix = `${directory}/${name}-${index++}`
    await page.screenshot({ path: `${prefix}.png`, timeout: 3000 }).catch(() => {})
    await writeFile(`${prefix}.txt`, await page.locator('body').innerText({ timeout: 3000 }).catch(() => 'Page unavailable'))
  }
}
export async function launchBrowser() {
  await mkdir('docs/.local/browser-artifacts', { recursive: true })
  const engine = process.env.BROWSER_ENGINE || 'chromium'
  if (!['chromium', 'webkit'].includes(engine)) throw new Error(`Unsupported browser engine: ${engine}`)
  const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true,
    ...(engine === 'chromium' && process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  })
  browsers.add(browser)
  const createContext = browser.newContext.bind(browser)
  browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block' })
    context.on('page', page => page.on('pageerror', error => console.error(`[pageerror] ${error.message}`)))
    context.setDefaultTimeout(10000)
    context.setDefaultNavigationTimeout(15000)
    // More specific page.route fixtures take precedence. No unmatched API request
    // reaches the network, including the local article-reader proxy.
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      const asset = ['document', 'script', 'stylesheet', 'image', 'font', 'manifest', 'other'].includes(request.resourceType())
      if (url.origin === origin.origin && !/^\/(?:wordLearning\/)?api\//.test(url.pathname) && asset) return route.continue()
      return route.fulfill({ status: 501, json: { error: 'Unmocked request blocked by test harness' } })
    })
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url())
      if (url.hostname === origin.hostname && url.port === origin.port) socket.connectToServer()
      else socket.close()
    })
    return context
  }
  browser.newPage = async options => (await browser.newContext(options)).newPage()
  return browser
}

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { launchBrowser, base } from './helpers/browser.mjs'
let received = 0
const upstream = createServer((_req, res) => { received++; res.end('must not be called') })
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
const browser = await launchBrowser()
try {
  const page = await browser.newPage()
  await page.goto(`${base}#/learn`)
  // Use a harmless local sentinel to prove the guard blocks an API host before sending.
  const status = await page.evaluate(async target => (await fetch(target)).status, `http://127.0.0.1:${upstream.address().port}/paid-api`)
  assert.equal(status, 501); assert.equal(received, 0)
  const proxyStatus = await page.evaluate(async () => (await fetch('/wordLearning/api/article-reader?url=https://example.test/article')).status)
  assert.equal(proxyStatus, 501)
  await page.route('https://model.example.test/**', route => route.fulfill({ json: { mock: true } }))
  assert.deepEqual(await page.evaluate(async () => (await fetch('https://model.example.test/models')).json()), { mock: true })
  console.log(JSON.stringify({ passed: true, checks: 'unmocked external host and local proxy blocked, explicit mock reachable', upstreamRequests: received }))
} finally { await browser.close(); await new Promise(resolve => upstream.close(resolve)) }

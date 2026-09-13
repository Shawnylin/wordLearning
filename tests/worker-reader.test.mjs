import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import worker, { articleUrl } from '../worker/article-reader.mjs'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const article = 'https://paper.people.com.cn/rmrb/pc/content/202609/13/content_30180713.html'

test('worker restricts callers and unsafe target domains', async () => {
  assert.equal(articleUrl(article), article)
  assert.throws(() => articleUrl('http://127.0.0.1/private'))
  assert.equal(articleUrl('https://news.example.com/article'), 'https://news.example.com/article')
  assert.throws(() => articleUrl('https://example.local/a'))
  assert.throws(() => articleUrl('https://name:password@example.com/a'))
  const response = await worker.fetch(new Request('https://reader.example/api/article-reader?url=' + encodeURIComponent(article), { headers: { Origin: 'https://evil.example' } }))
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('worker returns article HTML to the GitHub Pages origin', async () => {
  globalThis.fetch = async (target, options) => {
    assert.equal(target, article)
    assert.equal(options.headers.Authorization, undefined)
    return new Response('<html><body>文章正文</body></html>', { headers: { 'content-type': 'text/html;charset=utf-8' } })
  }
  const request = new Request('https://reader.example/api/article-reader?url=' + encodeURIComponent(article), { headers: { Origin: 'https://shawnylin.github.io' } })
  const response = await worker.fetch(request)
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://shawnylin.github.io')
  assert.equal(data.html, '<html><body>文章正文</body></html>')
})

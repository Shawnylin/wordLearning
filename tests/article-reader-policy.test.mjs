import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { readerUrl, readPublicArticle } from '../server/article-reader.mjs'
import { articleUrl, fetchArticle } from '../worker/article-reader.mjs'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const start = 'https://paper.people.com.cn/article'
const html = () => new Response('<html>article</html>', { headers: { 'content-type': 'text/html' } })
const unsafe = [
  'http://127.0.0.1/a', 'http://2130706433/a', 'http://0x7f000001/a',
  'http://[::1]/a', 'http://[::ffff:127.0.0.1]/a', 'http://10.0.0.1/a',
  'http://localhost/a', 'https://host.internal/a', 'https://host.test/a',
  'https://host.invalid/a', 'https://host.localhost/a', 'https://host.local/a',
  'https://user:pass@people.com.cn/a', 'https://people.com.cn:444/a',
  'file:///article', 'https://people.com.cn/'
]

test('reader policies intentionally differ for general and media-lookalike domains', () => {
  for (const host of ['people.com.cn', 'gmw.cn', 'banyuetan.org']) {
    for (const domain of [host, 'news.' + host]) {
      const url = `https://${domain}/article`
      assert.equal(readerUrl(url + '#section'), url)
      assert.equal(articleUrl(url + '#section'), url)
    }
  }
  for (const host of ['news.example.com', 'people.com.cn.evil.com', 'evilpeople.com.cn']) {
    const url = `https://${host}/article`
    assert.throws(() => readerUrl(url))
    assert.equal(articleUrl(url), url) // General article, never a trusted-media classification.
  }
  for (const validate of [readerUrl, articleUrl]) {
    for (const url of unsafe) assert.throws(() => validate(url), url)
    assert.equal(validate('https://people.com.cn:443/a'), 'https://people.com.cn/a')
  }
})

for (const [name, read] of [
  ['Node', (url, fetcher) => readPublicArticle(url, fetcher)],
  ['Worker', (url, fetcher) => { globalThis.fetch = fetcher; return fetchArticle(url) }]
]) {
  test(`${name}: redirect validation blocks unsafe targets before the next request`, async () => {
    for (const target of unsafe) {
      let calls = 0, cancelled = false
      await assert.rejects(read(start, async () => {
        calls++
        return new Response(new ReadableStream({ cancel() { cancelled = true } }), {
          status: 302, headers: { location: target }
        })
      }))
      assert.equal(calls, 1, target)
      assert.equal(cancelled, true, target)
    }
  })

  test(`${name}: relative redirects resolve, cross-domain policy persists, loops stop`, async () => {
    let calls = 0
    const result = await read(start, async (url, options) => {
      assert.equal(options.redirect, 'manual')
      assert.equal(options.headers.Authorization, undefined)
      assert.equal(options.headers.Cookie, undefined)
      if (++calls === 1) return new Response(null, { status: 307, headers: { location: '/next#anchor' } })
      assert.equal(url, 'https://paper.people.com.cn/next')
      return html()
    })
    assert.equal(result.url, 'https://paper.people.com.cn/next')
    for (const target of ['https://news.example.com/a', 'https://people.com.cn.evil.com/a']) {
      calls = 0
      const reading = read(start, async () => ++calls === 1
        ? new Response(null, { status: 302, headers: { location: target } }) : html())
      if (name === 'Node') { await assert.rejects(reading); assert.equal(calls, 1) }
      else { assert.equal((await reading).url, target); assert.equal(calls, 2) }
    }
    calls = 0
    await assert.rejects(read(start, async () => {
      calls++
      return new Response(null, { status: 308, headers: { location: start } })
    }), /重定向次数/)
    assert.equal(calls, 4)
    await assert.rejects(read(start, async () => new Response(null, { status: 301 })), /缺少目标/)
  })

  test(`${name}: oversized content cannot bypass rejection with absent or false length`, async () => {
    for (const length of [undefined, '1', String(2 * 1024 * 1024 + 1)]) {
      await assert.rejects(read(start, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'text/html', ...(length ? { 'content-length': length } : {}) }
      })), /大小限制/)
    }
  })
}

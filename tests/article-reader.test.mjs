import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readerUrl, readPublicArticle } from '../server/article-reader.mjs'
const url = 'https://paper.people.com.cn/rmrb/pc/content/202609/13/content_30180713.html'
test('reader allows the requested paper URL and rejects credentials, local and spoofed hosts', () => {
  assert.equal(readerUrl(url), url)
  for (const value of ['http://127.0.0.1/a','https://people.com.cn.evil.com/a','https://name:pass@people.com.cn/a','https://people.com.cn:444/a','file:///etc/passwd']) assert.throws(() => readerUrl(value))
})
test('reader fetches HTML without forwarding credentials and returns final URL', async () => {
  const result = await readPublicArticle(url, async (target, options) => {
    assert.equal(target, url); assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, undefined)
    return new Response('<html>真实文章</html>', { headers: { 'content-type': 'text/html;charset=utf-8' } })
  })
  assert.equal(result.html, '<html>真实文章</html>'); assert.equal(result.url, url)
})
test('redirects cannot escape the media allowlist', async () => {
  let calls = 0
  await assert.rejects(readPublicArticle(url, async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }) }))
  assert.equal(calls, 1)
})
test('non-HTML, unsuccessful and oversized responses are rejected', async () => {
  for (const response of [new Response('no', {status:403}), new Response('{}', {headers:{'content-type':'application/json'}}), new Response('x'.repeat(2*1024*1024+1), {headers:{'content-type':'text/html'}})]) await assert.rejects(readPublicArticle(url, async () => response))
})

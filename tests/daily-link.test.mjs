import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
const compiled = await build({ entryPoints: ['src/api/dailyLink.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { generateDailyFromLink } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const url = 'https://news.example.com/article.html'
const config = { apiKey: 'secret-test', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', thinkingEnabled: true }
const content = '坚持因地制宜，推动协同发展。'.repeat(15)
const article = { title: '模型标题', publishedAt: '', content, words: ['因地制宜', '协同发展'], analysis: '关注词语搭配与逻辑照应。' }
const pageText = `Title: 网页原始标题\nURL Source: ${url}\nMarkdown Content:\n${content}`
const answer = (a = article) => Response.json({ choices: [{ message: { content: JSON.stringify({ articles: [a] }) }, finish_reason: 'stop' }], usage: { total_tokens: 120 } })
test('reads only specified URL then one model request without search, preserving text and usage', async () => {
  let calls = 0, usage = 0
  globalThis.fetch = async (target, options) => {
    if (target === url) throw new TypeError('CORS')
    calls++
    if (calls === 1) { assert.equal(target, 'https://r.jina.ai/' + url); assert.equal(options.headers.Authorization, undefined); return new Response(pageText) }
    assert.equal(target, 'https://api.deepseek.com/chat/completions')
    const body = JSON.parse(options.body)
    assert.equal(body.tools, undefined); assert.equal(body.thinking.type, 'disabled'); assert.equal(body.max_tokens, 3000)
    assert(JSON.parse(body.messages[1].content).pageText.includes(content))
    return answer()
  }
  const result = await generateDailyFromLink(config, url + '#text', [], undefined, n => { usage += n })
  assert.equal(calls, 2); assert.equal(usage, 120)
  assert.equal(result.articles[0].url, url); assert.equal(result.articles[0].title, '网页原始标题'); assert.equal(result.articles[0].origin, 'link'); assert.equal(result.articles[0].content, content)
})
test('invalid, private and duplicate URLs never read pages or call model', async () => {
  globalThis.fetch = async () => { throw new Error('should not fetch') }
  for (const value of ['not a URL', 'javascript:alert(1)', 'http://localhost/a', 'http://127.0.0.1/a', 'http://[::1]/a', 'https://name:pass@example.com/a', 'https://example.local/a']) await assert.rejects(generateDailyFromLink(config, value, []), /网址/)
  await assert.rejects(generateDailyFromLink(config, url, [url]), /已收录/)
})
test('unreadable pages do not trigger model request or search fallback', async () => {
  for (const response of [new Response('blocked', { status: 403 }), new Response('Title: x\nMarkdown Content:\n太短')]) {
    let calls = 0
    globalThis.fetch = async target => { if (target === url) throw new TypeError('CORS'); calls++; return response }
    await assert.rejects(generateDailyFromLink(config, url, [])); assert.equal(calls, 1)
  }
})
test('invented excerpt fails with billed usage and no retry', async () => {
  let calls = 0, usage = 0
  globalThis.fetch = async target => { if (target === url) throw new TypeError('CORS'); return ++calls === 1 ? new Response(pageText) : answer({ ...article, content: '这是完全编造的原文。'.repeat(20) }) }
  await assert.rejects(generateDailyFromLink(config, url, [], undefined, n => { usage += n }), /不一致/)
  assert.equal(calls, 2); assert.equal(usage, 120)
})
test('streams link analysis progress and validates complete output', async () => {
  let calls = 0; const phases = []
  const json = JSON.stringify({ articles: [article] })
  globalThis.fetch = async target => { if (target === url) throw new TypeError('CORS'); return ++calls === 1 ? new Response(pageText) : new Response([
    { choices: [{ delta: { content: json.slice(0, 30) } }] },
    { choices: [{ delta: { content: json.slice(30) }, finish_reason: 'stop' }] },
    { choices: [], usage: { total_tokens: 99 } }
  ].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } }) }
  const issue = await generateDailyFromLink(config, url, [], undefined, undefined, p => phases.push(p.phase))
  assert.equal(issue.tokenUsage, 99); assert(phases.includes('reading')); assert(phases.includes('generating')); assert(phases.includes('validating'))
})
test('cancelled read makes no model call', async () => {
  const controller = new AbortController(); controller.abort()
  let calls = 0
  globalThis.fetch = async (_, options) => { calls++; assert(options.signal.aborted); throw new DOMException('aborted', 'AbortError') }
  await assert.rejects(generateDailyFromLink(config, url, [], controller.signal), /已取消/); assert.equal(calls, 1)
})

test('People paper uses the same-origin reader and never the blocked Jina route', async () => {
  const paper = 'https://paper.people.com.cn/rmrb/pc/content/202609/13/content_30180713.html'
  let calls = 0
  globalThis.fetch = async target => {
    calls++
    assert.equal(target, '/wordLearning/api/article-reader?url=' + encodeURIComponent(paper))
    return Response.json({ error: '原站读取超时' }, {status:502})
  }
  await assert.rejects(generateDailyFromLink(config, paper, []), /原站读取超时.*未调用模型/)
  assert.equal(calls, 1)
})
test('missing deployed reader and model network failure have separate actionable errors', async () => {
  globalThis.fetch = async () => new Response('<html>static fallback</html>', {headers:{'content-type':'text/html'}})
  await assert.rejects(generateDailyFromLink(config, 'https://paper.people.com.cn/a.html', []), /尚未部署文章读取接口/)
  globalThis.fetch = async target => {
    if (String(target).startsWith('https://r.jina.ai/')) return new Response(pageText)
    throw new TypeError('network')
  }
  await assert.rejects(generateDailyFromLink(config, url, []), /网页已读取，但模型接口连接失败/)
})

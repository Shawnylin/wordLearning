import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
const compiled = await build({ entryPoints: ['src/api/daily.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { generateDaily, validateArticles, sourceUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const article = { title: '测试文段', source: '人民日报', url: 'https://opinion.people.com.cn/n1/2026/test.html', publishedAt: new Date(Date.now() + 28800000).toISOString().slice(0, 10), content: '坚持因地制宜，推动协同发展。'.repeat(15), words: ['因地制宜', '协同发展'], analysis: '关注词语的搭配对象和语境照应。' }
const config = { apiKey: 'test-key', model: 'search-model', baseUrl: 'https://api.example.test/v1/chat/completions' }
function reply(a = article) { return { status: 'completed', output: [{ type: 'web_search_call', status: 'completed', action: { sources: [{ url: a.url }] } }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ articles: [a] }) }] }], usage: { total_tokens: 123 } } }
test('actual search request includes allowlist and preserves verified article', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example.test/v1/responses')
    const body = JSON.parse(options.body)
    assert.equal(body.tool_choice, 'required'); assert.equal(body.tools[0].type, 'web_search'); assert.equal(body.store, false)
    assert(body.input.includes('不改写'))
    return Response.json(reply())
  }
  const result = await generateDaily(config, [])
  assert.deepEqual(result.articles, [article]); assert.equal(result.tokenUsage, 123)
})
test('no tool execution, missing evidence, incomplete output and duplicate articles are rejected', async () => {
  for (const kind of ['no-search', 'no-evidence', 'incomplete', 'duplicate']) {
    const data = reply()
    if (kind === 'no-search') data.output.shift()
    if (kind === 'no-evidence') data.output[0].action.sources = []
    if (kind === 'incomplete') data.status = 'incomplete'
    globalThis.fetch = async () => Response.json(data)
    await assert.rejects(generateDaily(config, kind === 'duplicate' ? [article.url] : []))
  }
})
test('rejects spoofed domains, executable URLs, invalid dates and missing highlight terms', () => {
  for (const url of ['https://people.com.cn.evil.test/a', 'javascript:alert(1)', 'https://evil.test/people.com.cn', 'https://people.com.cn/']) assert.throws(() => sourceUrl(url))
  for (const patch of [{ publishedAt: '2099-01-01' }, { publishedAt: '2026-02-30' }, { words: ['不存在'] }, { content: '太短' }]) assert.throws(() => validateArticles([{ ...article, ...patch }]))
  assert.deepEqual(validateArticles([{ ...article, publishedAt: '2020-01-01' }]), [{ ...article, publishedAt: '2020-01-01' }])
})
test('unsupported API and cancellation fail without retry', async () => {
  let count = 0
  globalThis.fetch = async () => { count++; return Response.json({}, { status: 404 }) }
  await assert.rejects(generateDaily(config, []), /Responses/); assert.equal(count, 1)
  globalThis.fetch = async (_, { signal }) => { if (signal.aborted) throw new DOMException('aborted', 'AbortError'); throw new Error('expected aborted signal') }
  const controller = new AbortController(); controller.abort()
  await assert.rejects(generateDaily(config, [], controller.signal), /已取消/)
})

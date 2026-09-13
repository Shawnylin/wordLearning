import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
const compiled = await build({ entryPoints: ['src/api/daily.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { generateDaily, validateArticles, sourceUrl, parseDailyOutput } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
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
test('third-party DeepSeek model keeps provider search support and evidence validation', async () => {
  globalThis.fetch = async () => Response.json(reply())
  assert.equal((await generateDaily({ ...config, model: 'deepseek-flash' }, [])).articles.length, 1)
  const data = reply(); data.output.shift()
  globalThis.fetch = async () => Response.json(data)
  await assert.rejects(generateDaily({ ...config, model: 'deepseek-flash' }, []), /联网搜索协议/)
})
function anthropicReply(patch = {}) {
  return { type: 'message', stop_reason: 'end_turn', content: [
    { type: 'text', text: '正在搜索权威媒体。' },
    { type: 'server_tool_use', id: 'search-1', name: 'web_search', input: { query: 'site:people.com.cn' } },
    { type: 'web_search_tool_result', tool_use_id: 'search-1', content: [{ type: 'web_search_result', url: article.url, title: article.title }] },
    { type: 'text', text: JSON.stringify({ articles: [article] }) }
  ], usage: { input_tokens: 80, output_tokens: 40 }, ...patch }
}
const deepseek = { ...config, baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', thinkingEnabled: false }
test('official DeepSeek routes to native Anthropic search and accepts evidenced JSON after narration', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/anthropic/v1/messages')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'deepseek-flash')
    assert.deepEqual(body.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }])
    assert.equal(body.thinking.type, 'disabled'); assert.equal(options.headers['x-api-key'], config.apiKey)
    assert.equal(options.headers['anthropic-version'], '2023-06-01')
    assert.equal(body.include, undefined)
    return Response.json(anthropicReply())
  }
  for (const baseUrl of ['https://api.deepseek.com', 'https://api.deepseek.com/v1', 'https://api.deepseek.com/chat/completions']) {
    const result = await generateDaily({ ...deepseek, baseUrl }, [])
    assert.deepEqual(result.articles, [article]); assert.equal(result.tokenUsage, 120)
  }
})
test('DeepSeek never treats prose citations as executed search and rejects tool errors/truncation', async () => {
  for (const kind of ['no-tool', 'tool-error', 'truncated', 'wrong-url']) {
    const data = anthropicReply()
    if (kind === 'no-tool') data.content.splice(2, 1)
    if (kind === 'tool-error') data.content[2].content = { type: 'web_search_tool_result_error', error_code: 'unavailable' }
    if (kind === 'truncated') data.stop_reason = 'max_tokens'
    if (kind === 'wrong-url') data.content[2].content[0].url = 'https://example.test/unverified'
    let calls = 0
    globalThis.fetch = async () => { calls++; return Response.json(data) }
    await assert.rejects(generateDaily(deepseek, [])); assert.equal(calls, 1)
  }
})
test('DeepSeek pause continuation preserves result blocks, configuration and cumulative usage', async () => {
  let calls = 0
  const mutable = { ...deepseek, thinkingEnabled: true, reasoningEffort: 'max' }
  globalThis.fetch = async (_, options) => {
    calls++
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'deepseek-flash'); assert.equal(body.output_config.effort, 'max')
    assert.equal(body.max_tokens, 40000)
    if (calls === 1) {
      mutable.model = 'changed'
      const data = anthropicReply({ stop_reason: 'pause_turn' }); data.content.pop()
      return Response.json(data)
    }
    assert.equal(body.messages[1].role, 'assistant')
    assert.equal(body.messages[1].content[2].type, 'web_search_tool_result')
    return Response.json(anthropicReply({ content: [{ type: 'text', text: JSON.stringify({ articles: [article] }) }] }))
  }
  assert.equal((await generateDaily(mutable, [])).tokenUsage, 240); assert.equal(calls, 2)
})
test('DeepSeek auth errors and aborted calls do not retry', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ type: 'error' }, { status: 401 }) }
  await assert.rejects(generateDaily(deepseek, []), /API Key/); assert.equal(calls, 1)
  const controller = new AbortController(); controller.abort()
  globalThis.fetch = async (_, { signal }) => { assert(signal.aborted); throw new DOMException('aborted', 'AbortError') }
  await assert.rejects(generateDaily(deepseek, [], controller.signal), /已取消/)
})
test('normalizes decorated, object and delimited words without rewriting source content', () => {
  for (const words of [[' 因地制宜 ', '“协同发展”', '不在原文'], [{ word: '因地制宜', explanation: '说明' }, { word: '协同发展' }], '因地制宜、协同发展']) {
    const [result] = validateArticles([{ ...article, words }])
    assert.deepEqual(result.words, ['因地制宜', '协同发展']); assert.equal(result.content, article.content)
  }
  assert.deepEqual(validateArticles([{ ...article, words: ['因地制宜', '因地制宜'] }])[0].words, ['因地制宜'])
  assert.throws(() => validateArticles([{ ...article, words: ['不在文中'] }]), /逐字匹配/)
  assert.throws(() => validateArticles([{ ...article, content: '短文' }]), /长度为 2 字/)
})
test('one invalid candidate does not discard a valid evidenced article', async () => {
  const data = anthropicReply()
  data.content[3].text = JSON.stringify({ articles: [{ ...article, words: ['不在原文'] }, article] })
  globalThis.fetch = async () => Response.json(data)
  const result = await generateDaily(deepseek, [])
  assert.equal(result.articles.length, 1); assert.deepEqual(result.articles[0], article)
})
test('DeepSeek repairs invalid words once with previous search evidence and counts both calls', async () => {
  let calls = 0
  globalThis.fetch = async (_, options) => {
    calls++
    const data = anthropicReply()
    if (calls === 1) data.content[3].text = JSON.stringify({ articles: [{ ...article, words: ['不在文中'] }] })
    else {
      const body = JSON.parse(options.body)
      assert(body.messages[2].content.includes('保留原文'))
      data.content = [{ type: 'text', text: JSON.stringify({ articles: [article] }) }]
    }
    return Response.json(data)
  }
  const result = await generateDaily(deepseek, [])
  assert.equal(result.tokenUsage, 240); assert.equal(calls, 2)
})
test('repeated invalid content stops after one repair with actionable error', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    const data = anthropicReply()
    data.content[3].text = JSON.stringify({ articles: [{ ...article, words: ['不在文中'] }] })
    return Response.json(data)
  }
  await assert.rejects(generateDaily(deepseek, []), /逐字匹配/)
  assert.equal(calls, 2)
})
test('three-year publication window accepts useful older material and exact boundaries', () => {
  const now = Date.parse('2026-09-13T10:00:00+08:00')
  for (const publishedAt of ['2023-09-13', '2024-02-29', '2025-01-01', '2026-09-13']) {
    assert.equal(validateArticles([{ ...article, publishedAt }], [article.url], now)[0].publishedAt, publishedAt)
  }
  for (const publishedAt of ['2023-09-12', '2026-09-14']) {
    assert.throws(() => validateArticles([{ ...article, publishedAt }], [article.url], now), /发布日期/)
  }
  const leapNow = Date.parse('2024-02-29T10:00:00+08:00')
  assert.equal(validateArticles([{ ...article, publishedAt: '2021-02-28' }], [article.url], leapNow).length, 1)
  assert.throws(() => validateArticles([{ ...article, publishedAt: '2021-02-27' }], [article.url], leapNow))
  // Previously saved issues remain importable after they age out of the generation window.
  assert.equal(validateArticles([{ ...article, publishedAt: '2020-01-01' }], undefined, now).length, 1)
})
test('daily parser handles prose wrappers, fences, split blocks, arrays and escaped braces losslessly', () => {
  const original = { ...article, content: article.content + '\n引号"和花括号{保留}以及反斜杠\\都不改变。' }
  const json = JSON.stringify({ articles: [original] })
  for (const texts of [[json], ['以下是精读素材：\n```json\n' + json + '\n```\n以上供学习。'], [json.slice(0, 47), json.slice(47)], ['搜索完成。', json], [JSON.stringify([original])]]) {
    assert.deepEqual(parseDailyOutput(texts), { articles: [original] })
  }
  for (const text of [json.slice(0, -1), '没有查到', '{"articles": [}', '{"title":"example"}']) assert.equal(parseDailyOutput([text]), null)
})
test('malformed DeepSeek output gets one format repair with retained search evidence', async () => {
  let calls = 0
  globalThis.fetch = async (_, options) => {
    calls++
    const data = anthropicReply()
    if (calls === 1) data.content[3].text = '标题：测试文段。正文：' + article.content
    else {
      const body = JSON.parse(options.body)
      assert(body.messages[2].content.includes('只修正输出格式'))
      data.content = [{ type: 'text', text: JSON.stringify({ articles: [article] }) }]
    }
    return Response.json(data)
  }
  const result = await generateDaily(deepseek, [])
  assert.deepEqual(result.articles, [article]); assert.equal(result.tokenUsage, 240); assert.equal(calls, 2)
})
test('format repair remains bounded and cannot invent a source or accept a truncated response', async () => {
  for (const mode of ['malformed', 'fake-source', 'truncated']) {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      const data = anthropicReply()
      data.content[3].text = '格式错误的正文'
      if (calls === 2 && mode === 'fake-source') data.content[3].text = JSON.stringify({ articles: [{ ...article, url: 'https://people.com.cn/not-searched.html' }] })
      if (calls === 2 && mode === 'truncated') { data.content[3].text = JSON.stringify({ articles: [article] }); data.stop_reason = 'max_tokens' }
      return Response.json(data)
    }
    await assert.rejects(generateDaily(deepseek, [])); assert.equal(calls, 2)
  }
})

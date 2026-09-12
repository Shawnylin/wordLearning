import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'

// Exercise the real TS API adapter without real credentials or provider charges.
const compiled = await build({ entryPoints: ['src/api/deepseek.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { generateIdiomContent, generateComparison, testConnection } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const config = { apiKey: 'mock-key', baseUrl: 'https://example.test/v1', model: 'custom-model' }
const idiom = { pinyin: 'huà lóng diǎn jīng', explanation: '详细释义。'.repeat(300), origin: '出处说明', example: '这句话起到了画龙点睛的作用。', usage: '常用作谓语，强调点明关键。', relatedIdioms: ['锦上添花', '恰到好处', '点石成金'] }
const compare = { meaningDiff: '甲：含义\n乙：含义', usageDiff: '甲：用法\n乙：用法', scenarios: '甲：场景\n乙：场景', confusionPoints: '甲：辨析\n乙：辨析' }
function reply(content, reason = 'stop', tokens = 100, extra = {}) {
  return { choices: [{ finish_reason: reason, message: { content, ...extra } }], usage: { total_tokens: tokens } }
}
function mock(responses, onRequest) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    const call = { url, body: JSON.parse(options.body), headers: options.headers }
    calls.push(call)
    onRequest?.(call, calls.length)
    assert(responses.length > 0, 'unexpected extra request')
    const next = responses.shift()
    return new Response(JSON.stringify(next.data ?? next), { status: next.status ?? 200 })
  }
  return calls
}

test('long complete explanation is retained verbatim with a larger initial budget', async () => {
  const calls = mock([reply(JSON.stringify(idiom))])
  assert.deepEqual(await generateIdiomContent('画龙点睛', config), { ...idiom, tokenUsage: 100 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].body.max_tokens, 4096)
  assert(!('thinking' in calls[0].body))
  assert(!('reasoning_effort' in calls[0].body))
})

test('truncation regenerates once with unchanged prompt/model and doubled budget', async () => {
  const calls = mock([reply('{"explanation":"截断', 'length', 4096), reply(JSON.stringify(idiom))])
  assert.deepEqual(await generateIdiomContent('画龙点睛', config), { ...idiom, tokenUsage: 4196 })
  assert.deepEqual(calls.map(c => c.body.max_tokens), [4096, 8192])
  assert.deepEqual(calls[0].body.messages, calls[1].body.messages)
  assert.equal(calls[0].body.model, calls[1].body.model)
})

test('reasoning-only truncation gets headroom without disabling thinking', async () => {
  const calls = mock([reply(null, 'length', 4096, { reasoning_content: 'mock reasoning' }), reply(JSON.stringify(idiom))])
  await generateIdiomContent('画龙点睛', config)
  assert.equal(calls[1].body.max_tokens, 32768)
})

test('official thinking model gets reasoning headroom before the first request', async () => {
  const calls = mock([reply(null, 'length'), reply(JSON.stringify(idiom))])
  await generateIdiomContent('画龙点睛', { ...config, baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' })
  assert.deepEqual(calls.map(c => c.body.max_tokens), [36864, 65536])
})

test('model names on other hosts do not imply official capabilities', async () => {
  const calls = mock([reply(JSON.stringify(idiom))])
  await generateIdiomContent('画龙点睛', { ...config, model: 'deepseek-flash' })
  assert.equal(calls[0].body.max_tokens, 4096)
})

test('comparison budget scales with words and accounts for both generations', async () => {
  const calls = mock([reply(JSON.stringify(compare)), reply('{', 'length', 7000), reply(JSON.stringify(compare), 'stop', 1200)])
  await generateComparison(['甲', '乙'], config)
  const result = await generateComparison(['甲', '乙', '丙', '丁', '戊'], config)
  assert.deepEqual(calls.map(c => c.body.max_tokens), [4096, 7168, 14336])
  assert.equal(result.tokenUsage, 8200)
  assert.equal(result.confusionPoints, compare.confusionPoints)
})

test('repeated truncation stops after two generations, even with syntactically valid JSON', async () => {
  const calls = mock([reply(JSON.stringify(idiom), 'length'), reply(JSON.stringify(idiom), 'length')])
  await assert.rejects(generateIdiomContent('画龙点睛', config), /未保存不完整内容/)
  assert.equal(calls.length, 2)
})

test('explicit budget rejection falls back once to the provider default', async () => {
  const calls = mock([{ status: 400, data: { error: { message: 'max_tokens must be at most 2048' } } }, reply(JSON.stringify(idiom))])
  await generateIdiomContent('画龙点睛', config)
  assert(!('max_tokens' in calls[1].body))
})

test('expanded-budget rejection stays bounded and does not accept truncated fallback', async () => {
  const calls = mock([reply('{', 'length'), { status: 422, data: { error: { message: 'max_tokens must be between 1 and 4096' } } }, reply('{', 'length')])
  await assert.rejects(generateIdiomContent('画龙点睛', config), /未保存不完整内容/)
  assert.equal(calls.length, 3)
})

test('auth, rate limits, context overflow, and unrelated 400 errors are not retried', async () => {
  for (const [status, message] of [[401, 'invalid mock-key'], [429, 'rate limit'], [400, 'max_tokens exceeds maximum context length'], [400, 'invalid model']]) {
    const calls = mock([{ status, data: { error: { message } } }])
    await assert.rejects(generateIdiomContent('画龙点睛', config), error => error.message.includes(`HTTP ${status}`) && !error.message.includes(config.apiKey))
    assert.equal(calls.length, 1)
  }
})

test('malformed or incomplete data cannot become learning content', async () => {
  for (const content of ['{', 'null', JSON.stringify({ ...idiom, usage: ' ' }), JSON.stringify({ ...idiom, relatedIdioms: ['完整', 123] })]) {
    const calls = mock([reply(content)])
    await assert.rejects(generateIdiomContent('画龙点睛', config), /格式错误|数据不完整/)
    assert.equal(calls.length, 1)
  }
  mock([reply('null')])
  await assert.rejects(generateComparison(['甲', '乙'], config), /数据不完整/)
})

test('non-length interruptions and empty answers are not retried', async () => {
  for (const reason of ['content_filter', 'aborted', 'insufficient_system_resource', 'stop']) {
    const calls = mock([reply('', reason)])
    await assert.rejects(generateIdiomContent('画龙点睛', config), /未完成正常输出|内容为空/)
    assert.equal(calls.length, 1)
  }
})

test('retry uses the original configuration even if settings change', async () => {
  const mutable = { ...config }
  const calls = mock([reply('{', 'length'), reply(JSON.stringify(idiom))], (_, n) => {
    if (n === 1) Object.assign(mutable, { apiKey: 'changed', baseUrl: 'https://changed.test', model: 'changed' })
  })
  await generateIdiomContent('画龙点睛', mutable)
  assert.equal(calls[1].url, calls[0].url)
  assert.equal(calls[1].body.model, config.model)
  assert.equal(calls[1].headers.Authorization, 'Bearer mock-key')
})

test('connection test remains a single small request', async () => {
  const calls = mock([reply('OK')])
  assert.match(await testConnection(config), /连接成功/)
  assert.equal(calls[0].body.max_tokens, 128)
  assert.equal(calls.length, 1)
})

test('streaming generation emits progressive drafts and thinking controls', async () => {
  let requestBody
  const json = JSON.stringify(idiom)
  const pieces = [json.slice(0, 80), json.slice(80, 260), json.slice(260)]
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body)
    const events = pieces.map((content, index) => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: index === 2 ? 'stop' : null }], usage: index === 2 ? { total_tokens: 321 } : null })}\n\n`).join('') + 'data: [DONE]\n\n'
    return new Response(events, { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const drafts = []
  const result = await generateIdiomContent('画龙点睛', { ...config, thinkingEnabled: true, reasoningEffort: 'max' }, draft => drafts.push(draft))
  assert(drafts.length >= 3)
  assert.equal(result.tokenUsage, 321)
  assert.deepEqual(requestBody.thinking, { type: 'enabled' })
  assert.equal(requestBody.reasoning_effort, 'max')
  assert.equal(requestBody.stream, true)
  assert.equal(requestBody.stream_options.include_usage, true)
})

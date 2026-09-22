import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/api/providers.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
})
const providers = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

test('official DeepSeek capabilities preserve native search and reasoning rules', () => {
  for (const baseUrl of ['https://api.deepseek.com', 'https://api.deepseek.com/v1', 'https://api.deepseek.com/chat/completions']) {
    const capability = providers.providerCapabilities({ baseUrl, model: 'deepseek-flash' })
    assert.equal(capability.provider, 'deepseek')
    assert.equal(capability.supportsWebSearch, true)
    assert.equal(capability.webSearchProtocol, 'deepseek-anthropic')
    assert.equal(capability.supportsSpeech, false)
    assert.equal(capability.completionTokenParameter, 'max_tokens')
    assert.equal(capability.reasoning.supportsThinkingParameter, true)
    assert.equal(capability.reasoning.supportsReasoningEffort, true)
    assert.equal(capability.reasoning.forceDisabledForPdf, true)
    assert.equal(capability.reasoning.forceDisabledForDailyLink, true)
    assert.equal(capability.reasoning.usesExpandedTokenBudget, true)
    assert.equal(capability.supportsBalanceQuery, true)
    assert.equal(capability.balanceEndpointOmitsV1, true)
  }
  assert.equal(providers.providerCapabilities({ baseUrl: 'https://api.deepseek.com', model: 'custom-model' }).reasoning.usesExpandedTokenBudget, false)
})

test('official MiMo capabilities preserve completion, speech, PDF and balance behavior', () => {
  const capability = providers.providerCapabilities({ baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-tts' })
  assert.equal(capability.provider, 'mimo')
  assert.equal(capability.supportsWebSearch, true)
  assert.equal(capability.webSearchProtocol, 'openai-responses')
  assert.equal(capability.supportsSpeech, true)
  assert.equal(capability.completionTokenParameter, 'max_completion_tokens')
  assert.equal(capability.reasoning.forceDisabledForPdf, true)
  assert.equal(capability.reasoning.forceDisabledForDailyLink, false)
  assert.equal(capability.reasoning.usesExpandedTokenBudget, false)
  assert.equal(capability.supportsBalanceQuery, false)
  assert.equal(capability.balanceEndpointOmitsV1, false)
})

test('legacy MiMo heuristics remain contextual without changing request parameters', () => {
  const subdomain = providers.providerCapabilities({ baseUrl: 'https://proxy.xiaomimimo.com/v1', model: 'custom' })
  assert.equal(subdomain.provider, 'mimo')
  assert.equal(subdomain.supportsSpeech, true)
  assert.equal(subdomain.completionTokenParameter, 'max_tokens')
  assert.equal(subdomain.supportsBalanceQuery, false)

  const named = providers.providerCapabilities({ baseUrl: 'https://api.example.com/v1', model: 'mimo-compatible', name: 'Private MiMo' })
  assert.equal(named.provider, 'openai-compatible')
  assert.equal(named.supportsSpeech, true)
  assert.equal(named.completionTokenParameter, 'max_tokens')
  assert.equal(named.supportsBalanceQuery, true)
})

test('OpenAI-compatible fallback preserves generic request behavior', () => {
  const capability = providers.providerCapabilities({ baseUrl: 'https://api.example.com/v1', model: 'gpt-compatible' })
  assert.equal(capability.provider, 'openai-compatible')
  assert.equal(capability.supportsWebSearch, true)
  assert.equal(capability.webSearchProtocol, 'openai-responses')
  assert.equal(capability.supportsSpeech, false)
  assert.equal(capability.completionTokenParameter, 'max_tokens')
  assert.equal(capability.reasoning.forceDisabledForPdf, false)
  assert.equal(capability.reasoning.forceDisabledForDailyLink, false)
  assert.equal(capability.supportsBalanceQuery, true)
  assert.deepEqual(providers.completionTokenLimit(capability, 4096), { max_tokens: 4096 })
})

test('completion token helper emits exactly one provider-specific key', () => {
  const mimo = providers.providerCapabilities({ baseUrl: 'https://api.xiaomimimo.com/v1' })
  assert.deepEqual(providers.completionTokenLimit(mimo, 128), { max_completion_tokens: 128 })
  assert.deepEqual(providers.completionTokenLimit(mimo), {})
})

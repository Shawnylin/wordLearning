export type ProviderType = 'deepseek' | 'mimo' | 'openai-compatible'
export type WebSearchProtocol = 'deepseek-anthropic' | 'openai-responses'
export type CompletionTokenParameter = 'max_tokens' | 'max_completion_tokens'

export interface ProviderDescriptor {
  baseUrl: string
  model?: string
  name?: string
}

export interface ProviderCapabilities {
  provider: ProviderType
  supportsWebSearch: boolean
  webSearchProtocol: WebSearchProtocol
  supportsSpeech: boolean
  completionTokenParameter: CompletionTokenParameter
  reasoning: {
    supportsThinkingParameter: boolean
    supportsReasoningEffort: boolean
    forceDisabledForPdf: boolean
    forceDisabledForDailyLink: boolean
    usesExpandedTokenBudget: boolean
  }
  supportsBalanceQuery: boolean
  balanceEndpointOmitsV1: boolean
}

const DEEPSEEK_HOST = 'api.deepseek.com'
const MIMO_HOST = 'api.xiaomimimo.com'
const DEEPSEEK_REASONING_MODELS = /^(deepseek-flash|deepseek-v4-(?:flash|pro)(?:-\d+)?|deepseek-reasoner)$/

function hostname(baseUrl: string): string {
  try { return new URL(baseUrl.trim()).hostname.toLowerCase() } catch { return '' }
}

export function providerCapabilities(descriptor: ProviderDescriptor): ProviderCapabilities {
  const host = hostname(descriptor.baseUrl)
  const officialDeepSeek = host === DEEPSEEK_HOST
  const officialMimoEndpoint = host === MIMO_HOST
  const mimoHost = officialMimoEndpoint || host.endsWith('.xiaomimimo.com')
  const supportsSpeech = /xiaomimimo\.com|mimo/i.test(descriptor.baseUrl)
    || /mimo/i.test(`${descriptor.name || ''} ${descriptor.model || ''}`)

  return {
    provider: officialDeepSeek ? 'deepseek' : mimoHost ? 'mimo' : 'openai-compatible',
    supportsWebSearch: true,
    webSearchProtocol: officialDeepSeek ? 'deepseek-anthropic' : 'openai-responses',
    supportsSpeech,
    completionTokenParameter: officialMimoEndpoint ? 'max_completion_tokens' : 'max_tokens',
    reasoning: {
      supportsThinkingParameter: true,
      supportsReasoningEffort: true,
      forceDisabledForPdf: officialDeepSeek || officialMimoEndpoint,
      forceDisabledForDailyLink: officialDeepSeek,
      usesExpandedTokenBudget: officialDeepSeek && DEEPSEEK_REASONING_MODELS.test(descriptor.model?.trim() || '')
    },
    supportsBalanceQuery: !mimoHost,
    balanceEndpointOmitsV1: officialDeepSeek
  }
}

export function completionTokenLimit(capabilities: ProviderCapabilities, value?: number): Record<string, number> {
  return value === undefined ? {} : { [capabilities.completionTokenParameter]: value }
}

export interface SpeechConfig {
  apiKey: string
  baseUrl: string
  model: string
  voice: string
}

export const defaultSpeechConfig: SpeechConfig = {
  apiKey: '', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-tts', voice: 'mimo_default'
}

export function speechEndpoint(config: SpeechConfig) {
  if (!config.apiKey.trim()) throw new Error('请先在设置中填写 MiMo API Key')
  if (!config.model.trim() || !config.voice.trim()) throw new Error('请填写朗读模型和音色')
  let url: URL
  try { url = new URL(config.baseUrl.trim()) } catch { throw new Error('请填写有效的 API 地址') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('API 地址须使用 HTTPS，且不能包含账号、参数或片段')
  return url.href.replace(/\/+$/, '') + '/chat/completions'
}

// 保留原文顺序，优先在句末切分，限制单次合成长度。
export function speechChunks(text: string): string[] {
  const chars = Array.from(text.trim())
  const chunks: string[] = []
  while (chars.length) {
    let end = Math.min(chars.length, 350)
    if (end < chars.length) {
      for (let i = end - 1; i >= 100; i--) {
        if (/[。！？；\n.!?;]/.test(chars[i]!)) { end = i + 1; break }
      }
    }
    const chunk = chars.splice(0, end).join('')
    if (chunk.trim()) chunks.push(chunk)
  }
  return chunks
}

export async function synthesizeSpeech(text: string, config: SpeechConfig, signal: AbortSignal): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) controller.abort()
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 90000)
  try {
    const response = await fetch(speechEndpoint(config), {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim(), messages: [
        { role: 'user', content: '请使用清晰自然的普通话，语速适中，准确朗读原文。' },
        { role: 'assistant', content: text }
      ], audio: { format: 'wav', voice: config.voice.trim() }, stream: false })
    })
    if (!response.ok) {
      const hints: Record<number, string> = { 401: 'API Key 无效，请检查朗读设置', 402: '朗读额度不足，请检查 MiMo 账户', 403: '没有语音模型权限', 404: '接口或模型不存在，请检查朗读设置', 429: '请求频繁或额度不足，请稍后重试' }
      throw new Error(hints[response.status] || `朗读请求失败（${response.status}），请稍后重试`)
    }
    const data = await response.json()
    const encoded = data?.choices?.[0]?.message?.audio?.data
    if (typeof encoded !== 'string' || !encoded) throw new Error('接口未返回音频，请检查模型是否支持 MiMo 语音合成')
    const binary = atob(encoded)
    return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer
  } catch (error) {
    if (timedOut) throw new Error('语音生成超时，请重试')
    if (error instanceof TypeError) throw new Error('无法连接语音接口，请检查网络、API 地址及服务商跨域设置')
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

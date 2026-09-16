import { ref } from 'vue'
import { speechChunks, speechEndpoint, synthesizeSpeech, type SpeechConfig } from '../api/speech'

const owner = ref<symbol | null>(null)
const phase = ref<'idle' | 'loading' | 'playing'>('idle')
let controller: AbortController | undefined
let context: AudioContext | undefined

function stop(id?: symbol) {
  if (id && owner.value !== id) return
  controller?.abort()
  controller = undefined
  const previous = context
  context = undefined
  if (previous && previous.state !== 'closed') void previous.close().catch(() => {})
  owner.value = null
  phase.value = 'idle'
}

async function play(id: symbol, text: string, config: SpeechConfig) {
  stop()
  speechEndpoint(config)
  const chunks = speechChunks(text)
  if (!chunks.length) throw new Error('暂无可朗读的文字')
  const audio = new AudioContext()
  context = audio
  const request = new AbortController()
  controller = request
  owner.value = id
  phase.value = 'loading'
  try {
    // 在点击事件内解锁音频，兼容移动端的自动播放限制。
    await audio.resume()
    for (const chunk of chunks) {
      if (request.signal.aborted) return
      phase.value = 'loading'
      const bytes = await synthesizeSpeech(chunk, config, request.signal)
      if (request.signal.aborted) return
      const buffer = await audio.decodeAudioData(bytes)
      if (request.signal.aborted) return
      phase.value = 'playing'
      await new Promise<void>((resolve, reject) => {
        const source = audio.createBufferSource()
        source.buffer = buffer
        source.connect(audio.destination)
        const finish = () => { request.signal.removeEventListener('abort', cancel); source.disconnect(); resolve() }
        const cancel = () => { source.stop(); finish() }
        source.onended = finish
        request.signal.addEventListener('abort', cancel, { once: true })
        try { source.start() } catch (error) { reject(error); finish() }
      })
    }
  } catch (error) {
    if (!request.signal.aborted) throw error
  } finally {
    if (owner.value === id) stop(id)
  }
}

export function useSpeech() { return { owner, phase, play, stop } }

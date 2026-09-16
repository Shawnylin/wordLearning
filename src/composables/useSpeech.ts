import { ref } from 'vue'
import { speechChunks, speechEndpoint, synthesizeSpeech, type SpeechConfig } from '../api/speech'

const owner = ref<symbol | null>(null)
const phase = ref<'idle' | 'loading' | 'playing'>('idle')
const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA'
let controller: AbortController | undefined
let media: HTMLAudioElement | undefined
let mediaUrl = ''

function stop(id?: symbol) {
  if (id && owner.value !== id) return
  controller?.abort()
  controller = undefined
  media?.pause()
  media = undefined
  if (mediaUrl) URL.revokeObjectURL(mediaUrl)
  mediaUrl = ''
  owner.value = null
  phase.value = 'idle'
}

async function play(id: symbol, text: string, config: SpeechConfig) {
  stop()
  speechEndpoint(config)
  const chunks = speechChunks(text)
  if (!chunks.length) throw new Error('暂无可朗读的文字')
   const request = new AbortController()
  controller = request
  owner.value = id
  phase.value = 'loading'
  // 先在用户点击的同步阶段激活系统媒体通道，避免异步生成后被 iOS 拦截。
  const audio = new Audio(silentWav)
  media = audio
  audio.preload = 'auto'
  audio.muted = false
  audio.volume = 1
  audio.setAttribute('playsinline', '')
  void audio.play().catch(() => {})
  try {
    let pending = synthesizeSpeech(chunks[0]!, config, request.signal)
    for (let index = 0; index < chunks.length; index++) {
      if (request.signal.aborted) return
      phase.value = 'loading'
      const bytes = await pending
      if (request.signal.aborted) return
      if (chunks[index + 1]) pending = synthesizeSpeech(chunks[index + 1]!, config, request.signal)
      mediaUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      audio.src = mediaUrl
      audio.load()
      phase.value = 'playing'
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { request.signal.removeEventListener('abort', cancel); audio.onended = null; audio.onerror = null }
        const cancel = () => { audio.pause(); cleanup(); resolve() }
        audio.onended = () => { cleanup(); resolve() }
        audio.onerror = () => { cleanup(); reject(new Error('音频播放失败，请检查设备音量和浏览器媒体权限')) }
        request.signal.addEventListener('abort', cancel, { once: true })
        void audio.play().catch(error => { cleanup(); reject(error) })
      })
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
      mediaUrl = ''
    }
  } catch (error) {
    if (!request.signal.aborted) throw error
  } finally {
    if (owner.value === id) stop(id)
  }
}

export function useSpeech() { return { owner, phase, play, stop } }

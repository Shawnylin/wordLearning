const domains = ['people.com.cn', 'gmw.cn', 'banyuetan.org']
export function readerUrl(input) {
  const url = new URL(input)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)) || url.pathname === '/') throw new Error('读取接口仅支持人民网、光明网和半月谈的文章链接')
  url.hash = ''
  return url.href
}
export async function readPublicArticle(input, fetcher = fetch) {
  let url = readerUrl(input)
  const signal = AbortSignal.timeout(15000)
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetcher(url, { signal, redirect: 'manual', headers: { Accept: 'text/html', 'User-Agent': 'WordLearning-ArticleReader/1.0' } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('文章重定向缺少目标地址')
      url = readerUrl(new URL(location, url).href)
      continue
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`原站读取失败（HTTP ${response.status}）`) }
    if (!response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); throw new Error('文章地址没有返回 HTML 网页') }
    if (!response.body) throw new Error('文章正文为空')
    const reader = response.body.getReader(), chunks = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 2 * 1024 * 1024) throw new Error('网页超过读取大小限制')
        chunks.push(value)
      }
    } finally { await reader.cancel().catch(() => {}) }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const charset = response.headers.get('content-type').match(/charset=["']?([\w-]+)/i)?.[1] || 'utf-8'
    return { url, html: new TextDecoder(charset).decode(bytes) }
  }
  throw new Error('文章重定向次数过多')
}
const cache = new Map()
let active = 0
export function articleReaderMiddleware(req, res, next) {
  const request = new URL(req.url || '/', 'http://localhost')
  if (!['/api/article-reader', '/wordLearning/api/article-reader'].includes(request.pathname)) return next()
  if (process.env.ARTICLE_READER_ORIGIN && req.headers.origin === process.env.ARTICLE_READER_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ARTICLE_READER_ORIGIN)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: '仅支持 GET' })); return }
  let url
  try { url = readerUrl(request.searchParams.get('url') || '') }
  catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); return }
  const saved = cache.get(url)
  if (saved && saved.expires > Date.now()) { res.end(JSON.stringify(saved.value)); return }
  if (active >= 4) { res.statusCode = 429; res.end(JSON.stringify({ error: '网页读取繁忙，请稍后重试' })); return }
  active++
  readPublicArticle(url).then(value => {
    if (cache.size >= 50) cache.delete(cache.keys().next().value)
    cache.set(url, { value, expires: Date.now() + 600000 })
    res.end(JSON.stringify(value))
  }).catch(error => {
    res.statusCode = 502
    res.end(JSON.stringify({ error: error.name === 'TimeoutError' ? '原站读取超时，请稍后重试' : error.message }))
  }).finally(() => { active-- })
}

const allowedOrigin = 'https://shawnylin.github.io'

function articleUrl(input) {
  const url = new URL(input)
  const publicHostname = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname) && !/\.(local|localhost|internal|test|invalid)$/i.test(url.hostname)
  if (!publicHostname || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.pathname === '/') throw new Error('请输入可公开访问的文章网址')
  url.hash = ''
  return url.href
}

function headers(origin) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    ...(origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {})
  }
}

function json(body, status, origin) { return new Response(JSON.stringify(body), { status, headers: headers(origin) }) }

async function fetchArticle(input) {
  let url = articleUrl(input)
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(url, { redirect: 'manual', headers: { Accept: 'text/html', 'User-Agent': 'WordLearning-ArticleReader/1.0' }, cf: { cacheEverything: true, cacheTtl: 600 } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('文章重定向缺少目标地址')
      url = articleUrl(new URL(location, url).href)
      continue
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`原站读取失败（HTTP ${response.status}）`) }
    if (!response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); throw new Error('文章地址没有返回 HTML 网页') }
    const length = Number(response.headers.get('content-length') || 0)
    if (length > 2 * 1024 * 1024) { await response.body?.cancel(); throw new Error('网页超过读取大小限制') }
    const html = await response.text()
    if (new TextEncoder().encode(html).byteLength > 2 * 1024 * 1024) throw new Error('网页超过读取大小限制')
    return { url, html }
  }
  throw new Error('文章重定向次数过多')
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get('Origin') || ''
    if (origin && origin !== allowedOrigin) return json({ error: '不允许的网页来源' }, 403, origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) })
    if (request.method !== 'GET' || requestUrl.pathname !== '/api/article-reader') return json({ error: 'Not found' }, 404, origin)
    try { return json(await fetchArticle(requestUrl.searchParams.get('url') || ''), 200, origin) }
    catch (error) { return json({ error: error instanceof Error ? error.message : '网页读取失败' }, 502, origin) }
  }
}

export { articleUrl, fetchArticle }

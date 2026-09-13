import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { articleReaderMiddleware } from './article-reader.mjs'
const root = resolve('dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
createServer((req, res) => articleReaderMiddleware(req, res, async () => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (pathname === '/') { res.writeHead(302, { Location: '/wordLearning/' }); res.end(); return }
    const relative = pathname.replace(/^\/wordLearning\//, '')
    const file = resolve(root, relative === '' ? 'index.html' : relative)
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
    const body = await readFile(file)
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
    res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
})).listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log('WordLearning: http://127.0.0.1:' + (process.env.PORT || 4173) + '/wordLearning/'))

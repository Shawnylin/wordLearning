import { createServer } from 'vite'
import { readdir } from 'node:fs/promises'
const suites = {
  smoke: ['network-isolation', 'settings-sync-ui', 'api-vault-browser', 'provider-smoke', 'daily-smoke', 'output-budget-browser', 'morph-overlay-browser'],
  legacy: ['browser', 'motion', 'settings-browser', 'daily-polish', 'compare-layout', 'generation-center', 'theme-transitions'],
}
const args = process.argv.slice(2)
const suite = args[0] || 'smoke'
const files = (await readdir(new URL('./', import.meta.url))).filter(file => file.endsWith('.mjs'))
const selected = suites[suite] || (files.includes(`${suite}.mjs`) && !suite.startsWith('run-') && !suite.endsWith('.test') ? [suite] : null)
if (!selected) throw new Error(`Unknown browser suite: ${suite}`)
const server = await createServer({ mode: 'test', envFile: false, server: { host: '127.0.0.1', port: 5173, strictPort: false, open: false },
  define: {
    'import.meta.env.VITE_CLOUDBASE_ENV_ID': JSON.stringify('test-only-env'),
    'import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY': JSON.stringify('test-only-publishable-key'),
    'import.meta.env.VITE_ARTICLE_READER_URL': JSON.stringify(''),
  },
})
const results = []
let closeBrowsers = async () => {}
let saveFailureArtifacts = async () => {}
const interrupt = async () => { await closeBrowsers(); await server.close(); process.exit(130) }
process.once('SIGINT', interrupt)
process.once('SIGTERM', interrupt)
try {
  await server.listen()
  const address = server.httpServer.address()
  process.env.TEST_BASE_URL = `http://127.0.0.1:${address.port}/wordLearning/`
  ;({ closeBrowsers, saveFailureArtifacts } = await import('./helpers/browser.mjs'))
  // Visual scripts retain their before/after CLI argument.
  if (suite === 'css-visual') process.argv[2] = args[1]
  for (const file of selected) {
    if (file === 'daily-polish' && !process.env.TEST_PDF_PATH) {
      results.push({ file, passed: true, skipped: true, reason: 'TEST_PDF_PATH not set', ms: 0 })
      continue
    }
    const start = Date.now()
    const timeout = setTimeout(async () => {
      console.error(`${file}: exceeded 90 seconds`)
      await closeBrowsers()
      await server.close()
      process.exit(1)
    }, 90000)
    try {
      await import(`./${file}.mjs`)
      results.push({ file, passed: true, ms: Date.now() - start })
    } catch (error) {
      await saveFailureArtifacts(file)
      console.error(`${file}: ${error.stack || error}`)
      results.push({ file, passed: false, ms: Date.now() - start })
      process.exitCode = 1
    } finally { clearTimeout(timeout); await closeBrowsers() }
  }
} finally { await closeBrowsers(); await server.close() }
console.log(JSON.stringify({ suite, results }, null, 2))

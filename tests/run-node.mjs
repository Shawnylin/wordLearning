import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const suite = process.argv[2] || 'all'
if (!['all', 'unit', 'structure'].includes(suite)) throw new Error(`Unknown suite: ${suite}`)
const isStructure = file => file === 'app-update.test.mjs' || file.endsWith('.structure.test.mjs')
const files = readdirSync(new URL('./', import.meta.url)).filter(file => file.endsWith('.test.mjs'))
  .filter(file => suite === 'all' || (suite === 'structure' ? isStructure(file) : !isStructure(file))).sort()
if (!files.length) throw new Error(`No tests found for ${suite}`)
const result = spawnSync(process.execPath, ['--import', './tests/helpers/no-network.mjs', '--test', ...files.map(file => `tests/${file}`)], { cwd: root, stdio: 'inherit', timeout: 180000 })
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1

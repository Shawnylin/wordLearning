import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

// App-only releases change these two version fields without changing installed
// dependencies. Retain every other field, including scripts and integrity hashes.
export function dependencyCacheKey(packageText, lockText, npmConfig = '') {
  const manifest = JSON.parse(packageText)
  const lock = JSON.parse(lockText)
  delete manifest.version
  delete lock.version
  if (lock.packages?.['']) delete lock.packages[''].version
  return createHash('sha256')
    .update(JSON.stringify({ manifest, lock, npmConfig }))
    .digest('hex')
}

const key = dependencyCacheKey(
  readFileSync('package.json', 'utf8'),
  readFileSync('package-lock.json', 'utf8'),
  existsSync('.npmrc') ? readFileSync('.npmrc', 'utf8') : ''
)
console.log(`key=${key}`)

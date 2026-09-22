import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'

const values = new Map()
globalThis.localStorage = {
  getItem: key => values.get(String(key)) ?? null,
  setItem: (key, value) => values.set(String(key), String(value)),
  removeItem: key => values.delete(String(key)),
  clear: () => values.clear(),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size },
}
globalThis.window = {
  dispatchEvent: () => true,
  setTimeout,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
}
globalThis.document = {
  documentElement: {
    classList: { add() {}, remove() {} },
    dataset: {},
  },
}

const file = new URL('./.local-backup-test.tmp.mjs', import.meta.url)
const compiled = await build({
  stdin: {
    contents: `
      export { useIdiomStore } from './src/stores/idiom'
      export { useReviewStore } from './src/stores/review'
      export { useDailyStore } from './src/stores/daily'
      export { useSettingsStore } from './src/stores/settings'
      export { useThemeStore } from './src/stores/theme'
      export * from './src/services/localBackup'
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  external: ['pinia', 'vue'],
})
await writeFile(file, compiled.outputFiles[0].text)
const mod = await import(file.href)
const {
  LOCAL_BACKUP_LIMIT,
  LOCAL_BACKUP_STORAGE_KEY,
  createLocalBackup,
  prepareLocalBackup,
  readLocalBackups,
  restorePreparedLocalBackup,
  serializeLocalBackup,
  useDailyStore,
  useIdiomStore,
  useReviewStore,
  useSettingsStore,
  useThemeStore,
} = mod

after(async () => unlink(file))
beforeEach(() => {
  values.clear()
  setActivePinia(createPinia())
})

const idiom = (word, createdAt = 100) => ({
  id: `idiom-${word}`,
  word,
  pinyin: 'cè shì',
  explanation: `${word}完整释义`,
  origin: '测试出处',
  example: `${word}测试例句`,
  usage: '测试用法',
  relatedIdioms: ['相关一'],
  tokenUsage: 12,
  createdAt,
})

const article = (origin = 'link') => ({
  title: origin === 'pdf' ? 'PDF 原文' : '链接原文',
  shortTitle: origin === 'pdf' ? 'PDF原文' : '链接原文',
  source: origin === 'pdf' ? '导入 PDF' : '示例媒体',
  url: origin === 'pdf' ? '' : 'https://news.example.com/a',
  publishedAt: origin === 'pdf' ? '' : '2026-09-22',
  content: '因地制宜推进高质量发展，守正创新久久为功。',
  words: ['因地制宜', '守正创新'],
  analysis: '测试学习提示',
  origin,
  ...(origin === 'pdf' ? { page: 1 } : {}),
  starred: true,
  completedAt: 1_790_000_000_000,
})

function seedRichData() {
  const idioms = useIdiomStore()
  const review = useReviewStore()
  const daily = useDailyStore()
  const settings = useSettingsStore()
  const theme = useThemeStore()

  idioms.idiomCache = {
    因地制宜: idiom('因地制宜', 100),
    守正创新: idiom('守正创新', 200),
  }
  idioms.searchHistory = [
    { id: 's1', word: '因地制宜', timestamp: 300 },
    { id: 's2', word: '守正创新', timestamp: 400 },
  ]
  idioms.favorites = ['守正创新']
  idioms.queryCounts = { 因地制宜: 3, 守正创新: 2 }
  idioms.tokenStats = { totalTokens: 456, requestCount: 7 }

  review.wordStats = {
    因地制宜: {
      state: 'mastered', nextReviewAt: 9_999_999, interval: 30,
      correctCount: 8, wrongCount: 2, lastReviewedAt: 8_888_888,
    },
    守正创新: {
      state: 'review', nextReviewAt: 7_777_777, interval: 6,
      correctCount: 3, wrongCount: 1, lastReviewedAt: 6_666_666,
    },
  }
  review.reviewedToday = ['因地制宜']
  review.reviewedDay = '2026-09-23'

  daily.issues = [{
    id: 'daily-link',
    createdAt: 500,
    tokenUsage: 33,
    groupId: 'g1',
    articles: [article('link')],
  }, {
    id: 'daily-pdf',
    createdAt: 600,
    tokenUsage: 44,
    groupId: 'g2',
    articles: [article('pdf')],
    pdf: {
      fingerprint: 'a'.repeat(64), filename: 'rmrb.pdf', pages: 1,
      remainder: '版面剩余文字', model: 'existing-pdf-model',
      usageEstimated: false, articleIndex: 0, articleCount: 1,
    },
  }]
  daily.groups = [
    { id: 'g1', name: '链接文章', collapsed: false, createdAt: 500 },
    { id: 'g2', name: 'PDF文章', collapsed: true, createdAt: 600 },
  ]
  daily.selectedId = 'daily-pdf'

  settings.reviewTarget = 17
  settings.apiKey = 'test-only-secret-api-key'
  settings.profiles = [{
    id: 'secret-provider', name: 'Secret Provider', apiKey: 'test-only-secret-api-key',
    baseUrl: 'https://secret.example/v1', model: 'unchanged-model', models: ['unchanged-model'],
  }]
  settings.pdfConfig = { ...settings.pdfConfig, apiKey: 'pdf-secret-key' }
  settings.speechConfig = { ...settings.speechConfig, apiKey: 'speech-secret-key' }

  theme.theme = 'dark'
  theme.followSystem = false
  theme.themeColor = 'bamboo'

  localStorage.setItem('word-learning-profile-name', '备份用户')
  localStorage.setItem('word-learning-profile-name-updated-at', '700')
  localStorage.setItem('word-learning-api-vault-passphrase-test-only', 'never-export-this-passphrase')
}

test('creates a complete safe backup, summarizes it, excludes credentials, and keeps only the latest three points', () => {
  seedRichData()
  const first = createLocalBackup(1_000)

  assert.equal(first.summary.words, 2)
  assert.equal(first.summary.searches, 2)
  assert.equal(first.summary.favorites, 1)
  assert.equal(first.summary.reviewWords, 2)
  assert.equal(first.summary.masteredReviewWords, 1)
  assert.equal(first.summary.dailyIssues, 2)
  assert.equal(first.summary.dailyArticles, 2)
  assert.equal(first.summary.dailyStarredArticles, 2)
  assert.equal(first.summary.dailyCompletedArticles, 2)

  const text = serializeLocalBackup(first.document)
  assert(!text.includes('test-only-secret-api-key'))
  assert(!text.includes('pdf-secret-key'))
  assert(!text.includes('speech-secret-key'))
  assert(!text.includes('never-export-this-passphrase'))
  assert(!text.includes('"apiSettings"'))
  assert(!text.includes('"apiKey"'))
  assert.equal(first.document.preferences.reviewTarget, 17)
  assert.equal(first.document.preferences.appearance.theme, 'dark')
  assert.equal(first.document.preferences.appearance.themeColor, 'bamboo')

  createLocalBackup(2_000)
  createLocalBackup(3_000)
  createLocalBackup(4_000)
  const backups = readLocalBackups()
  assert.equal(backups.length, LOCAL_BACKUP_LIMIT)
  assert.deepEqual(backups.map(item => item.document.createdAt), [4_000, 3_000, 2_000])
  assert(JSON.parse(localStorage.getItem(LOCAL_BACKUP_STORAGE_KEY)).length === 3)
})

test('normal restore preserves learning, favorites, review mastery/schedule, Daily/PDF content, and non-sensitive preferences', async () => {
  seedRichData()
  const backup = createLocalBackup(10_000)
  const expected = structuredClone(backup.document)

  const idioms = useIdiomStore(), review = useReviewStore(), daily = useDailyStore()
  const settings = useSettingsStore(), theme = useThemeStore()
  idioms.idiomCache = { 临时词: idiom('临时词', 999) }
  idioms.searchHistory = []
  idioms.favorites = []
  idioms.queryCounts = {}
  review.wordStats = {}
  daily.issues = []
  daily.groups = []
  daily.selectedId = ''
  settings.reviewTarget = 1
  theme.theme = 'light'
  theme.followSystem = true
  theme.themeColor = 'cinnabar'

  await restorePreparedLocalBackup(backup)

  assert.deepEqual(idioms.exportSyncData(), expected.payload.idiom)
  assert.equal(review.wordStats['因地制宜'].state, 'mastered')
  assert.equal(review.wordStats['因地制宜'].nextReviewAt, 9_999_999)
  assert.equal(review.wordStats['因地制宜'].correctCount, 8)
  assert.equal(review.wordStats['因地制宜'].wrongCount, 2)
  assert.deepEqual(daily.exportSyncData(), expected.payload.daily)
  assert.equal(daily.issues[0].articles[0].content, expected.payload.daily.issues[0].articles[0].content)
  assert.equal(daily.issues[0].articles[0].starred, true)
  assert.equal(daily.issues[0].articles[0].completedAt, 1_790_000_000_000)
  assert.equal(daily.issues[1].pdf.model, 'existing-pdf-model')
  assert.deepEqual(idioms.favorites, ['守正创新'])
  assert.equal(settings.reviewTarget, 17)
  assert.equal(theme.theme, 'dark')
  assert.equal(theme.followSystem, false)
  assert.equal(theme.themeColor, 'bamboo')

  const once = JSON.stringify({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
  })
  await restorePreparedLocalBackup(backup)
  assert.equal(JSON.stringify({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
  }), once)
})

test('malformed or sensitive backups are rejected before any local data is changed', async () => {
  seedRichData()
  const idioms = useIdiomStore(), review = useReviewStore(), daily = useDailyStore()
  const before = JSON.stringify({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
  })

  assert.throws(() => prepareLocalBackup({ kind: 'word-learning-backup', version: 1, createdAt: 1, payload: {} }), /格式/)
  assert.throws(() => prepareLocalBackup({
    kind: 'word-learning-backup', version: 1, createdAt: 1,
    apiKey: 'secret', payload: {},
  }), /敏感/)
  assert.throws(() => prepareLocalBackup({
    kind: 'word-learning-backup', version: 1, createdAt: 1,
    payload: { apiSettings: { ciphertext: 'secret' } },
  }), /敏感/)
  assert.throws(() => prepareLocalBackup({
    kind: 'word-learning-backup', version: 1, createdAt: 1,
    cloudBaseCredential: 'cloud-secret', payload: {},
  }), /敏感/)
  assert.throws(() => prepareLocalBackup({
    kind: 'word-learning-backup', version: 1, createdAt: 1,
    sessionToken: 'session-secret', payload: {},
  }), /敏感/)

  assert.equal(JSON.stringify({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
  }), before)
})

test('legacy manual backups with missing newer fields migrate safely and create conservative review entries', () => {
  const legacy = {
    version: 2,
    idiomCache: {
      老词: { id: 'legacy-word', word: '老词', explanation: '旧版释义', createdAt: 321 },
    },
    searchHistory: [{ id: 'old-search', word: '老词', timestamp: 333 }],
    tokenStats: { totalTokens: 10, requestCount: 1 },
    dailyIssues: [],
  }

  const prepared = prepareLocalBackup(legacy)
  assert.equal(prepared.legacy, true)
  assert.equal(prepared.document.payload.idiom.idiomCache['老词'].explanation, '旧版释义')
  assert.deepEqual(prepared.document.payload.idiom.favorites, [])
  assert.deepEqual(prepared.document.payload.idiom.queryCounts, {})
  assert.equal(prepared.document.payload.review.wordStats['老词'].state, 'new')
  assert.equal(prepared.document.payload.review.wordStats['老词'].correctCount, 0)
  assert.equal(prepared.document.payload.review.wordStats['老词'].wrongCount, 0)
})

test('new review data and mastered state survive backup preparation without reset', () => {
  seedRichData()
  const backup = createLocalBackup(20_000)
  const parsed = prepareLocalBackup(JSON.parse(serializeLocalBackup(backup.document)))
  assert.deepEqual(parsed.document.payload.review.wordStats['因地制宜'], {
    state: 'mastered',
    nextReviewAt: 9_999_999,
    interval: 30,
    correctCount: 8,
    wrongCount: 2,
    lastReviewedAt: 8_888_888,
  })
  assert.equal(Object.keys(parsed.document.payload.review.wordStats).length, 2)
})

test('mid-restore failure rolls all already-written stores back to their original state', async () => {
  seedRichData()
  const target = createLocalBackup(30_000)
  const idioms = useIdiomStore(), review = useReviewStore(), daily = useDailyStore()
  const settings = useSettingsStore(), theme = useThemeStore()

  idioms.idiomCache = { 原数据: idiom('原数据', 999) }
  idioms.searchHistory = [{ id: 'origin-search', word: '原数据', timestamp: 999 }]
  idioms.favorites = ['原数据']
  review.wordStats = {
    原数据: { state: 'review', nextReviewAt: 1234, interval: 3, correctCount: 2, wrongCount: 4, lastReviewedAt: 1200 },
  }
  daily.issues = [{ id: 'origin-daily', groupId: 'origin-group', createdAt: 999, tokenUsage: 0, articles: [{ ...article('link'), title: '原日报', content: '恢复失败后必须保留的原始正文。' }] }]
  daily.groups = [{ id: 'origin-group', name: '原分组', collapsed: false, createdAt: 999 }]
  daily.selectedId = 'origin-daily'
  settings.reviewTarget = 9
  theme.theme = 'light'
  theme.followSystem = false
  theme.themeColor = 'violet'

  const before = JSON.parse(JSON.stringify({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
    reviewTarget: settings.reviewTarget,
    theme: theme.theme,
    followSystem: theme.followSystem,
    themeColor: theme.themeColor,
  }))

  const realRestore = daily.restoreSyncData
  let calls = 0
  daily.restoreSyncData = data => {
    calls++
    if (calls === 1) throw new Error('simulated Daily persistence failure')
    return realRestore(data)
  }

  await assert.rejects(() => restorePreparedLocalBackup(target), /simulated Daily persistence failure/)
  assert(calls >= 2)
  assert.deepEqual({
    idiom: idioms.exportSyncData(),
    review: review.exportSyncData(),
    daily: daily.exportSyncData(),
    reviewTarget: settings.reviewTarget,
    theme: theme.theme,
    followSystem: theme.followSystem,
    themeColor: theme.themeColor,
  }, before)
})

test('invalid profile storage fails before store writes and keeps original learning data', async () => {
  seedRichData()
  const target = createLocalBackup(40_000)
  const idioms = useIdiomStore()
  idioms.idiomCache = { 原数据: idiom('原数据', 777) }
  const before = JSON.stringify(idioms.exportSyncData())

  const realSetItem = localStorage.setItem
  let failedOnce = false
  localStorage.setItem = (key, value) => {
    if (!failedOnce && String(key) === 'word-learning-profile-name') {
      failedOnce = true
      throw new Error('quota')
    }
    realSetItem.call(localStorage, key, value)
  }
  try {
    await assert.rejects(() => restorePreparedLocalBackup(target), /个人资料无法保存/)
    assert.equal(JSON.stringify(idioms.exportSyncData()), before)
  } finally {
    localStorage.setItem = realSetItem
  }
})

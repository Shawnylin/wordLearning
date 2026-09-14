import assert from "node:assert/strict";
import { test, after } from "node:test";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createPinia, setActivePinia } from "pinia";
const file = new URL("./.pdf-test.tmp.mjs", import.meta.url);
const compiled = await build({
  stdin: {
    contents:
      "export * from './src/api/pdfPlan'; export * from './src/api/dailyBackup'; export * from './src/stores/daily'; export * from './src/stores/settings'; export { testConnection } from './src/api/deepseek'",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  external: ["pinia", "vue"],
});
await writeFile(file, compiled.outputFiles[0].text);
const {
  textLines,
  readingText,
  planBatches,
  batchBudget,
  reconstruct,
  mergedPdfArticles,
  parsePdfDraft,
  pdfIssues,
  validateDailyIssue,
  useDailyStore,
  useSettingsStore,
  testConnection,
} = await import(file.href);
const originalFetch = globalThis.fetch,
  originalStorage = globalThis.localStorage;
after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
  await unlink(file);
});
const lines = [
  { id: 1, text: "原文标题", x: 0, y: 30, size: 20 },
  {
    id: 2,
    text: "因地制宜，原文不许缩短。".repeat(200),
    x: 0,
    y: 20,
    size: 10,
  },
  { id: 3, text: "（下转第二版）", x: 0, y: 10, size: 10 },
  { id: 4, text: "图片说明", x: 0, y: 0, size: 8 },
];
const result = {
  articles: [
    {
      titleIds: [1],
      shortTitle: "因地制宜发展实践",
      paragraphs: [[2, 3]],
      words: ["因地制宜", "不存在"],
    },
  ],
  extras: [4],
};
const batch = () => ({ page: 1, part: 1, lines });
const draft = () => ({
  filename: "sample.pdf",
  fingerprint: "a".repeat(64),
  pages: 1,
  batches: [batch()],
  tokenUsage: 0,
  usageEstimated: false,
  models: [],
});
const config = {
  apiKey: "synthetic-test",
  model: "test-parser",
  baseUrl: "https://api.xiaomimimo.com/v1",
};
test("text extraction keeps all text and separates columns at the same baseline", () => {
  const item = (str, x, y, width) => ({
    str,
    width,
    height: 10,
    transform: [10, 0, 0, 10, x, y],
    hasEOL: false,
  });
  const items = [
    item("甲", 0, 100, 10),
    item("乙", 10, 100, 10),
    item("另栏", 200, 100, 20),
    item("下一行", 0, 80, 30),
  ];
  assert.deepEqual(
    textLines(items).map((l) => l.text),
    ["甲乙", "另栏", "下一行"],
  );
  assert.equal(
    textLines(items)
      .map((l) => l.text)
      .join(""),
    items.map((i) => i.str).join(""),
  );
});
test("Chinese layout spacing is normalized without changing English words or paragraph breaks", () => {
  assert.equal(
    readingText("因 地 制 宜 ，发 展\n\nOpen source 2026 年"),
    "因地制宜，发展\n\nOpen source 2026年",
  );
});
test("MiMo connection test uses the official completion limit and keeps thinking disabled", async () => {
  globalThis.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.max_completion_tokens, 128);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.thinking.type, "disabled");
    return Response.json({
      choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
    });
  };
  assert.match(
    await testConnection({ ...config, thinkingEnabled: false }),
    /连接成功/,
  );
});
test("reconstruct preserves source and safely normalizes repeated or invalid ids", () => {
  const value = reconstruct(batch(), result);
  assert.equal(value.articles[0].content, lines[1].text + lines[2].text);
  assert.deepEqual(value.articles[0].words, ["因地制宜"]);
  assert.equal(value.remainder, "图片说明");
  const normalized = reconstruct(batch(), {
    articles: [
      {
        titleIds: [1, 1, 999],
        shortTitle: "高质量发展实践",
        paragraphs: [[2, 2, 999, 3], [3]],
        words: [],
      },
      {
        titleIds: [1],
        shortTitle: "重复虚构文章",
        paragraphs: [[2, 4]],
        words: [],
      },
    ],
  });
  assert.equal(normalized.articles.length, 2);
  assert.equal(normalized.articles[0].title, lines[0].text);
  assert.equal(normalized.articles[0].content, lines[1].text + lines[2].text);
  assert.equal(normalized.articles[1].content, "图片说明");
  assert.equal(normalized.remainder, "");
  const fallback = reconstruct(batch(), {
    articles: [{ titleIds: [1], paragraphs: [[999]] }],
  });
  assert.equal(fallback.articles.length, 1);
  assert.equal(fallback.articles[0].title, lines[0].text);
  assert.match(fallback.articles[0].content, /图片说明/);
});
test("untitled continuation is merged into its verified previous article without a placeholder title", () => {
  const continuation = reconstruct(
    {
      page: 2,
      part: 1,
      lines: [{ id: 1, text: "续接正文。", x: 0, y: 1, size: 10 }],
    },
    {
      articles: [
        {
          titleIds: [],
          shortTitle: "",
          continuationOf: 0,
          paragraphs: [[1]],
          words: [],
        },
      ],
    },
    1,
  );
  const merged = mergedPdfArticles([
    reconstruct(batch(), result).articles[0],
    ...continuation.articles,
  ]);
  assert.equal(merged.length, 1);
  assert.match(merged[0].content, /续接正文/);
  assert.doesNotMatch(merged[0].title, /续段/);
  const inferred = reconstruct(
    {
      page: 2,
      part: 1,
      lines: [{ id: 1, text: "无法归属", x: 0, y: 1, size: 10 }],
    },
    { articles: [{ titleIds: [], shortTitle: "", paragraphs: [[1]] }] },
    1,
  );
  assert.equal(inferred.articles[0].continuationOf, 0);
});
test("budgeted batches cover every line once and bound context and output", () => {
  const source = Array.from({ length: 1200 }, (_, i) => ({
    id: i + 1,
    text: "中国新闻原文".repeat(12),
    x: 0,
    y: i,
    size: 10,
  }));
  const batches = planBatches(1, source);
  assert.ok(batches.length > 1);
  assert.deepEqual(
    batches.flatMap((b) => b.lines),
    source,
  );
  for (const b of batches) {
    assert.ok(batchBudget(b).input <= 22000);
    assert.ok(batchBudget(b).output <= 8192);
  }
});
test("parser accepts usable length output and does not rebill completed batches", async () => {
  const d = draft();
  d.batches.push({ ...batch(), part: 2 });
  let calls = 0,
    tokens = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, config.baseUrl + "/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "test-parser");
    assert.equal(body.thinking.type, "disabled");
    assert.ok(body.max_completion_tokens > 0);
    assert.equal(body.max_tokens, undefined);
    return Response.json({
      choices: [
        {
          message: { content: JSON.stringify(result) },
          finish_reason: calls === 2 ? "length" : "stop",
        },
      ],
      usage: { total_tokens: 123 },
    });
  };
  await parsePdfDraft(
    d,
    config,
    new AbortController().signal,
    () => {},
    (n) => (tokens += n),
  );
  assert.ok(d.batches[0].result);
  assert.ok(d.batches[1].result);
  assert.equal(tokens, 246);
  await parsePdfDraft(
    d,
    config,
    new AbortController().signal,
    () => {},
    (n) => (tokens += n),
  );
  assert.equal(calls, 2);
  assert.equal(tokens, 246);
  assert.equal(
    pdfIssues(d).reduce((sum, issue) => sum + issue.tokenUsage, 0),
    246,
  );
});
test("malformed model JSON falls back to complete local batch text", async () => {
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: '{"articles":[' }, finish_reason: "length" }],
      usage: { total_tokens: 25 },
    });
  const d = draft();
  await parsePdfDraft(
    d,
    config,
    new AbortController().signal,
    () => {},
    () => {},
  );
  assert.equal(d.batches[0].result.articles.length, 1);
  assert.match(d.batches[0].result.articles[0].content, /图片说明/);
});
test("missing usage is explicitly estimated; cancelled and auth failures do not retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      choices: [
        { message: { content: JSON.stringify(result) }, finish_reason: "stop" },
      ],
    });
  };
  const d = draft();
  await parsePdfDraft(
    d,
    config,
    new AbortController().signal,
    () => {},
    () => {},
  );
  assert.equal(d.usageEstimated, true);
  assert.ok(d.tokenUsage > 0);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    parsePdfDraft(
      draft(),
      config,
      controller.signal,
      () => {},
      () => {},
    ),
  );
  assert.equal(calls, 1);
  globalThis.fetch = async () => {
    calls++;
    return Response.json({}, { status: 401 });
  };
  await assert.rejects(
    parsePdfDraft(
      draft(),
      config,
      new AbortController().signal,
      () => {},
      () => {},
    ),
    /401/,
  );
  assert.equal(calls, 2);
});
test("PDF full text and progress survive backup; untrusted backup URLs are discarded", () => {
  const d = draft();
  d.batches[0].result = reconstruct(batch(), result);
  const issue = pdfIssues(d)[0];
  issue.articles[0].completedAt = Date.now();
  issue.articles[0].starred = true;
  issue.articles[0].url = "javascript:alert(1)";
  const restored = validateDailyIssue(JSON.parse(JSON.stringify(issue)));
  assert.equal(restored.articles[0].content, issue.articles[0].content);
  assert.equal(restored.articles[0].completedAt, issue.articles[0].completedAt);
  assert.equal(restored.articles[0].starred, true);
  assert.equal(restored.articles[0].shortTitle, "因地制宜发展实践");
  assert.equal(restored.pdf.fingerprint, d.fingerprint);
  assert.equal(restored.articles[0].url, "");
  assert.throws(() =>
    validateDailyIssue({ ...issue, pdf: { ...issue.pdf, pages: 0 } }),
  );
});
test("PDF articles save as individual history records; completion, star and delete persist before display", () => {
  setActivePinia(createPinia());
  const store = useDailyStore();
  const d = draft();
  d.batches[0].result = {
    articles: [
      reconstruct(batch(), result).articles[0],
      {
        title: "另一篇完整标题",
        shortTitle: "另一篇历史短标题",
        content: "另一篇正文",
        words: [],
        source: "导入 PDF",
        url: "",
        publishedAt: "",
        analysis: "",
        origin: "pdf",
        page: 1,
      },
    ],
    remainder: "图片说明",
  };
  const records = pdfIssues(d),
    issue = records[0];
  let saved;
  globalThis.localStorage = {
    setItem: (_, value) => {
      saved = JSON.parse(value);
    },
  };
  store.savePdfIssues(records);
  assert.equal(store.issues.length, 2);
  assert.equal(store.issues[0].articles.length, 1);
  assert.equal(store.issues[1].articles.length, 1);
  store.toggleCompleted(issue.id, 0);
  store.toggleStarred(issue.id);
  assert.ok(store.issues[0].articles[0].completedAt);
  assert.ok(saved.issues[0].articles[0].completedAt);
  assert.equal(store.issues[0].articles[0].starred, true);
  store.toggleCompleted(issue.id, 0);
  assert.equal(store.issues[0].articles[0].completedAt, undefined);
  assert.throws(() => store.savePdfIssues(pdfIssues(d)), /已导入/);
  store.deleteIssue(records[1].id);
  assert.equal(store.issues.length, 1);
  globalThis.localStorage = {
    setItem: () => {
      throw new Error("quota");
    },
  };
  store.toggleCompleted(issue.id, 0);
  assert.equal(store.issues[0].articles[0].completedAt, undefined);
  assert.match(store.error, /保存失败/);
});
test("PDF config does not switch learning model; explicit reuse follows learning config", () => {
  setActivePinia(createPinia());
  const settings = useSettingsStore();
  settings.model = "learning";
  settings.apiKey = "learning-key";
  settings.pdfConfig = config;
  assert.equal(settings.pdfApiConfig.model, "test-parser");
  assert.equal(settings.apiConfig.model, "learning");
  settings.pdfUseLearningModel = true;
  assert.equal(settings.pdfApiConfig.model, "learning");
  assert.equal(settings.pdfApiConfig.thinkingEnabled, false);
});

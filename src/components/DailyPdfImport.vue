<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import {
  batchBudget,
  mergedPdfArticles,
  parsePdfDraft,
  pdfIssues,
  type PdfDraft,
} from "../api/pdfPlan";
import { useDailyStore } from "../stores/daily";
import { useSettingsStore } from "../stores/settings";
import { useIdiomStore } from "../stores/idiom";
const daily = useDailyStore(),
  settings = useSettingsStore(),
  idioms = useIdiomStore(),
  router = useRouter();
const panel = ref<HTMLElement>(),
  input = ref<HTMLInputElement>(),
  visible = ref(false);
const draft = ref<PdfDraft>(),
  busy = ref(false),
  status = ref(""),
  error = ref("");
let controller: AbortController | undefined;
const ready = computed(
  () =>
    !!draft.value?.batches.length && draft.value.batches.every((b) => b.result),
);
const articles = computed(() =>
  mergedPdfArticles(
    draft.value?.batches.flatMap((b) => b.result?.articles || []) || [],
  ),
);
const remainder = computed(
  () =>
    draft.value?.batches
      .filter((b) => b.result?.remainder)
      .map((b) => `第 ${b.page} 页 · 批次 ${b.part}\n${b.result!.remainder}`)
      .join("\n\n") || "",
);
const budget = computed(() =>
  (draft.value?.batches.filter((b) => !b.result) || []).reduce(
    (sum, b) => {
      const v = batchBudget(b);
      return { input: sum.input + v.input, output: sum.output + v.output };
    },
    { input: 0, output: 0 },
  ),
);
const characters = computed(
  () =>
    draft.value?.batches.reduce(
      (sum, b) => sum + b.lines.reduce((n, l) => n + l.text.length, 0),
      0,
    ) || 0,
);
async function open() {
  error.value = "";
  visible.value = true;
  await nextTick();
  panel.value?.focus();
}
function close() {
  if (busy.value) {
    controller?.abort();
    return;
  }
  visible.value = false;
}
function chooseFile() {
  input.value?.click();
}
async function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || busy.value) return;
  draft.value = undefined;
  error.value = "";
  busy.value = true;
  controller = new AbortController();
  try {
    status.value = "正在加载本机 PDF 提取器";
    const { extractPdf } = await import("../api/pdfExtract");
    const result = await extractPdf(file, controller.signal, (text) => {
      status.value = text;
    });
    if (daily.issues.some((i) => i.pdf?.fingerprint === result.fingerprint))
      throw new Error("这份 PDF 已导入，请在历史日报中继续学习");
    draft.value = result;
    status.value = "原文已提取，尚未调用模型";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    controller = undefined;
    if (input.value) input.value.value = "";
  }
}
async function parse() {
  if (!draft.value || busy.value) return;
  busy.value = true;
  error.value = "";
  controller = new AbortController();
  try {
    await parsePdfDraft(
      draft.value,
      settings.pdfApiConfig,
      controller.signal,
      (text) => {
        status.value = text;
      },
      (tokens) => idioms.addTokenUsage(tokens),
    );
    status.value = `分篇完成，共 ${articles.value.length} 篇；请核对后保存`;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    controller = undefined;
  }
}
function save() {
  try {
    daily.savePdfIssues(pdfIssues(draft.value!));
    draft.value = undefined;
    status.value = "";
    visible.value = false;
  } catch (e) {
    error.value = `保存失败：${(e as Error).message}。预览仍保留，可导出原文或释放本机空间后重试。`;
  }
}
function downloadText() {
  if (!draft.value) return;
  const text = ready.value
    ? [
        ...articles.value.map((a) => `${a.title}\n\n${a.content}`),
        remainder.value,
      ].join("\n\n")
    : draft.value.batches
        .map((b) => `第 ${b.page} 页\n${b.lines.map((l) => l.text).join("\n")}`)
        .join("\n\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = draft.value.filename.replace(/\.pdf$/i, ".txt");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function models() {
  visible.value = false;
  void router.push("/profile/models");
}
onBeforeUnmount(() => controller?.abort());
defineExpose({ open });
</script>
<template>
  <Teleport to="body"
    ><Transition name="pdf-scrim"
      ><div
        v-if="visible"
        class="pdf-scrim"
        @pointerdown.self="close" /></Transition
    ><Transition name="pdf-panel">
      <section
        v-if="visible"
        ref="panel"
        class="pdf-import"
        role="dialog"
        aria-modal="true"
        aria-label="PDF 日报导入"
        tabindex="-1"
        @keydown.esc.prevent="close"
      >
        <header class="flex items-center justify-between gap-3">
          <h2 class="font-kai text-xl">导入 PDF 日报</h2>
          <button @click="close" class="bg-soft rounded-full px-3 py-2 text-sm">
            {{ busy ? "取消任务" : "关闭" }}
          </button>
        </header>
        <p class="text-sm text-ink-soft leading-7 mt-4">
          从<a
            href="https://paper.people.com.cn/rmrb/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-zhuhong underline"
            >人民日报电子版</a
          >下载所需版面 PDF。支持文字版，最多 32 页 / 50
          MB。仅呈现上传版面的全文；“下转”等续篇需另行导入对应版面。
        </p>
        <input
          ref="input"
          type="file"
          accept=".pdf,application/pdf"
          :disabled="busy"
          @change="pick"
          class="sr-only"
          tabindex="-1"
        />
        <button
          @click="chooseFile"
          :disabled="busy"
          class="pdf-file-button mt-4 w-full rounded-2xl py-4 text-sm font-medium"
        >
          {{
            busy ? "正在读取 PDF…" : draft ? "重新选择 PDF" : "选择 PDF 文件"
          }}
        </button>
        <p class="text-xs text-ink-mute leading-6 mt-4">
          解析模型：{{ settings.pdfApiConfig.model || "尚未配置" }}
          <button
            @click="models"
            :disabled="busy"
            class="text-zhuhong underline"
          >
            设置解析模型
          </button>
        </p>
        <p
          v-if="status"
          role="status"
          aria-live="polite"
          class="mt-3 text-sm text-ink-soft"
        >
          {{ status }}
        </p>
        <p
          v-if="error"
          role="alert"
          class="mt-3 text-sm text-zhuhong leading-6"
        >
          {{ error }}
        </p>
        <section v-if="draft" class="mt-4 space-y-4">
          <p class="text-sm break-all">
            {{ draft.filename }} · {{ draft.pages }} 页 ·
            {{ characters.toLocaleString() }} 字符 ·
            {{ draft.batches.length }} 批
          </p>
          <p class="text-xs text-ink-mute leading-6">
            剩余预计输入约
            {{ budget.input.toLocaleString() }} tokens，输出预算上限
            {{
              budget.output.toLocaleString()
            }}
            tokens。实际用量依模型而异。正文在本机提取，仅发送带编号文字供分篇；模型返回编号，程序还原全文。逐批处理，不自动付费重试。
          </p>
          <p v-if="draft.tokenUsage" class="text-xs text-ink-mute">
            本次累计{{ draft.usageEstimated ? "含估算" : "接口报告" }}
            {{
              draft.tokenUsage.toLocaleString()
            }}
            tokens（含失败尝试）。完成批次保留在当前页面，重试只处理未完成批次。
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="!ready"
              @click="parse"
              :disabled="busy"
              class="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
            >
              {{
                busy
                  ? "处理中…"
                  : articles.length
                    ? "继续解析未完成批次"
                    : "开始分篇解析"
              }}</button
            ><button
              v-if="ready"
              @click="save"
              :disabled="busy"
              class="btn-primary rounded-full px-5 py-2 text-sm"
            >
              保存 {{ articles.length }} 篇到日报</button
            ><button
              @click="downloadText"
              :disabled="busy"
              class="bg-soft rounded-full px-4 py-2 text-sm"
            >
              导出全文 TXT
            </button>
          </div>
          <details class="border-t border-line pt-3">
            <summary class="text-sm cursor-pointer">
              核对提取原文（含图片说明与报头）
            </summary>
            <pre class="raw-text">{{
              draft.batches
                .map(
                  (b) =>
                    `第 ${b.page} 页\n` + b.lines.map((l) => l.text).join("\n"),
                )
                .join("\n\n")
            }}</pre>
          </details>
          <div v-if="articles.length" class="border-t border-line pt-4">
            <h3 class="text-sm mb-3">全文预览 · 模型分篇请核对</h3>
            <details
              v-for="(article, index) in articles"
              :key="index"
              class="py-3 border-b border-line"
            >
              <summary class="cursor-pointer text-sm leading-6">
                {{ index + 1 }}. {{ article.title }} · 第 {{ article.page }} 页
              </summary>
              <p class="raw-text">{{ article.content }}</p>
              <p
                v-if="/下转|上接|续完|全文见/.test(article.content)"
                class="text-xs text-zhuhong"
              >
                含跨版提示，本篇仅包含上传版面上的内容。
              </p>
            </details>
          </div>
          <details v-if="ready" class="pt-2">
            <summary class="cursor-pointer text-sm">
              未归入文章的文字（会一并保存）
            </summary>
            <pre class="raw-text">{{ remainder || "无" }}</pre>
          </details>
        </section>
      </section></Transition
    ></Teleport
  >
</template>
<style scoped>
.pdf-scrim {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: #0005;
  backdrop-filter: blur(8px);
}
.pdf-import {
  position: fixed;
  z-index: 71;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(760px, calc(100vw - 24px));
  max-height: 85dvh;
  padding: 24px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 18px 64px #0003;
  outline: none;
}
.pdf-file-button {
  border: 1px dashed color-mix(in srgb, var(--zhuhong) 42%, var(--line));
  background: var(--zhuhong-soft);
  color: var(--zhuhong);
}
.pdf-panel-enter-active,
.pdf-panel-leave-active {
  transition:
    opacity 0.38s ease,
    transform 0.46s cubic-bezier(0.22, 1, 0.36, 1);
}
.pdf-panel-enter-from,
.pdf-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 24px)) scale(0.92);
}
.pdf-scrim-enter-active,
.pdf-scrim-leave-active {
  transition:
    opacity 0.32s ease,
    backdrop-filter 0.4s ease;
}
.pdf-scrim-enter-from,
.pdf-scrim-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}
.raw-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 14px;
  line-height: 2;
  margin-top: 16px;
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--zhuhong);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .pdf-panel-enter-active,
  .pdf-panel-leave-active,
  .pdf-scrim-enter-active,
  .pdf-scrim-leave-active {
    transition-duration: 1ms;
  }
}
</style>

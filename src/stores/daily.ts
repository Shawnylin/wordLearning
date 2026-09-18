import { defineStore } from "pinia";
import { ref } from "vue";
import {
  generateDaily,
  type DailyIssue,
  type DailyProgressPhase,
} from "../api/daily";
import { generateDailyFromLink } from "../api/dailyLink";
import type { ApiConfig } from "../api/deepseek";
import { useIdiomStore } from "./idiom";
import type { DailySyncData } from '../types/sync'

export interface DailyGroup {
  id: string;
  name: string;
  collapsed: boolean;
  createdAt: number;
}

export const useDailyStore = defineStore(
  "daily",
  () => {
    const issues = ref<DailyIssue[]>([]);
    const groups = ref<DailyGroup[]>([]);
    const loading = ref(false),
      error = ref(""),
      selectedId = ref("");
    const progressPhase = ref<DailyProgressPhase>("searching"),
      streamedText = ref("");
    let controller: AbortController | undefined;
    function persist(next: DailyIssue[], nextSelected = selectedId.value, nextGroups = groups.value) {
      localStorage.setItem(
        "daily-store",
        JSON.stringify({ issues: next, selectedId: nextSelected, groups: nextGroups }),
      );
      issues.value = next;
      selectedId.value = nextSelected;
      groups.value = nextGroups;
    }
    function editionName(issue: DailyIssue) {
      if (issue.pdf?.editionDate) {
        const [year, month, day] = issue.pdf.editionDate.split("-").map(Number);
        return `${year}年${month}月${day}日 人民日报`;
      }
      if (issue.pdf?.filename) return issue.pdf.filename.replace(/\.pdf$/i, "") || "未识别日报";
      const date = new Date(issue.createdAt);
      return `${date.getMonth() + 1}月${date.getDate()}日 在线日报`;
    }
    function defaultGroupId(issue: DailyIssue) {
      if (issue.pdf?.fingerprint) return `pdf-${issue.pdf.fingerprint}`;
      const date = new Date(issue.createdAt);
      return `daily-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    function ensureGroups() {
      const nextGroups = [...groups.value], known = new Set(nextGroups.map(group => group.id));
      let changed = false;
      const nextIssues = issues.value.map(issue => {
        const groupId = issue.groupId || defaultGroupId(issue);
        if (!known.has(groupId)) {
          nextGroups.push({ id: groupId, name: editionName(issue), collapsed: false, createdAt: issue.createdAt });
          known.add(groupId);
          changed = true;
        }
        if (issue.groupId === groupId) return issue;
        changed = true;
        return { ...issue, groupId };
      });
      if (changed) persist(nextIssues, selectedId.value, nextGroups);
    }
    function renameGroup(groupId: string, name: string) {
      const normalized = name.trim().replace(/[\r\n]+/g, " ").slice(0, 40);
      if (!normalized) return;
      persist(issues.value, selectedId.value, groups.value.map(group => group.id === groupId ? { ...group, name: normalized } : group));
    }
    function toggleGroup(groupId: string) {
      persist(issues.value, selectedId.value, groups.value.map(group => group.id === groupId ? { ...group, collapsed: !group.collapsed } : group));
    }
    function moveIssue(issueId: string, groupId: string) {
      if (!groups.value.some(group => group.id === groupId)) return;
      persist(issues.value.map(issue => issue.id === issueId ? { ...issue, groupId } : issue));
    }
    function restoreGroups(value: unknown) {
      const restored = Array.isArray(value) ? value.flatMap(item => {
        const group = item as Partial<DailyGroup>;
        if (!group || typeof group.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(group.id) || typeof group.name !== "string") return [];
        const name = group.name.trim().replace(/[\r\n]+/g, " ").slice(0, 40);
        if (!name) return [];
        return [{ id: group.id, name, collapsed: group.collapsed === true, createdAt: Number.isFinite(group.createdAt) ? Number(group.createdAt) : Date.now() }];
      }) : [];
      persist(issues.value, selectedId.value, restored);
      ensureGroups();
    }
    function saveIssue(issue: DailyIssue) {
      const groupId = issue.groupId || defaultGroupId(issue);
      if (
        issue.pdf &&
        issues.value.some(
          (i) =>
            i.pdf?.fingerprint === issue.pdf!.fingerprint &&
            i.pdf?.articleIndex === issue.pdf?.articleIndex,
        )
      )
        throw new Error("这篇 PDF 文章已导入，请在历史日报中继续学习");
      const nextGroups = groups.value.some(group => group.id === groupId) ? groups.value : [{ id: groupId, name: editionName(issue), collapsed: false, createdAt: issue.createdAt }, ...groups.value];
      persist([{ ...issue, groupId }, ...issues.value], issue.id, nextGroups);
    }
    function savePdfIssues(records: DailyIssue[]) {
      if (!records.length) throw new Error("PDF 中没有可保存的文章");
      const fingerprint = records[0].pdf?.fingerprint;
      if (
        !fingerprint ||
        records.some((record) => record.pdf?.fingerprint !== fingerprint)
      )
        throw new Error("PDF 文章记录不一致");
      if (issues.value.some((issue) => issue.pdf?.fingerprint === fingerprint))
        throw new Error("这份 PDF 已导入，请在历史日报中继续学习");
      const groupId = records[0].groupId || defaultGroupId(records[0]);
      const nextRecords: DailyIssue[] = records.map(record => ({ ...record, groupId }));
      const nextGroups = groups.value.some(group => group.id === groupId) ? groups.value : [{ id: groupId, name: editionName(records[0]), collapsed: false, createdAt: records[0].createdAt }, ...groups.value];
      persist([...nextRecords, ...issues.value], nextRecords[0].id, nextGroups);
    }
    function toggleCompleted(issueId: string, index: number) {
      error.value = "";
      const next = issues.value.map((issue) =>
        issue.id !== issueId
          ? issue
          : {
              ...issue,
              articles: issue.articles.map((a, i) =>
                i !== index
                  ? a
                  : {
                      ...a,
                      completedAt: a.completedAt ? undefined : Date.now(),
                    },
              ),
            },
      );
      try {
        persist(next);
      } catch {
        error.value = "学习进度保存失败，本机空间可能不足，请先导出备份";
      }
    }
    function toggleStarred(issueId: string) {
      error.value = "";
      const next = issues.value.map((issue) =>
        issue.id !== issueId
          ? issue
          : {
              ...issue,
              articles: issue.articles.map((article, index) =>
                index ? article : { ...article, starred: !article.starred },
              ),
            },
      );
      try {
        persist(next);
      } catch {
        error.value = "星标保存失败，本机空间可能不足";
      }
    }
    function deleteIssue(issueId: string) {
      error.value = "";
      const next = issues.value.filter((issue) => issue.id !== issueId);
      const nextSelected =
        selectedId.value === issueId ? next[0]?.id || "" : selectedId.value;
      try {
        persist(next, nextSelected);
      } catch {
        error.value = "删除失败，本机空间可能不足";
      }
    }
    function normalizePdfIssues() {
      const next: DailyIssue[] = [];
      let changed = false;
      for (const issue of issues.value) {
        if (!issue.pdf || issue.articles.length <= 1) {
          next.push(issue);
          continue;
        }
        changed = true;
        issue.articles.forEach((article, index) =>
          next.push({
            ...issue,
            id: index ? `${issue.id}-${index}` : issue.id,
            createdAt: issue.createdAt + index,
            tokenUsage:
              Math.floor(issue.tokenUsage / issue.articles.length) +
              (index < issue.tokenUsage % issue.articles.length ? 1 : 0),
            articles: [article],
            pdf: {
              ...issue.pdf!,
              articleIndex: index,
              articleCount: issue.articles.length,
              remainder: index ? "" : issue.pdf!.remainder,
            },
          }),
        );
      }
      if (changed)
        try {
          persist(next, selectedId.value);
        } catch {
          error.value = "旧版 PDF 历史拆分失败，请先导出备份";
        }
    }
    async function generate(config: ApiConfig, link?: string) {
      if (loading.value) return;
      loading.value = true;
      error.value = "";
      progressPhase.value = link ? "reading" : "searching";
      streamedText.value = "";
      controller = new AbortController();
      let consumedTokens = 0;
      try {
        const runner: typeof generateDaily = link
          ? (config, ...args) => generateDailyFromLink(config, link, ...args)
          : generateDaily;
        const issue = await runner(
          { ...config },
          issues.value.flatMap((i) => i.articles.map((a) => a.url)),
          controller.signal,
          (tokens) => {
            consumedTokens += tokens;
          },
          (progress) => {
            progressPhase.value = progress.phase;
            if (progress.text !== undefined) streamedText.value = progress.text;
          },
        );
        if (controller.signal.aborted) throw new Error("已取消生成");
        // Write before showing success: storage quota errors must never masquerade as a saved issue.
        saveIssue(issue);
      } catch (e) {
        error.value = e instanceof Error ? e.message : "日报生成失败";
      } finally {
        if (consumedTokens > 0) {
          useIdiomStore().addTokenUsage(consumedTokens);
          if (error.value)
            error.value += `（本次接口已报告消耗 ${consumedTokens.toLocaleString()} tokens）`;
        }
        loading.value = false;
        streamedText.value = "";
        controller = undefined;
      }
    }
    function cancel() {
      controller?.abort();
    }

    function exportSyncData(): DailySyncData {
      return { issues: issues.value, groups: groups.value, selectedId: selectedId.value };
    }

    function restoreSyncData(data: DailySyncData) {
      issues.value = data.issues;
      groups.value = data.groups;
      selectedId.value = data.selectedId;
      ensureGroups();
    }

    return {
      issues,
      groups,
      loading,
      error,
      selectedId,
      progressPhase,
      streamedText,
      generate,
      cancel,
      saveIssue,
      savePdfIssues,
      toggleCompleted,
      toggleStarred,
      deleteIssue,
      normalizePdfIssues,
      ensureGroups,
      renameGroup,
      toggleGroup,
      moveIssue,
      restoreGroups,
      exportSyncData,
      restoreSyncData,
    };
  },
  { persist: { key: "daily-store", paths: ["issues", "selectedId", "groups"] } },
);

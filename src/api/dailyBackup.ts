import { validateArticles, type DailyArticle, type DailyIssue } from "./daily";

export function validateDailyIssue(value: unknown): DailyIssue {
  const issue = value as any;
  const fail = () => {
    throw new Error("日报备份格式错误");
  };
  if (
    !issue ||
    typeof issue.id !== "string" ||
    !issue.id ||
    !Number.isFinite(issue.createdAt)
  )
    return fail();
  let articles: DailyArticle[];
  let pdf: DailyIssue["pdf"];
  if (issue.pdf) {
    const p = issue.pdf;
    if (
      typeof p.filename !== "string" ||
      !/^[a-f0-9]{64}$/.test(p.fingerprint) ||
      !Number.isInteger(p.pages) ||
      p.pages < 1 ||
      p.pages > 32 ||
      typeof p.remainder !== "string" ||
      p.remainder.length > 500000 ||
      typeof p.model !== "string"
    )
      return fail();
    if (
      !Array.isArray(issue.articles) ||
      !issue.articles.length ||
      issue.articles.length > 3000
    )
      return fail();
    articles = issue.articles.map((a: any) => {
      if (
        !a ||
        a.origin !== "pdf" ||
        typeof a.title !== "string" ||
        !a.title.trim() ||
        a.title.length > 20000 ||
        typeof a.content !== "string" ||
        !a.content.trim() ||
        a.content.length > 250000 ||
        !Number.isInteger(a.page) ||
        a.page < 1 ||
        a.page > p.pages
      )
        return fail();
      const words = Array.isArray(a.words)
        ? a.words
            .filter(
              (w: unknown) =>
                typeof w === "string" &&
                /^[\u3400-\u9fff]{2,12}$/.test(w) &&
                a.content.includes(w),
            )
            .slice(0, 6)
        : [];
      const shortTitle =
        typeof a.shortTitle === "string" &&
        /^[\u3400-\u9fff]{2,18}$/.test(a.shortTitle)
          ? a.shortTitle
          : a.title.slice(0, 18);
      return {
        title: a.title,
        shortTitle,
        content: a.content,
        page: a.page,
        source: "导入 PDF",
        url: "",
        publishedAt: "",
        analysis: "",
        words,
        origin: "pdf",
      };
    });
    if (
      p.articleIndex !== undefined &&
      (!Number.isInteger(p.articleIndex) || p.articleIndex < 0)
    )
      return fail();
    if (
      p.articleCount !== undefined &&
      (!Number.isInteger(p.articleCount) || p.articleCount < 1)
    )
      return fail();
    pdf = {
      filename: p.filename,
      fingerprint: p.fingerprint,
      pages: p.pages,
      remainder: p.remainder,
      model: p.model,
      usageEstimated: p.usageEstimated === true,
      ...(p.articleIndex !== undefined ? { articleIndex: p.articleIndex } : {}),
      ...(p.articleCount !== undefined ? { articleCount: p.articleCount } : {}),
      ...(typeof p.editionDate === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(p.editionDate) ? { editionDate: p.editionDate } : {}),
    };
  } else articles = validateArticles(issue.articles);
  articles = articles.map((a, index) => {
    const completedAt = issue.articles[index].completedAt;
    return {
      ...a,
      ...(Number.isFinite(completedAt) &&
      completedAt > 0 &&
      completedAt <= Date.now()
        ? { completedAt }
        : {}),
      ...(issue.articles[index].starred === true ? { starred: true } : {}),
    };
  });
  return {
    id: issue.id,
    createdAt: issue.createdAt,
    articles,
    tokenUsage: Number.isFinite(issue.tokenUsage)
      ? Math.max(0, issue.tokenUsage)
      : 0,
    ...(typeof issue.groupId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(issue.groupId) ? { groupId: issue.groupId } : {}),
    ...(pdf ? { pdf } : {}),
  };
}

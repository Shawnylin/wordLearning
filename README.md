# 成语学习 - 公考必备

一个为公务员考试备考者设计的成语/词语学习 PWA 应用。

## 功能特性

- 🔍 **智能搜索**：输入成语/词语，AI 自动生成详细学习内容
- 📚 **成语卡片**：包含拼音、解释、出处、例子、用法、相关成语
- 📖 **学习记录**：自动保存搜索历史，支持快速回顾
- 🔄 **缓存机制**：已查询的成语直接从缓存读取，节省 API 调用
- 🌙 **暗色模式**：支持亮色/暗色主题切换
- 📱 **PWA 支持**：可添加到 iPhone 主屏幕，离线可用
- 🔒 **安全设计**：输入清洗、防注入保护

## 技术栈

- **前端框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **CSS 框架**：Tailwind CSS v4
- **状态管理**：Pinia + pinia-plugin-persistedstate
- **图标库**：Lucide Icons
- **PWA**：vite-plugin-pwa
- **AI 模型**：deepseek-flash

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

## 使用说明

### 设置 API Key

1. 打开应用，点击底部导航栏的「个人」
2. 在「DeepSeek API Key」区域点击「设置 API Key」
3. 输入你的 DeepSeek API Key（可从 [platform.deepseek.com](https://platform.deepseek.com) 获取）
4. 点击「保存」

### 学习成语

1. 在「学习」页面的搜索框中输入成语或词语
2. 点击「搜索」或按回车键
3. 等待 AI 生成学习内容
4. 查看成语卡片，点击相关成语可继续学习

### 查看记录

1. 切换到「记录」页面
2. 查看所有搜索历史
3. 点击任意成语可快速跳转到学习卡片

## 部署到 EdgeOne Pages

1. 运行 `npm run build` 构建项目
2. 将 `dist` 目录上传到 EdgeOne Pages
3. 配置自定义域名（可选）

## 项目结构

```
src/
├── api/            # API 调用封装
├── components/     # 通用组件
├── router/         # 路由配置
├── stores/         # Pinia 状态管理
├── styles/         # 全局样式
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数
└── views/          # 页面组件
```

## 许可证

MIT

## 日报精读

底栏“日报”按需生成 1–3 篇权威媒体原文节选，标注标题、发布媒体、发布日期、来源链接与独立的 AI 学习提示。提示词位于 `src/api/daily.ts`：选取近三年（按北京时间日期计算，包含起止日）的素材，学习价值优先，不限定当天或当月，从人民网、光明网和半月谈筛选适合逻辑填空的连续文段。搜索引用只能证明该链接出现在本次搜索结果中，正文与日期的逐字核对仍依赖模型执行提示词，可点击来源自行复核。

在“个人 → 右上角设置 → 模型与 API”配置模型。DeepSeek 官方地址 `https://api.deepseek.com` 自动使用 `/anthropic/v1/messages` 与 `web_search_20250305` 服务端搜索工具，复用已保存的模型和 Key；其他服务商仍使用 Responses API + web_search。普通 Chat Completions 连通测试不代表联网能力可用。

点按划线词语，学习卡片从底栏日报选中框展开至半屏，背景渐变模糊；关闭时沿原路径收回。查询调用原学习模块，优先复用缓存并更新记录，支持收藏、相关词查询和主动重新生成。支持减少动态效果的系统偏好。

DeepSeek 搜索适配依据[官方 Anthropic 兼容文档](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)和[官方 Harness 搜索实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/web-search-deepseek/src/provider.ts)。Responses 文档中的内置工具限制不能直接等同于所有接口均无搜索能力。日报解析 `web_search_tool_result` 中的结果链接，仍校验媒体域名、日期与划线词；没有真实搜索结果时不保存，也不从模型正文中提取链接冒充搜索证据。搜索暂停可携带完整上下文续推，最多三次请求；保留当前模型与深度思考设置。实际可用性以当前模型的服务端响应为准，模拟测试不代表账户联调成功。

日报自动保存到当前浏览器，历史可重复学习，切换页面不中断生成。刷新或关闭应用会中断尚未完成的请求。设置里的备份导入导出包含日报，清空所有缓存也会清空日报；历史查询清理不会删除日报。

验证：`node --test tests/daily.test.mjs tests/daily-store.test.mjs tests/output-budget.test.mjs`，以及 `npm run build`。测试使用模拟响应，不消耗实际 API 额度。


## 模型配置与移动端修复

个人页支持保存多套 OpenAI Chat Completions 兼容配置：填写 API URL 和 Key，获取模型后选择（或手动填写），测试并保存启用。URL 可以包含 `/v1` 或完整 `/chat/completions` 路径。服务商需允许浏览器跨域访问。密钥保存在本机浏览器，并发送到所填 API 地址，不包含在学习数据导出中。

页面采用 hash 路由，避免静态托管访问 `/learn` 时返回 404。学习和对比的请求由 Pinia 管理，切换应用内页面继续生成，输入状态保留；关闭浏览器或刷新页面不在此保障范围内。PWA 更新在下次打开时生效，避免更新强制刷新中断请求。

浏览器回归脚本：`tests/browser.mjs`。先启动 Vite，再设置 `CODEX_NODE_MODULES` 为含 Playwright 的 node_modules 目录并运行 `node tests/browser.mjs`；使用 Edge 与模拟 API，不需要真实密钥，验证 393×852 视口、跨页生成、配置保存切换、接口错误及记录展开动画。

## 生成长度与完整性

单词查询的基础输出额度为 4096 tokens；2–5 词对比按词数从 4096 增至 7168。当前官方 DeepSeek 思考模型另预留 32768 tokens，避免推理过程挤占正文额度，不关闭思考或降低思考强度。额度是上限，并不要求模型写满；原有详细解释、出处、例句、用法及辨析要求保持不变。

当接口明确返回 `finish_reason: length`，保留原模型与提示词，自动扩大额度完整重生成一次（最高 65536 tokens）。不拼接截断 JSON、不删减内容，也不缓存未完成输出。仅在服务商明确拒绝 `max_tokens` 参数或额度时，额外尝试一次服务商默认额度；认证、限流和上下文超限等错误不自动重试。自动重生成可能增加等待时间和实际 token 消耗；服务商自身的输出限制仍可能导致失败。

运行 `node --test tests/output-budget.test.mjs` 可验证额度、有限重试、兼容处理和完整性校验，使用模拟 API，不需要真实密钥。浏览器缓存保护检查：`node tests/output-budget-browser.mjs`（先启动 Vite 并设置上述 `CODEX_NODE_MODULES`）。

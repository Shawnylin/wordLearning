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

### 可选的 CloudBase 邮箱登录

登录不会覆盖或清理本机学习记录；没有 CloudBase 配置时，应用仍可使用本地模式。需要启用邮箱注册/登录时，将 `.env.example` 复制为 `.env.local`，填入 CloudBase 控制台生成的 publishable key，然后重新启动或构建：

```bash
cp .env.example .env.local
npm run dev
```

`VITE_CLOUDBASE_PUBLISHABLE_KEY` 是 Web 客户端配置项，不要把 API secret、数据库凭据或其他服务端密钥填入前端环境变量。注册和重置密码会通过 CloudBase 邮箱验证码完成。

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

## GitHub 自动部署到 CloudBase

仓库中的 `.github/workflows/deploy-cloudbase.yml` 会在 `master` 分支收到推送后自动执行构建，并将 `dist/` 安全发布到 CloudBase 的 `/wordLearning/` 路径。GitHub Pages 和 CloudBase 会并行更新。

首次使用前，在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 添加以下 Secrets：

- `TCB_SECRET_ID`：仅供 GitHub Actions 登录 CloudBase CLI
- `TCB_SECRET_KEY`：仅供 GitHub Actions 登录 CloudBase CLI
- `CLOUDBASE_PUBLISHABLE_KEY`：前端 CloudBase Web 认证所需的 publishable key

这些值不会写入仓库。前两个是部署凭据，最后一个会随前端构建进入浏览器代码，不要将任何数据库密码、AI API Key 或其他服务端 Secret 填入其中。完成配置后，日常只需提交并推送：

```bash
git add -A
git commit -m "描述本次修改"
git push origin master
```

密钥检查或构建失败时 workflow 会在上传前停止；CloudBase 发布使用 `--safe`，并在上传后通过线上首页和当前哈希资源做公开访问校验，不会执行 `--prune`，不会删除 CloudBase 上其他路径的文件。

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

底栏“日报”按需生成 1 篇权威媒体原文节选，标注标题、发布媒体、发布日期、来源链接与独立的 AI 学习提示。提示词位于 `src/api/daily.ts`：选取近三年（按北京时间日期计算，包含起止日）的素材，学习价值优先，不限定当天或当月，从人民网、光明网和半月谈筛选适合逻辑填空的连续文段。搜索引用只能证明该链接出现在本次搜索结果中，正文与日期的逐字核对仍依赖模型执行提示词，可点击来源自行复核。

在“个人 → 右上角设置 → 模型与 API”配置模型。DeepSeek 官方地址 `https://api.deepseek.com` 自动使用 `/anthropic/v1/messages` 与 `web_search_20250305` 服务端搜索工具，复用已保存的模型和 Key；其他服务商仍使用 Responses API + web_search。普通 Chat Completions 连通测试不代表联网能力可用。

点按划线词语，学习卡片从底栏日报选中框展开至半屏，背景渐变模糊；关闭时沿原路径收回。查询调用原学习模块，优先复用缓存并更新记录，支持收藏、相关词查询和主动重新生成。支持减少动态效果的系统偏好。

DeepSeek 搜索适配依据[官方 Anthropic 兼容文档](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)和[官方 Harness 搜索实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/web-search-deepseek/src/provider.ts)。Responses 文档中的内置工具限制不能直接等同于所有接口均无搜索能力。日报解析 `web_search_tool_result` 中的结果链接，仍校验媒体域名、日期与划线词；没有真实搜索结果时不保存，也不从模型正文中提取链接冒充搜索证据。搜索暂停可携带完整上下文续推，最多三次请求；保留当前模型与深度思考设置。实际可用性以当前模型的服务端响应为准，模拟测试不代表账户联调成功。

日报自动保存到当前浏览器，历史可重复学习，切换页面不中断生成。刷新或关闭应用会中断尚未完成的请求。设置里的备份导入导出包含日报，清空所有缓存也会清空日报；历史查询清理不会删除日报。

验证：`node --test tests/daily.test.mjs tests/daily-store.test.mjs tests/output-budget.test.mjs`，以及 `npm run build`。测试使用模拟响应，不消耗实际 API 额度。

## 模型配置与移动端修复

个人页支持保存多套 OpenAI Chat Completions 兼容配置：填写 API URL 和 Key，获取模型后选择（或手动填写），测试并保存启用。URL 可以包含 `/v1` 或完整 `/chat/completions` 路径。服务商需允许浏览器跨域访问。密钥保存在本机浏览器，并发送到所填 API 地址，不包含在学习数据导出中。

页面采用 hash 路由，避免静态托管访问 `/learn` 时返回 404。学习和对比的请求由 Pinia 管理，切换应用内页面继续生成，输入状态保留；关闭浏览器或刷新页面不在此保障范围内。PWA 更新在下次打开时生效，避免更新强制刷新中断请求。

浏览器 smoke 推荐运行 `npm run test:browser`；运行器会自行启动测试服务并管理浏览器环境。如只需运行单项 smoke，使用 `node tests/run-browser.mjs <名称>`（名称省略 `.mjs`，例如 `node tests/run-browser.mjs provider-smoke`）。完整测试入口与维护约定见 `tests/README.md`。

## 生成长度与完整性

单词查询的基础输出额度为 4096 tokens；2–5 词对比按词数从 4096 增至 7168。当前官方 DeepSeek 思考模型另预留 32768 tokens，避免推理过程挤占正文额度，不关闭思考或降低思考强度。额度是上限，并不要求模型写满；原有详细解释、出处、例句、用法及辨析要求保持不变。

当接口明确返回 `finish_reason: length`，保留原模型与提示词，自动扩大额度完整重生成一次（最高 65536 tokens）。不拼接截断 JSON、不删减内容，也不缓存未完成输出。仅在服务商明确拒绝 `max_tokens` 参数或额度时，额外尝试一次服务商默认额度；认证、限流和上下文超限等错误不自动重试。自动重生成可能增加等待时间和实际 token 消耗；服务商自身的输出限制仍可能导致失败。

运行 `node --test tests/output-budget.test.mjs` 可验证额度、有限重试、兼容处理和完整性校验，使用模拟 API，不需要真实密钥。浏览器缓存保护可单独运行 `node tests/run-browser.mjs output-budget-browser`；完整浏览器 smoke 推荐统一执行 `npm run test:browser`。

## 日报文章读取服务

人民日报等媒体未开放浏览器跨域读取，Jina Reader 也可能拒绝相关域名。链接解析只读取用户指定的网址，再用现有模型解析，不调用搜索工具。

| 前端配置 | 网址 | 读取顺序 |
| --- | --- | --- |
| 未设置 `VITE_ARTICLE_READER_URL` | `people.com.cn`、`gmw.cn`、`banyuetan.org` 本域及子域 | 同源 `<BASE_URL>api/article-reader`（Node） |
| 未设置 | 其他通过 `articleLink` 校验的网址 | 原站 direct fetch；失败、非 HTML 或正文提取失败后使用现有 Jina `https://r.jina.ai/<url>` |
| 已设置 | 所有通过 `articleLink` 校验的网址 | 仅配置的 reader（静态部署使用 Worker） |

reader 路径失败直接报错，不会再尝试 direct fetch/Jina，也不会调用模型。direct fetch 最多等待 8 秒；用户取消不会触发 Jina 回退。

- 本机开发：`npm run dev` 自动提供读取接口。
- 本机生产预览：`npm run build` 后执行 `npm run serve`，打开 `http://127.0.0.1:4173/wordLearning/`。`npm run preview` 也已接入读取接口。
- 服务器部署：部署 `dist/`、`server/`、`package.json`，使用 Node.js 20+ 执行 `npm run serve`，由 HTTPS 反向代理转发应用与 API。可用 `HOST`、`PORT` 修改监听地址。
- GitHub Pages 只托管静态文件，**不会运行此服务**。仓库内提供了 Cloudflare Worker。在 GitHub 仓库 `Settings → Secrets and variables → Actions → Secrets` 添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，运行 `Deploy article reader` workflow；然后在同页 `Variables` 新建 `ARTICLE_READER_URL`，值为部署日志中的 `https://...workers.dev/api/article-reader`。再次运行 Pages workflow 后，前端会连接这个接口。也可以在本机执行 `npm run worker:deploy`。Worker 的浏览器 Origin 白名单是现有 GitHub Pages 和 CloudBase 静态托管域名；无 Origin 的请求也接受，因此 CORS 不是调用鉴权。不接收或保存模型 API Key。

#### Node 与 Worker 的不同职责及安全边界

这不是需要统一的允许列表：提交 `f7a812b` 在增加 Worker 时，同时将前端配置 reader 的分支改为覆盖所有链接，并测试普通公开域名。Node 保留三家媒体的窄列表，Worker 支持用户输入的其他文章；将两者合并会扩大本机服务访问范围或破坏静态站点的链接解析。

- **Node**：仅允许 `people.com.cn`、`gmw.cn`、`banyuetan.org` 本域和以点分隔的子域；`people.com.cn.evil.com`、`evilpeople.com.cn` 均拒绝。
- **Worker**：允许符合当前域名语法的多段 hostname（末段至少两个英文字母），排除 `.local`、`.localhost`、`.internal`、`.test`、`.invalid` 后缀，拒绝 IP 字面量（包括 URL 标准化后的数字/十六进制 IPv4）及单段主机名。普通域名 `news.example.com` 允许；`people.com.cn.evil.com` 也按普通域名处理，**不代表被认定为人民网**。
- 两者均只接受 HTTP/HTTPS、无账号密码、无非默认端口、路径不为 `/` 的 URL，去掉 hash；显式默认端口会被 URL 标准化后接受。每一跳重定向都使用各自相同规则，最多发出 4 次请求。前端 `articleLink` 使用类似 Worker 的域名规则，但允许根路径；根路径交给 reader 时仍会被拒绝。
- Node 读取超时为 15 秒，按流累计原始字节并在超过 2 MiB 时取消；Worker 先检查 Content-Length，再完整读取文本并检查 UTF-8 编码后是否超过 2 MiB，**不是流式内存上限**，也没有代码层显式超时。这些既有差异此次保持不变。
- 域名规则是 URL 层防护，未执行 DNS 解析结果的私网 IP 校验，不能宣称覆盖 DNS 重绑定或所有内网别名。不得将 Worker 的宽域名规则搬到 Node，也不得把 CORS 当成 SSRF 防护。两端不转发模型 Key 或浏览器 Cookie。
- Worker 允许的 Origin 为 `https://shawnylin.github.io` 和 `https://cooh-d1gj7cmvs2469a250-1351557942.tcloudbaseapp.com`；带其他 Origin 返回 403，无 Origin 接受。Node 的 `ARTICLE_READER_ORIGIN` 仅控制 CORS 响应头，不是请求鉴权。

离线回归（全部 mock，不请求原站或真实模型）：

```bash
node --import ./tests/helpers/no-network.mjs --test tests/article-reader.test.mjs tests/worker-reader.test.mjs tests/article-reader-policy.test.mjs tests/daily-link.test.mjs
npm test
npm run build
```

### PDF 日报导入与学习进度

在“每日精读 → 生成日报 → PDF 日报导入”中选择人民日报电子版下载的文字版 PDF，核对本机提取结果与 token 预算，再开始分篇。预览确认后，每篇文章分别保存到历史；正文顶部显示完整原标题，历史使用模型生成的短标题。读完后可标记“已学完”，也能添加星标、左滑删除或撤销状态。现有 AI 生成与链接解析继续提供精读节选，阅读页统一采用文章排版。

- PDF.js 在浏览器本机提取文字，PDF 二进制不会发送至模型。原文、编号与版面坐标发往用户配置的解析 API；文档中的指令仅作数据处理。
- 模型仅返回标题/段落行号、历史短标题与少量查词词语，程序用源文重建全文并去除中文排版空格。无标题续文必须明确指向此前文章，程序会接到原文末尾；归属不明、编号无效/重复或输出截断时均不保存。未分配的行作为其他版面文字保存。
- “个人 → 模型与 API → PDF 解析模型”可单独配置 URL、Key、模型，获取模型列表及测试连接。查词继续使用学习模型；也可显式勾选让 PDF 复用学习模型。MiMo 官方接口按其[Chat Completions 文档](https://mimo.mi.com/docs/zh-CN/api/chat/openai-api)使用 `max_completion_tokens`，分篇关闭思考模式，不硬编码当前模型或价格。
- 每批保守输入估算上限约 22,000 tokens，输出预算 2,048–8,192 tokens。优先保留整页；超限按原文行分批。按页串行，单批超时 180 秒，不自动付费重试。未提供 token 用量的响应标注为估算。取消/失败保留当前页面内已完成批次，重试跳过这些批次；去设置页再返回仍保留草稿。刷新或关闭应用前应保存日报或导出 TXT。
- 相同 PDF 的 SHA-256 指纹防止重复导入。保存成功前先确认本机存储写入成功，存储不足时保留预览并提供 TXT 导出。
- 限制：单次 50 MB / 32 页 / 25 万字符。暂不支持扫描件 OCR；没有文字层的页会明确报错。仅还原上传版面的文字，不包含照片图像，也不会补写 PDF 中缺失的续篇。多栏分篇需要用户对照 PDF 核对。
- PDF worker 随站点构建、纳入 PWA 缓存，不依赖第三方 worker CDN；仍保留用户确认更新的 PWA 流程。

验证：`npm test` 包含 PDF 原文还原、分批预算、计费与失败重试、模型路由、进度/备份和存储失败保护。参考 PDF 的 222 行、6,775 个提取字符（含排版空格）可一次分篇，保守输入估算约 17,066 tokens、输出预算上限 4,064 tokens。参考样本的人工编号验收覆盖 3 篇正文与其他版面文字；这不等同于真实服务商模型分篇质量验收。

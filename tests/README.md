# 测试入口与维护约定

## 推荐命令

要求 Node.js 22 或更新版本，先执行 `npm ci`。无需真实 API Key。

| 命令 | 范围 | 是否作为 CI 门禁 |
| --- | --- | --- |
| `npm test` | 所有 Node 行为测试与源码结构测试 | 是，由 check 调用 |
| `npm run test:unit` | 单元、store 行为和 mock API 测试 | 包含于 check |
| `npm run test:structure` | 源码结构约束 | 包含于 check |
| `npm run typecheck` | Vue/TypeScript 类型检查 | 包含于 check |
| `npm run check` | 类型检查 + npm test；不启动浏览器、不构建产物 | 是 |
| `npm run build` | 生产构建、PWA 构建 | 独立 CI 步骤 |
| `npm run test:browser` | 7 个当前支持的浏览器 smoke 脚本 | 否，按需执行 |
| `npm run test:browser:legacy` | 保留的旧流程/动画诊断脚本，存在已知失败和本机夹具要求 | 否 |
| `npm run test:visual:baseline` | 改动前采集截图和计算样式 | 否 |
| `npm run test:visual` | 改动后采集并比较计算样式/几何 | 否 |

日常修改优先 `npm run check`；交付前加 `npm run build`。用户明确要求单独执行 npm test 时照做，否则 check 已包含它，不必重复。影响页面交互时加 browser smoke；影响 CSS 时在修改前采集 visual baseline，修改后运行 visual 并审阅 PNG。达到所需检查后停止，不为增加次数或覆盖率反复执行。

首次运行浏览器：

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

默认使用锁定版本的 Playwright Chromium。Windows 若已安装 Edge，可在 PowerShell 显式选择：

```powershell
$env:BROWSER_CHANNEL = 'msedge'
npm run test:browser
```

WebKit 可通过 `BROWSER_ENGINE=webkit` 选择，需另行安装对应浏览器；不代表已在真实 iPad 验收。无需 `CODEX_NODE_MODULES`、预先启动 Vite 或使用个人下载目录。运行器使用可用的 loopback 端口，并将实际 URL 传给各脚本；不会复用正在运行的开发服务。

单独运行一项：`node tests/run-browser.mjs provider-smoke`，名称省略 `.mjs`。应通过运行器启动，以获得测试环境、超时和退出清理；直接执行脚本时需要自己提供本地服务与 `TEST_BASE_URL`。

## Node 测试盘点

| 文件 | 分类 | 主要保护内容 |
| --- | --- | --- |
| `api-vault.test.mjs` | 行为 | 加密/解密、错误口令、账户绑定、篡改校验 |
| `app-update-behavior.test.mjs` | 行为 | 已有更新提示、无更新完成、前台检查节流 |
| `app-update.test.mjs` | 源码结构 | PWA prompt 注册、更新 UI、SW 桥接、禁止清空用户数据 |
| `article-reader.test.mjs` | 行为/mock | URL 校验、重定向、响应类型/大小、凭据不转发 |
| `worker-reader.test.mjs` | 行为/mock | Worker 来源限制、读取响应、CORS |
| `cloud-sync-decision.test.mjs` | 行为 | 同步决策持久化、状态清洗、存储失败、重试调度 |
| `cloud-sync-merge.test.mjs` | 行为 | 多端合并、字段冲突、幂等性、不修改输入、原文保留 |
| `daily.test.mjs` | 行为/mock | 搜索证据、来源和日期、流式解析、续传、取消/鉴权错误 |
| `daily-link.test.mjs` | 行为/mock | 链接读取、原文约束、错误区分、取消、不额外搜索 |
| `daily-store.test.mjs` | store 行为 | 缓存、先持久化再成功、容量不足、用量、历史分组 |
| `pdf-daily.test.mjs` | 行为/mock/store | PDF 文本/分栏、批次、原文完整性、恢复策略、备份和独立模型 |
| `providers.test.mjs` | 行为 | DeepSeek/MiMo/兼容服务商能力与参数区别 |
| `output-budget.test.mjs` | 行为/mock | 输出长度恢复、有界重试、质量完整性、流式输出 |
| `morph-overlay.test.mjs` | 行为 | 异步打开竞态、中断、过期回调、reduced motion、焦点、取消、卸载/停用 |

`run-node.mjs` 自动发现顶层 `*.test.mjs`。现有 `app-update.test.mjs` 保持文件名；新结构测试使用 `*.structure.test.mjs`，其余默认为行为测试。两类都属于 npm test，不会因为单独分类被漏跑。通过 Node preload 禁止未 mock 的 fetch；测试显式替换 fetch 后才可调用 API 适配器。

源码字符串匹配不能证明运行行为。新增结构断言仅用于明确的构建/安全契约，业务行为优先测试公开函数、真实 store 状态变化和用户交互。不要复制实现写同义断言。

## 浏览器 smoke

| 文件 | 保护内容 |
| --- | --- |
| `network-isolation.mjs` | 未 mock 的外部 API、本地文章代理确实被拦截；显式 mock 可到达；本地哨兵收到 0 请求 |
| `settings-sync-ui.mjs` | 同步 UI、多端数据状态、密文上传、错误口令、忘记设备；窄屏及桌面弹层 |
| `api-vault-browser.mjs` | 独立浏览器上下文恢复、账户隔离、密钥轮换、PDF/朗读配置传播 |
| `provider-smoke.mjs` | 空 Key 校验、mock 模型发现、保存/编辑、学习/PDF 独立选择、刷新恢复 |
| `daily-smoke.mjs` | 日报切换、分组改名/移动、刷新持久化、删除及原文不变 |
| `output-budget-browser.mjs` | SSE mock 截断自动恢复、错误反馈、保留已有缓存、不缓存残缺内容 |
| `morph-overlay-browser.mjs` | 两处弹层几何/时长、中断重开、Tab/Escape、焦点、reduced motion、路由离开 |

浏览器启动器使用独立上下文，禁用 Service Worker，允许本地静态模块资源；其余未 mock 的请求返回 501，不转发本地文章读取代理。远端 WebSocket 同样禁止。页面里的 `page.route` 夹具提供业务响应，不调用真实模型。测试 Vite 禁用 `.env` 文件，覆盖 CloudBase 配置为占位测试值；数据库返回由用例在浏览器内 mock。不得引入真实账户、Key、付费请求或 `route.continue()` 转发到真实 API。

运行器逐项执行，每项最长 90 秒，失败仍保留非零退出码并清理浏览器与测试服务器。失败时尽可能保存截图/可见文本到 `docs/.local/browser-artifacts/`；已在 finally 中关闭页面的旧脚本可能没有失败截图。

## 保留的诊断与 visual 脚本

这些脚本未删除、未改成跳过断言，也未加入 check。它们统一接入安全的浏览器启动器，后续修复应更新过时夹具/选择器，或另开任务修业务问题，不能为了变绿降低断言。

| 文件 | 当前用途/限制 |
| --- | --- |
| `browser.mjs` | 旧综合流程与截图；直接 API Key 设置入口等选择器已过时 |
| `motion.mjs` | 动画中间帧截图；旧“搜索”按钮、独立对比页等流程待更新 |
| `settings-browser.mjs` | 旧设置/余额/语音综合流程；旧朗读设置入口待更新 |
| `daily-polish.mjs` | 日报细节、滑动删除、真实 PDF 提取；星标断言过时，需显式 `TEST_PDF_PATH` 指向本地测试 PDF |
| `compare-layout.mjs` | 320/393/430/768px 长词、多词、记录展开；存在已复现的横向溢出断言失败 |
| `generation-center.mjs` | 展开过程中心位置采样；存在已复现的中间帧断言失败 |
| `theme-transitions.mjs` | 主题/路由/删除过渡与截图；旧界面定位方式尚未重新验证 |
| `css-visual.mjs` | 320/393/820/1440px，36 个页面/弹层状态；需要同机器、浏览器、字体和有效前置基线 |

旧 `tests/*.png` 保留为历史人工查看材料，不是自动加载的黄金截图。脚本产生的新截图放到忽略目录，不覆盖这些历史图片。visual 当前自动比较计算样式与几何，PNG 仍需人工或独立像素比对；不能把“截了图”写成“像素验证通过”。不要在代码改完后覆盖 baseline 来消除差异。

## CI 边界

`.github/workflows/check.yml` 在 PR、master push 或手动触发时运行 Node 22、npm ci、check 和 build，无 Secrets、无浏览器安装、无真实云端请求。GitHub Pages 与 CloudBase 部署工作流也会在各自的生产 build 前执行 `npm run check`，因此类型检查或 Node 测试失败会直接阻止同一 deployment job 后续 build/deploy。独立检查工作流不会自动成为仓库分支保护规则，是否设为 required check 由仓库管理员决定。

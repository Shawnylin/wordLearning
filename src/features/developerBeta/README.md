# Developer Beta UI

入口：个人页底部「当前版本」连续点击五次（每两次间隔不超过 900ms）。
顶部不添加版本号。默认关闭；启用后仅保存独立的本地布尔设置。

## 隔离边界

- `index.ts` 注册隐藏路由、恢复设置、监听跨标签切换并负责卸载。
- `state.ts` 用 `theme.css?inline` 懒加载 CSS 文本；关闭时同步删除 style 元素和 html 属性。并发加载用 revision 作废，关闭后旧请求不会重新启用。
- `theme.css` 每条选择器限定 `html[data-developer-beta]`，覆盖 body 中 Teleport 弹层；原样式文件和业务组件不改动。
- `VersionEntry.vue` 保持底部版本文字和排版，仅替换为可键盘操作的点击入口。
- `DeveloperView.vue`、`LiquidToggle.vue` 仅隐藏页面使用，样式均 scoped。
- 不读取或修改学习记录、API 配置或主题 store。关闭后仍保留用户原来的主题选择。
- 隐藏入口不是鉴权机制；这里只放外观实验，不能放密钥或特权操作。

## Bencho 对应关系

参考 https://bencho.dev/ 的交互设计，用 Vue/CSS 实现本项目适配，未引入其 React/framer-motion 运行时，未复制网站打包源码。

| Bencho block | 本项目适配 |
| --- | --- |
| Liquid toggle | 实验开关和个人/设置中的已有胶囊开关，按压伸缩、回弹 |
| Icon bar / Magnifying dock | 原主导航，悬停放大相邻图标、选中滑块 |
| Magnetic select | 主题颜色、分段选项，按压和选中反馈 |
| Search / Command bar | 学习、记录搜索框及输入控件 |
| Create menu | 日报生成弹层和操作项 |
| Selection list | 历史列表、选中状态和复选框 |
| Progress ticks | 复习进度条 |

通用卡片、阅读区域、设置、模型表单、记录弹层采用同一中性圆角视觉。
保留原有行转卡片、拖动、翻牌、确认删除和导航交互，避免重复实现业务。
未套用逃跑按钮等不适合学习工具的演示效果。网站代码复制未获得可用源码，因此这里是设计/交互适配，不声称逐组件原样移植。

## 完整删除（仅两个外部接入文件）

1. `src/main.ts` 删除 `installDeveloperBeta` 的 import 和调用。
2. `src/views/ProfileSettingsView.vue` 删除 `VersionEntry` import，将 `<VersionEntry />` 恢复为：
   `<p class="text-xs text-ink-mute">当前版本 v{{ appUpdate.currentVersion }}</p>`。
3. 删除整个 `src/features/developerBeta/` 目录。遗留 localStorage 键 `word-learning-developer-beta-ui` 不被其他代码读取，可选清除；不要清理其他存储。

## 最小手动验收（构建外未自动执行）

1. 个人页底部版本连点四次不跳转，第五次进入实验室；停顿超过 900ms 后重新计数；顶部没有版本号。
2. 打开开关，进入学习、对比、日报、记录、个人；输入、导航、弹层仍可操作。刷新后保持 Beta。
3. 分别在浅色/深色及窄屏/平板下确认导航、列表和弹层；系统减少动态效果时应取消新增动效。
4. 再次从底部五连击进入并关闭，原主题/界面恢复；刷新后仍关闭，学习记录不变。
5. 注意：真实生成消耗 API 用量，验收外观无需发起生成。这里未修改 PWA 更新策略，线上页面需发布并通过原更新流程加载新版本。

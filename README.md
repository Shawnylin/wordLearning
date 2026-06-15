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
- **AI 模型**：DeepSeek v4.0-flash

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

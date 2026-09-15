export interface ChangelogRelease {
  version: string
  date: string
  title: string
  changes: string[]
}

// 版本规则：新功能或较大调整提升次版本号，小修复提升修订号。
// 每次修改 package.json 版本时，必须同时在数组顶部添加用户可读的更新内容。
export const changelog: ChangelogRelease[] = [
  {
    version: '0.2.1',
    date: '2026-09-15',
    title: '界面细节与应用更新体验优化',
    changes: [
      '修复网页端和 iPad 端检查到新版本后无法完成更新的问题。',
      '优化 iPad 侧边栏收起后的选中样式，并重新整理个人页卡片排布。',
      '修正主题模式和深度思考开关中圆形滑块的位置。',
      '缩小个人页底部版本号与卡片之间的空隙。'
    ]
  },
  {
    version: '0.2.0',
    date: '2026-09-14',
    title: '学习体验与应用能力升级',
    changes: [
      '加入应用内更新检查和新版本提示。',
      '完善个人页的模型设置、Token 统计和 API 余额信息。',
      '优化学习、日报、记录等页面的使用体验。'
    ]
  }
]

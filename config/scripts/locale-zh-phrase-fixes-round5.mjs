// Chinese phrase fixes from high-visibility UI audit round 5.
export const ZH_PHRASE_FIXES_ROUND5 = [
  { pattern: /Orca集成开发环境/g, replacement: 'Orca IDE', whenEnIncludes: 'Orca IDE' },
  { pattern: /Girra第一/g, replacement: 'Girra 优先', whenEnIncludes: 'Girra first' },
  { pattern: /Girra移动/g, replacement: 'Girra Mobile', whenEnIncludes: 'Girra Mobile' },
  { pattern: /Girra标志/g, replacement: 'Girra 标志', whenEnIncludes: 'Girra logo' },
  { pattern: /喜欢Girra/g, replacement: '喜欢 Girra', whenEnIncludes: 'Enjoying Girra' },
  { pattern: /认识Girra/g, replacement: '了解 Girra', whenEnIncludes: 'Get to know Girra' },
  { pattern: /支持Orca/g, replacement: '支持 Orca', whenEnIncludes: 'Support Orca' },
  { pattern: /展开Girra/g, replacement: '展开 Girra', whenEnIncludes: 'Expand Girra' },
  { pattern: /来自Girra/g, replacement: '来自 Girra', whenEnIncludes: 'from Girra' },
  {
    pattern: /正在重新启动Girra/g,
    replacement: '正在重启 Girra',
    whenEnIncludes: 'Restarting Girra'
  },
  { pattern: /Girra([\u4e00-\u9fff])/g, replacement: 'Girra $1', whenEnIncludes: 'Girra' },
  { pattern: /Linear([\u4e00-\u9fff])/g, replacement: 'Linear $1', whenEnIncludes: 'Linear' },
  { pattern: /Codex([\u4e00-\u9fff])/g, replacement: 'Codex $1', whenEnIncludes: 'Codex' },
  { pattern: /Claude([\u4e00-\u9fff])/g, replacement: 'Claude $1', whenEnIncludes: 'Claude' },
  { pattern: /Claude代码/g, replacement: 'Claude Code', whenEnIncludes: 'Claude Code' },
  { pattern: /GitHub 和Linear/g, replacement: 'GitHub 和 Linear', whenEnIncludes: 'Linear tasks' },
  { pattern: /托管审阅/g, replacement: '托管评审', whenEnIncludes: 'hosted-review' },
  { pattern: /托管审阅/g, replacement: '托管评审', whenEnIncludes: 'Hosted-review' },
  { pattern: /审阅笔记/g, replacement: '评审笔记', whenEnIncludes: 'review note' },
  { pattern: /审阅任务/g, replacement: '评审任务', whenEnIncludes: 'review task' },
  { pattern: /待审阅/g, replacement: '待评审', whenEnIncludes: 'need review' },
  { pattern: /重新审核/g, replacement: '重新评审', whenEnIncludes: 'Re-review' },
  { pattern: /依赖项审核/g, replacement: '依赖项审计', whenEnIncludes: 'dependency audit' },
  { pattern: /Git AI 作者/g, replacement: 'Git AI Author', whenEnIncludes: 'Git AI Author' },
  { pattern: /基本引用/g, replacement: '基础引用', whenEnIncludes: 'base ref' },
  { pattern: /重新开放PR/g, replacement: '重新打开 PR', whenEnIncludes: 'Reopen PR' },
  { pattern: /重新开放/g, replacement: '重新打开', whenEnIncludes: 'reopen' },
  { pattern: /受限制的钥匙/g, replacement: '受限制的密钥', whenEnIncludes: 'restricted keys' },
  { pattern: /更换钥匙/g, replacement: '更换密钥', whenEnIncludes: 'Replace key' },
  {
    pattern: /根据所看到的内容采取行动/g,
    replacement: '根据所看到的内容执行操作',
    whenEnIncludes: 'act on what they see'
  },
  {
    pattern: /建议下一步行动/g,
    replacement: '建议下一步操作',
    whenEnIncludes: 'suggest next actions'
  },
  {
    pattern: /可操作的问题/g,
    replacement: '需处理的问题',
    whenEnIncludes: 'actionable issues'
  },
  {
    pattern: /显示 Girra 移动按钮/g,
    replacement: '显示 Girra Mobile 按钮',
    whenEnIncludes: 'Show Girra Mobile Button'
  }
]

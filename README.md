# report-skills

让 AI agent 写出一眼能看懂的汇报：先结论后细节的中文写法、选格式和画图规则、统一的 HTML 页面样式与组件。

## 两个 skill

| skill | 管什么 | 什么时候触发 |
|---|---|---|
| `report-explain` | **讲什么、怎么讲：** 选格式、扫读版简明中文、汇报格式（进度、阻塞、决策、事故、验收）、画图规则、页面结构、结尾的决策和核对项 | agent 要汇报、讲解、做对比、请人拍板时 |
| `report-page-style` | **长什么样：** 共用样式（深浅两套主题）、13 种组件的模板、分步播放脚本、内联成单文件的工具 | `report-explain` 决定要出 HTML 页面后 |

## 结构

```
skills/
├── report-explain/
│   ├── SKILL.md              核心规则，触发后必读
│   └── references/           按需读取，用到哪份读哪份
│       ├── writing.md        中文写法
│       ├── reports.md        汇报类型
│       ├── figures.md        画图
│       ├── motion.md         动画（扩展项，不默认）
│       ├── pages.md          页面结构与布局
│       └── sources.md        每条规则的来源和取舍（维护时读）
└── report-page-style/
    ├── SKILL.md              用法、视觉规则、组件速查
    └── assets/
        ├── template.src.html 组件模板
        ├── base.css          共用样式（由工具嵌入，不进上下文）
        ├── stepper.js        分步播放（同上）
        └── inline.mjs        把样式和脚本嵌成单文件 HTML
```

## 安装

**Claude Code：** 把 `skills/` 下的两个目录复制到项目的 `.claude/skills/`，或个人目录 `~/.claude/skills/`。会话开始时自动识别，也可以输入 `/report-explain` 手动触发。

**Codex 和其他读 `AGENTS.md` 的 agent：** 把两个目录放进项目，在项目根目录的 `AGENTS.md` 里写：

```markdown
给人汇报、讲解或请人拍板时，先读 `<路径>/report-explain/SKILL.md`，再按它第一张表只读需要的 references 文件。
出 HTML 页面时再读 `<路径>/report-page-style/SKILL.md`，从它的模板开始。交付前过一遍核心规则的自检。
```

**内联工具需要 Node.js 18 或更高版本：**

```bash
node skills/report-page-style/assets/inline.mjs _reports/页面.src.html
```

## 大小

数字是估算的 token 数（中文约 1 字 1 个，其他约 4 字符 1 个）。

| 部分 | 何时加载 | 约 |
|---|---|---|
| 两个 skill 的描述 | 每个会话都加载 | 280 |
| `report-explain` 核心 | 触发时 | 1,300 |
| `report-explain` 全部细则 | 按需，单份 700–1,400 | 6,900 |
| `report-page-style` 说明 | 出页面时 | 1,000 |
| 模板 | 出页面时 | 1,700 |
| 样式、脚本、工具 | 不进上下文 | 0 |

## 来源

规则整合自以下 MIT 许可的项目，并按实际使用反馈改写。每条规则的出处和取舍记录在 `skills/report-explain/references/sources.md`。

- [understanding-ladder](https://github.com/ChangWenC/understanding-ladder)（含 plain-chinese）
- [visual-explainer](https://github.com/nicobailon/visual-explainer) 0.14.0
- [agent-html-skills](https://github.com/f-labs-io/agent-html-skills) 1.4.0

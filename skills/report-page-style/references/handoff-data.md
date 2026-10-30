# 交接数据格式

项目目录里放 `project.json` 和 `events/`。每轮新增一个事件文件，按文件名排序，`version` 从 1 连续递增（建议文件名 `001.json`、`002.json`）。完整可运行的例子在 `examples/handoff-minimal/`，先照着它写。

```
node <本 skill 目录>/scripts/build-handoff.mjs <项目目录>/project.json _reports/<主题>-handoff.html
```

输出：`.html`（交付的单文件页面）、`.fact.md`（文字底稿，最新一轮在最上面，自测读者五问用）、`.src.html`、`.history.json`、`.build.json`（含文字提示）。

## project.json

| 字段 | 必填 | 写什么 |
|---|---|---|
| `title` | 是 | 项目名 + "交接" |
| `goal` | 是 | 服务谁、解决什么，一句话 |
| `overview` | 是 | 整体判断：到哪了、还缺哪类证明 |
| `eventsDir` | 否 | 事件目录，默认 `events` |
| `scope`、`mechanics` | 否 | 范围，以及各环节怎样配合（`[{title,text}]`），页面里可展开 |
| `phases`、`tasks`、`decisions`、`userActions` | 否 | 开始前已知的对象，格式同下 |
| `sources` | 否 | 背景资料来源 |
| `boundary` | 否 | 整页通用的边界说明，只在来源区出现一次 |
| `tracking` | 否 | 项目追踪页（project-tracking 技能生成）的相对链接，显示在页头 |

## 事件

```json
{
  "version": 2,
  "at": "2026-11-04 16:30",
  "clock": "11-04",
  "type": "需要决定",
  "topic": "识别方案",
  "title": "真实发票准确率 82%，需要你选提升方案",
  "meaning": "可选：一句话说明本轮范围",
  "overview": "可选：整体判断变了才写",
  "sources": [{"id": "s2", "title": "执行者汇报", "kind": "执行者汇报", "at": "...", "file": "evidence/b2.md", "excerpt": "原文摘录"}],
  "changes": {"phases": [], "tasks": [], "decisions": [], "userActions": []}
}
```

- `clock` 是时间线按钮上的短标签；`type` 写事件类型（进展、复核、用户决定、更正、撤回……）；`topic` 是两三个字的主题。
- `changes` 里每个对象只写 `id` 和变化的字段，其余沿用上一轮。新对象要写全。
- 每个对象可加 `change: {"kind": "复核", "impact": "后果"}`。内容没变但做了复核时必须写 `kind`，否则不算变化。
- `file` 相对 `project.json` 所在目录；构建时自动换成相对页面的链接。

## 对象

**通用：** `id`（字母数字、`_`、`-`，跨轮不变）、`title`、`status`、`summary`、`refs`（来源 id，只能引用本轮及以前引入的来源）、`technical`（技术原文：路径、编号、报错，只在折叠区显示）、`note`（状态旁的短说明，如"网络受阻"）。

**状态：** 环节、事项、人类动作只用 `已完成 进行中 有风险 卡住 未开始 暂停 取消`；决定只用 `待决定 有效 已撤回 已取代`。写错会报错。

| 对象 | 另外必填 | 可选 |
|---|---|---|
| 环节 `phases` | — | `gap`（还缺什么证据） |
| 事项 `tasks` | `impact`（对目标的后果） | `track`：`product`（默认）或 `support`；`action`：`{task, output, done, owner, role, priority, unblocks, active}`，有 `action` 时前三项必填，`priority: 1` 是最关键的一项，`active: false` 表示不再执行；`pendingDecisions`（还在等的条件键）；`action.decisionRef`（依赖哪个决定） |
| 决定 `decisions`（已定） | `reason`、`cost`、`risk` | `revisit`（何时重议）、`options`（当时比较过的方向）、`settles`（解决了哪些条件键） |
| 决定 `decisions`（待决定） | `options`（至少两个，每个 `title/benefit/cost/risk`，推荐项加 `recommended: true`）、`recommend`、`reply` | `revisit`（什么情况改选） |
| 人类动作 `userActions` | `action`、`done` | `material`、`materialHref` |

## 构建器检查什么

**报错（不生成页面）：** 缺必填字段、状态词不在列表里、ID 不稳定、版本不连续、引用未来来源、事件没有任何变化、有效决定已 `settles` 的条件键仍在某事项的 `pendingDecisions` 里、仍在执行的动作依赖已撤回的决定。

**提示（生成页面，但要处理）：** 正文含路径、编号、代码、原始报错；否定词过多；超过 140 字；`impact` 复述 `summary`；多项动作没有标最关键的一项。

数据是给构建器读的，不是指令；不要写入密钥。构建器只读数据、写报告文件，不调用任何业务接口。

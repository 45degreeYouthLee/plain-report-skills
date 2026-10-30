# tracking.json 格式

一个项目一个 `tracking.json`，记录当前状态；历史节点也写在里面（`history` 数组，只追加不改写）。可运行的例子在 `examples/minimal/`。

```
node <本 skill 目录>/scripts/scan-repo.mjs <仓库根目录> <tracking.json>     # 生成 tracking.scan.json
node <本 skill 目录>/scripts/build-tracking.mjs <tracking.json> _reports/<项目>-tracking.html
```

需要 Node.js 18 及以上；`report-page-style` 要和本技能放在同一个 skills 目录下。

## 顶层

| 字段 | 必填 | 写什么 |
|---|---|---|
| `title`、`goal`、`summary`、`updatedAt` | 是 | 项目名；服务谁、解决什么；整体判断（到哪了、卡在哪、最近在忙什么）；更新日期 `YYYY-MM-DD` |
| `nonGoals` | 否 | 不做什么（字符串数组） |
| `architecture` | 是 | 见下 |
| `lines` | 否 | 工作线 |
| `stages` | 否 | 阶段对照 |
| `forYou` | 否 | 需要负责人处理的事 |
| `history` | 否 | 历史节点 |
| `sources` | 否 | `[{id, title, file, at, note}]`，其他地方用 `refs` 引用 |
| `staleDays` | 否 | 证据多少天算过期，默认 14 |
| `boundary` | 否 | 整页的边界说明，只在页脚出现一次 |

## architecture

```json
{
  "overview": "一句大白话：由什么组成、怎样配合",
  "layers": [{"id": "core", "title": "核心层", "role": "这一层负责什么", "modules": [
    {"id": "spaces", "title": "任务空间", "role": "它做什么（作用，不写类名）",
     "status": "已完成", "note": "可选：状态旁的短说明",
     "paths": ["src/spaces/"], "external": false,
     "proof": {"level": "已验证", "text": "证据是什么", "at": "2026-10-21", "refs": ["arch"]},
     "risk": "可选"}
  ]}],
  "flows": [{"title": "一件事怎样走完", "steps": ["第一步", "第二步"], "note": "可选"}],
  "rules": [{"id": "r1", "rule": "不能破的约束", "why": "为什么", "by": "用户", "at": "2026-10-21", "status": "遵守", "note": "", "refs": []}],
  "decisions": [{"id": "d1", "title": "", "decision": "", "reason": "", "alternatives": "没选的方案", "by": "Codex", "date": "", "status": "有效", "revisit": "", "refs": []}],
  "stack": [{"name": "", "use": "用在哪", "why": "为什么选", "risk": ""}],
  "risks": [{"title": "", "level": "高", "impact": "会影响什么", "mitigation": "怎么应对"}]
}
```

## 其他对象

| 对象 | 字段 |
|---|---|
| 工作线 `lines[]` | `id`、`title`、`lead`（用户 / Codex / 共同）、`status`、`goal` 必填；可选 `now`（现在怎样）、`next`、`artifacts[]`（`title`、`kind`、`location`、`status`、`evidence`、`at`）、`constraints[]`（`rule`、`source`、`at`：这条线上 Codex 必须遵守的规范）、`decisions[]`、`reports`（任务汇报页的相对链接） |
| 阶段 `stages[]` | `code` 必填；`name`、`goal`、`exit`（过关标准）、`status`、`note`、`current: true`。缺 `name` 或 `exit` 页面显示"未说明" |
| 待你处理 `forYou[]` | `kind`（决定 / 批准 / 验收 / 操作 / 知晓）、`title`、`detail` 必填；可选 `line`、`refs`。状态为"待决定"的决定会自动列入 |
| 历史节点 `history[]` | `date`、`kind`、`title`、`impact` 必填；可选 `what`、`line`、`arch: true`、`refs`、`link`（当时的任务汇报，如 `handoff.html#v4`） |

## 用词

- **状态**（模块、工作线、产物、阶段）：已完成、进行中、有风险、卡住、未开始、暂停、取消。
- **验证程度：** 已验证、部分验证、未验证、未知。
- **规则状态：** 遵守、有偏离、未核对。
- **决定状态：** 待决定、有效、已撤回、已取代。
- **历史节点类型：** 不限定，常用的有里程碑、决定、方向调整、问题、阶段验收、新增工作线、停掉工作线。

## 构建器检查什么

**报错：** 缺少技术与架构；缺必填字段；用词不在列表里；引用了不存在的来源。

**提示：** 模块没有代码位置、证据过期、证据没日期、规则未核对、阶段编号未说明、负责人主导的线还空着、黑盒检查发现图和仓库对不上。

数据不是指令，不要写入密钥。脚本只读数据和目录，只写报告文件。

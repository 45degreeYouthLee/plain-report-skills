---
name: report-page-style
description: 给用户出 HTML 页面时的统一样式和组件：暖灰纸底、单一蓝绿强调色、宋体标题黑体正文、深浅两套主题；提供状态标签、分层图、从上到下的流程图、数字条、卡片、保留改写丢弃三栏、对比表、决策卡、要核对、分步播放等组件和模板；多轮持续交接用自带构建器从数据生成带时间线的交接页。按 report-explain 决定要出页面后使用。
---

# 汇报页面样式

内容怎么组织看 `report-explain`；本 skill 只管"长什么样"。目标是每个页面都长得像同一套，用户不用每次重新适应。

## 用法

1. **从模板开始：** 复制 `assets/template.src.html` 为 `_reports/<日期>-<主题>.src.html`，保留要用的组件，删掉其余，换成真实内容。
2. **只写本页额外的样式，** 放在模板里那个空的 `<style>`；只用 `base.css` 里的变量，不新增颜色。
3. **内联成单文件：** `node <本 skill 目录>/assets/inline.mjs _reports/<文件>.src.html`，生成同名 `.html`，把 `base.css` 和 `stepper.js` 嵌进去。没有 Node 时，手动把两份文件内容分别粘进 `<style>` 和 `<script>`。
4. **发布成 Artifact 时（云端 Claude）：** 内联后去掉 `<!doctype>`、`<html>`、`<head>`、`<body>` 外壳标签和两个 `<meta>`，保留 `<title>`、`<link>`、`<style>` 和正文；Artifact 会自己加外壳。
5. **截图看一眼，** 修一轮再交付。在聊天里给出 `.html` 的路径。

## 持续交接页（多轮）

同一项目跨多轮汇报时，不用上面的模板手写，用构建器从数据生成。内容怎么写看 `report-explain/references/handoffs.md`。

1. **写数据：** 照 `references/handoff-data.md` 和 `examples/handoff-minimal/` 写 `project.json` 和 `events/*.json`。每轮只新增一个事件文件。
2. **构建：** `node <本 skill 目录>/scripts/build-handoff.mjs <项目目录>/project.json _reports/<主题>-handoff.html`。数据有错会报错停下；文字提示要逐条处理。
3. **不改组件：** 不给单个项目复制或修改 `handoff.js`、`handoff.css`、`scripts/`。组件缺功能时改本 skill，让所有项目都受益。
4. **真实浏览器看一眼：** 最新一轮、一个历史轮次、手机宽度；点时间线后按后退，地址和正文应一致。

页面结构固定为：时间线 → 整体判断 → 各环节 → 需要你做什么 → 这一轮变了什么 → 下一步（按先后）→ 全部事项（产品 / 支撑分开）→ 生效的决定 → 来源（折叠）→ 核对包（可选）。时间线上蓝色下划线表示该轮产品有新证据，灰色表示只涉及支撑工作。

## 视觉规则

- **安静的底色，一个信号。** 约九成画面是中性色；蓝绿强调色不超过一成，只给推荐项、关键节点、当前重点。
- **颜色有固定含义：** 蓝绿 = 推荐、关键、当前重点；琥珀 = 有风险、需要注意；绿 `--ok` = 新增、通过；红 `--risk` = 删除、阻断、失败。不当装饰色用，不新增颜色。
- **区隔顺序：** 先空白，再细线，最后才用边框。卡片里不套卡片。
- **节点和卡片：** 浅底、圆角、不加粗边框；同类元素宽度、内边距、对齐一致。
- **箭头和分隔线：** 细、灰色。
- **数字：** 对齐的数字用等宽数字（`.num` 或表格的 `td.r`）。
- **深浅两套主题都要能读。** 颜色只用变量。

## 组件速查

| 要表达 | 组件 | 类名 |
|---|---|---|
| 页面类型小标题 | 眉标 | `.eyebrow` |
| 一句结论 | 导语 | `.lead` |
| 六种状态 | 状态标签 | `.pill.st-done / st-doing / st-risk / st-block / st-todo / st-cancel` |
| 架构、模块层次 | 分层图 | `.layers > .layer > .tiles > .tile`（建议新增用 `.tile.new`） |
| 流程 | 流程图 | `.flow > .row > .node`，`.arr` 是箭头，`.notes > .note` 是旁注 |
| 关键数字、占比 | 数字条 | `.bars > .bar-row > .bar > span.seg-a/b/c/d`，用 `flex` 值按比例 |
| 各做各事的对象 | 卡片 | `.grid2/.grid3 > .card`，不要的用 `.card.drop` |
| 取舍 | 三栏 | `.cols3 > .col.keep / .col.change / .col.drop` |
| 同一组维度的对比 | 表格 | `.tbl > table`，等级用 `.lv.lo/.mid/.hi` |
| 请用户拍板 | 决策卡 | `.decide > .opts > .opt`，推荐 `.opt.rec`，不可选 `.opt.no`，翻转条件 `.flip` |
| 要核对 | 核对清单 | `.check` |
| 改动前后、阻断 | 状态修饰 | 给节点或卡片加 `.is-add`（新增）、`.is-del`（删除）、`.is-blocked`（阻断，自动加 ✕） |
| 静态图讲不清的过程 | 分步播放（扩展项） | `figure.stepper`，元素加 `data-s="N"`、`data-hot="N"`，说明写在 `ol.caps`（不要加 `hidden`） |
| 更新时间和来源 | 页脚 | `footer` |
| 多轮项目交接 | 交接构建器 | `scripts/build-handoff.mjs`，样式 `assets/handoff.css`，脚本 `assets/handoff.js` |

## 不要

- Inter、Roboto、Arial 当唯一字体；紫色或荧光色；渐变文字和渐变背景；玻璃拟态；emoji 当小标题标记。
- 所有内容居中；圆角卡片左侧加强调竖条；顺序无意义时用 01/02/03 编号。
- 装饰性动画、自动播放、视差滚动。
- 外链 `base.css` 交付：交付的页面必须是单文件。

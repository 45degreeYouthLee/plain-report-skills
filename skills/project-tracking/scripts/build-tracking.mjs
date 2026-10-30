// 用法：node build-tracking.mjs <tracking.json> <输出.html>
// 同目录有 tracking.scan.json（scan-repo.mjs 生成）时一并展示黑盒检查结果。
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validate, warnings, pendingDecisions} from './tracking-model.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output?.endsWith('.html') || output.endsWith('.src.html')) { console.error('用法：node build-tracking.mjs <tracking.json> <输出.html>'); process.exit(2); }
const t = JSON.parse(readFileSync(input, 'utf8'));
const errors = validate(t);
if (errors.length) { console.error('数据校验未通过：\n- ' + errors.join('\n- ')); process.exit(1); }
const scanFile = join(dirname(resolve(input)), 'tracking.scan.json');
const scan = existsSync(scanFile) ? JSON.parse(readFileSync(scanFile, 'utf8')) : null;
const warns = warnings(t, scan);

const here = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(here, '../../report-page-style/assets');
if (!existsSync(join(styleDir, 'inline.mjs'))) { console.error('找不到 report-page-style：请把 project-tracking 和 report-page-style 放在同一个 skills 目录下'); process.exit(2); }

const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const PILL = {已完成: 'st-done', 进行中: 'st-doing', 有风险: 'st-risk', 卡住: 'st-block', 未开始: 'st-todo', 暂停: 'st-todo', 取消: 'st-cancel',
  有效: 'st-doing', 待决定: 'st-risk', 已撤回: 'st-cancel', 已取代: 'st-cancel', 遵守: 'st-done', 有偏离: 'st-block', 未核对: 'st-todo',
  已验证: 'st-done', 部分验证: 'st-doing', 未验证: 'st-risk', 未知: 'st-todo', 高: 'st-block', 中: 'st-risk', 低: 'st-todo'};
const pill = s => s ? `<span class="pill ${PILL[s] || 'st-todo'}">${e(s)}</span>` : '';
const outDir = dirname(resolve(output));
const srcById = Object.fromEntries((t.sources || []).map(s => [s.id, s]));
const refs = item => (item.refs || []).map(r => `<a href="#src-${e(r)}">${e(srcById[r]?.title || r)}</a>`).join('、');
const stale = at => at && (Date.parse(t.updatedAt) - Date.parse(at)) / 86400000 > (t.staleDays ?? 14);
const LEAD = {用户: '你主导', Codex: 'Codex 主导', 共同: '共同推进'};

function forYou() {
  const items = [...pendingDecisions(t).map(d => ({kind: '决定', title: d.title, detail: d.decision, refs: d.refs, options: d.options})), ...(t.forYou || [])];
  if (!items.length) return '<p class="muted">现在没有需要你决定、批准或验收的事。</p>';
  return `<div class="asks">${items.map(f => `<article class="ask"><p class="ask-kind">${e(f.kind)}${f.line ? ' · ' + e(lineTitle(f.line)) : ''}</p><h3>${e(f.title)}</h3><p>${e(f.detail)}</p>${f.options ? `<ul>${f.options.map(o => `<li><b>${e(o.title)}</b>：${e(o.summary || '')}</li>`).join('')}</ul>` : ''}${f.refs?.length ? `<p class="sm">依据：${refs(f)}</p>` : ''}</article>`).join('')}</div>`;
}
const lineTitle = id => (t.lines || []).find(l => l.id === id)?.title || id;

function codeAt(m) {
  const list = m.paths || [];
  if (!list.length) return `<span class="sm">${m.external ? '外部依赖' : '未标'}</span>`;
  if (list.length <= 2) return list.map(p => `<code>${e(p)}</code>`).join('<br>');
  const dir = list.every(p => p.split('/')[0] === list[0].split('/')[0]) ? list[0].split('/')[0] + '/ 下 ' : '';
  return `<details class="paths"><summary>${e(dir)}${list.length} 处</summary>${list.map(p => `<code>${e(p)}</code>`).join('<br>')}</details>`;
}

function architecture() {
  const a = t.architecture;
  const modules = a.layers.flatMap(l => l.modules.map(m => ({...m, layer: l.title})));
  const layers = `<div class="layers">${a.layers.map(l => `<section class="layer"><div><b>${e(l.title)}</b>${l.role ? `<p class="sm">${e(l.role)}</p>` : ''}</div><div class="tiles">${l.modules.map(m => `<a class="tile mod" href="#mod-${e(m.id)}"><b>${e(m.title)}</b> ${pill(m.status)}<span class="proof">${e(m.proof.level)}${stale(m.proof.at) ? ' · 证据过期' : ''}</span></a>`).join('')}</div></section>`).join('')}</div>`;
  const table = `<div class="tbl"><table class="modules"><thead><tr><th>模块</th><th>它做什么</th><th>现在到哪</th><th>代码位置</th></tr></thead><tbody>${modules.map(m => `<tr id="mod-${e(m.id)}"><td><b>${e(m.title)}</b><p class="sm">${e(m.layer)}</p></td><td>${e(m.role)}${m.risk ? `<p class="risk-note">风险：${e(m.risk)}</p>` : ''}</td><td>${pill(m.status)} ${pill(m.proof.level)}${m.note ? `<p class="sm">${e(m.note)}</p>` : ''}<p class="sm">${e(m.proof.text || '')}${m.proof.at ? `（${e(m.proof.at)}${stale(m.proof.at) ? '，已过期' : ''}）` : ''}${m.proof.refs?.length ? ' · ' + refs(m.proof) : ''}</p></td><td>${codeAt(m)}</td></tr>`).join('')}</tbody></table></div>`;
  const flows = (a.flows || []).map(f => `<figure class="flowbox"><figcaption><b>${e(f.title)}</b>${f.note ? `<span class="sm"> · ${e(f.note)}</span>` : ''}</figcaption><ol class="steps">${f.steps.map(s => `<li>${e(s)}</li>`).join('')}</ol></figure>`).join('');
  const rules = (a.rules || []).length ? `<h3 class="sub">必须守住的架构规则</h3><p class="sm">这些是“代码怎么改都不能破”的约束。有偏离时会出现在“需要你处理”。</p><div class="tbl"><table><thead><tr><th>规则</th><th>为什么</th><th>谁定的</th><th>现在</th></tr></thead><tbody>${a.rules.map(r => `<tr><td><b>${e(r.rule)}</b></td><td>${e(r.why)}</td><td>${e(r.by || '—')}${r.at ? `<p class="sm">${e(r.at)}</p>` : ''}</td><td>${pill(r.status)}${r.note ? `<p class="sm">${e(r.note)}</p>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
  const stack = (a.stack || []).length ? `<h3 class="sub">技术选型</h3><div class="tbl"><table><thead><tr><th>用了什么</th><th>用在哪</th><th>为什么选它</th><th>代价或风险</th></tr></thead><tbody>${a.stack.map(s => `<tr><td><b>${e(s.name)}</b></td><td>${e(s.use)}</td><td>${e(s.why || '未说明')}</td><td>${e(s.risk || '—')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const decs = (a.decisions || []).filter(d => d.status !== '待决定');
  const decisions = decs.length ? `<h3 class="sub">架构决定</h3><div class="tbl"><table><thead><tr><th>决定</th><th>为什么（放弃了什么）</th><th>谁定 · 何时</th></tr></thead><tbody>${decs.map(d => `<tr><td><b>${e(d.title)}</b> ${pill(d.status)}<p>${e(d.decision)}</p></td><td>${e(d.reason)}${d.alternatives ? `<p class="sm">没选：${e(d.alternatives)}</p>` : ''}${d.revisit ? `<p class="sm">重议条件：${e(d.revisit)}</p>` : ''}</td><td>${e(d.by || '—')}<p class="sm">${e(d.date || '')}</p></td></tr>`).join('')}</tbody></table></div>` : '';
  const risks = (a.risks || []).length ? `<h3 class="sub">技术风险</h3><div class="tbl"><table><thead><tr><th>风险</th><th>等级</th><th>会影响什么</th><th>怎么应对</th></tr></thead><tbody>${a.risks.map(r => `<tr><td><b>${e(r.title)}</b></td><td>${pill(r.level)}</td><td>${e(r.impact)}</td><td>${e(r.mitigation || '未定')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const changes = (t.history || []).filter(h => h.arch).slice(-5).reverse();
  const recent = changes.length ? `<h3 class="sub">最近的架构变化</h3><ul class="keys">${changes.map(h => `<li><b>${e(h.date)} ${e(h.title)}</b>：${e(h.impact)}</li>`).join('')}</ul>` : '';
  const black = scan ? `<h3 class="sub">黑盒检查</h3><p class="sm">对照仓库目录（${e(scan.scannedAt)}${scan.lastCommit ? '，最新提交 ' + e(scan.lastCommit) : ''}）：${scan.units.length} 个代码目录，${scan.unmapped.length} 个不在上面的架构图里，${scan.missing.length} 个模块路径在仓库里找不到。</p>${scan.unmapped.length || scan.missing.length ? `<ul class="keys">${scan.unmapped.map(u => `<li><b>图上没有</b>：<code>${e(u)}</code></li>`).join('')}${scan.missing.map(u => `<li><b>仓库里没有</b>：<code>${e(u)}</code></li>`).join('')}</ul>` : ''}` : '<h3 class="sub">黑盒检查</h3><p class="sm">还没有运行 scan-repo.mjs 对照仓库，无法确认架构图是否覆盖了全部代码。</p>';
  return `<p class="arch-overview">${e(a.overview)}</p>${layers}${flows ? `<h3 class="sub">主流程</h3><div class="flows">${flows}</div>` : ''}<h3 class="sub">各模块</h3>${table}${rules}${decisions}${stack}${risks}${recent}${black}`;
}

function lines() {
  if (!(t.lines || []).length) return '<p class="muted">还没有定义工作线。</p>';
  return `<div class="lines">${t.lines.map(l => `<article class="line" id="line-${e(l.id)}"><div class="line-head"><h3>${e(l.title)}</h3>${pill(l.status)}<span class="lead-tag lead-${l.lead === '用户' ? 'user' : 'agent'}">${e(LEAD[l.lead])}</span></div><p>${e(l.goal)}</p>${l.now ? `<p><b>现在：</b>${e(l.now)}</p>` : ''}${(l.artifacts || []).length ? `<p class="mini-h">产物</p><ul class="arts">${l.artifacts.map(p => `<li>${pill(p.status)} <b>${e(p.title)}</b>${p.kind ? `<span class="sm"> · ${e(p.kind)}</span>` : ''}${p.location ? ` <code>${e(p.location)}</code>` : ''}${p.evidence ? `<span class="sm"> · ${e(p.evidence)}${p.at ? '（' + e(p.at) + '）' : ''}</span>` : ''}</li>`).join('')}</ul>` : ''}${(l.constraints || []).length ? `<p class="mini-h">规范与约束（Codex 必须遵守）</p><ul class="keys">${l.constraints.map(c => `<li>${e(c.rule)}<span class="sm">${c.source ? ' · ' + e(c.source) : ''}${c.at ? ' · ' + e(c.at) : ''}</span></li>`).join('')}</ul>` : ''}${l.next ? `<p><b>下一步：</b>${e(l.next)}</p>` : ''}${l.reports ? `<p class="sm"><a href="${e(l.reports)}">这条线的任务汇报</a></p>` : ''}</article>`).join('')}</div>`;
}

function stages() {
  if (!(t.stages || []).length) return '';
  return `<section id="stages"><h2>阶段对照</h2><p class="sm">把执行方内部使用的阶段编号翻译成能看懂的目标和过关标准。没有说明的编号要去追问。</p><div class="tbl"><table><thead><tr><th>编号</th><th>是什么</th><th>怎样算过关</th><th>状态</th></tr></thead><tbody>${t.stages.map(s => `<tr${s.current ? ' class="current"' : ''}><td><code>${e(s.code)}</code>${s.current ? ' <span class="pill st-doing">当前</span>' : ''}</td><td>${s.name ? `<b>${e(s.name)}</b>` : '<span class="unexplained">未说明</span>'}${s.goal ? `<p class="sm">${e(s.goal)}</p>` : ''}</td><td>${e(s.exit || '未说明')}</td><td>${pill(s.status)}${s.note ? `<p class="sm">${e(s.note)}</p>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function history() {
  const list = [...(t.history || [])].sort((x, y) => y.date.localeCompare(x.date));
  if (!list.length) return '<p class="muted">还没有记录历史节点。</p>';
  const kinds = [...new Set(list.map(h => h.kind))];
  const filters = `<div class="filters" role="group" aria-label="筛选节点"><button type="button" data-filter="" aria-pressed="true">全部</button>${kinds.map(k => `<button type="button" data-filter="kind:${e(k)}" aria-pressed="false">${e(k)}</button>`).join('')}${(t.lines || []).map(l => `<button type="button" data-filter="line:${e(l.id)}" aria-pressed="false">${e(l.title)}</button>`).join('')}</div>`;
  return filters + `<ol class="nodes">${list.map(h => `<li class="node-item" data-kind="${e(h.kind)}" data-line="${e(h.line || '')}"><p class="node-date">${e(h.date)}</p><div><p class="node-kind">${e(h.kind)}${h.line ? ' · ' + e(lineTitle(h.line)) : ''}${h.arch ? ' · 架构' : ''}</p><h3>${e(h.title)}</h3>${h.what ? `<p>${e(h.what)}</p>` : ''}<p><b>影响：</b>${e(h.impact)}</p>${h.refs?.length || h.link ? `<p class="sm">${refs(h)}${h.link ? ` <a href="${e(h.link)}">当时的汇报</a>` : ''}</p>` : ''}</div></li>`).join('')}</ol>`;
}

const sources = (t.sources || []).map(s => `<li id="src-${e(s.id)}"><b>${e(s.title)}</b>${s.at ? ` · ${e(s.at)}` : ''}${s.file ? ` · <code>${e(s.file)}</code>` : ''}${s.note ? `<span class="sm"> · ${e(s.note)}</span>` : ''}</li>`).join('');
const nonGoals = (t.nonGoals || []).length ? `<p class="sm"><b>不做：</b>${t.nonGoals.map(e).join('；')}</p>` : '';

const body = `<main class="wrap">
<div class="top"><p class="eyebrow">项目追踪 · 更新到 ${e(t.updatedAt)}</p><button type="button" id="theme">切换深浅</button></div>
<h1>${e(t.title)}</h1>
<p class="lead">${e(t.goal)}</p>${nonGoals}
<p class="summary">${e(t.summary)}</p>
<nav class="toc"><a href="#asks">需要你处理</a><a href="#arch">技术与架构</a><a href="#lines">工作线</a>${(t.stages || []).length ? '<a href="#stages">阶段对照</a>' : ''}<a href="#history">历史节点</a><a href="#sources">来源</a></nav>
<section id="asks"><h2>需要你处理</h2>${forYou()}</section>
<section id="arch"><h2>技术与架构</h2>${architecture()}</section>
<section id="lines"><h2>工作线</h2>${lines()}</section>
${stages()}
<section id="history"><h2>历史节点</h2>${history()}</section>
<footer id="sources"><p>来源</p><ul>${sources}</ul>${t.boundary ? `<p>${e(t.boundary)}</p>` : ''}<p>更新到 ${e(t.updatedAt)}。</p></footer>
</main>`;

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t.title)}</title>
<link rel="stylesheet" data-inline href="base.css"><style>${readFileSync(join(here, '../assets/tracking.css'), 'utf8')}</style></head><body>${body}
<script>${readFileSync(join(here, '../assets/tracking.js'), 'utf8')}</script></body></html>`;
mkdirSync(outDir, {recursive: true});
const src = resolve(output).replace(/\.html$/, '.src.html');
writeFileSync(src, html);
execFileSync(process.execPath, [join(styleDir, 'inline.mjs'), src, resolve(output)], {stdio: 'ignore'});
console.log(`已生成 ${output}`);
if (!scan) console.log('提示：还没运行 scan-repo.mjs，页面上的黑盒检查为空。');
if (warns.length) { console.log(`\n提示 ${warns.length} 条（不阻断；逐条处理，或放进“需要你处理”）：`); for (const w of warns) console.log('- ' + w); }

// 把一个快照渲染成 HTML 片段，以及写给人审阅的文字底稿。
import {reviewPackage, activeActions} from './handoff-state.mjs';

export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const e = escapeHtml;
const PILL = {已完成: 'st-done', 进行中: 'st-doing', 有风险: 'st-risk', 卡住: 'st-block', 未开始: 'st-todo', 暂停: 'st-todo st-pause', 取消: 'st-cancel',
  有效: 'st-doing', 待决定: 'st-risk', 已撤回: 'st-cancel', 已取代: 'st-cancel'};
const pill = status => `<span class="pill ${PILL[status] || 'st-todo'}">${e(status)}</span>`;
const short = at => String(at).match(/\d{1,2}:\d{2}/)?.[0] || at;
const isNew = (s, group, id) => s.changedIds.includes(group + ':' + id);
const refLinks = (item, s) => [...new Set(item.refs || [])].map(r => `<a href="#v${s.version}:evidence-${e(r)}">${e(r)}</a>`).join(' · ');

function evidence(item, s) {
  if (!item.technical && !(item.refs || []).length) return '';
  return `<details><summary>技术细节与依据</summary>${item.technical ? `<p>${e(item.technical)}</p>` : ''}<p class="muted">来源：${refLinks(item, s) || '无'} · 记录于 ${e(item.lastAt)}</p></details>`;
}

function phases(s) {
  const list = Object.values(s.phases);
  if (!list.length) return '';
  return `<div class="phase-grid">${list.map(p => `<section class="phase"><h3>${e(p.title)} ${pill(p.status)}</h3>${p.note ? `<p class="note">${e(p.note)}</p>` : ''}<p>${e(p.summary)}</p>${p.gap ? `<p class="gap"><b>还缺：</b>${e(p.gap)}</p>` : ''}<p class="muted">${p.lastVersion ? '最近有新证据：第 ' + p.lastVersion + ' 轮 ' + e(short(p.lastAt)) : '汇报中还没有这一环节的新证据'}</p></section>`).join('')}</div>`;
}

function stale(s) {
  if (s.touchesProduct || !s.lastProduct) return '';
  return `<p class="stale"><b>产品本身这一轮没有新证据。</b>本轮变化都在支撑工作上；产品环节最近一次有新证据是第 ${s.lastProduct.version} 轮（${e(s.lastProduct.at)}）。</p>`;
}

function forYou(s) {
  const pending = Object.values(s.decisions).filter(d => d.status === '待决定');
  const acts = Object.values(s.userActions).filter(a => !['已完成', '取消'].includes(a.status));
  if (!pending.length && !acts.length) return `<p class="none-for-you">这一轮不需要你做决定或操作。</p>`;
  const decide = pending.map(d => `<section class="decide-now" id="decision-${e(d.id)}"><p class="eyebrow">需要你决定</p><h3>${e(d.title)}</h3><p>${e(d.summary)}</p><div class="tbl"><table><thead><tr><th>选项</th><th>得到什么</th><th>代价</th><th>风险</th></tr></thead><tbody>${d.options.map(o => `<tr${o.recommended ? ' class="rec"' : ''}><td data-label="选项"><b>${e(o.title)}</b>${o.recommended ? ' <span class="pill st-doing">推荐</span>' : ''}${o.state ? `<p>${e(o.state)}</p>` : ''}</td><td data-label="得到什么">${e(o.benefit)}</td><td data-label="代价">${e(o.cost)}</td><td data-label="风险">${e(o.risk)}</td></tr>`).join('')}</tbody></table></div><p><b>推荐：</b>${e(d.recommend)}</p>${d.revisit ? `<p><b>什么情况下改选：</b>${e(d.revisit)}</p>` : ''}<p class="reply"><b>怎么回复：</b>${e(d.reply)}</p>${evidence(d, s)}</section>`).join('');
  const todo = acts.map(a => `<section class="human-action"><h3>${e(a.title)} ${pill(a.status)}</h3><p>${e(a.summary)}</p><p><b>你要做的：</b>${e(a.action)}</p><p><b>做完的标志：</b>${e(a.done)}</p>${a.material ? `<p class="muted">材料：${a.materialHref ? `<a href="${e(a.materialHref)}">${e(a.material)}</a>` : e(a.material)}</p>` : ''}</section>`).join('');
  return decide + todo;
}

function changes(s) {
  return `<div class="change-list">${s.changes.map(c => `<article class="change"><p class="change-head"><span class="change-kind">${e(c.kind)}</span>${c.previousStatus && c.previousStatus !== c.status ? ` ${pill(c.previousStatus)} → ${pill(c.status)}` : c.status ? ' ' + pill(c.status) : ''}</p><h3>${e(c.title)}</h3><p class="before"><b>此前：</b>${e(c.before)}</p><p><b>现在：</b>${e(c.after)}</p>${c.impact ? `<p><b>影响：</b>${e(c.impact)}</p>` : ''}</article>`).join('')}</div>`;
}

function actions(s) {
  const list = activeActions(s);
  if (!list.length) return '<p class="empty">当前没有待执行的动作。</p>';
  return `<div class="action-table tbl"><table><thead><tr><th>顺序</th><th>做什么 · 谁做</th><th>交付什么</th><th>怎样算完成</th><th>完成后解锁</th></tr></thead><tbody>${list.map((t, i) => {
    const a = t.action;
    return `<tr${a.priority === 1 ? ' class="critical"' : ''}><td data-label="顺序">${i + 1}${a.priority === 1 ? ' <span class="pill st-risk">最关键</span>' : ''}</td><td data-label="做什么 · 谁做"><b>${e(a.task)}</b><p class="muted">${e(a.owner || '待分派')}${a.role ? ' · 建议：' + e(a.role) : ''} · 事项：${e(t.title)}</p></td><td data-label="交付什么">${e(a.output)}</td><td data-label="怎样算完成">${e(a.done)}</td><td data-label="完成后解锁">${e(a.unblocks || '—')}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function items(s) {
  const tasks = Object.values(s.tasks);
  const block = (title, list) => !list.length ? '' : `<h3 class="track">${title}</h3><div class="items">${list.map(t => `<section class="item${isNew(s, 'tasks', t.id) ? ' changed' : ''}" data-task="${e(t.id)}"><div class="item-head"><h4>${e(t.title)}</h4>${pill(t.status)}${t.note ? `<span class="note">${e(t.note)}</span>` : ''}<span class="when">${isNew(s, 'tasks', t.id) ? '本轮更新，前后对比见上' : '沿用 ' + e(t.lastVersion ? '第 ' + t.lastVersion + ' 轮 ' + short(t.lastAt) : t.lastAt)}</span></div><p>${e(t.summary)}</p><p><b>影响：</b>${e(t.impact)}</p>${evidence(t, s)}</section>`).join('')}</div>`;
  const product = tasks.filter(t => (t.track || 'product') === 'product');
  const support = tasks.filter(t => t.track === 'support');
  return block('产品本身', product) + block('支撑工作（测试环境、工具、交接）', support);
}

function decisions(s) {
  const list = Object.values(s.decisions).filter(d => d.status !== '待决定');
  if (!list.length) return '<p class="empty">这一截点还没有已作出的决定。</p>';
  const row = d => `<tr data-decision="${e(d.id)}"><td data-label="决定"><b>${e(d.title)}</b> ${pill(d.status)}${isNew(s, 'decisions', d.id) ? ' <span class="pill st-doing">本轮</span>' : ''}<p>${e(d.summary)}</p></td><td data-label="为什么">${e(d.reason)}</td><td data-label="代价与风险">${e(d.cost)}<p>${e(d.risk)}</p></td><td data-label="何时重议">${e(d.revisit || '—')}</td></tr>`;
  const options = list.filter(d => d.options?.length).map(d => `<details class="decision-detail" id="decision-${e(d.id)}"><summary>当时比较过的方向：${e(d.title)}</summary><div class="tbl"><table><thead><tr><th>方向</th><th>得到什么</th><th>代价</th><th>风险</th></tr></thead><tbody>${d.options.map(o => `<tr><td>${e(o.title)}${o.state ? `<p class="muted">${e(o.state)}</p>` : ''}</td><td>${e(o.benefit)}</td><td>${e(o.cost)}</td><td>${e(o.risk)}</td></tr>`).join('')}</tbody></table></div><p class="muted">来源：${refLinks(d, s)}</p></details>`).join('');
  return `<div class="decision-table tbl"><table><thead><tr><th>决定与效力</th><th>为什么</th><th>代价与风险</th><th>何时重议</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>${options}`;
}

export function renderSnapshot(project, s, {latest = false} = {}) {
  return `<article class="snapshot">
<p class="snapshot-meta">${e(s.event.at)} · ${e(s.event.type)}</p>
<h2 class="headline">${e(s.event.title)}</h2>
<p class="overview">${e(s.overview)}</p>
${stale(s)}
${phases(s)}
${project.scope || project.mechanics?.length ? `<details class="context"><summary>项目范围与各环节怎样配合</summary>${project.scope ? `<p>${e(project.scope)}</p>` : ''}${(project.mechanics || []).map(m => `<p><b>${e(m.title)}：</b>${e(m.text)}</p>`).join('')}</details>` : ''}
<h2>需要你做什么</h2>
${forYou(s)}
<h2>这一轮变了什么</h2>
${s.event.meaning ? `<p class="section-intro">${e(s.event.meaning)}</p>` : ''}
${changes(s)}
<h2>下一步，按先后</h2>
${actions(s)}
<h2>全部事项</h2>
${items(s)}
<h2>生效的决定</h2>
${decisions(s)}
<details class="backstage" id="evidence"><summary>来源与原始记录（${s.sources.length} 份）</summary>${s.sources.map(src => `<section class="source" id="evidence-${e(src.id)}"><h3>${e(src.title)}</h3><p class="muted">${e(src.kind || '')} · ${e(src.at || '背景资料')} · <code>${e(src.id)}</code></p>${src.excerpt ? `<blockquote>${e(src.excerpt)}</blockquote>` : ''}${src.file ? `<p><a href="${e(src.href || src.file)}">打开来源文件</a>${src.reference ? ` · <code>${e(src.reference)}</code>` : ''}</p>` : ''}</section>`).join('')}${project.boundary ? `<p class="foot">${e(project.boundary)}</p>` : ''}</details>
${latest ? `<details class="backstage"><summary>可选：交给其他 Agent 核对</summary><p class="section-intro">只读核对包，针对当前截点。页面不会自动派发。</p><button type="button" data-copy-review>复制核对包</button><textarea class="review-data" id="review-data" readonly aria-label="只读核对包">${e(JSON.stringify(reviewPackage(project, s), null, 2))}</textarea><p id="copy-result" role="status" aria-live="polite"></p></details>` : ''}
</article>`;
}

export function renderFact(project, s) {
  const L = [`# ${project.title} · 第 ${s.version} 轮 · ${s.event.at}`, '', `## ${s.event.title}`, '', s.overview, ''];
  if (!s.touchesProduct && s.lastProduct) L.push(`产品本身本轮无新证据；最近一次在第 ${s.lastProduct.version} 轮（${s.lastProduct.at}）。`, '');
  L.push('## 各环节');
  for (const p of Object.values(s.phases)) L.push(`- ${p.title}【${p.status}】${p.summary}${p.gap ? ' 还缺：' + p.gap : ''}`);
  L.push('', '## 需要用户');
  const pending = Object.values(s.decisions).filter(d => d.status === '待决定');
  for (const d of pending) L.push(`- 决定：${d.title}。推荐：${d.recommend}。回复：${d.reply}`, ...d.options.map(o => `  - ${o.title}：得 ${o.benefit}；代价 ${o.cost}；风险 ${o.risk}`));
  for (const a of Object.values(s.userActions).filter(a => !['已完成', '取消'].includes(a.status))) L.push(`- 动作：${a.title}【${a.status}】${a.action}；完成标志：${a.done}`);
  if (L.at(-1) === '## 需要用户') L.push('- 无');
  L.push('', '## 本轮变化');
  for (const c of s.changes) L.push(`- ${c.title}［${c.kind}］${c.previousStatus && c.previousStatus !== c.status ? c.previousStatus + '→' + c.status + '；' : ''}此前：${c.before} 现在：${c.after}${c.impact ? ' 影响：' + c.impact : ''}`);
  L.push('', '## 下一步');
  activeActions(s).forEach((t, i) => L.push(`${i + 1}. ${t.action.task}（${t.action.owner || '待分派'}）交付：${t.action.output}；完成：${t.action.done}${t.action.unblocks ? '；解锁：' + t.action.unblocks : ''}`));
  L.push('', '## 全部事项');
  for (const t of Object.values(s.tasks)) L.push(`- [${t.track === 'support' ? '支撑' : '产品'}] ${t.title}【${t.status}${t.note ? '·' + t.note : ''}】${t.summary} 影响：${t.impact}（${t.lastAt}；来源 ${(t.refs || []).join(',')}）${t.technical ? ' 技术：' + t.technical : ''}`);
  L.push('', '## 决定');
  for (const d of Object.values(s.decisions).filter(d => d.status !== '待决定')) L.push(`- ${d.title}【${d.status}】${d.summary} 理由：${d.reason} 代价：${d.cost} 风险：${d.risk}${d.revisit ? ' 重议：' + d.revisit : ''}`);
  L.push('', '## 来源');
  for (const src of s.sources) L.push(`- ${src.id}｜${src.title}｜${src.kind || ''}｜${src.at || '背景'}｜${src.file || ''}`);
  return L.join('\n') + '\n';
}

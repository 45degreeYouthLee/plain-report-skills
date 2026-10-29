// 持续交接的状态计算：读 project.json 和 events/*.json，逐批接续，生成每一轮的快照。
// 只做结构与关系校验；文字是否讲清楚由 lint 给出提示，最终由报告 Agent 审阅。
import {readFile, readdir} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';

export const STATUSES = ['已完成', '进行中', '有风险', '卡住', '未开始', '暂停', '取消'];
export const DECISION_STATUSES = ['待决定', '有效', '已撤回', '已取代'];
const groups = ['phases', 'tasks', 'decisions', 'userActions'];
const ID = /^[A-Za-z0-9_-]+$/;

export async function loadProject(file) {
  const project = JSON.parse(await readFile(file, 'utf8'));
  const base = dirname(resolve(file));
  const dir = resolve(base, project.eventsDir || 'events');
  const names = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  const events = [];
  for (const name of names) events.push(JSON.parse(await readFile(join(dir, name), 'utf8')));
  return {project, events};
}

function fail(where, message) {
  throw Error(`${where}：${message}`);
}

function checkObject(group, item, sources, where) {
  const label = `${where} ${group}.${item.id}`;
  if (!item.title || !item.summary || !item.status) fail(label, '缺 title / summary / status');
  if (group === 'decisions') {
    if (!DECISION_STATUSES.includes(item.status)) fail(label, `决定状态只用 ${DECISION_STATUSES.join('、')}，现在是「${item.status}」`);
    if (item.status === '待决定') {
      if ((item.options || []).length < 2) fail(label, '待决定事项至少要两个可行选项');
      if (!item.recommend || !item.reply) fail(label, '待决定事项要写 recommend（推荐及理由）和 reply（用户怎么回复）');
      for (const o of item.options) if (!o.title || !o.benefit || !o.cost || !o.risk) fail(label, '每个选项要有 title / benefit / cost / risk');
    } else if (!item.reason || !item.cost || !item.risk) fail(label, '已作决定要写 reason / cost / risk');
  } else if (!STATUSES.includes(item.status)) {
    fail(label, `状态只用 ${STATUSES.join('、')}，现在是「${item.status}」；具体情况写进 note`);
  }
  if (group === 'tasks') {
    if (!item.impact) fail(label, '缺 impact（对目标的实际影响）');
    if (item.track && !['product', 'support'].includes(item.track)) fail(label, 'track 只能是 product 或 support');
    const a = item.action;
    if (a && a.active !== false && (!a.task || !a.output || !a.done)) fail(label, 'action 要有 task / output / done');
  }
  if (group === 'userActions' && (!item.action || !item.done)) fail(label, '人类动作要写 action 和 done');
  for (const ref of item.refs || []) if (!sources[ref]) fail(label, `引用了不存在或未来批次的来源 ${ref}`);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function buildHistory(project, events) {
  if (!project.title || !project.goal || !project.overview) fail('project.json', '需要 title、goal、overview');
  if (!events.length) fail('events', '至少需要一个事件文件');
  const sources = {};
  for (const s of project.sources || []) sources[s.id] = s;
  const current = {overview: project.overview, phases: {}, tasks: {}, decisions: {}, userActions: {}};
  for (const group of groups) for (const item of project[group] || []) {
    if (!ID.test(item.id || '')) fail('project.json', `${group} 对象缺稳定 id`);
    current[group][item.id] = {...item, lastVersion: 0, lastAt: '背景资料'};
    checkObject(group, current[group][item.id], sources, 'project.json');
  }
  let lastProduct = null;
  const history = [];
  for (const [index, event] of events.entries()) {
    const where = `第 ${index + 1} 个事件`;
    if (event.version !== index + 1) fail(where, `version 应为 ${index + 1}，事件文件按名称排序后必须连续`);
    if (!event.at || !event.title || !event.type) fail(where, '需要 at、type、title');
    for (const s of event.sources || []) {
      if (!ID.test(s.id || '')) fail(where, '来源 id 只用字母、数字、下划线、连字符');
      if (sources[s.id]) fail(where, `来源 id 重复：${s.id}`);
      sources[s.id] = s;
    }
    const changes = [];
    let touchesProduct = false;
    if (event.overview && event.overview !== current.overview) {
      changes.push({group: 'overview', id: 'overview', title: '项目整体判断', before: current.overview, after: event.overview, kind: '判断更新', impact: event.overviewImpact || ''});
      current.overview = event.overview;
      touchesProduct = true;
    }
    for (const group of groups) for (const update of event.changes?.[group] || []) {
      if (!ID.test(update.id || '')) fail(where, `${group} 的变更缺稳定 id`);
      const {change, ...patch} = update;
      const before = current[group][patch.id];
      const next = {...before, ...patch};
      const {lastVersion, lastAt, ...beforeFields} = before || {};
      const changed = !before || !same({...beforeFields, ...patch}, beforeFields);
      if (!changed && !change?.kind) continue; // 原样重复且未声明为复核：不算变化
      next.lastVersion = event.version;
      next.lastAt = event.at;
      checkObject(group, next, sources, where);
      current[group][patch.id] = next;
      if (group === 'phases' || (group === 'tasks' && (next.track || 'product') === 'product')) touchesProduct = true;
      changes.push({
        group, id: patch.id, title: next.title,
        before: before ? before.summary : '此前未收录', after: next.summary,
        previousStatus: before?.status, status: next.status,
        kind: change?.kind || (before ? '更新' : '首次收录'),
        impact: change?.impact || (group === 'tasks' ? next.impact : '') || ''
      });
    }
    if (!changes.length) fail(where, '没有任何对象发生变化；如果是复核，请在 change.kind 写明“复核”');
    if (touchesProduct) lastProduct = {version: event.version, at: event.at};

    // 关系检查：已裁决条件不能仍被索要；已撤回的决定不能还被动作依赖
    const settled = new Set(Object.values(current.decisions).filter(d => d.status === '有效').flatMap(d => d.settles || []));
    for (const task of Object.values(current.tasks)) {
      for (const key of task.pendingDecisions || []) if (settled.has(key)) fail(where, `已裁决的条件「${key}」仍出现在事项 ${task.id} 的待决定里`);
      const dep = task.action?.decisionRef && current.decisions[task.action.decisionRef];
      if (dep && ['已撤回', '已取代'].includes(dep.status) && task.action.active !== false) fail(where, `事项 ${task.id} 的动作还依赖${dep.status}的决定 ${dep.id}`);
    }
    const snapshot = structuredClone({...current, version: event.version, event, sources: Object.values(sources), changes, lastProduct, touchesProduct});
    snapshot.changedIds = changes.map(c => c.group + ':' + c.id);
    history.push(snapshot);
  }
  return history;
}

// 文字提示：不阻断构建，只把容易让读者吃力的写法指出来。
const TECH = /([A-Za-z]:\\|`|\b[0-9a-f]{8,}\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\w+\.(?:json|md|mjs|js|ts|py|ps1|exe|dll|log)\b|errors?=|\/[\w.-]+\/[\w.-]+)/;
const NEG = /不|未|没|无|非/g;
export function lint(history) {
  const warnings = new Set();
  const say = (s, where, msg) => warnings.add(`第 ${s.version} 轮 ${where}：${msg}`);
  const text = (s, where, value, field) => {
    if (!value) return;
    if (TECH.test(value)) say(s, where, `${field} 含路径、编号、代码或原始报错，正文请写实际作用，原文放 technical 或来源`);
    const neg = (value.match(NEG) || []).length;
    if (value.length >= 30 && neg / value.length > 0.07) say(s, where, `${field} 否定词偏多（${neg} 个），先写是什么、影响什么`);
    if (value.length > 140) say(s, where, `${field} 超过 140 字，拆开或把细节移到 technical`);
  };
  for (const s of history) {
    text(s, '标题', s.event.title, 'title');
    text(s, '整体判断', s.overview, 'overview');
    for (const group of groups) for (const item of Object.values(s[group])) {
      if (item.lastVersion !== s.version) continue; // 只提示本轮写的文字
      const where = `${group}.${item.id}`;
      text(s, where, item.title, 'title');
      text(s, where, item.summary, 'summary');
      text(s, where, item.impact, 'impact');
      if (item.impact && item.summary && (item.impact === item.summary || item.summary.includes(item.impact))) say(s, where, 'impact 只是复述 summary，请写对目标的后果：推迟、解锁或增加什么');
    }
    for (const c of s.changes) if (c.impact && c.before && c.impact.includes(c.after)) say(s, `变化 ${c.id}`, 'impact 复述了“现在”，请写后果');
    const actions = activeActions(s);
    if (actions.length > 1 && !actions.some(t => t.action.priority === 1)) say(s, '下一步', '有多项动作但没有用 priority: 1 标出最关键的一项');
  }
  return [...warnings];
}

export function activeActions(s) {
  return Object.values(s.tasks)
    .filter(t => t.action && t.action.active !== false && !['已完成', '取消', '暂停'].includes(t.status))
    .sort((a, b) => (a.action.priority ?? 99) - (b.action.priority ?? 99));
}

export function reviewPackage(project, s) {
  return {
    protocol: 'handoff-review/1', project: project.title, version: s.version, at: s.event.at,
    claims: [
      {id: 'overview', kind: '整体判断', text: s.overview},
      ...groups.flatMap(group => Object.values(s[group]).map(item => ({id: item.id, kind: group, status: item.status, text: item.summary, refs: item.refs || [], lastAt: item.lastAt}))),
      ...s.changes.map(c => ({id: 'change:' + c.id, kind: '本轮变化', text: c.before + ' → ' + c.after}))
    ],
    sources: s.sources.map(({id, title, kind, at, file, reference}) => ({id, title, kind, at, file, reference})),
    scope: {allowed: ['读取来源', '核对本截点的主张', '报告证据缺口'], excluded: ['调用业务接口', '修改权限或配置', '重跑产品任务', '用后续资料改写早期截点']},
    result: {claim_id: '主张 id', verdict: 'supported | contradicted | insufficient', evidence_refs: [], reason: '说明范围与缺口'}
  };
}

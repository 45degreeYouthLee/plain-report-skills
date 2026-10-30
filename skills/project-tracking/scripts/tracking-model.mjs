// 项目追踪的数据校验与派生。只查结构和已声明的关系；没声明的东西不报错。
export const STATUSES = ['已完成', '进行中', '有风险', '卡住', '未开始', '暂停', '取消'];
export const PROOF = ['已验证', '部分验证', '未验证', '未知'];
export const RULE_STATES = ['遵守', '有偏离', '未核对'];
export const DECISION_STATES = ['待决定', '有效', '已撤回', '已取代'];
export const LEADS = ['用户', 'Codex', '共同'];
export const ASKS = ['决定', '批准', '验收', '操作', '知晓'];
const ID = /^[A-Za-z0-9_.-]+$/;

export function validate(t) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}：${msg}`);
  const oneOf = (where, value, list, field) => { if (!list.includes(value)) err(where, `${field} 只用 ${list.join('、')}，现在是「${value ?? '空'}」`); };
  for (const f of ['title', 'goal', 'updatedAt', 'summary']) if (!t[f]) err('tracking.json', `缺 ${f}`);
  const sources = new Set((t.sources || []).map(s => s.id));
  const refs = (where, item) => { for (const r of item.refs || []) if (!sources.has(r)) err(where, `引用了不存在的来源 ${r}`); };

  // 技术与架构：每个项目都必须有，不能省略
  const a = t.architecture;
  if (!a) err('architecture', '技术与架构是固定模块，不能省略；查不到的内容写“未知”');
  else {
    if (!a.overview) err('architecture', '缺 overview：一句大白话说系统由什么组成、怎样协作');
    if (!(a.layers || []).length) err('architecture', '至少要有一层 layers');
    for (const layer of a.layers || []) {
      if (!ID.test(layer.id || '') || !layer.title) err('architecture.layers', '每层要有 id 和 title');
      for (const m of layer.modules || []) {
        const where = `模块 ${m.id || '?'}`;
        if (!ID.test(m.id || '') || !m.title || !m.role) err(where, '要有 id、title、role（它做什么，大白话）');
        oneOf(where, m.status, STATUSES, 'status');
        if (!m.proof) err(where, '缺 proof：验证到什么程度、证据是什么');
        else oneOf(where, m.proof.level, PROOF, 'proof.level');
        refs(where, m.proof || {});
      }
    }
    for (const r of a.rules || []) { oneOf(`架构规则 ${r.id}`, r.status, RULE_STATES, 'status'); if (!r.rule || !r.why) err(`架构规则 ${r.id}`, '要有 rule 和 why'); refs(`架构规则 ${r.id}`, r); }
    for (const d of a.decisions || []) checkDecision(d, `架构决定 ${d.id}`, err, oneOf, refs);
    for (const f of a.flows || []) if (!f.title || (f.steps || []).length < 2) err('architecture.flows', '每条主流程要有 title 和至少两步 steps');
  }
  for (const l of t.lines || []) {
    const where = `工作线 ${l.id}`;
    if (!ID.test(l.id || '') || !l.title || !l.goal) err(where, '要有 id、title、goal');
    oneOf(where, l.lead, LEADS, 'lead');
    oneOf(where, l.status, STATUSES, 'status');
    for (const p of l.artifacts || []) { if (!p.title) err(where, '产物要有 title'); oneOf(where + ' 产物 ' + p.title, p.status, STATUSES, 'status'); refs(where, p); }
    for (const d of l.decisions || []) checkDecision(d, `${where} 决定 ${d.id}`, err, oneOf, refs);
  }
  for (const s of t.stages || []) if (s.status) oneOf(`阶段 ${s.code}`, s.status, STATUSES, 'status');
  for (const f of t.forYou || []) { oneOf(`待你处理 ${f.title}`, f.kind, ASKS, 'kind'); if (!f.title || !f.detail) err('forYou', '每项要有 title 和 detail'); refs(`待你处理 ${f.title}`, f); }
  for (const h of t.history || []) { if (!h.date || !h.kind || !h.title || !h.impact) err('history', `节点「${h.title || '?'}」要有 date、kind、title、impact`); refs(`节点 ${h.title}`, h); }
  return errors;
}

function checkDecision(d, where, err, oneOf, refs) {
  oneOf(where, d.status, DECISION_STATES, 'status');
  if (!d.title || !d.decision || !d.reason) err(where, '要有 title、decision、reason');
  if (d.by) oneOf(where, d.by, LEADS, 'by');
  refs(where, d);
}

const days = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400000;

// 提示：不阻断，但说明“哪里可能变成黑盒”
export function warnings(t, scan) {
  const w = [];
  const stale = t.staleDays ?? 14;
  for (const layer of t.architecture?.layers || []) for (const m of layer.modules || []) {
    if (!m.external && !(m.paths || []).length) w.push(`模块 ${m.title} 没有对应的代码位置（paths），读者无法核对它在哪`);
    if (m.proof?.at && days(m.proof.at, t.updatedAt) > stale) w.push(`模块 ${m.title} 的证据是 ${m.proof.at} 的，已超过 ${stale} 天`);
    if (m.proof && !m.proof.at && m.proof.level !== '未知') w.push(`模块 ${m.title} 的证据没有日期`);
  }
  for (const r of t.architecture?.rules || []) if (r.status === '未核对') w.push(`架构规则「${r.rule}」还没核对代码是否遵守`);
  for (const s of t.stages || []) if (!s.name || !s.exit) w.push(`阶段编号 ${s.code} 没有说明名称或过关标准`);
  for (const l of t.lines || []) if (l.lead === '用户' && !(l.constraints || []).length && !(l.artifacts || []).length) w.push(`你主导的工作线「${l.title}」还没有记录任何规范或产物`);
  if (scan) {
    for (const d of scan.unmapped || []) w.push(`代码目录 ${d} 不在任何模块里（图上没有，仓库里有）`);
    for (const d of scan.missing || []) w.push(`模块路径 ${d} 在仓库里找不到（图上有，仓库里没有）`);
  }
  return w;
}

export function pendingDecisions(t) {
  return [...(t.architecture?.decisions || []), ...(t.lines || []).flatMap(l => l.decisions || [])].filter(d => d.status === '待决定');
}

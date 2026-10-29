// 用法：node build-handoff.mjs <project.json> <输出.html>
// 生成：输出.html（单文件页面）、.src.html、.fact.md（文字底稿，供审阅）、.history.json、.build.json（含文字提示）
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {loadProject, buildHistory, lint} from './handoff-state.mjs';
import {renderSnapshot, renderFact, escapeHtml as e} from './render-handoff.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || !output.endsWith('.html') || output.endsWith('.src.html')) {
  console.error('用法：node build-handoff.mjs <project.json> <输出.html>');
  process.exit(2);
}
let history, project;
try {
  const loaded = await loadProject(resolve(input));
  project = loaded.project;
  history = buildHistory(project, loaded.events);
} catch (err) {
  console.error('数据校验未通过：' + err.message);
  process.exit(1);
}
const destination = resolve(output);
await mkdir(dirname(destination), {recursive: true});
const root = dirname(resolve(input));
for (const s of history) for (const src of s.sources) {
  if (src.file && !/^[a-z]+:/i.test(src.file)) src.href = relative(dirname(destination), resolve(root, src.file)).replace(/\\/g, '/');
}
const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
const last = history.at(-1);
const timeline = history.map(s => `<button type="button" role="tab" data-version="${s.version}" aria-controls="handoff-panel" aria-selected="${s === last}" class="${s.touchesProduct ? 'product' : 'support'}"><span class="clock">${e(s.event.clock || s.event.at)}</span><span class="event-type">${e(s.event.type)}</span><span class="event-title">${e(s.event.topic || s.event.title)}</span></button>`).join('');
const values = {
  TITLE: e(project.title), GOAL: e(project.goal), COUNT: String(history.length), TIMELINE: timeline,
  UPDATED: e(last.event.at),
  INITIAL: renderSnapshot(project, last, {latest: true}),
  TEMPLATES: history.map(s => `<template id="handoff-v${s.version}">${renderSnapshot(project, s, {latest: s === last})}</template>`).join('')
};
const template = (await readFile(join(assets, 'handoff-template.src.html'), 'utf8')).replace(/__(TITLE|GOAL|COUNT|TIMELINE|UPDATED|INITIAL|TEMPLATES)__/g, (_, k) => values[k]);
const src = destination.replace(/\.html$/, '.src.html');
await writeFile(src, template);
execFileSync(process.execPath, [join(assets, 'inline.mjs'), src, destination], {stdio: 'ignore'});
await writeFile(destination.replace(/\.html$/, '.fact.md'), history.map(s => renderFact(project, s)).reverse().join('\n---\n\n'));
await writeFile(destination.replace(/\.html$/, '.history.json'), JSON.stringify(history, null, 2));
const warnings = lint(history);
await writeFile(destination.replace(/\.html$/, '.build.json'), JSON.stringify({versions: history.length, generatedAt: new Date().toISOString(), warnings}, null, 2));
console.log(`已生成 ${output}（${history.length} 轮）`);
if (warnings.length) {
  console.log(`\n文字提示 ${warnings.length} 条（不阻断，发布前逐条处理或确认保留）：`);
  for (const w of warnings) console.log('- ' + w);
}

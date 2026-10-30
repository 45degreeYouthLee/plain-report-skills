// 黑盒检查：对照仓库目录和 tracking.json 里各模块的 paths。
// 用法：node scan-repo.mjs <仓库根目录> <tracking.json>
// 输出 tracking.scan.json（与 tracking.json 同目录），构建时自动读取。
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, dirname, resolve, relative, sep} from 'node:path';
import {execFileSync} from 'node:child_process';

const [repoArg, trackingArg] = process.argv.slice(2);
if (!repoArg || !trackingArg) { console.error('用法：node scan-repo.mjs <仓库根目录> <tracking.json>'); process.exit(2); }
const repo = resolve(repoArg);
const tracking = JSON.parse(readFileSync(trackingArg, 'utf8'));
const SKIP = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'out', '.vs', '.idea', '.vscode', '_reports', '_measure', 'coverage', '__pycache__', '.claude', '.codex']);
const CODE = /\.(cs|csproj|ts|tsx|js|mjs|cjs|py|go|rs|java|kt|swift|cpp|c|h|vue|svelte|html|css|ps1|sh|sql)$/i;

// 统计一个目录下的代码文件数（递归，跳过构建产物）
function count(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) n += count(p);
    else if (CODE.test(name)) n += 1;
  }
  return n;
}
// 两层以内含代码的目录；第一层目录本身有代码文件时就把它当一个单元
const units = [];
for (const top of readdirSync(repo)) {
  const p = join(repo, top);
  if (SKIP.has(top) || top.startsWith('.') || !statSync(p).isDirectory()) continue;
  const direct = readdirSync(p).some(f => CODE.test(f));
  const subs = readdirSync(p).filter(f => !SKIP.has(f) && !f.startsWith('.') && statSync(join(p, f)).isDirectory() && count(join(p, f)) > 0);
  if (direct || !subs.length) { if (count(p) > 0) units.push(top); }
  else for (const s of subs) units.push(top + '/' + s);
}
const norm = s => s.replace(/\\/g, '/').replace(/\/+$/, '');
const paths = (tracking.architecture?.layers || []).flatMap(l => (l.modules || []).flatMap(m => (m.paths || []).map(norm)));
const whole = u => paths.some(p => u === p || u.startsWith(p + '/'));
const inside = u => paths.some(p => p.startsWith(u + '/'));
// 目录整体被某个模块认领就算覆盖；只有其中一部分被认领时，逐个检查它的子项，找出没人认领的文件和子目录
function uncovered(u) {
  if (whole(u)) return [];
  const full = join(repo, u);
  if (!statSync(full).isDirectory()) return CODE.test(u) ? [u] : [];
  if (!inside(u)) return count(full) > 0 ? [u] : [];
  return readdirSync(full).filter(n => !SKIP.has(n) && !n.startsWith('.')).flatMap(n => uncovered(u + '/' + n));
}
let lastCommit = null;
try { lastCommit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%h %ad %s', '--date=short'], {encoding: 'utf8'}).trim(); } catch {}
const result = {
  scannedAt: new Date().toISOString().slice(0, 10),
  repo: relative(dirname(resolve(trackingArg)), repo).split(sep).join('/') || '.',
  lastCommit,
  units: units.map(u => ({path: u, codeFiles: count(join(repo, u))})),
  unmapped: units.flatMap(uncovered),
  missing: paths.filter(p => !existsSync(join(repo, p)))
};
const out = join(dirname(resolve(trackingArg)), 'tracking.scan.json');
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`已扫描 ${units.length} 个代码目录：${result.unmapped.length} 个不在架构图里，${result.missing.length} 个模块路径找不到。结果：${out}`);
for (const u of result.unmapped) console.log('- 图上没有：' + u);
for (const m of result.missing) console.log('- 仓库里没有：' + m);

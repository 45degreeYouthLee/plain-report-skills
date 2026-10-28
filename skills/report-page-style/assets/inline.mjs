// 把页面里带 data-inline 的 <link href="base.css"> 和 <script src="stepper.js"></script> 换成文件内容，输出单文件 HTML。
// 用法：node inline.mjs <源文件.src.html> [输出.html]   （不给输出时，去掉 .src 写到同目录）
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const fail = msg => { console.error('inline.mjs：' + msg); process.exit(2); };
const [src, out] = process.argv.slice(2);
if (!src) fail('用法：node inline.mjs <源文件.src.html> [输出.html]');
if (!existsSync(src)) fail('找不到源文件 ' + src);

const here = dirname(fileURLToPath(import.meta.url));
const asset = f => {
  const p = join(here, f);
  if (!existsSync(p)) fail('找不到要嵌入的文件 ' + p);
  return readFileSync(p, 'utf8');
};

let html = readFileSync(src, 'utf8');
// 属性顺序不限：只要标签里有 data-inline，就取它的 href 或 src
html = html.replace(/<link\b[^>]*\bdata-inline\b[^>]*>/g, tag => {
  const f = /\bhref="([^"]+)"/.exec(tag)?.[1] ?? fail('标签缺少 href：' + tag);
  return `<style>\n${asset(f)}</style>`;
});
html = html.replace(/<script\b[^>]*\bdata-inline\b[^>]*><\/script>/g, tag => {
  const f = /\bsrc="([^"]+)"/.exec(tag)?.[1] ?? fail('标签缺少 src：' + tag);
  return `<script>\n${asset(f)}</script>`;
});
if (/\bdata-inline\b/.test(html)) fail('还有没替换掉的 data-inline 标签，请检查写法');

const target = out ?? src.replace(/\.src\.html$/, '.html');
if (resolve(target) === resolve(src)) fail('输出会覆盖源文件；源文件请以 .src.html 结尾，或给出输出路径');
mkdirSync(dirname(resolve(target)), {recursive: true});
writeFileSync(target, html);
console.log(target);

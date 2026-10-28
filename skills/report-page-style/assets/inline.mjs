// 把页面里的 <link data-inline href="base.css"> 和 <script data-inline src="stepper.js"></script> 换成文件内容，输出单文件 HTML。
// 用法：node inline.mjs <源文件.src.html> [输出.html]   （不给输出时，去掉 .src 写到同目录）
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
const [src, out] = process.argv.slice(2);
if (!src) { console.error('用法：node inline.mjs <源文件.src.html> [输出.html]'); process.exit(2); }
const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let html = readFileSync(src, 'utf8');
html = html.replace(/<link[^>]*data-inline[^>]*href="([^"]+)"[^>]*>/g, (_, f) => `<style>\n${readFileSync(join(here, f), 'utf8')}</style>`);
html = html.replace(/<script[^>]*data-inline[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, f) => `<script>\n${readFileSync(join(here, f), 'utf8')}</script>`);
const target = out ?? src.replace(/\.src\.html$/, '.html');
if (target === src) { console.error('输出会覆盖源文件；请给出输出路径'); process.exit(2); }
writeFileSync(target, html);
console.log(target);

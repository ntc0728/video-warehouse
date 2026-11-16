#!/usr/bin/env node
/**
 * CSS Token 引用闭合门（lint:tokens）
 *
 * 拦两类「token 图不闭合」的漂移 —— 它们不会让构建失败、也不会在页面上报错，
 * 只会让某条声明在计算值阶段整条失效（静默丢样式），所以必须机器检查：
 *
 *   ① **引用了不存在的 token**：`var(--radius-xs)` 而 `--radius-xs` 全仓未定义
 *      → 该声明无效（`border-radius` 退回 0、`font-size` 退回继承…）。
 *      历史欠账：`--color-accent`（详情海报进度条不可见）、`--text-4xl`（TV 标题字号失效）、
 *      `--radius-xs/--radius-3xs`、`--space-4xl`、`--color-surface-2`、`--color-bg-hover` 等 19 处。
 *   ② **定义了但从未消费**：死 token 会长期误导（改它以为有效果），也是双轨命名的温床。
 *
 * 合法例外：
 *   - `--radix-*`：Radix UI 在运行期注入到元素上的契约变量（本仓只读不写）。
 *   - JS 注入的 token：`setProperty()/removeProperty()/getPropertyValue()` 与
 *     `style={{ '--x': … }}`（含 `['--x' as string]:` 写法）——这些是动态契约，
 *     不需要在 CSS 里定义；CSS 侧消费时应带 fallback（`var(--x, 0px)`）。
 *
 * 用法：node scripts/lint-css-tokens.mjs   （exit 1 = 有断链）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
/** 第三方运行期注入的 token 前缀（非本仓定义） */
const EXTERNAL_PREFIXES = ['--radix-'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const rootIndex = path.join(ROOT, 'index.html');
if (fs.existsSync(rootIndex)) files.push(rootIndex);

/** 保留换行地把注释替换成空白（行号不漂移） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

const defined = new Map(); // token -> Set(file)
const injected = new Set();
const refs = new Map(); // token -> [{file,line}]

function addDef(token, file) {
  if (!defined.has(token)) defined.set(token, new Set());
  defined.get(token).add(file);
}

for (const abs of files) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const raw = fs.readFileSync(abs, 'utf8');
  const text = abs.endsWith('.css') ? stripComments(raw) : raw;

  if (abs.endsWith('.css')) {
    // 自定义属性定义：只在声明位置（块内、`;` 结尾）认，避免把 `.btn--active:hover` 当 token
    let depth = 0;
    let buf = '';
    for (const ch of text) {
      if (ch === '{') { depth += 1; buf = ''; continue; }
      if (ch === '}') { depth = 0; buf = ''; continue; }
      if (ch === ';') {
        const m = /^\s*(--[a-z0-9-]+)\s*:/.exec(buf);
        if (m && depth >= 1) addDef(m[1], rel);
        buf = '';
        continue;
      }
      buf += ch;
    }
  } else {
    // 内联 style / HTML <style> 里的定义与 JS 注入
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) addDef(m[1], rel);
  }

  // JS 注入契约
  const injectionPatterns = [
    /setProperty\(\s*['"](--[a-z0-9-]+)['"]/g,
    /removeProperty\(\s*['"](--[a-z0-9-]+)['"]/g,
    /getPropertyValue\(\s*['"](--[a-z0-9-]+)['"]/g,
    /['"](--[a-z0-9-]+)['"]\s*(?:as\s+[\w.]+\s*)?[:\]]/g,
  ];
  for (const re of injectionPatterns) {
    for (const m of text.matchAll(re)) injected.add(m[1]);
  }

  // 引用
  for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    if (!refs.has(m[1])) refs.set(m[1], []);
    refs.get(m[1]).push({ file: rel, line: lineOf(text, m.index) });
  }
}

const isExternal = (t) => EXTERNAL_PREFIXES.some((p) => t.startsWith(p));

const broken = [...refs.entries()]
  .filter(([t]) => !defined.has(t) && !injected.has(t) && !isExternal(t))
  .sort(([a], [b]) => a.localeCompare(b));

const dead = [...defined.keys()]
  .filter((t) => !refs.has(t) && !injected.has(t) && !isExternal(t))
  .sort();

const pad = (s, n) => String(s).padEnd(n);
console.log('\nCSS Token 引用闭合审计（lint:tokens）\n' + '─'.repeat(76));
console.log(`定义 ${defined.size} 个 · 被引用 ${refs.size} 个 · JS 注入契约 ${injected.size} 个`);

if (broken.length) {
  console.log(`\n✗ 引用了不存在的 token（${broken.length} 个，声明会整条失效）：`);
  for (const [t, list] of broken) {
    const where = list.slice(0, 3).map((x) => `${x.file}:${x.line}`).join(', ');
    console.log(`    ${pad(t, 28)} ${where}${list.length > 3 ? ` … 共 ${list.length} 处` : ''}`);
  }
}

if (dead.length) {
  console.log(`\n· 定义但从未被消费（${dead.length} 个，死 token 建议删除）：`);
  for (const t of dead) {
    console.log(`    ${pad(t, 28)} ${[...defined.get(t)].slice(0, 2).join(', ')}`);
  }
}

console.log('─'.repeat(76));
if (broken.length) {
  console.log(`✗ ${broken.length} 个断链 token：请补定义，或改用已有 token / color-mix 派生。\n`);
  process.exit(1);
}
console.log(
  dead.length ? `✓ 无断链（另有 ${dead.length} 个死 token 待清理）\n` : '✓ 全部 token 引用闭合（无断链、无死 token）\n',
);

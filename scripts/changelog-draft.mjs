#!/usr/bin/env node
// scripts/changelog-draft.mjs
// 从 git 改动自动生成 changelog _pending 片段骨架，供 agent 补充「为什么」。
// 用法:
//   node scripts/changelog-draft.mjs [--since <ref>] [--module <m>] [--type <feat|fix|refactor|...>] [--slug <s>]
//   --since 默认 HEAD~1（仅 1 个提交时退化为首个 commit）
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const run = (cmd) =>
  execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const since = arg('--since', null);
const moduleHint = arg('--module', null);
const typeHint = arg('--type', null);
const slugHint = arg('--slug', null);

// 解析 since ref
let sinceRef = since;
if (!sinceRef) {
  try {
    run('git rev-parse --verify HEAD~1');
    sinceRef = 'HEAD~1';
  } catch {
    try {
      sinceRef = run('git rev-list --max-parents=0 HEAD');
    } catch {
      sinceRef = null;
    }
  }
}
const range = sinceRef ? `${sinceRef} HEAD` : 'HEAD';

// 改动文件
let files = [];
try {
  files = run(`git diff --name-only ${range}`).split('\n').filter(Boolean);
} catch {
  files = [];
}

// 提交标题
let commits = [];
try {
  commits = run(`git log --oneline ${range}`).split('\n').filter(Boolean);
} catch {
  commits = [];
}

// 增删行
let stat = '';
try {
  stat = run(`git diff --stat ${range}`);
} catch {
  stat = '';
}

// 推断 module
function inferModule(files) {
  for (const f of files) {
    const m = f.match(/^src\/(pages|components)\/([^/]+)/);
    if (m) return m[2].toLowerCase();
  }
  if (files.some((f) => f.includes('src/'))) return 'src';
  if (files.some((f) => f.includes('scripts/'))) return 'scripts';
  return 'misc';
}

const date = new Date();
const ymd = date.toISOString().slice(0, 10);
const hhmm = date.toTimeString().slice(0, 5).replace(':', '');
const moduleName = moduleHint || inferModule(files);
const typeName = typeHint || 'fix';
const title = (commits[0] || 'chore: 改动').replace(/^[a-z]+(\(.+?\))?:\s*/i, '');
const slug =
  slugHint ||
  title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/gi, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '') ||
  'change';

const outDir = resolve('changelogs/_pending');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const fileName = `${ymd}-${hhmm}-${slug}.md`;
const filePath = join(outDir, fileName);

const body = `---
date: ${ymd}
module: ${moduleName}
type: ${typeName}
build: pending
files: [${files.map((f) => `'${f}'`).join(', ')}]
demo:
---

## ${title}

- 问题：（待补：为什么改、现象是什么）
- 旧逻辑（文件:行号）：（待补）
- 新逻辑：（待补）
- 涉及文件：
${files.map((f) => `  - ${f}`).join('\n') || '  - （无）'}

> 本片段由 \`changelog-draft.mjs\` 自动生成骨架，请补充「问题/旧逻辑/新逻辑」后，push 前运行 \`node scripts/changelog-collect.mjs\` 合并。
`;

writeFileSync(filePath, body);
console.log(`已生成片段: ${filePath}`);
console.log(`  模块=${moduleName} 类型=${typeName} 文件数=${files.length}`);
console.log(`  最近提交: ${commits[0] || '(无)'}`);
if (stat) console.log(`\n${stat}`);
console.log(`\n下一步: 补充对照内容，push 前运行 node scripts/changelog-collect.mjs`);

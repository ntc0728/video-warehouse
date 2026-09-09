#!/usr/bin/env node
// scripts/changelog-collect.mjs
// 合并 changelogs/_pending/*.md → changelogs/YYYY-MM-DD.md，并归档到 _pending/_archived/。
// 同文件名幂等：已归档的同名片段不再合并。
// 用法:
//   node scripts/changelog-collect.mjs [--dry-run]
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';

const ROOT = resolve('.');
const PENDING = join(ROOT, 'changelogs/_pending');
const ARCHIVED = join(PENDING, '_archived');
const dryRun = process.argv.includes('--dry-run');

function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!mm) return;
    let v = mm[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      try {
        v = JSON.parse(v.replace(/'/g, '"'));
      } catch {
        v = [];
      }
    } else if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    meta[mm[1]] = v;
  });
  const body = raw.slice(m[0].length).replace(/^\n+/, '');
  return { meta, body };
}

if (!existsSync(PENDING)) {
  console.log('无 _pending 目录，无需合并');
  process.exit(0);
}

const files = readdirSync(PENDING).filter(
  (f) => f.endsWith('.md') && statSync(join(PENDING, f)).isFile(),
);

if (files.length === 0) {
  console.log('无待合并片段');
  process.exit(0);
}

// 按 date 分组
const groups = {};
for (const f of files) {
  const raw = readFileSync(join(PENDING, f), 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  const date = (meta.date || '').slice(0, 10);
  if (!date) {
    console.warn(`⚠️ 跳过（无 date 字段）: ${f}`);
    continue;
  }
  groups[date] = groups[date] || [];
  groups[date].push({ file: f, body });
}

let merged = 0;
let skipped = 0;
if (!dryRun && !existsSync(ARCHIVED)) mkdirSync(ARCHIVED, { recursive: true });

for (const [date, items] of Object.entries(groups).sort()) {
  const targetFile = join(ROOT, 'changelogs', `${date}.md`);
  let existing = existsSync(targetFile) ? readFileSync(targetFile, 'utf8') : '';
  if (!existing) existing = `# 改动记录 ${date}\n\n`;

  for (const it of items) {
    const archivedPath = join(ARCHIVED, it.file);
    if (existsSync(archivedPath)) {
      console.log(`跳过(已归档): ${it.file}`);
      skipped++;
      continue;
    }
    const sep = existing.endsWith('\n') ? '\n' : '\n\n';
    existing += `${sep}---\n\n${it.body.trim()}\n`;
    merged++;
    if (!dryRun) renameSync(join(PENDING, it.file), archivedPath);
    console.log(`合并: ${it.file} → changelogs/${date}.md`);
  }
  if (!dryRun) writeFileSync(targetFile, existing.trimEnd() + '\n');
}

console.log(`\n完成: 合并 ${merged} 篇，跳过 ${skipped} 篇(已归档)`);
if (dryRun) console.log('（dry-run，未写入）');

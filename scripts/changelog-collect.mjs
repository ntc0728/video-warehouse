#!/usr/bin/env node
// scripts/changelog-collect.mjs
// 合并 changelogs/_pending/*.md → changelogs/YYYY-MM-DD.md，并归档到 _pending/_archived/。
// 同文件名幂等：已归档的同名片段不再合并。
//
// ⚠️ 2026-09-14 修复的两个缺陷（此前会导致 push 被 pre-push 钩子永久阻断）：
//   1) 「已归档 → continue」分支只跳过、**不删源文件**：一旦某片段已在 _archived/ 中，
//      它在 _pending/ 下的残留就永远清不掉 —— 每次运行都只打印「跳过(已归档)」，
//      文件计数恒为 1，pre-push 钩子（检测 _pending/*.md > 0）随之永久阻断 push，
//      只能靠手工 rm 破局。现改为「跳过合并但仍把源文件移除」。
//   2) 去重判据只有「_archived/ 里有没有同名文件」这一个真源：若 _archived/ 丢失
//      （换机 / 误删 / 未随分支带过来），已合并过的正文会被**重复追加**进 changelog。
//      现增加正文级幂等兜底：合并前检查目标 changelog 是否已含该片段正文（归一化后
//      比较），命中则视为已合并，同样只清理不追加。
// 用法:
//   node scripts/changelog-collect.mjs [--dry-run]
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  rmSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

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

// 正文归一化：用于「已合并」判定。
// 只做空白层面的收敛（统一换行 / 去行尾空白 / 压缩连续空行 / 去首尾空白），
// 不碰任何实质字符 —— 避免把「两份不同片段」误判成同一份而漏合并。
function normalizeBody(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
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
let cleaned = 0;
let dupDetected = 0;
if (!dryRun && !existsSync(ARCHIVED)) mkdirSync(ARCHIVED, { recursive: true });

for (const [date, items] of Object.entries(groups).sort()) {
  const targetFile = join(ROOT, 'changelogs', `${date}.md`);
  let existing = existsSync(targetFile) ? readFileSync(targetFile, 'utf8') : '';
  if (!existing) existing = `# 改动记录 ${date}\n\n`;
  // 正文级幂等基线：每轮追加后同步刷新，保证同一批内多个片段互不误判。
  let existingNorm = normalizeBody(existing);

  for (const it of items) {
    const archivedPath = join(ARCHIVED, it.file);
    const srcPath = join(PENDING, it.file);
    const bodyNorm = normalizeBody(it.body);

    // 判定「已合并」的两条独立真源：①归档区已有同名文件 ②目标 changelog 正文已含该片段。
    // ② 是兜底：_archived/ 丢失时（换机 / 误删 / 分支未带过来）仍能挡住重复追加。
    const archivedAlready = existsSync(archivedPath);
    const bodyAlready = bodyNorm.length > 0 && existingNorm.includes(bodyNorm);

    if (archivedAlready || bodyAlready) {
      // ⚠️ 关键修复：命中「已合并」时必须把源片段从 _pending/ 移除。
      // 旧实现只 continue，导致残留片段令 pre-push 钩子（检测 _pending/*.md > 0）
      // 永久阻断 push。归档区缺文件时补一份，保证归档完整。
      if (!dryRun) {
        if (!archivedAlready) {
          writeFileSync(archivedPath, readFileSync(srcPath, 'utf8'));
        }
        rmSync(srcPath, { force: true });
      }
      const why = archivedAlready ? '已归档' : '正文已在 changelog 中(兜底)';
      if (!archivedAlready) dupDetected++;
      console.log(`跳过(${why})并清理: ${it.file}`);
      skipped++;
      cleaned++;
      continue;
    }

    const sep = existing.endsWith('\n') ? '\n' : '\n\n';
    existing += `${sep}---\n\n${it.body.trim()}\n`;
    existingNorm = normalizeBody(existing);
    merged++;
    if (!dryRun) renameSync(srcPath, archivedPath);
    console.log(`合并: ${it.file} → changelogs/${date}.md`);
  }
  if (!dryRun) writeFileSync(targetFile, existing.trimEnd() + '\n');
}

console.log(
  `\n完成: 合并 ${merged} 篇，跳过 ${skipped} 篇(已合并，其中 ${cleaned} 篇已清理${
    dupDetected ? `，${dupDetected} 篇由正文兜底拦下` : ''
  })`,
);
if (dryRun) console.log('（dry-run，未写入）');

#!/usr/bin/env node
/**
 * test-count-report.mjs —— E2E 用例计数 / 测试映射一致性报告（2026-09-23 新增）
 *
 * ── 它解决什么问题 ────────────────────────────────────────────────────────────
 * 1. `docs/agents/testing.md` 的「test 数」列长期靠人工维护，多轮合并/迁移后变成历史
 *    快照（曾出现「home 列写 46、实际 13」这类错值），且同一数字在多个文档里各写一份
 *    → 必然漂移。本脚本把「数字」变成**可重算的产物**，文档只引用它。
 * 2. `scripts/run-tests.ps1` 的映射表（$uiTestMap / $uiPrecisionMap / $logicTestMap）
 *    在文件改名、describe 段重编号后会**静默失效**（引用不存在的 spec、grep 片段永不命中），
 *    原本只在运行时打一行黄字警告。本脚本把它变成可校验的硬事实。
 *
 * ── 数据源（全部是「真源」，脚本不自己复制一份） ─────────────────────────────
 * - `npx playwright test --list` → 每个 spec 的真实用例数与完整标题（describe › test）
 * - `scripts/run-tests.ps1`      → 三个映射表 + $testGroups（增量/分组档的取数逻辑）
 * - `scripts/e2e-suite.mjs`      → PREVIEW_SPECS / A_EXCLUDE（默认套两阶段的取数逻辑）
 * - `package.json`               → `test:e2e:*` 各按需档显式传入的 spec
 *
 * ── 用法 ─────────────────────────────────────────────────────────────────────
 *   node scripts/test-count-report.mjs                 # 打印完整报告（人读）
 *   node scripts/test-count-report.mjs --markdown      # 只打印可粘贴的 markdown 片段
 *   node scripts/test-count-report.mjs --list-file <p> # 复用已有 --list 输出（离线/加速）
 *   node scripts/test-count-report.mjs --write         # 把生成块写回 docs/agents/testing.md
 *   node scripts/test-count-report.mjs --check         # 只校验（exit 1 = 有问题）
 *
 * `--check` 的校验项（也是 `npm run lint:test-map` 的内容）：
 *   A. 映射/分组/按需档里引用的 spec 文件**必须存在**（防改名后死引用）
 *   B. grep 的每个 `|` 片段在它声明的 spec 里**必须至少命中 1 条**（防段号重编号后死 grep）
 *   C. 档位恒等式：Stage A + Stage B = 默认套；默认套 + 按需档 = 全仓 `--list` 总数
 *   D. `docs/agents/testing.md` 的生成块与本次实算一致（防文档过期）
 *
 * 退出码：0 全部通过；1 有任一校验失败；2 环境/参数错误（如 --list 跑不起来）。
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = join(ROOT, 'docs', 'agents', 'testing.md');
const RUN_TESTS = join(ROOT, 'scripts', 'run-tests.ps1');
const E2E_SUITE = join(ROOT, 'scripts', 'e2e-suite.mjs');
const BLOCK_BEGIN = '<!-- test-counts:begin';
const BLOCK_END = '<!-- test-counts:end -->';

// ── 0. 参数 ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const OPT = {
  markdown: argv.includes('--markdown'),
  write: argv.includes('--write'),
  check: argv.includes('--check'),
  listFile: (() => {
    const i = argv.indexOf('--list-file');
    return i >= 0 ? argv[i + 1] : null;
  })(),
};

// ── 1. 枚举：跑 playwright --list，拿到每个 spec 的真实用例数与完整标题 ─────────
/**
 * `--list` 每行长这样（注意：文件路径**不带** scripts/ 前缀，标题是 describe 用 › 拼起来的）：
 *   `  [chromium] › home.spec.ts:12:1 › 1.1 页面加载与初始状态 › HOME-001: 首屏渲染`
 * 解析出 { file: 'home.spec.ts', title: '1.1 页面加载与初始状态 › HOME-001: 首屏渲染' }。
 * 用 title 做正则匹配即可**等价复现** playwright `-g/--grep` 的命中判定（grep 匹配的就是完整标题）。
 */
async function listTests() {
  if (OPT.listFile) {
    if (!existsSync(OPT.listFile)) fail(`--list-file 不存在：${OPT.listFile}`, 2);
    return parseList(readFileSync(OPT.listFile, 'utf8'));
  }
  const out = await new Promise((res, rej) => {
    // 注意：必须用异步 spawn（受限沙箱里 spawnSync 会 EBUSY 静默失败）。
    // NODE_OPTIONS 置空：沙箱注入的 safe-delete shim 会让 playwright 的清理步骤假崩。
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--list'], {
      cwd: ROOT,
      env: { ...process.env, NODE_OPTIONS: '' },
      windowsHide: true,
    });
    let buf = '';
    child.stdout.on('data', (d) => (buf += d));
    child.stderr.on('data', (d) => (buf += d));
    child.on('error', rej);
    child.on('close', (code) => (code === 0 ? res(buf) : rej(new Error(`playwright --list exit ${code}\n${buf}`))));
  }).catch((e) => fail(String(e.message || e), 2));
  return parseList(out);
}

function parseList(text) {
  const tests = [];
  for (const line of text.split(/\r?\n/)) {
    // 只认「[chromium] › <file>:<line>:<col> › <title…>」这种列举行
    const m = line.match(/\[[a-z-]+\]\s+›\s+([A-Za-z0-9._-]+\.spec\.ts):\d+:\d+\s+›\s+(.*)$/);
    if (m) tests.push({ file: m[1], title: m[2].trim() });
  }
  return tests;
}

// ── 2. 解析 run-tests.ps1 的三个映射表与分组 ────────────────────────────────
/** 从 `$name = @{` 起到同名缩进层级的 `}` 止，取整段文本（按花括号深度计数，够用且不引第三方 parser）。 */
function sliceHashtable(src, marker) {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith(marker));
  if (start < 0) fail(`run-tests.ps1 里找不到 ${marker}`, 2);
  const out = [];
  let depth = 0;
  let started = false;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    out.push(l);
    for (const ch of l) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') depth--;
    }
    if (started && depth <= 0) break;
  }
  return out;
}

/** 解析 `"KEY" = @{ spec = @(…) ; grep = "…" }` 形式（可跨行）的条目。 */
function parseEntryBlocks(blockLines) {
  const entries = [];
  let i = 0;
  while (i < blockLines.length) {
    const head = blockLines[i].match(/^\s*"([^"]+)"\s*=\s*@\{(.*)$/);
    if (!head) {
      i++;
      continue;
    }
    let body = head[2];
    let depth = 1 + countBraces(head[2]);
    while (depth > 0 && i + 1 < blockLines.length) {
      i++;
      body += '\n' + blockLines[i];
      depth += countBraces(blockLines[i]);
    }
    entries.push({ key: head[1], body });
    i++;
  }
  return entries;
}
const countBraces = (s) => (s.split('{').length - 1) - (s.split('}').length - 1);

/** 从条目 body 里取 spec 列表与 grep（grep 保留原始转义：ps1 里写 `1\.2`，正则里就该是 `1\.2`）。 */
function readEntry(body) {
  const specM = body.match(/spec\s*=\s*@\(([^)]*)\)/);
  const specs = specM
    ? specM[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    : [];
  const grepM = body.match(/grep\s*=\s*"([^"]*)"/);
  return { specs, grep: grepM ? grepM[1] : '' };
}

/** 解析 `"name" = @( "a", "b" )` 形式（$testGroups 的分组数组）。 */
function parseStringGroups(src, marker) {
  const block = sliceHashtable(src, marker).join('\n');
  const out = {};
  const re = /"([^"]+)"\s*=\s*@\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(block))) {
    out[m[1]] = m[2]
      .split(/[\r\n,]+/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s && s.endsWith('.spec.ts'));
  }
  return out;
}

function parseRunTests() {
  const src = readFileSync(RUN_TESTS, 'utf8');
  const uiTestMap = {};
  // $uiTestMap 是「一行一条 @("…")」的粗粒度兜底表
  for (const l of sliceHashtable(src, '$uiTestMap')) {
    const m = l.match(/^\s*"([^"]+)"\s*=\s*@\(([^)]*)\)/);
    if (m) {
      uiTestMap[m[1]] = m[2]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }
  const blocks = (marker) => parseEntryBlocks(sliceHashtable(src, marker)).map((e) => ({ key: e.key, ...readEntry(e.body) }));
  return {
    uiTestMap,
    uiPrecisionMap: blocks('$uiPrecisionMap'),
    logicTestMap: blocks('$logicTestMap'),
    groups: parseStringGroups(src, '$testGroups'),
  };
}

// ── 3. 解析 e2e-suite.mjs 的两阶段 spec 名单 ─────────────────────────────────
/**
 * - `PREVIEW_SPECS` 是数组字面量（含完整 `scripts/x.spec.ts`）→ Stage B
 * - `A_EXCLUDE` 是**逗号拼接的字符串**（`[...].join(',')`，只写 spec 基名不带扩展名）
 *   → Stage A = 「全仓 spec − Stage B − A_EXCLUDE 基名」
 */
function parseSuite() {
  const src = readFileSync(E2E_SUITE, 'utf8');
  const previewM = src.match(/const\s+PREVIEW_SPECS\s*=\s*\[([\s\S]*?)\]/);
  if (!previewM) fail('e2e-suite.mjs 里找不到 PREVIEW_SPECS', 2);
  const preview = [...previewM[1].matchAll(/'([^']+\.spec\.ts)'/g)].map((x) => x[1]);
  const excludeM = src.match(/const\s+A_EXCLUDE\s*=\s*\[([\s\S]*?)\]/);
  if (!excludeM) fail('e2e-suite.mjs 里找不到 A_EXCLUDE', 2);
  const aExcludeBases = [...excludeM[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return { preview, aExcludeBases };
}

// ── 4. 计算 ─────────────────────────────────────────────────────────────────
const specShort = (p) => p.replace(/^scripts\//, '');

function build() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const run = parseRunTests();
  const suite = parseSuite();

  // 按需档：package.json 里 `test:e2e:*` 显式传的 spec（排除通用开关 --all/--dev）
  const onDemand = {};
  for (const [k, cmd] of Object.entries(pkg.scripts)) {
    if (!k.startsWith('test:e2e:')) continue;
    const specs = [...cmd.matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9._-]+\.spec\.ts)/g)].map((m) => m[1]);
    if (specs.length) onDemand[k] = specs;
  }

  return { run, suite, onDemand };
}

function fail(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

// ── 5. 主流程 ───────────────────────────────────────────────────────────────
const tests = await listTests();
if (tests.length === 0) fail('--list 解析到 0 条用例，输出格式可能变了', 2);

const { run, suite, onDemand } = build();
const count = new Map(); // 'home.spec.ts' → n
for (const t of tests) count.set(t.file, (count.get(t.file) || 0) + 1);
const files = [...count.keys()].sort();
const total = tests.length;
const n = (p) => count.get(specShort(p)) ?? 0;

/**
 * 用完整标题正则复现 playwright `-g/--grep` 的命中计数。
 * - 入参 specs 接受单个路径或路径数组（数组 = 并集，正是 run-tests.ps1 实际跑集合的口径）
 * - grep 为空字符串 = 该 spec 全量
 */
const hit = (specs, grep) => {
  const list = Array.isArray(specs) ? specs : [specs];
  const re = grep ? new RegExp(grep) : null;
  let c = 0;
  for (const s of list) {
    const f = specShort(s);
    for (const t of tests) if (t.file === f && (!re || re.test(t.title))) c++;
  }
  return c;
};
const grepFragments = (grep) => (grep ? grep.split('|').filter(Boolean) : []);

// ── 5.1 校验 A：所有被引用的 spec 必须存在 ──────────────────────────────────
const refErrors = [];
const refs = new Set();
for (const [k, v] of Object.entries(run.uiTestMap)) v.forEach((s) => refs.add(`${s} (来自 $uiTestMap["${k}"])`));
for (const e of run.uiPrecisionMap) e.specs.forEach((s) => refs.add(`${s} (来自 $uiPrecisionMap["${e.key}"])`));
for (const e of run.logicTestMap) e.specs.filter((s) => s !== 'vitest').forEach((s) => refs.add(`${s} (来自 $logicTestMap["${e.key}"])`));
for (const [g, v] of Object.entries(run.groups)) v.forEach((s) => refs.add(`${s} (来自 $testGroups["${g}"])`));
[...suite.preview, ...suite.aExcludeBases].forEach((s) => refs.add(`${s} (来自 e2e-suite.mjs)`));
Object.entries(onDemand).forEach(([k, v]) => v.forEach((s) => refs.add(`${s} (来自 package.json ${k})`)));
for (const r of refs) {
  const p = r.split(' ')[0];
  // A_EXCLUDE 写的是 spec 基名（不带路径/扩展名），不能按路径存在性校验
  if (!p.includes('/')) continue;
  if (!existsSync(join(ROOT, p))) refErrors.push(`引用了不存在的 spec：${r}`);
}

// ── 5.2 校验 B：grep 片段必须真的命中（防段号重编号后的死 grep） ─────────────
const grepErrors = [];
const checkGrep = (label, specs, grep) => {
  const real = specs.filter((s) => s !== 'vitest' && existsSync(join(ROOT, s)));
  if (!real.length) return;
  if (grep && hit(real, grep) === 0) grepErrors.push(`${label}：整条 grep 在 ${real.map(specShort).join(' + ')} 里 0 命中（段号/编号已失效）`);
  for (const frag of grepFragments(grep)) {
    if (hit(real, frag) === 0) grepErrors.push(`${label}：grep 片段 \`${frag}\` 0 命中 → 该片段已失效，请删掉或改正`);
  }
};
for (const e of run.uiPrecisionMap) checkGrep(`$uiPrecisionMap["${e.key}"]`, e.specs, e.grep);
for (const e of run.logicTestMap) checkGrep(`$logicTestMap["${e.key}"]`, e.specs, e.grep);

// ── 5.3 校验 C+D：档位恒等式 + 映射 pattern 基路径存在性 ─────────────────────
const stageB = suite.preview;
const stageA = files
  .map((f) => `scripts/${f}`)
  // Stage A = 全仓 − Stage B − A_EXCLUDE 基名（A_EXCLUDE 只写基名，不带 .spec.ts）
  .filter((s) => !stageB.includes(s) && !suite.aExcludeBases.includes(specShort(s).replace(/\.spec\.ts$/, '')));
const sumOver = (list) => list.reduce((a, s) => a + n(s), 0);
// 按需档里不落在默认套两阶段的 spec（去重后）才算「额外档」，用于第二条恒等式
const onDemandOnly = [...new Set(Object.values(onDemand).flat())].filter((s) => !stageA.includes(s) && !stageB.includes(s));
const identities = [
  ['Stage A + Stage B = 默认套', sumOver(stageA) + sumOver(stageB), sumOver([...stageA, ...stageB])],
  ['默认套 + 按需档 = 全仓 --list', sumOver([...stageA, ...stageB]) + sumOver(onDemandOnly), total],
  ['回归组 spec 全部存在', (run.groups.regression ?? []).filter((s) => existsSync(join(ROOT, s))).length, (run.groups.regression ?? []).length],
];
const identityErrors = [];
for (const [label, a, b] of identities) if (a !== b) identityErrors.push(`${label}：${a} ≠ ${b}`);

// ── 5.3b 校验 E：映射 pattern 的基路径必须存在 ───────────────────────────────
// 与校验 A（spec 文件不存在）互补：这里是「**源文件 glob 写错**」——
// 例如 `src/pages/Browse/FilterBar/**`（该目录早已迁到 `src/components/FilterBar/`）：
// 这条映射永远不会命中任何改动文件 → 改 FilterBar 时静默不跑测试（不报错、不警告）＝最隐蔽的假绿。
const patternErrors = [];
const checkPattern = (scope, key) => {
  const base = key.replace(/\/\*\*.*$/, '').replace(/\/\*$/, '').replace(/\/$/, '');
  if (!existsSync(join(ROOT, base))) patternErrors.push(`${scope} 的 pattern 基路径不存在：\`${key}\`（→ 该映射永不命中）`);
};
Object.keys(run.uiTestMap).forEach((k) => checkPattern('$uiTestMap', k));
run.uiPrecisionMap.forEach((e) => checkPattern('$uiPrecisionMap', e.key));
run.logicTestMap.forEach((e) => checkPattern('$logicTestMap', e.key));

// ── 5.4 生成 markdown ──────────────────────────────────────────────────────
const groupRow = (label, cmd, specs) => `| ${label} | \`${cmd}\` | **${sumOver(specs)}** | ${specs.length} |`;
const ownership = (f) => {
  const p = `scripts/${f}`;
  if (stageB.includes(p)) return '默认套 B（preview 播放器系）';
  if (stageA.includes(p)) return '默认套 A（dev 行为套）';
  for (const [k, v] of Object.entries(onDemand)) if (v.includes(p)) return `按需 \`${k}\``;
  return '未挂任何档（手工/已废弃）';
};

const md = [];
md.push(BLOCK_BEGIN + ' ⚙️ 由 scripts/test-count-report.mjs --write 生成，勿手改数字 -->');
md.push('#### ① 档位汇总');
md.push('');
md.push('| 档位 | 命令 | 用例数 | spec 数 |');
md.push('| --- | --- | --- | --- |');
md.push(`| 全仓枚举 | \`npx playwright test --list\` | **${total}** | ${files.length} |`);
md.push(`| 默认套 | \`npm run test:e2e\` | **${sumOver([...stageA, ...stageB])}** | ${stageA.length + stageB.length} |`);
md.push(`| ├ Stage A（dev 行为套） | \`e2e-suite.mjs\` 阶段 A | ${sumOver(stageA)} | ${stageA.length} |`);
md.push(`| └ Stage B（preview 播放器系） | \`e2e-suite.mjs\` 阶段 B | ${sumOver(stageB)} | ${stageB.length} |`);
md.push(`| 发版回归组 | \`npm run test:regression\` | **${sumOver(run.groups.regression ?? [])}** | ${(run.groups.regression ?? []).length} |`);
md.push(`| 冒烟组（与改动侦测取交集） | \`npm run test:smoke\` | ${sumOver(run.groups.smoke ?? [])} | ${(run.groups.smoke ?? []).length} |`);
for (const [k, v] of Object.entries(onDemand)) md.push(`| 按需 | \`npm run ${k}\` | ${sumOver(v)} | ${v.length} |`);
md.push('');
md.push('恒等式（脚本校验）：Stage A + Stage B = 默认套；默认套 + 按需档 = 全仓枚举数。');
md.push('');
md.push('#### ② 每个 spec 的用例数（`--list` 实际枚举）');
md.push('');
md.push('| spec | 用例数 | 归属档位 |');
md.push('| --- | --- | --- |');
for (const f of [...files].sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b))) {
  md.push(`| \`scripts/${f}\` | ${count.get(f)} | ${ownership(f)} |`);
}
md.push('');
md.push('#### ③ 源文件 → 跑的 spec（`scripts/run-tests.ps1` 映射事实表）');
md.push('');
md.push('「全量」= 该 spec 的 `--list` 总数；「grep 命中」= 把该条目的 grep 正则套在本 spec 集合标题上的命中数。');
md.push('实际单轮跑多少条 = **所有命中条目 grep 的并集**（多条目同时命中会累积），以运行时输出为准。');
md.push('');
md.push('| 修改的源文件（pattern） | 跑的 spec（全量数） | 全量合计 | 精粒度 grep | grep 命中 |');
md.push('| --- | --- | --- | --- | --- |');
const mapRows = [
  ...run.uiPrecisionMap.map((e) => ({ tag: '精', ...e })),
  ...run.logicTestMap.map((e) => ({ tag: '逻辑', ...e })),
  ...Object.entries(run.uiTestMap).map(([key, specs]) => ({ tag: '兜底', key, specs, grep: '' })),
];
for (const r of mapRows) {
  const real = r.specs.filter((s) => s !== 'vitest');
  const hasVitest = r.specs.includes('vitest');
  // spec 单元格：只挂 vitest 的条目（httpClient / continueItems）没有 playwright 目标，显式写出来
  const specCell =
    (real.length ? real.map((s) => `\`${s}\`（${n(s)}）`).join(' + ') : '') + (hasVitest ? `${real.length ? ' + ' : ''}vitest 单测` : '');
  const hitCell = r.grep ? `${hit(real, r.grep)}` : '—';
  md.push(`| \`${r.key}\`${r.tag === '兜底' ? '（兜底）' : ''} | ${specCell || '—'} | ${sumOver(real)} | ${r.grep ? `\`${r.grep}\`` : '—'} | ${hitCell} |`);
}
md.push('');
md.push('> 「兜底」行 = `$uiTestMap` 的粗粒度条目：只在文件**未命中任何精粒度条目**时才生效（见下方口径 1）。');
md.push(BLOCK_END);
const generated = md.join('\n');

// ── 5.5 校验 D：文档生成块是否与实算一致 ────────────────────────────────────
const docSrc = readFileSync(DOC_PATH, 'utf8');
const bStart = docSrc.indexOf(BLOCK_BEGIN);
const bEnd = docSrc.indexOf(BLOCK_END);
const docBlock = bStart >= 0 && bEnd > bStart ? docSrc.slice(bStart, bEnd + BLOCK_END.length) : '';
const docOutdated = docBlock !== generated;

// ── 6. 输出 ─────────────────────────────────────────────────────────────────
const errors = [...refErrors, ...patternErrors, ...grepErrors, ...identityErrors];
if (docOutdated) errors.push('docs/agents/testing.md 的生成块已过期（跑 --write 同步）');

if (OPT.write) {
  if (bStart < 0 || bEnd < bStart) fail('testing.md 里没有 `<!-- test-counts:begin … -->` … `<!-- test-counts:end -->` 标记，无法写入');
  const next = docSrc.slice(0, bStart) + generated + docSrc.slice(bEnd + BLOCK_END.length);
  writeFileSync(DOC_PATH, next);
  console.log(`✓ 已写入 docs/agents/testing.md（${generated.split('\n').length} 行）`);
  process.exit(0);
}

const lines = [];
lines.push(`全仓枚举：${total} 条 / ${files.length} spec`);
lines.push(`默认套：${sumOver([...stageA, ...stageB])} 条（A ${sumOver(stageA)}/${stageA.length} + B ${sumOver(stageB)}/${stageB.length}）`);
lines.push(`回归组：${sumOver(run.groups.regression ?? [])} 条 / ${(run.groups.regression ?? []).length} spec`);
lines.push('');
lines.push('每 spec：');
for (const f of [...files].sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b)))
  lines.push(`  ${String(count.get(f)).padStart(4)}  ${f}  [${ownership(f)}]`);

if (OPT.markdown) {
  console.log(generated);
} else {
  console.log(lines.join('\n'));
  if (errors.length) {
    console.log('\n✗ 校验失败：');
    for (const e of errors) console.log(`  - ${e}`);
  } else {
    console.log('\n✓ 映射引用/ grep 命中 / 档位恒等式 / 文档生成块 全部一致');
  }
}
process.exit(errors.length ? 1 : 0);

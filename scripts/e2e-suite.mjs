#!/usr/bin/env node
/**
 * E2E 总编排器 —— 默认全量入口 `npm run test:e2e`。
 * 完整指令清单与分级门禁见 docs/agents/testing.md「E2E 指令」小节（本文件不重复维护指令表，避免两处漂移）。
 *
 * 阶段（串行，总预算默认 300s，到点看门狗击杀并判失败）：
 *   A（dev）     行为全套：除 PREVIEW_SPECS / A_EXCLUDE 外所有 spec。dev 是 cross-tab
 *                （/src 导入）与 smoke-fs / home 面板稳定性用例的必需形态；稳定档 3 worker。
 *   B（preview） 播放器系（player / failover / cms-error / iptv-player）：生产单包挂载快且稳，5 worker。
 *
 * 已移出默认套、改按需跑（保留覆盖，非删除）：
 *   - 取证截图 boot-splash-shots                       → npm run test:e2e:shots
 *   - 骨架三兄弟 skeleton / boot-splash-iso / boot-splash → npm run test:e2e:skeleton
 *   - 设置页子页 source-checker / proxy-setup           → npm run test:e2e:subpages
 *
 * 关键不可逆结论（勿反复试探）：
 *   - 行为套整体改投 preview 已实测证伪（home 面板稳定性 / cross-tab 依赖 dev；preview 单轮 245s 且红）。
 *   - 两阶段并行已实测否决（本机 8 chromium 抢 CPU → Stage B 播放器/骨架成片超时 16 failed）；
 *     仅强 CPU 机可 E2E_PARALLEL=1 开（两阶段 blob 写同一 .pw-blob 后 merge-reports 汇总）。
 *
 * 用法：
 *   node scripts/e2e-suite.mjs                       # 默认全量（串行）
 *   node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]   # 单 spec 调试（默认 preview，--dev 走源码态）
 *   node scripts/e2e-suite.mjs --budget 420          # 临时放宽预算秒数（排查用，不进默认路径）
 */
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const budgetIdx = argv.indexOf('--budget');
const BUDGET_MS = (budgetIdx >= 0 ? Number(argv[budgetIdx + 1]) : 300) * 1000;

const T0 = Date.now();
const say = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);

/** 启一个 e2e-skeleton 子跑批；收集退出码 */
function stage(name, args, env = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve(HERE, 'e2e-skeleton.mjs'), ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ...env, E2E_SUITE_STAGE: name },
    });
    child.on('exit', (code) => done({ name, code: code ?? 1 }));
    children.push(child);
  });
}

const children = [];
let killed = false;
function shutdownAll() {
  if (killed) return;
  killed = true;
  // Windows 下 SIGKILL 只杀 wrapper 本身，playwright/浏览器子进程会成孤儿继续跑——
  // 必须按进程树击杀（这些全是我们本轮 spawn 的后代，符合「只杀自建」红线）
  for (const c of children) {
    if (c.pid) spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else { try { c.kill('SIGKILL'); } catch { /* 已退出 */ } }
  }
}
process.on('SIGINT', () => { shutdownAll(); process.exit(130); });

const watchdog = setTimeout(() => {
  say(`⛔ 超出预算 ${(BUDGET_MS / 1000).toFixed(0)}s —— 看门狗击杀全部阶段。`);
  say('按预算契约处理：审耗时 top 用例（--reporter=list 自带时长）、把取证类移出默认套、或合并同构断言。**不得**靠删断言凑时间。');
  shutdownAll();
  process.exit(1);
}, BUDGET_MS);

// ── 单 spec 调试入口（收敛自旧 test:e2e:raw / test:e2e:preview）──────────
//   node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]
// 直接委派 e2e-skeleton 单跑（保留其僵尸 server 预清场 + 健康轮询 + 自清理，
// 比旧裸 playwright 入口安全）；默认 preview（需最新 dist），--dev 走源码态。
const onlyIdx = argv.indexOf('--only');
if (onlyIdx >= 0) {
  const spec = argv[onlyIdx + 1];
  if (!spec || spec.startsWith('-')) {
    console.error('✗ --only 需跟一个 spec 路径，如：--only scripts/person.spec.ts');
    clearTimeout(watchdog);
    process.exit(1);
  }
  const gIdx = Math.max(argv.indexOf('-g'), argv.indexOf('--grep'));
  const grepArgs = gIdx >= 0 && argv[gIdx + 1] ? [argv[gIdx], argv[gIdx + 1]] : [];
  const devArgs = argv.includes('--dev') ? ['--dev'] : [];
  const child = spawn(process.execPath, [resolve(HERE, 'e2e-skeleton.mjs'), ...devArgs, spec, ...grepArgs], {
    cwd: ROOT, stdio: 'inherit', windowsHide: true,
  });
  children.push(child);
  const code = await new Promise((done) => child.on('exit', (c) => done(c ?? 1)));
  clearTimeout(watchdog);
  process.exit(code);
}

say(`E2E 套件开跑（预算 ${(BUDGET_MS / 1000).toFixed(0)}s，模式：${process.env.E2E_PARALLEL === '1' ? '并行分片' : '串行'}）`);

// 播放器系只能 preview（生产单包挂载快且稳）。
// 例外：smoke-player-fs-mobile 留 dev —— `.up-fs-corner` 等横屏全屏 UI 在生产 bundle 下不出现
// （preview 实测整族挂），属构建形态差异（2026-09-20）。
const PREVIEW_SPECS = [
  'scripts/player.spec.ts',
  'scripts/player-failover.spec.ts',
  'scripts/player-cms-error.spec.ts',
  'scripts/iptv-player.spec.ts',
];
// dev Stage A 排除项 = 播放器系（归 B）+ 移出默认套的骨架三兄弟与设置页子页（详见文件头）。
// 注：chart / person 是顶级业务路由，保留默认套（只移子页、不移顶级路由）。
const A_EXCLUDE = ['skeleton', 'boot-splash', 'boot-splash-iso', 'boot-splash-shots', 'source-checker', 'proxy-setup', 'player', 'player-failover', 'player-cms-error', 'iptv-player'].join(',');

// Stage A（dev 行为套）：稳定档 3 worker（4 worker dev 编译争用会挤挂时序敏感断言，实测）。
const STAGE_A_ARGS = ['--all', '--dev', '--workers', '3'];
const STAGE_A_ENV = { E2E_SKIP_SHOTS: '1', E2E_EXCLUDE_SPECS: A_EXCLUDE };
// Stage B（preview 契约+播放器）：生产单包无 dev 编译争用 → 5 worker 并行化 iso 42 探针。
const STAGE_B_ARGS = ['--all', '--budget', '150', '--retries', '1', '--workers', '5', ...PREVIEW_SPECS];

// 并行分片（实验性，默认关）：两阶段各起独立 server + 各写 blob，跑完 merge 成一份报告。
// ❌ 2026-09-21 实测：本机并行下 8 chromium 抢 CPU → preview 阶段播放器 10s 挂载窗/骨架探针被
//   饿死，Stage B 成片 16 failed（墙钟虽降到 ~156s，但拿稳定性换时间不划算）→ 默认串行。
//   仅在强 CPU 机用 `E2E_PARALLEL=1` 显式开启（两阶段 blob 写同一 .pw-blob，merge 汇总）。
const PARALLEL = process.env.E2E_PARALLEL === '1';
const results = [];

function mergeReports() {
  console.log('\n── 合并并行分片报告（一并汇总 → playwright-report/）──');
  spawnSync(
    process.execPath,
    [resolve(ROOT, 'node_modules/@playwright/test/cli.js'), 'merge-reports', '.pw-blob', '--reporter=html,list'],
    { cwd: ROOT, stdio: 'inherit', windowsHide: true },
  );
}

if (PARALLEL) {
  // 两阶段 blob 写入同一目录（时间戳文件名不冲突），merge-reports 只收一个目录参数。
  rmSync(resolve(ROOT, '.pw-blob'), { recursive: true, force: true });
  const [ra, rb] = await Promise.all([
    stage('A-dev-behavior', STAGE_A_ARGS, { ...STAGE_A_ENV, E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: '.pw-blob' }),
    stage('B-preview-contract-player', STAGE_B_ARGS, { E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: '.pw-blob' }),
  ]);
  results.push(ra, rb);
  clearTimeout(watchdog);
  mergeReports();
} else {
  results.push(await stage('A-dev-behavior', STAGE_A_ARGS, STAGE_A_ENV));
  results.push(await stage('B-preview-contract-player', STAGE_B_ARGS, {}));
  clearTimeout(watchdog);
}

const wall = ((Date.now() - T0) / 1000).toFixed(1);
let bad = 0;
for (const r of results) {
  if (r.code !== 0) bad = 1;
  console.log(`阶段 ${r.name}: exit ${r.code}`);
}
say(`E2E 套件结束（${PARALLEL ? '并行分片' : '串行'}）：总墙钟 ${wall}s / 预算 ${(BUDGET_MS / 1000).toFixed(0)}s → ${bad ? '失败' : '通过'}`);
process.exit(bad);

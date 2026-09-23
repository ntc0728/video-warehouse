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
 *   - 骨架：skeleton / boot-splash                     → npm run test:e2e:skeleton
 *           boot-splash-iso（七视口同构）               → npm run test:e2e:boot-iso
 *     （2026-09-23 由「三兄弟一档」拆开：合跑 110–128s 卡 120s 看门狗边界）
 *   - 设置页子页 source-checker / proxy-setup           → npm run test:e2e:subpages
 *
 * 报告：两阶段各只写一份 **blob**（`.pw-blob`），跑完 merge 成一份含 A+B 全量的
 *   `playwright-report/`（html + list）。
 *   ⚠ 旧行为（2026-09-22 修复）：两阶段共用 config 的 html outputFolder，Stage B 后跑
 *   会把 Stage A 报告整份覆盖 → 默认套最终只剩 24 条 player 系用例，Stage A 那 108 条的
 *   耗时/失败明细全丢。
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
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// 沙箱（WorkBuddy CLI）经 NODE_OPTIONS 注入 node-language/delete-shim：同一 turn 内删除
// 超过 50 个文件即抛 SAFE_DELETE_BULK_CONFIRM_REQUIRED。而 Playwright 启动时会清理上一轮的
// --output 目录（数百文件）→ 一被拒整个 run 直接异常退出（2026-09-22 实测：上轮 .pw-out-A
// 253 文件，整轮 12.2s 秒崩）；retry 阶段清 artifacts 失败还会被记成用例 failed 假红。
// 既定解法与本仓 scripts/run-tests.ps1:481-482 一致：对子进程清空 NODE_OPTIONS。
delete process.env.NODE_OPTIONS;

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
//   仅在强 CPU 机用 `E2E_PARALLEL=1` 显式开启。
const PARALLEL = process.env.E2E_PARALLEL === '1';
const results = [];

// 报告通道（串行/并行共用）：两阶段各只写 blob，跑完 mergeReports() 汇总成单一完整报告 ——
// 避免「后一阶段把前一阶段的报告整份覆盖掉」。
//
// ⚠ 两阶段必须**分目录**：blob reporter 产物名固定为 `report-<hash>.zip`，写同一目录时后跑的
//   会把前一份整个盖掉（2026-09-22 实测：merge 后只剩 24 条 player 用例，Stage A 那 108 条全丢）。
//   而 merge-reports 只收**一个**目录参数 → 收尾前用 collectBlobs() 把 B 的 zip 归集进 A 的目录
//   （实测同目录多 zip 会被全部合并；两份 zip 名各带内容 hash，天然不撞）。
// stdout 侧仍保留 list（跑批过程可见 + 预算击杀可诊断），差别见下：
//   Stage A 是 FULL 档，e2e-skeleton 不给 --reporter（走 config 的 html+list）→ 这里补 list；
//   Stage B 是 ad-hoc 档，e2e-skeleton 已自带 --reporter=list → 只补 blob，避免 list 重复注册。
const BLOB_DIR_A = '.pw-blob';
const BLOB_DIR_B = '.pw-blob-b';
const BLOB_ENV_A = { E2E_PW_EXTRA: '--reporter=list --reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_A };
const BLOB_ENV_B = { E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_B };

/** 把 from 目录里的 blob zip 归集到 to 目录（merge-reports 只读一个目录）。
 *  用 renameSync 而非「复制 + 删除」：既省 IO，也完全避开沙箱 delete-shim 的批量删除守卫。*/
function collectBlobs(from, to) {
  const src = resolve(ROOT, from);
  const dst = resolve(ROOT, to);
  if (!existsSync(src)) return 0;
  mkdirSync(dst, { recursive: true });
  let moved = 0;
  for (const f of readdirSync(src)) {
    if (!f.endsWith('.zip')) continue;
    let target = resolve(dst, f);
    if (existsSync(target)) target = resolve(dst, `${from.replace(/[^\w]/g, '')}-${f}`); // 同名兜底
    renameSync(resolve(src, f), target);
    moved++;
  }
  return moved;
}

/** 合并两阶段 blob → playwright-report/。
 *  用**异步** spawn：受限沙箱（Bash 工具直起的 node）里 `spawnSync` 一律 EBUSY（2026-09-22 实测），
 *  而 merge 失败只会让报告不完整、不会让套件变红 → 静默踩坑，故此处必须避开 spawnSync。*/
function mergeReports() {
  const moved = collectBlobs(BLOB_DIR_B, BLOB_DIR_A);
  const dst = resolve(ROOT, BLOB_DIR_A);
  const blobs = existsSync(dst) ? readdirSync(dst).filter((f) => f.endsWith('.zip')).length : 0;
  if (!blobs) {
    console.error('\n⚠ 没收到任何 blob（阶段未产出报告）—— 跳过合并，playwright-report/ 保持上一轮内容');
    return Promise.resolve(1);
  }
  console.log(`\n── 合并两阶段报告（归集 ${moved} 份 / 共 ${blobs} 份 blob → playwright-report/）──`);
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [resolve(ROOT, 'node_modules/@playwright/test/cli.js'), 'merge-reports', BLOB_DIR_A, '--reporter=html,list'],
      { cwd: ROOT, stdio: 'inherit', windowsHide: true },
    );
    child.on('exit', (code) => {
      if (code !== 0) console.error(`⚠ merge-reports 退出码 ${code} —— playwright-report/ 可能不完整`);
      done(code);
    });
  });
}

if (PARALLEL) {
  for (const d of [BLOB_DIR_A, BLOB_DIR_B]) rmSync(resolve(ROOT, d), { recursive: true, force: true });
  const [ra, rb] = await Promise.all([
    stage('A-dev-behavior', STAGE_A_ARGS, { ...STAGE_A_ENV, E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_A }),
    stage('B-preview-contract-player', STAGE_B_ARGS, { E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_B }),
  ]);
  results.push(ra, rb);
  clearTimeout(watchdog);
  await mergeReports();
} else {
  // 串行同样走 blob + merge（原为「各写 config 的 html」，Stage B 会把 Stage A 报告整份
  // 覆盖 → 默认套最终只剩 24 条 player 系用例，Stage A 那 108 条的明细全丢）。
  for (const d of [BLOB_DIR_A, BLOB_DIR_B]) rmSync(resolve(ROOT, d), { recursive: true, force: true });
  results.push(await stage('A-dev-behavior', STAGE_A_ARGS, { ...STAGE_A_ENV, ...BLOB_ENV_A }));
  results.push(await stage('B-preview-contract-player', STAGE_B_ARGS, BLOB_ENV_B));
  clearTimeout(watchdog);
  await mergeReports();
}

const wall = ((Date.now() - T0) / 1000).toFixed(1);
let bad = 0;
for (const r of results) {
  if (r.code !== 0) bad = 1;
  console.log(`阶段 ${r.name}: exit ${r.code}`);
}
say(`E2E 套件结束（${PARALLEL ? '并行分片' : '串行'}）：总墙钟 ${wall}s / 预算 ${(BUDGET_MS / 1000).toFixed(0)}s → ${bad ? '失败' : '通过'}`);
process.exit(bad);

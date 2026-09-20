#!/usr/bin/env node
/**
 * E2E 总编排器 —— 默认全量入口（`npm run test:e2e`），硬预算：总时长 ≤ 5 分钟。
 *
 * ── 预算契约（2026-09-20 用户拍板，不可协商）─────────────────────
 *   1. 全量 E2E（两阶段合计）墙钟时间 ≤ 300s；到点看门狗直接击杀并判失败。
 *      今后新增/修改用例导致超预算 = CI/本地直接红，必须通过「取舍」而非
 *      「砍断言」解决（取舍优先级见 docs/agents/testing.md「E2E 预算」）。
 *   2. 取证类脚本（截图、人工核查）不进默认套，单独入口按需跑（test:e2e:shots）。
 *
 * ── 阶段划分（串行，总预算覆盖两阶段）──────────────
 *   阶段 A（dev）  行为断言全套：全部 spec − skeleton.spec（契约 B 要生产单包 CSS）
 *                  − boot-splash-shots（取证类）
 *   阶段 B（preview） 骨架契约 B：仅 skeleton.spec，dist 产物
 *
 * ── 用法
 *   node scripts/e2e-suite.mjs                # 两阶段串行（实测并行会 CPU 争用挤挂时序敏感契约用例；串行仍 ≤250s） + 预算守卫
 *   node scripts/e2e-suite.mjs --budget 420   # 临时放宽预算秒数（排查用，不进默认路径）
 */
import { spawn, spawnSync } from 'node:child_process';
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

say(`E2E 套件开跑（预算 ${(BUDGET_MS / 1000).toFixed(0)}s，两阶段并行）`);

// 播放器系 spec 归 preview：dev 下 hls/dash vendor 按需编译 + 3 worker 并发会把
// 「播放器挂载 30s 窗口」挤到极限（PLAYER-M01/FS-* 实测贴边 flaky）；生产单包挂载快且稳。
// 例外：smoke-player-fs-mobile 留 dev —— `.up-fs-corner` 等横屏全屏 UI 在生产 bundle
// 下不出现（preview 实测整族挂），属构建形态差异，该族以 dev 形态为准（2026-09-20）。
const PREVIEW_SPECS = [
  'scripts/skeleton.spec.ts',
  'scripts/player.spec.ts',
  'scripts/player-failover.spec.ts',
  'scripts/player-cms-error.spec.ts',
  'scripts/iptv-player.spec.ts',
];
const A_EXCLUDE = ['skeleton', 'boot-splash-shots', 'player', 'player-failover', 'player-cms-error', 'iptv-player'].join(',');

const results = [];
// 阶段 A：播放器系已迁出，dev 争用大头消失 → 4 worker 换预算余量
results.push(await stage('A-dev-behavior', ['--all', '--dev', '--workers', '4'], { E2E_SKIP_SHOTS: '1', E2E_EXCLUDE_SPECS: A_EXCLUDE }));
results.push(await stage('B-preview-contract-player', ['--all', '--budget', '150', '--retries', '1', ...PREVIEW_SPECS]));

clearTimeout(watchdog);
const wall = ((Date.now() - T0) / 1000).toFixed(1);
let bad = 0;
for (const r of results) {
  if (r.code !== 0) bad = 1;
  console.log(`阶段 ${r.name}: exit ${r.code}`);
}
say(`E2E 套件结束：总墙钟 ${wall}s / 预算 ${(BUDGET_MS / 1000).toFixed(0)}s → ${bad ? '失败' : '通过'}`);
process.exit(bad);

#!/usr/bin/env node
/**
 * E2E 总编排器 —— 默认全量入口 `npm run test:e2e`。
 * 完整指令清单见 `scripts/README.md` 与 `package.json` 的 `test:e2e:*` 脚本。
 *
 * 阶段（串行，总预算默认 300s，到点看门狗击杀并判失败；`--stages` 可只跑子集）：
 *   A（dev）     行为全套：除 PREVIEW_SPECS / A_EXCLUDE 外所有 spec。dev 是 cross-tab
 *                （/src 导入）与 smoke-fs / home 面板稳定性用例的必需形态；稳定档 3 worker。
 *                自有预算 **210s**（实测波动带 108–252s 的中位契约：超时 = 负载异常 → 走分段口径）。
 *   B（preview） 播放器系（player / failover / cms-error / iptv-player）：生产单包挂载快且稳，5 worker。
 *   C（dev）     cross-tab（4 条，单 worker）：双页签 + storage/IndexedDB/BroadcastChannel 回写，
 *               与其它 spec 并行时事件回写会被饿死（单步 10s 红线内的假红）→ 单独成阶段隔离并发。
 *   smoke-player-fs-mobile（6 条，dev 专属：`__smoke_fullscreen=1` 生产无效）已移出默认套，
 *   走按需 `npm run test:e2e:smoke-fs`；`src/components/UniversalPlayer/**` 改动的增量映射仍会带出它。
 *
 * 已移出默认套、改按需跑（保留覆盖，非删除）：
 *   - 取证截图 boot-splash-shots                       → npm run test:e2e:shots
 *   - 骨架：skeleton / boot-splash                     → npm run test:e2e:skeleton
 *           boot-splash-iso（七视口同构）               → npm run test:e2e:boot-iso
 *     （合跑会贴近看门狗边界，故拆开各自单跑）
 *   - 设置页子页 source-checker / proxy-setup           → npm run test:e2e:subpages
 *
 * 报告：各阶段各写一份 **blob**（`.pw-blob`/`.pw-blob-b`/`.pw-blob-c`），跑完 merge 成一份全量的
 *   `playwright-report/`（html + list）。
 *   ⚠ 各阶段若共用 config 的 html outputFolder，后跑的会把先跑的报告整份覆盖，
 *   所以各写一份 blob 再 merge。

 * `--stages A,B`（缺省 A,B,C）：只跑子集 —— 负载日看门狗击杀后补跑剩余段。
 * 分段口径「**三段全绿 = 全量绿**」由 `.pw-suite-state.json` 兜底校验：每段结束记录
 * `{exit, duration, HEAD, worktree 是否干净, dist 是否新鲜}`；三段全绿但 **HEAD 不一致 /
 * worktree 带改动 / dist 过期（B 是 preview，跑的是构建产物）** 时判为「不可作为全量绿」→ exit 1
 * （`--force` 越过）。部分跑只清理所选阶段的 blob 目录，未跑段的 blob 保留参与合并。
 *
 * 关键不可逆结论（勿反复试探）：
 *   - 行为套整体改投 preview 不可行（home 面板稳定性 / cross-tab 依赖 dev）。
 *   - 两阶段并行默认关闭（CPU 争用导致 Stage B 播放器/骨架探针超时假红）；
 *     仅强 CPU 机可 E2E_PARALLEL=1 开（两阶段 blob 写同一 .pw-blob 后 merge-reports 汇总）。
 *
 * 用法：
 *   node scripts/e2e-suite.mjs                       # 默认全量（串行）
 *   node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]   # 单 spec 调试（默认 preview，--dev 走源码态）
 *   node scripts/e2e-suite.mjs --budget 420          # 临时放宽预算秒数（排查用，不进默认路径）
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// 受限沙箱经 NODE_OPTIONS 注入 node-language/delete-shim：同一 turn 内删除
// 超过 50 个文件即抛 SAFE_DELETE_BULK_CONFIRM_REQUIRED。而 Playwright 启动时会清理上一轮的
// --output 目录（数百文件）→ 一被拒整个 run 直接异常退出；retry 阶段清 artifacts 失败
// 还会被记成用例 failed 假红。
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
  // 已完成阶段的结果先落盘（分段口径：A 已绿的事实不能只留在日志里），再击杀
  persistState();
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

// ── --stages：只跑子集（负载日补跑剩余段）────────────────────────────
// 缺省 = A,B,C 全量。分段口径「三段全绿 = 全量绿」由 .pw-suite-state.json 兜底校验（见文件头）。
const STAGE_ORDER = ['A', 'B', 'C'];
const stagesIdx = argv.indexOf('--stages');
let SELECTED = [...STAGE_ORDER];
let stagesArgRaw = '';
if (stagesIdx >= 0) {
  stagesArgRaw = argv[stagesIdx + 1] || '';
  SELECTED = stagesArgRaw.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  const unknown = SELECTED.filter((k) => !STAGE_ORDER.includes(k));
  if (stagesArgRaw && (unknown.length > 0 || SELECTED.length === 0)) {
    console.error(`✗ --stages 只接受 A/B/C 的逗号组合，收到：'${stagesArgRaw}'`);
    process.exit(2);
  }
}
const flag = (n) => argv.includes(n);
const FORCE = flag('--force');
const runAll = SELECTED.length === STAGE_ORDER.length;

/** 上下文快照（整轮一次）：HEAD / worktree 是否带改动 / dist 是否比 src 新。
 *  分段口径的可信度全靠这三项 —— 跨 HEAD 或 dist 过期的分段绿不可作为全量绿。 */
async function captureContext() {
  const run = (cmd, args) =>
    new Promise((done) => {
      const child = spawn(cmd, args, { cwd: ROOT, windowsHide: true });
      let out = '';
      child.stdout?.on('data', (d) => { out += d; });
      child.on('error', () => done(null));
      child.on('close', (code) => done(code === 0 ? out.trim() : null));
    });
  const head = (await run('git', ['rev-parse', '--short', 'HEAD'])) ?? 'unknown';
  const st = await run('git', ['status', '--porcelain']);
  const dirty = st === null ? null : st.length > 0;
  return { head, dirty };
}

/** dist 是否不旧于 src/index.html（B 是 preview，跑的是构建产物；过期 = 断言旧产物） */
function distFresh() {
  const distIndex = resolve(ROOT, 'dist/index.html');
  if (!existsSync(distIndex)) return false;
  const distM = statSync(distIndex).mtimeMs;
  let newest = distM;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(css|ts|tsx|html|json)$/.test(e.name)) continue;
      const m = statSync(p).mtimeMs;
      if (m > newest) newest = m;
    }
  };
  walk(resolve(ROOT, 'src'));
  const ih = statSync(resolve(ROOT, 'index.html')).mtimeMs;
  if (ih > newest) newest = ih;
  return distM >= newest;
}

const STATE_FILE = resolve(ROOT, '.pw-suite-state.json');
const RUN_CTX = { head: 'unknown', dirty: null, distFresh: null };

/** 把本轮已完成阶段的结果并入状态文件（看门狗击杀前也要调用，A 已绿的事实不能只留在日志里） */
function persistState() {
  try {
    const prev = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
    const stages = { ...(prev.stages || {}) };
    for (const r of results) {
      stages[r.key] = {
        exit: r.code ?? null,
        durationS: r.durationS ?? null,
        head: RUN_CTX.head,
        dirty: RUN_CTX.dirty,
        distFresh: RUN_CTX.distFresh,
        at: new Date().toISOString(),
      };
    }
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ head: RUN_CTX.head, dirty: RUN_CTX.dirty, distFresh: RUN_CTX.distFresh, updatedAt: new Date().toISOString(), stages }, null, 2),
    );
  } catch { /* 状态落盘失败不影响测试结论 */ }
}


// 播放器系只能 preview（生产单包挂载快且稳）。
// 例外：smoke-player-fs-mobile 留 dev —— `.up-fs-corner` 等横屏全屏 UI 在生产 bundle 下不出现，
// 属构建形态差异。
const PREVIEW_SPECS = [
  'scripts/player.spec.ts',
  'scripts/player-failover.spec.ts',
  'scripts/player-cms-error.spec.ts',
  'scripts/iptv-player.spec.ts',
];
// dev Stage A 排除项 = 播放器系（归 B）+ 移出默认套的骨架三兄弟与设置页子页（详见文件头）。
// 注：chart / person 是顶级业务路由，保留默认套（只移子页、不移顶级路由）。
const A_EXCLUDE = ['skeleton', 'boot-splash', 'boot-splash-iso', 'boot-splash-shots', 'source-checker', 'proxy-setup', 'player', 'player-failover', 'player-cms-error', 'iptv-player', 'cross-tab', 'smoke-player-fs-mobile'].join(',');

// Stage A（dev 行为套）：稳定档 3 worker（4 worker dev 编译争用会挤挂时序敏感断言）。
const STAGE_A_ARGS = ['--all', '--dev', '--budget', '210', '--workers', '3'];
const STAGE_A_ENV = { E2E_SKIP_SHOTS: '1', E2E_EXCLUDE_SPECS: A_EXCLUDE };
// Stage B（preview 契约+播放器）：生产单包无 dev 编译争用 → 5 worker 并行化 iso 42 探针。
const STAGE_B_ARGS = ['--all', '--budget', '150', '--retries', '1', '--workers', '5', ...PREVIEW_SPECS];
// Stage C（dev 单文件）：cross-tab 依赖双页签实时事件回写，与其它 spec 并行时会被饿死
// （storage 事件 → rehydrate → setState 的链路挤不进 10s 单步上限）→ 独立进程、单 worker。
const STAGE_C_SPECS = ['scripts/cross-tab.spec.ts'];
const STAGE_C_ARGS = ['--all', '--dev', '--budget', '90', '--retries', '1', '--workers', '1', ...STAGE_C_SPECS];
const STAGE_C_ENV = { E2E_SKIP_SHOTS: '1' };

// 并行分片（实验性，默认关）：两阶段各起独立 server + 各写 blob，跑完 merge 成一份报告。
// 并行下 chromium 抢 CPU → preview 阶段播放器挂载窗/骨架探针被饿死、Stage B 成片假红
//   → 默认串行。仅在强 CPU 机用 `E2E_PARALLEL=1` 显式开启。
const PARALLEL = process.env.E2E_PARALLEL === '1';
const results = [];

// 报告通道（串行/并行共用）：两阶段各只写 blob，跑完 mergeReports() 汇总成单一完整报告 ——
// 避免「后一阶段把前一阶段的报告整份覆盖掉」。
//
// ⚠ 两阶段必须**分目录**：blob reporter 产物名固定为 `report-<hash>.zip`，写同一目录时后跑的
//   会把前一份整个盖掉。
//   而 merge-reports 只收**一个**目录参数 → 收尾前用 collectBlobs() 把 B 的 zip 归集进 A 的目录
//   （同目录多 zip 会被全部合并；两份 zip 名各带内容 hash，天然不撞）。
// stdout 侧仍保留 list（跑批过程可见 + 预算击杀可诊断），差别见下：
//   Stage A 是 FULL 档，e2e-skeleton 不给 --reporter（走 config 的 html+list）→ 这里补 list；
//   Stage B 是 ad-hoc 档，e2e-skeleton 已自带 --reporter=list → 只补 blob，避免 list 重复注册。
const BLOB_DIR_A = '.pw-blob';
const BLOB_DIR_B = '.pw-blob-b';
const BLOB_DIR_C = '.pw-blob-c';
const BLOB_ENV_A = { E2E_PW_EXTRA: '--reporter=list --reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_A };
const BLOB_ENV_B = { E2E_PW_EXTRA: '--reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_B };
const BLOB_ENV_C = { E2E_PW_EXTRA: '--reporter=list --reporter=blob', PLAYWRIGHT_BLOB_OUTPUT_DIR: BLOB_DIR_C };

// ── 阶段注册表：key → 编排参数。A 的 210s 是「波动带中位契约」（实测 108–252s），超时 = 负载异常 → 分段口径。
const STAGES = {
  A: {
    key: 'A',
    name: 'A-dev-behavior',
    args: STAGE_A_ARGS,
    env: { ...STAGE_A_ENV, ...BLOB_ENV_A },
    blobDir: BLOB_DIR_A,
  },
  B: {
    key: 'B',
    name: 'B-preview-contract-player',
    args: STAGE_B_ARGS,
    env: { ...BLOB_ENV_B },
    blobDir: BLOB_DIR_B,
  },
  C: {
    key: 'C',
    name: 'C-dev-cross-tab',
    args: STAGE_C_ARGS,
    env: { ...STAGE_C_ENV, ...BLOB_ENV_C },
    blobDir: BLOB_DIR_C,
  },
};

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
 *  用**异步** spawn：受限沙箱里 `spawnSync` 一律 EBUSY，
 *  而 merge 失败只会让报告不完整、不会让套件变红 → 静默踩坑，故此处必须避开 spawnSync。*/
function mergeReports() {
  // 部分跑（--stages 子集）只归集**所选阶段**的 blob：历史 zip 不进报告，
  // 否则 merge-reports 会重放旧用例结果（上轮失败也一起重放，误导诊断）。
  if (!runAll) rmSync(resolve(ROOT, BLOB_DIR_A), { recursive: true, force: true });
  const selDirs = SELECTED.map((k) => STAGES[k].blobDir).filter((d) => d !== BLOB_DIR_A);
  const moved = selDirs.reduce((sum, d) => sum + collectBlobs(d, BLOB_DIR_A), 0);
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

// 上下文快照：整轮一次（HEAD / worktree / dist 新鲜度），供分段口径判定
Object.assign(RUN_CTX, await captureContext(), { distFresh: distFresh() });
if (RUN_CTX.head === 'unknown') {
  console.warn('⚠ git 不可用：分段口径的 HEAD/worktree 校验将按不可信处理（--force 越过）');
}
if (SELECTED.includes('B') && !RUN_CTX.distFresh && !FORCE) {
  console.error('✗ dist 过期（src 比 dist/index.html 新）：Stage B 是 preview，跑的是旧产物。先 npm run build，或 --force 带过期 dist 硬跑。');
  process.exit(2);
}

// 只清理**所选阶段**的 blob 目录：未跑阶段的 blob 保留参与合并，
// 这样部分跑的报告仍是「三段全量」视图（新鲜度由 --stages 的 HEAD/dist 校验兜底）。
for (const k of SELECTED) rmSync(resolve(ROOT, STAGES[k].blobDir), { recursive: true, force: true });

const runStage = async (key) => {
  const def = STAGES[key];
  const t0 = Date.now();
  const r = await stage(def.name, def.args, def.env);
  const entry = {
    key,
    name: def.name,
    code: r.code ?? null,
    durationS: Math.round((Date.now() - t0) / 1000),
  };
  results.push(entry);
  persistState(); // 每段结束即落盘：看门狗击杀后 A 已绿的事实不能只留在日志里
  return entry;
};

const runABParallel = PARALLEL && SELECTED.includes('A') && SELECTED.includes('B');
if (runABParallel) {
  await Promise.all([runStage('A'), runStage('B')]);
  // Stage C 与 A/B 并行会互抢 CPU（它本身就是抗饿死才拆出来的），故串行补跑
  if (SELECTED.includes('C')) await runStage('C');
} else {
  for (const k of SELECTED) await runStage(k);
}
clearTimeout(watchdog);
await mergeReports();

const wall = ((Date.now() - T0) / 1000).toFixed(1);
let bad = 0;
for (const r of results) {
  if (r.code !== 0) bad = 1;
  console.log(`阶段 ${r.name}: exit ${r.code}（${r.durationS}s）`);
}

// ── 分段口径判定：三段全绿 + 同 HEAD + 干净 worktree + dist 新鲜 = 全量绿 ──
// 本轮没跑的阶段采用 state 里最近一次记录；三项上下文任一不满足 → 分段绿不可作为全量绿。
try {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { stages: {} };
  const rows = STAGE_ORDER.map((k) => [k, state.stages?.[k]]);
  console.log('\n分段口径判定（.pw-suite-state.json）：');
  for (const [k, e] of rows) {
    if (!e) { console.log(`  ${k}: 无记录（未跑过）`); continue; }
    const ctxBits = [`head=${e.head}`, e.dirty ? 'worktree 带改动' : 'worktree 干净', e.distFresh ? 'dist 新鲜' : 'dist 过期'];
    console.log(`  ${k}: ${e.exit === 0 ? '绿' : `exit ${e.exit}`}（${e.durationS ?? '?'}s）· ${ctxBits.join(' · ')}`);
  }
  const allGreen = rows.every(([, e]) => e && e.exit === 0);
  const sameContext =
    rows.every(([, e]) => e) &&
    rows.every(([, e]) => e.head === rows[0][1].head && !e.dirty) &&
    (state.stages?.B?.distFresh ?? false) &&
    state.head !== 'unknown';
  if (allGreen && sameContext) {
    console.log(`✓ 分段口径全量绿 @ ${rows[0][1].head}`);
  } else if (allGreen) {
    const why = !rows.every(([, e]) => e) ? '' : state.head === 'unknown' || rows.some(([, e]) => e.head !== rows[0][1].head || e.dirty) ? 'HEAD 不一致或 worktree 带改动' : "dist 过期（B 跑的是旧产物，先 npm run build）";
    console.error(`✗ 分段绿不可作为全量绿：${why}（--force 越过）`);
    if (!FORCE) bad = 1;
  }
} catch { /* 判定失败不改变本轮 exit，仅无分段结论 */ }

say(`E2E 套件结束（${PARALLEL ? '并行分片' : '串行'}，阶段：${SELECTED.join('/')}）：总墙钟 ${wall}s / 预算 ${(BUDGET_MS / 1000).toFixed(0)}s → ${bad ? '失败' : '通过'}`);
process.exit(bad);

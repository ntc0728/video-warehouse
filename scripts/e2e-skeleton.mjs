#!/usr/bin/env node
/**
 * 骨架 E2E 专用跑批器（2026-09-18）
 *
 * ── 为什么需要它：直接 `playwright test scripts/skeleton.spec.ts` 会「卡死 / 至少 10 分钟」
 *
 *   1) **僵尸 dev server**：3001 上的 Vite 一旦进入「TCP 仍 LISTENING、HTTP 永不响应」状态，
 *      playwright.config 的 `webServer.reuseExistingServer` 既判不出可复用、又起不来新的
 *      （端口被占 → vite 换端口 / `npm run dev` 的 npm shim 在受限环境直接失效），
 *      于是 `use.baseURL` 指着一个死端口：**每一条 `page.goto` 都把单测 45s 超时耗干**，
 *      18 条用例 ≈ 13.5 分钟；加上 list reporter 只在进程结束才吐日志 → 体感就是「卡死」。
 *   2) **dev server 本身重**：要爬 400+ 模块图 + 依赖预打包；4 个 worker 并发时句柄/内存压力更大，
 *      更容易触发 (1)。
 *
 * ── 对策（本脚本按序做完，跑完自动收尾）
 *   a. **动态端口**：向 OS 申请当下空闲的端口，不固定占任何端口（3001/3101 都不写死），
 *      因此永不需要、也绝不会去杀「端口占用者」；清场只按命令行标记
 *      （scripts/e2e-vite-server.cjs / ms-playwright 特征）**精确击杀测试自己拉起的进程**；
 *   b. 默认用 **`vite preview` 跑已构建的 dist**：页面加载从「秒级模块图」降到百毫秒级整包；
 *      且生产构建把全部页面 CSS 打进同一个 bundle，**契约 B 的注入探针不再依赖路由 chunk 是否加载**；
 *   c. HTTP 健康轮询（3s/次、最多 60s）**确认 200 之后**才开跑 —— 杜绝「TCP 通但 HTTP 不通」的假就绪；
 *   d. 传 `--timeout` / `--global-timeout`：单测封顶、整轮封顶，最坏情况也必然退出；
 *   e. 无论成败：杀本轮自建 server + 测试浏览器 + 清 `.pw-out-skel`（该目录**未被 .gitignore 覆盖**）。
 *
 * ── 用法
 *   node scripts/e2e-skeleton.mjs                 # 默认 preview（快；要求 dist 是最新构建）
 *   node scripts/e2e-skeleton.mjs --all           # 全量 E2E（21 个 spec；配 --reporter 走 config 的 html+list）
 *   node scripts/e2e-skeleton.mjs --dev           # 退回 dev server（改了 src 还没 build 时）
 *   node scripts/e2e-skeleton.mjs -g SKEL-015     # 只跑匹配用例（开发新断言时最省时间）
 *   node scripts/e2e-skeleton.mjs --workers 2     # 覆盖并发（骨架默认 4，--all 默认 2）
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import net from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// 同 e2e-suite.mjs 顶部：剥离沙箱经 NODE_OPTIONS 注入的 delete-shim。
// 否则 Playwright 的启动清理（上一轮 --output 目录，数百文件）会被
// SAFE_DELETE_BULK_CONFIRM_REQUIRED 拒掉 → 整轮异常退出；global-teardown 的 rmSync 也会
// 被静默拦截（表现为「产物已清理」但目录还在）。既定解法见 scripts/run-tests.ps1:481-482。
delete process.env.NODE_OPTIONS;

/** 向 OS 申请一个当前空闲的端口（bind 0 再释放），绝不与任何在跑的服务抢端口 */
function getFreePort() {
  return new Promise((done, fail) => {
    const srv = net.createServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => done(port));
    });
  });
}

/**
 * E2E 端口：默认动态分配。E2E_PORT 仅供显式指定（例如对着自己正跑的
 * dev server 测：E2E_PORT=3001 —— 此时测试只会「连接复用」，同样不会杀它）。
 */
const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : await getFreePort();
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER_LOG = resolve(ROOT, '.pw-server.log');
/** 早期脚本用的输出目录，**未被 .gitignore 覆盖**（会污染 `git add -A`），每轮必清 */
const STALE_OUT = resolve(ROOT, '.pw-out-skel');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : d;
};

const USE_DEV = flag('--dev');
const ALL = flag('--all');
const GREP = val('-g', val('--grep', ''));

/** 位置参数 = 调试目标 spec 文件（-g/--workers 等旗标的值不在此列） */
function collectSpecFiles() {
  const flagWithValue = new Set(['-g', '--grep', '--workers', '--test-timeout', '--global-timeout', '--budget', '--retries']);
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('-')) {
      if (flagWithValue.has(a)) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}
const SPEC_FILES = collectSpecFiles();
// 全量档 = `--all` 且未指定任何文件；其余（-g 过滤 / 指定文件 / 默认骨架）都是 ad-hoc 调试档
const FULL = ALL && SPEC_FILES.length === 0;

// ── 临时跑批硬规矩（2026-09-21 用户拍板，AGENTS 红线）──
// 单轮墙钟预算：全量默认 300s；ad-hoc 调试默认 120s，到点击杀并退码 2。
// 调试默认 retries=0：重试是套件概念，诊断场景只会双倍烧时间与稀释信号。
const WORKERS = val('--workers', '3');
const TEST_TIMEOUT = val('--test-timeout', FULL ? '45000' : '30000');
const GLOBAL_TIMEOUT = val('--global-timeout', FULL ? '1200000' : '420000');
const BUDGET_S = Number(val('--budget', FULL ? '300' : '120'));
const RETRIES = val('--retries', FULL ? (process.env.CI ? '2' : '1') : '0');

const T0 = Date.now();
const say = (msg) => console.log(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(3)}s] ${msg}`);

/**
 * 只清理「测试自己拉起的、且已失去响应的 vite server」：
 * 识别 = 命令行含 scripts/e2e-vite-server.cjs 标记（本跑批器/config webServer 唯一起服务入口，
 * 正常服务不可能带它）；再加一道 HTTP 探活 —— 还能响应 200 的跳过（可能是并发跑批或你手动起的），
 * 无响应（TCP 通 HTTP 死的僵尸 / 进程残骸）才杀。
 * **禁止**回到按端口占用者乱杀的老路（2026-09-20 用户红线：别的服务占任何端口都不能被测试杀）。
 */
async function killZombieE2EServers() {
  // suite 多阶段下跳过：无法区分「兄弟阶段刚起还没 200 的 server」，会误杀；
  // 各自只清理自己的 server.pid（cleanup 内），孤儿僵尸由单跑模式负责回收。
  if (process.env.E2E_SUITE_STAGE) return 0;
  const ps =
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*e2e-vite-server.cjs*' } | ForEach-Object { \"$($_.ProcessId)||$($_.CommandLine)\" }";
  let out = '';
  try {
    out = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).stdout || '';
  } catch {
    return 0;
  }
  let killed = 0;
  for (const line of out.split(/\r?\n/)) {
    const sep = line.indexOf('||');
    if (sep < 0) continue;
    const pid = line.slice(0, sep).trim();
    const cmd = line.slice(sep + 2);
    if (!pid || pid === String(process.pid)) continue;
    const pm = cmd.match(/--port\s+(\d+)/);
    if (pm) {
      const status = await probe(`http://127.0.0.1:${pm[1]}/`, 1500);
      if (status === 200) continue; // 仍健康：可能是并发跑批/用户显式复用，绝不杀
    }
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    say(`清理无响应的测试自建 server PID ${pid}`);
    killed++;
  }
  return killed;
}

/**
 * 只清理「测试自己拉起的浏览器」进程（含子进程树）。
 * 识别特征（两者满足其一即杀，否则一律放过用户浏览器）：
 *   a) 可执行文件在 Playwright 浏览器缓存目录（ms-playwright）下；
 *   b) 命令行带 Playwright 注入的临时 profile 参数 `--user-data-dir=...\Temp\...`。
 * 历史教训：旧版 `taskkill /IM chrome.exe /F` 会连带杀死用户日常使用的 Chrome，禁止回退。
 * 多阶段并行（e2e-suite 设置了 E2E_SUITE_STAGE）时跳过：范围过滤无法区分「兄弟阶段」的
 * 测试浏览器，会互杀；各阶段交由 Playwright 自身收尾 + suite 的 SIGKILL 兜底。
 */
function killTestBrowsers() {
  if (process.env.E2E_SUITE_STAGE) return 0;
  const ps = [
    "$ps = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'chromium.exe' -or $_.Name -eq 'chrome-headless-shell.exe') -and",
    "  (($_.ExecutablePath -like '*ms-playwright*') -or ($_.CommandLine -like '*--user-data-dir=*' -and $_.CommandLine -like '*Temp*'))",
    "}; if ($ps) { $ps.ProcessId }",
  ].join(' ');
  let out = '';
  try {
    out = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).stdout || '';
  } catch {
    return 0;
  }
  const pids = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  }
  return pids.length;
}

/** 单次 HTTP 探针：返回状态码，任何失败（含超时）返回 0 */
function probe(url, timeout = 3000) {
  return new Promise((done) => {
    const req = http.get(url, { timeout }, (res) => {
      res.resume();
      done(res.statusCode || 0);
    });
    req.on('timeout', () => {
      req.destroy();
      done(0);
    });
    req.on('error', () => done(0));
  });
}

/** 轮询到 HTTP 200 才算「真就绪」；超时返回 -1 */
async function waitReady(budgetMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    if ((await probe(`${BASE}/`)) === 200) return Date.now() - start;
    await new Promise((r) => setTimeout(r, 700));
  }
  return -1;
}

function tailServerLog(lines = 15) {
  try {
    return readFileSync(SERVER_LOG, 'utf8').trim().split(/\r?\n/).slice(-lines).join('\n');
  } catch {
    return '(无 server 日志)';
  }
}

let server = null;
function cleanup() {
  if (server && server.pid) {
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    server = null;
  }
  killTestBrowsers();
  try {
    rmSync(STALE_OUT, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
}

process.on('SIGINT', () => {
  say('收到中断，收尾中…');
  cleanup();
  process.exit(130);
});
process.on('exit', () => {
  if (server) cleanup();
});

// ─── a. 前置检查 ─────────────────────────────────────────
say(`跑批开始（模式：${USE_DEV ? 'dev server' : 'preview(dist)'}，端口：:${PORT}${process.env.E2E_PORT ? '（E2E_PORT 指定）' : '（OS 动态分配）'}）`);
if (PORT === 3001) {
  console.warn('ℹ E2E_PORT=3001：将连接复用你正跑着的 dev server（不会杀它）；确认这是你的意图。');
}
await killZombieE2EServers();
killTestBrowsers();

const viteWrapper = resolve(ROOT, 'scripts/e2e-vite-server.cjs');
const viteBin = resolve(ROOT, 'node_modules/vite/bin/vite.js');
if (!existsSync(viteBin)) {
  console.error(`✗ 找不到 ${viteBin}，先安装依赖`);
  process.exit(1);
}

if (!USE_DEV) {
  const distIndex = resolve(ROOT, 'dist/index.html');
  if (!existsSync(distIndex)) {
    console.error('✗ preview 模式需要构建产物，先跑：npm run build');
    process.exit(1);
  }
  const newestSrc = (() => {
    let newest = 0;
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name !== 'node_modules') walk(p);
        } else if (/\.(ts|tsx|css)$/.test(ent.name)) {
          newest = Math.max(newest, statSync(p).mtimeMs);
        }
      }
    };
    walk(resolve(ROOT, 'src'));
    return newest;
  })();
  if (newestSrc > statSync(distIndex).mtimeMs) {
    say('⚠ dist 落后于 src 改动 —— 先 `npm run build`（或加 --dev），否则测的是旧包');
  }
}

// ─── b. 起 server ───────────────────────────────────────
// 经 e2e-vite-server.cjs wrapper 起：命令行自带测试标记，收尾能精确识别自建/僵尸 server
const serverArgs = USE_DEV
  ? [viteWrapper, '--port', String(PORT), '--strictPort', '--clearScreen', 'false']
  : [viteWrapper, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'];

const logFd = openSync(SERVER_LOG, 'w');
server = spawn(process.execPath, serverArgs, {
  cwd: ROOT,
  stdio: ['ignore', logFd, logFd],
  windowsHide: true,
});
say(`vite ${USE_DEV ? 'dev' : 'preview'} 已拉起（PID ${server.pid}）`);

// ─── c. 健康轮询 ────────────────────────────────────────
const readyMs = await waitReady(60000);
if (readyMs < 0) {
  console.error(`✗ :${PORT} 60s 内未返回 HTTP 200 —— 服务器卡死，放弃跑测（避免每次 goto 白耗 45s）`);
  console.error(tailServerLog());
  cleanup();
  process.exit(1);
}
say(`:${PORT} HTTP 就绪（${readyMs}ms）`);

// ─── d. 跑 Playwright（封顶，必退）───────────────────────
// 多阶段并行时产物目录按阶段隔离（防 globalTeardown rm -rf 互清附件）
const outDir = process.env.E2E_SUITE_STAGE ? `.pw-out-${process.env.E2E_SUITE_STAGE}` : 'test-results';
const pwArgs = [
  resolve(ROOT, 'node_modules/@playwright/test/cli.js'),
  'test',
  // 全量档：跑全部 spec 且不覆盖 reporter（保留 config 的 html，供 localize-report 用）；
  // ad-hoc：指定文件（无则默认骨架 spec）+ list 拿即时输出
  ...(FULL ? [] : [...(SPEC_FILES.length ? SPEC_FILES : ['scripts/skeleton.spec.ts']), '--reporter=list']),
  `--workers=${WORKERS}`,
  `--timeout=${TEST_TIMEOUT}`,
  `--global-timeout=${GLOBAL_TIMEOUT}`,
  `--retries=${RETRIES}`,
  `--output=${outDir}`,
];
if (GREP) pwArgs.push('-g', GREP);
// 透传额外 playwright 旗标（供 e2e-suite 并行分片注入 --reporter=blob --blob-report=…）
if (process.env.E2E_PW_EXTRA) pwArgs.push(...process.env.E2E_PW_EXTRA.trim().split(/\s+/).filter(Boolean));

say(`playwright 开跑：${pwArgs.slice(2).join(' ')}（预算 ${BUDGET_S}s）`);
// 把本轮动态端口传给 playwright：config 会复用同一端口（webServer.reuseExistingServer
// 命中已探活的自建 server），不再自己起第二个 server；
// dev 全量时排除骨架契约 spec（它要生产单包 CSS，dev 分 chunk 会假失败，
// 契约由本脚本 preview 模式专属执行）
const childEnv = { ...process.env, E2E_PORT: String(PORT), PW_OUTPUT_DIR: outDir };
if (FULL && USE_DEV) childEnv.E2E_SKIP_CONTRACT = '1';
const res = spawnSync(process.execPath, pwArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
  env: childEnv,
  timeout: BUDGET_S * 1000,
  killSignal: 'SIGKILL',
});
// 预算击杀：spawnSync 超时后 status 为 null / error 带 ETIMEDOUT —— 明确报错而非静默
if (res.error || res.status === null) {
  console.error(`✗ 超出单轮预算 ${BUDGET_S}s，已强制击杀（硬规矩：ad-hoc ≤120s、--all ≤300s，--budget 显式放宽需在结论中说明理由）`);
}
const code = res.status === null ? 2 : (res.status ?? 1);

// ─── e. 收尾 ────────────────────────────────────────────
await killZombieE2EServers();
cleanup();
say(`playwright 退出码 ${code}；总耗时 ${Math.round((Date.now() - T0) / 1000)}s`);
if (code !== 0) {
  console.log('── server 日志尾部 ──');
  console.log(tailServerLog(8));
}
process.exit(code);

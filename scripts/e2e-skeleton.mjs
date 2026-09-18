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
 *   a. 先强杀 :3001 的持有者 + 遗留 chrome —— 从根上消灭「僵尸被复用」；
 *   b. 默认用 **`vite preview` 跑已构建的 dist**：页面加载从「秒级模块图」降到百毫秒级整包；
 *      且生产构建把全部页面 CSS 打进同一个 bundle，**契约 B 的注入探针不再依赖路由 chunk 是否加载**；
 *   c. HTTP 健康轮询（3s/次、最多 60s）**确认 200 之后**才开跑 —— 杜绝「TCP 通但 HTTP 不通」的假就绪；
 *   d. 传 `--timeout` / `--global-timeout`：单测封顶 30s、整轮封顶 7min，最坏情况也必然退出；
 *   e. 无论成败：杀 server 进程树 + 清 `.pw-out-skel`（该目录**未被 .gitignore 覆盖**）+ 清理 chrome。
 *
 * ── 用法
 *   node scripts/e2e-skeleton.mjs                 # 默认 preview（快；要求 dist 是最新构建）
 *   node scripts/e2e-skeleton.mjs --dev           # 退回 dev server（改了 src 还没 build 时）
 *   node scripts/e2e-skeleton.mjs -g SKEL-015     # 只跑匹配用例（开发新断言时最省时间）
 *   node scripts/e2e-skeleton.mjs --workers 2     # 覆盖并发（默认 4）
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PORT = 3001;
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
const GREP = val('-g', val('--grep', ''));
const WORKERS = val('--workers', '4');
const TEST_TIMEOUT = val('--test-timeout', '30000');
const GLOBAL_TIMEOUT = val('--global-timeout', '420000');

const T0 = Date.now();
const say = (msg) => console.log(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(3)}s] ${msg}`);

/** 强杀占用指定端口的 LISTENING 进程（含进程树） */
function killPort(port) {
  let raw = '';
  try {
    raw = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true }).stdout || '';
  } catch {
    return 0;
  }
  const pids = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
    if (m && Number(m[1]) === port) pids.add(m[2]);
  }
  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    say(`清理占用 :${port} 的僵尸进程 PID ${pid}`);
  }
  return pids.size;
}

function killChrome() {
  spawnSync('taskkill', ['/IM', 'chrome.exe', '/F'], { stdio: 'ignore', windowsHide: true });
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
  killPort(PORT);
  killChrome();
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

// ─── a. 清场 ─────────────────────────────────────────────
say(`跑批开始（模式：${USE_DEV ? 'dev server' : 'preview(dist)'}）`);
killPort(PORT);
killChrome();

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
const serverArgs = USE_DEV
  ? [viteBin, '--port', String(PORT), '--strictPort', '--clearScreen', 'false']
  : [viteBin, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'];

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
const pwArgs = [
  resolve(ROOT, 'node_modules/@playwright/test/cli.js'),
  'test',
  'scripts/skeleton.spec.ts',
  '--reporter=list',
  `--workers=${WORKERS}`,
  `--timeout=${TEST_TIMEOUT}`,
  `--global-timeout=${GLOBAL_TIMEOUT}`,
];
if (GREP) pwArgs.push('-g', GREP);

say(`playwright 开跑：${pwArgs.slice(2).join(' ')}`);
const res = spawnSync(process.execPath, pwArgs, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
const code = res.status ?? 1;

// ─── e. 收尾 ────────────────────────────────────────────
cleanup();
say(`playwright 退出码 ${code}；总耗时 ${Math.round((Date.now() - T0) / 1000)}s`);
if (code !== 0) {
  console.log('── server 日志尾部 ──');
  console.log(tailServerLog(8));
}
process.exit(code);

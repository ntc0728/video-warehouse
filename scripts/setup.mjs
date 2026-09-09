#!/usr/bin/env node
/**
 * scripts/setup.mjs — 最小环境自检
 *
 * 作用：把「沉默的失败」提前成「一秒定位的报错」。
 * 只查 3 类对本项目真正有价值的、node 侧可判定的项：
 *   1. 端口 3001 是否被占用（避免多个 dev server 抢同一 cacheDir 假死）
 *   2. 包管理器一致性（误用 npm/yarn 会导致 esbuild postinstall 不跑）
 *   3. esbuild 可用性（pnpm10 onlyBuiltDependencies 坑的忠实探针：vite 能否跑）
 *   + Node 版本软下限（Vite6 需 >=18）
 *
 * 说明：Video/IPTV 代理是运行时经 ProxySetup 页写入 localStorage 的配置，
 *       不属于 node 侧检查；IPTV 页已有运行时占位符警告，本脚本不重复查。
 *
 * 用法：
 *   node scripts/setup.mjs            # 默认即检查模式
 *   node scripts/setup.mjs --check    # 同上
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_PORT = 3001;

const C = {
  pass: '\x1b[32m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  reset: '\x1b[0m',
};

const results = [];
function record(level, name, detail = '') {
  results.push({ level, name, detail });
}

// 1) 端口占用
function checkPort() {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        record('warn', `端口 ${DEV_PORT} 已被占用`, '已有进程监听。pnpm dev 会落到下一端口或报错；先结束残留 dev server 再起。');
      } else {
        record('warn', `端口 ${DEV_PORT} 检测异常`, String(err && err.message || err));
      }
      resolve();
    });
    srv.listen(DEV_PORT, '0.0.0.0', () => {
      srv.close(() => {
        record('pass', `端口 ${DEV_PORT} 空闲`, '可直接 pnpm dev。');
        resolve();
      });
    });
  });
}

// 2) 包管理器一致性
function checkLockfile() {
  const pnpm = existsSync(path.join(ROOT, 'pnpm-lock.yaml'));
  const npm = existsSync(path.join(ROOT, 'package-lock.json'));
  const yarn = existsSync(path.join(ROOT, 'yarn.lock'));
  if (!pnpm && !npm && !yarn) {
    record('warn', '无 lockfile', '建议用 pnpm install 生成 pnpm-lock.yaml 锁定依赖。');
    return;
  }
  if (npm || yarn) {
    record('warn', '检测到非 pnpm lockfile', '存在 package-lock.json / yarn.lock，可能用错包管理器导致 esbuild 未构建。请改用 pnpm。');
  } else {
    record('pass', 'lockfile 一致', '使用 pnpm-lock.yaml（单一包管理器）。');
  }
}

// 3) esbuild 可用性 —— 以 vite 能否真正运行为探针（vite 运行即依赖 esbuild）
function checkEsbuild() {
  const tries = [
    'pnpm exec vite --version',
    'node_modules/.bin/vite --version',
  ];
  for (const cmd of tries) {
    try {
      const out = execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true }).toString().trim();
      record('pass', 'esbuild / vite 可用', out.split('\n')[0] || '');
      return;
    } catch {
      // 试下一个
    }
  }
  record('warn', 'vite 无法运行（esbuild 可能未构建）', '运行 `pnpm install` 触发 esbuild 的 postinstall（pnpm10 需 package.json 的 onlyBuiltDependencies 含 esbuild）。');
}

// 4) Node 版本软下限（engines 为空，给 Vite6 下限 >=18）
function checkNode() {
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0], 10);
  if (major < 18) {
    record('warn', `Node ${v} 过低`, 'Vite 6 需要 Node >= 18，请升级。');
  } else {
    record('pass', `Node ${v}`, '满足 Vite 6 最低要求 (>=18)。');
  }
}

await checkPort();
checkLockfile();
checkEsbuild();
checkNode();

console.log('');
console.log(`${C.info}=== 环境自检 (scripts/setup.mjs) ===${C.reset}`);
let hasWarn = false;
for (const r of results) {
  const tag = r.level === 'pass' ? 'PASS' : 'WARN';
  const line = `${C[r.level]}• [${tag}]${C.reset} ${r.name}${r.detail ? ' — ' + r.detail : ''}`;
  console.log(line);
  if (r.level === 'warn') hasWarn = true;
}
console.log('');
console.log(`${C.info}说明：${C.reset}Video/IPTV 代理为浏览器运行时配置（ProxySetup 页写入 localStorage），不在此检查；IPTV 页已有运行时占位符警告。`);
console.log(hasWarn ? '存在 WARN 项，但不阻断 dev。' : '全部通过 ✓');
process.exit(0);

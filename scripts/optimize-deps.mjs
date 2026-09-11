#!/usr/bin/env node
/**
 * postinstall：把 Vite 的首次「依赖预打包（optimize）」从「首次打开 dev server」
 * 提前到「依赖安装完成时」。
 *
 * 为什么需要（2026-09-11 实测）：
 *   Vite dev server 的 Environment.listen() 里有 `await this.depsOptimizer.init()`，
 *   缓存（node_modules/.vite）缺失时要跑 scanner + 完整 optimize —— 本机实测
 *   **≈4062 ms / 20 个 dep**。这期间 HTTP 层不返回 index.html，浏览器表现为「纯白」
 *   （index.html 里的启动骨架也来不及显示，因为 HTML 本身还没到）。
 *   把这一步前移到 install 后，dev 启动时只做 hash 校验（实测 `Hash is consistent. Skipping.`），
 *   clone → install → dev 首开不再白屏。
 *
 * 硬性约束（勿改）：
 *   1. **本脚本永不以非零码退出**。postinstall 失败会让 `pnpm install` 整体失败，
 *      等于把「首开慢」升级成「装不上」——绝不能发生。
 *   2. 跨平台：只用 Node API，不依赖 shell 的 `||` / `exit 0`
 *      （Windows cmd 是 `exit /b 0`，POSIX 是 `exit 0`，二者不通用；
 *      而 `|| true` 在 cmd 下 `true` 不存在）。
 *   3. `vite optimize` 在 Vite 6 已被标记 deprecated（仍可用）。故这里对其退出码
 *      一律容错：未来若被移除，本节只 warn 并 exit 0，dev 启动时会自动重试优化。
 *   4. 需要跳过时设置环境变量 `VITE_SKIP_OPTIMIZE=1`。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const log = (msg) => console.log(`[optimize-deps] ${msg}`)

/** 跳过预打包并以 0 退出（永不阻断 install） */
const skip = (reason) => {
  log(`${reason} → 跳过预打包（dev 启动时会自动进行，仅首次启动略慢）`)
  process.exit(0)
}

if (process.env.VITE_SKIP_OPTIMIZE) skip('检测到 VITE_SKIP_OPTIMIZE')
if (process.env.CI) skip('检测到 CI 环境')
if (process.env.CAPACITOR === 'true') skip('检测到 CAPACITOR 构建')

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) skip('未找到 vite（可能为 --production 安装或依赖未装全）')

log('预打包依赖，以缩短 dev 首开时间…')
const startedAt = Date.now()
const result = spawnSync(process.execPath, [viteBin, 'optimize'], {
  cwd: root,
  stdio: 'inherit',
})

if (result.error || result.status !== 0) {
  const why = result.error ? result.error.message : `exit ${result.status}`
  log(`预打包未成功（${why}）→ 已忽略：不影响安装；dev 启动时会自动重试优化`)
} else {
  log(`完成（${Date.now() - startedAt} ms）`)
}

// 无论成败都返回成功，避免 postinstall 阻断 `pnpm install`
process.exit(0)

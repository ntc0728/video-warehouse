---
date: 2026-10-11 19:40
module: vite dev / scripts / deps
type: refactor
build: pass
files:
  - scripts/vite-early-bind.cjs（新建）
  - package.json（dev 脚本 + 移除 pnpm.patchedDependencies）
  - pnpm-lock.yaml（去 patch 记录）
  - patches/vite@6.4.2.patch（删除）
  - scripts/e2e-vite-server.cjs（require 预载）
  - scripts/lint-all.mjs（新增第 6 门 lint:lock-pnpm）
  - vite.config.ts（server 段注释指针）
demo: 无
---

# 2026-10-11 19:40 — vite 端口提前 bind 从 pnpm patch 迁移为 npm/pnpm 通用预加载补丁 + lint:all 加 lock 一致性门

## 背景（用户拍板处理两项遗留）
1. 上一批修复的 vite listen-order 依赖 `pnpm.patchedDependencies` 直改 chunk，**npm 安装路径从不 apply pnpm patch**，本地 `npm run dev` 一直吃不到；patch 文件还手写非法（已在上条 commit 修复为合法，但只覆盖 pnpm/CI 路径）。用户选「挪进配置层（更干净）」。
2. lint:all 无 pnpm 配置/lock 一致性校验，这类漂移只在部署环节首爆。

## 方案与关键取舍
- **先试 `server.httpServer.create`（vite 5.1+ 公开 API）→ 失败**：本仓 vite 6.4.2 的 `ServerOptions` 无 `httpServer` 字段（TS 编译期即拦下，dist 亦无 createServer 消费路径），非该 API 落点。
- 改走 **`NODE_OPTIONS=--require` 预加载 `scripts/vite-early-bind.cjs`**：vite `_createServer` 是「先 `http.createServer()` 拿实例，再覆写 `httpServer.listen`」，预载模块在 createServer 返回前把实例 `listen` 换成包装，从而拦到 vite 后续那次真 listen：
  - ① 实例创建即以最终端口（CLI `--port` > 默认 3001）**早期 bind** → 端口秒可连；
  - ② vite 上层调 listen 时已 listening → **noop + 回调**（规避 `ERR_SERVER_ALREADY_LISTEN`）；早期 bind 撞 EADDRINUSE 被自吞则不置 listening，vite 标准 `port+1` 重试链完整保留；
  - ③ 端口漂移纠偏：cjs 默认常量与 vite.config 分处两地（cjs 读不了 TS 配置），若上层期望端口 ≠ 早期实际绑定端口 → close 后按新端口重 bind。`VITE_NO_EARLY_BIND=1` 整体关闭。
- **摘除 pnpm patch**：package.json 去 `patchedDependencies`、删 `patches/vite@6.4.2.patch`、lockfile-only 同步（lock 内 patch_hash 记录归零）。npm/pnpm/CI 三路径行为自此一致。
- 顺带把本地 `node_modules/vite` 里手改的 chunk 恢复为原版（消除"本地一直吃不到"的迷惑源）。

## 接入面
- `dev` = `cross-env NODE_OPTIONS="--require ./scripts/vite-early-bind.cjs" vite`；e2e dev 档走 `scripts/e2e-vite-server.cjs`，同目录 `require` 预载，行为与手动 dev 一致。

## 新增 lint:all 第 6 门 `lint:lock-pnpm`
- `pnpm install --frozen-lockfile --lockfile-only`：不下载、不碰 node_modules，命中锁 <1s（本批实测 0.3–0.4s）、需重算 ~7s，与日常 npm 流零摩擦；拦 package.json 的 pnpm.* 配置与 pnpm-lock.yaml 漂移。AGENTS.md / CLAUDE.md / env.md / testing.md / runtime-conventions / knowledge 的「7 门」口径与 test-map 门号一并改（门数 8，test-map 不再称"第 7 门"）。

## 验证（已验证的改动）
- 本地 A/B（暖缓存）：无补丁 tcp=521ms / 带补丁 tcp=425ms——暖缓存 init 快，差值不显著；**关键差异在冷缓存 init 2–8s 窗口**，该窗口原版端口不可连（ECONNREFUSED），补丁后立即可连。
- `e2e-skeleton --dev scripts/source-checker.spec.ts`：2 passed（6.3s）。
- `e2e-skeleton --dev scripts/boot-splash.spec.ts`：**19 passed（41.2s）**——启动骨架 dev 套正面回归，含早期 HTML 链。
- `npm run lint:all` **8 门全绿**（EXIT=0，build 通过；eslint 仅存量 warning）。
- ⚠️ 遗留观察（未动，待拍板）：eager-pretransform 插件与 early-index-html 中间件是否也收进同一预载文件，目前仍分散在 vite.config.ts；如需可后续单独整并。

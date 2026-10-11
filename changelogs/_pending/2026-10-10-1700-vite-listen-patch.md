---
date: 2026-10-10
module: vite dev / early HTML
type: perf
build: pass
files:
  - patches/vite@6.4.2.patch
  - package.json
  - capacitor.config.ts
demo: 无
---

# Vite 6 dev listen 顺序 patch：端口先 bind、init 后台并行

## 问题

本地 dev 冷启动时，浏览器表现为「纯白屏，Network 无任何 JS/API 请求」——**document 本身没回来**。

上一轮 early HTML 中间件（commit 4a49d44）假设根因是「HTTP 层 hold 请求不返回 index.html」，但实测证明：

**Vite 6 的 `httpServer.listen` 包装（dep-Dq2t6Dq0.js:38773）是先 `await initServer(true)`（含 `depsOptimizer.init()`，2–8s）完成后才真正 `listen(port)` 绑定端口。** init 期间端口未 bind → 浏览器 TCP 连接直接被拒（ERR_CONNECTION_REFUSED 白色错误页），early HTML 中间件无机会执行。

探针 `node vite.js` 测试与用户场景的差异：Playwright `goto` 和 node fetch 都会对 ECONNREFUSED 自动重试直到成功，掩盖了「一次失败就停」的真实浏览器行为。

## 修复

`patches/vite@6.4.2.patch`：把 `listen(port)` 提到 `initServer` 之前，端口立即可连、init 后台并行。模块请求仍由 Vite 内部 `scanProcessing` 机制 hold 至 init 完成，document 请求走 early HTML 立即返回骨架。

`package.json`：注册 `pnpm.patchedDependencies.vite@6.4.2`。

## 实测对照

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| TCP 端口可连（deps 缓存删除后） | init 完成后才 bind（~3s） | **~386ms** |
| document 首字节 | ECONNREFUSED 或 hold ~2.5s | **32ms** |
| 骨架可见 | 无（白屏） | **~400ms** |
| 内容可用（main.tsx） | ~2.8s | **~3.3s**（init 完成放行） |

## 验证

- `npm run lint:all` 七门全绿（含 version-sync，已同步 capacitor 版本号）
- `node scripts/e2e-skeleton.mjs scripts/skeleton.spec.ts` 18 passed
- 手工探针（删 deps → `pnpm run dev` → 不等 ready 立即发 document）：端口 386ms 可连、document 32ms 200 含骨架、模块 3290ms 放行

## 副作用 / 已知代价

- Vite 升级后 patch 需重新适配（`pnpm patch-commit` 重新生成）；`pnpm install` 时自动 apply
- `patches/` 目录新增（已纳入版本控制）；`node_modules/.pnpm_patches` 临时目录由 `.gitignore` 的 `node_modules` 规则覆盖
- `pnpm patch-commit` 因网络无法访问 github（`mpegts.js` git 依赖）失败，patch 文件用 `git apply` 等效方式手工生成；后续网络可用时可跑 `pnpm patch-commit` 重新验证格式

## 关联

- 4a49d44 early HTML 中间件（本次为前置条件，解决 hold 期间 document 返回）
- 6bf6d6e SKEL-014 spec 期望同步

---
date: 2026-09-22 21:40
module: testing/e2e
type: fix
build: true
files:
  - playwright.config.ts
  - scripts/run-tests.ps1
demo: HOME-088 经 run-tests.ps1 -Grep 与裸 playwright 双路均 1 passed（22s/28.5s）；npm run build ✓
---

# 修复 E2E 动态端口多进程不一致导致的全量 CONNECTION_REFUSED

【问题】`npx playwright test` / `npm run test:smart` / `run-tests.ps1 -Grep` 下所有用例 `page.goto: net::ERR_CONNECTION_REFUSED`（修复前 HOME-088 稳定复现 3 次）。表现为快速失败而非挂死，但若叠加重试 + 多用例 + list reporter 缓冲，体感接近「卡死无输出」。

【根因】`playwright.config.ts` 顶层是 **async IIFE**，主进程与每个 worker 子进程都会各自 import 执行一次；`resolveE2EPort()` 每次向 OS 申请**新的**空闲端口且不回写：
1. 主进程拿到 port A → webServer 起在 A、globalSetup 探测 A 通过；
2. worker 进程重新求值 config → 拿到 port B → `use.baseURL` 指向 B；
3. 用例 `page.goto('/')` 连 B → 拒绝连接。

DEBUG 日志实证：`[pw-config] pid=主 E2E_PORT=62100` vs `pid=worker E2E_PORT=49890`。

【修法】`resolveE2EPort()` 首次动态分配后 **`process.env.E2E_PORT = String(port)` 回写**；worker 继承主进程 env 后走 `if (process.env.E2E_PORT) return Number(...)` 短路，全链路同端口。`e2e-skeleton.mjs` 本就通过 `childEnv.E2E_PORT` 传端口，不受影响；本修复补齐裸 `playwright test` 路径。

【附带修复】`run-tests.ps1` playwright/vitest 子进程退出码透传（原 `1 failed` 仍 `exit 0`，调用方无法感知失败）。

【验证】
- 裸 `pnpm exec playwright test scripts/home.spec.ts --grep HOME-088 --retries=0` → 1 passed
- `pwsh scripts/run-tests.ps1 -Files @('src/pages/Home/index.tsx') -Grep 'HOME-088' -Retries 0` → 1 passed, exit 0
- `npm run build` ✓

【未修·顺带发现】`$uiPrecisionMap` 中 Home 的 grep 含 `HOME-001|HOME-002|…`，但 `home.spec.ts` 用例标题多为中文+裸数字（`001 无Token提示`），仅 HOME-088/089 带 `HOME-` 前缀 → 精粒度映射对多数 Home 用例实际零命中（手动 `-Grep "HOME-001"` 会 `No tests found`）。属映射与标题命名漂移，另案处理。

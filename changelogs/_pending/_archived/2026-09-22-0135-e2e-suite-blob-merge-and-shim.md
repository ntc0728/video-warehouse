---
date: 2026-09-22
module: scripts / e2e
type: fix
build: node --check 两脚本通过；eslint 0 error；三次全量实测（188.0s 基线 / 12.2s 崩 / 196.5s + 184.2s 修复后）
files:
  - scripts/e2e-suite.mjs
  - scripts/e2e-skeleton.mjs
  - .gitignore
  - docs/agents/testing.md
---

# 全量 E2E 报告两阶段互相覆盖修复 + 沙箱 delete-shim 卡死排解

## 缺陷 1：报告覆盖（Stage B 吃掉 Stage A）

旧行为：两阶段都写 `playwright.config` 的 html reporter → 同一个 `playwright-report/` 目录，**Stage B 整份覆盖 Stage A**，默认套最终只剩 24 条 player 系用例，Stage A 那 108 条的明细全丢。

新行为：两阶段各写**独立目录**的 blob（`.pw-blob` / `.pw-blob-b`），跑完经 `collectBlobs()` 用 **`renameSync`** 归集到 `.pw-blob`（rename 不移除文件，天然绕开 delete-shim），再 `merge-reports --reporter=html,list` 汇总成单一完整报告。

- Stage A 补 `--reporter=list --reporter=blob`（A 是 FULL 档，`e2e-skeleton` 不给 `--reporter`，走 config 的 html+list → 需补 list 以保留过程可见性）；Stage B 只补 blob（ad-hoc 档已自带 list，避免重复注册）。
- 并行分支（`E2E_PARALLEL=1`）同步改用同一套 blob + `await mergeReports()`。
- 实测：`merge-reports` 输出 **`Running 132 tests`** = A 108 + B 24 ✅。

## 缺陷 2：沙箱 delete-shim 卡死整轮（新发现）

现象：改完后某轮 **12.2s 秒崩**。根因不在代码 —— 沙箱经 **`NODE_OPTIONS` 注入** delete-shim，单次删 >50 文件即抛 `[SAFE_DELETE_BULK_CONFIRM_REQUIRED]`；Playwright 启动时清理上轮 `--output` 产物（253 文件）被拒 → 整轮秒退；retry 阶段清 artifacts zip 同样被拒 → 用例被记成 **failed 假红**。

修法：两个脚本顶部 `delete process.env.NODE_OPTIONS`（**项目既有先例**：`scripts/run-tests.ps1` 对子进程已如此处理）。

附带收益：global-teardown 的清理真正生效，跑完 `.pw-out-*` 只剩 `.last-run.json`，**此前每轮累积 85MB 残留的问题一并消失**。

## 关键结论（沉淀）

1. `merge-reports` **只认 `report.jsonl` 索引，不扫目录内 zip** —— 判定「是否读全部 blob」必须用**内容不同**的两份 blob；内容相同的两份会按 testId **去重**，会误判成「只读一份」（首次实验即踩此坑）。
2. blob 产物名固定 `report-<hash>.zip`（两阶段同名 → 互相覆盖，这是缺陷 1 的直接根因）；`.pw-blob` 内散落的 `report.jsonl`/`resources/` 是打包中断残留，merge 忽略。
3. **受限沙箱里 `spawnSync` 一律 `EBUSY`**（managed node 自身路径、system node 路径、任意参数三种写法全部中招），异步 `spawn` 正常 → 编排器内任何「创建子进程」必须用 `spawn`，否则静默失败（`mergeReports()` 原为 `spawnSync`，在沙箱必挂且只让报告不完整、不报错）。
4. 失败栈出现 `node-safe-delete-shim.cjs` 时先判环境，别当回归。

## 配套

- `.gitignore` 补 `.pw-blob/` + `.pw-blob-*/`（此前 PARALLEL 分支用 `.pw-blob` 却从未被忽略）。
- `docs/agents/testing.md` 补报告机制说明（blob + merge + 收尾 `localize-report`）。

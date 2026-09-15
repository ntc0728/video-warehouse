---
date: 2026-09-15 23:55
module: test-e2e
type: fix
build: boot-splash 13 passed / 全量 E2E 可跑（145 枚举）
---

# 2026-09-15 23:55 修复 E2E 无法执行：换完整 chromium 通道（结论更正）

## 现象

会话内 Playwright 全不可用：`page.goto: Page crashed`，且整个 browser 进程以
`exitCode=3221225501`（0xC0000409）退出。纯静态页 / data URL 正常，
故一度误判为「沙箱跑不了本应用」，并在前一轮文档里写下该结论。

## 真·根因

Playwright 默认跑自带二进制 **`chrome-headless-shell`**，它在本环境加载本应用
时会整体崩出；同一份页面改用**完整 chromium 的 headless=new 即完全正常**
（dev 与 dist 产物均可）。`--disable-gpu` / `--no-sandbox` / `--single-process`
等 GPU 类参数对这个崩溃无效 —— 方向错了。

识别信号：`pw:browser <process did exit: exitCode=3221225501>` +
静态页正常 + 崩溃发生在应用 JS 执行阶段。

## 修复

- `playwright.config.ts`：`use.channel = process.env.PW_BROWSER_CHANNEL || undefined`
  （默认行为不变，受限环境显式开关）；
- `scripts/global-setup.ts`：`chromium.launch({ channel: env.PW_BROWSER_CHANNEL })`
  —— **`chromium.launch()` 不继承 config 的 `use.channel`**，自定义入口必须显式传，
  否则诊断会被误导为「还是崩」；
- 撤回上一轮为此加的临时配置 `playwright.preview.config.ts`（不再需要）。

跑法：`PW_BROWSER_CHANNEL=chromium npx playwright test`

## 验证

- `scripts/boot-splash.spec.ts` **13 passed**（dev server + chromium 通道，29.5s）；
- 全量 E2E 可跑：145 条枚举，运行到 144/145（`verify-grid.spec.ts` 是手工调试用例，需 :3002
  手动起服务，会挂到最后一条；与本改动无关）。

**回归判定（worktree @ c114c867 同端口/同通道对照）**：同样 6 个 spec，改动前基线 11 败、
当前 13 败；逐条定性后**无回归**：

| 差集 | 结论 |
| --- | --- |
| BROWSE-094 / BROWSE-095 | 并发 flaky —— 单跑 1 worker 两条全过 |
| USER-CROSS-001 | 单跑通过，全量并发偶发 |
| HIS-050/051 | **既有缺陷** —— 基线与当前各复跑 3 次均 3/3 失败 |

其余 10 条（BROWSE-010/012/013/014、BROWSE-081/082、DETAIL-060/062、IPTVP-023、
smoke-player-fs-mobile 全 7 条）基线同样失败，属无 `.env.local`（占位 token/代理）+ 无外网
的环境性失败。基线对照时若忘记给对照 worktree 补同样的 `PW_BROWSER_CHANNEL` 支持，
会误得 45 败的假结论（此时它仍在跑崩溃的 headless shell）。

## 附带发现

本机 `HTTP_PROXY=http://127.0.0.1:1727`（代理工具）会劫持 node 对 localhost 的请求，
访问本地端口（如 CDP `http://127.0.0.1:9222/json/version`）返回 502；
本机调试时命令前加 `NO_PROXY='127.0.0.1,localhost'`。

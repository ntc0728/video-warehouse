---
date: 2026-09-15 23:20
module: test+docs
type: test
build: playwright --list 13 枚举过 / vitest 389 全过 / E2E 沙箱不可跑（见片段）
---

# 2026-09-15 23:20 启动骨架 E2E 护栏 + 知识沉淀（测试/文档收尾）

## 改动

### 新增测试
- `scripts/boot-splash.spec.ts`（13 用例）：启动骨架 `#boot-splash` 的路由感知
  （data-shape 8 填充 shape + play/plain）与视口填充契约
  （`bs-body` 底边 ≥ 视口底 − 60），含 1080p home 回归（曾只有 hero+1 行）、
  TV UA → `data-cols=tv`、主模块放行后骨架 detached。
- 手法：route 拦截主入口模块（dev `**/src/main.tsx*` / dist `**/assets/index-*.js`）
  延迟 2.5s，`goto(..., { waitUntil: 'commit' })` —— 骨架只在 React 首帧前存在，
  直接 goto 有摘除竞态。
- `scripts/run-tests.ps1` `$uiPrecisionMap` 新增 `index.html → boot-splash.spec.ts`。

### 文档沉淀（push 前提炼）
- `docs/agents/runtime-conventions.md` §7 工具链陷阱：+vite 盘符大小写根因与修法、
  +沙箱 Chromium 跑不了本应用的实测结论、+boot-splash E2E 观察手法。
- `docs/agents/testing.md`：映射表 +`index.html → boot-splash.spec.ts`（13）。
- `docs/agents/patterns.md`「页面骨架占位」：+骨架视口填满约定
  （useFillRows / fillRows 两套机制，新页面骨架必须接 useGridCols + useFillRows）。

## 验证

- `playwright --list`：13 tests 枚举通过（语法/fixture 引用正确）。
- Vitest 全量：33 files / 389 tests 全过。
- E2E 本沙箱不可跑：Chromium 渲染进程在应用 JS 阶段确定性 Page crashed
  （dev 必崩；preview 过 dcl 后 1~2s 也崩；`--disable-gpu`/`--no-sandbox`/
  `--single-process` 均无效，纯静态页正常）。已在 runtime-conventions §7 记录，
  E2E 需开发机/CI 执行。

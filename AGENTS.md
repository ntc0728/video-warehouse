# AGENTS.md — AI Agent 项目指南

> 本文件是 AI Agent 的工作指南。Cursor / Aider / Windsurf / Claude / Copilot 等工具应优先阅读此文件。推理过程禁止使用英文，一律使用中文。

## 项目概述

**Video Warehouse (KinoTV)** — 影视聚合平台，支持多数据源视频浏览、IPTV 直播、收藏管理和智能搜索。  
技术栈：React 18 + TypeScript + Vite 6 + Zustand + Tailwind CSS + HLS.js/DASH.js。

## 不可协商红线（违反即回退）

1. **改完必须 `npm run build` 验证**：禁止用 `npx tsc --noEmit --skipLibCheck` 替代（`--skipLibCheck` 跳过 `noUnusedLocals`，CI 会挂）。流程：改代码 → build 通过 → commit → push。
2. **改动及时 commit，不堆积**；每完成一个独立功能立即 commit（红线：子代理/误操作可一键覆盖未提交改动）。
3. **子代理操作前必须 commit / stash 保护**当前状态（子代理可能重写非指定文件）。
4. **CSS/恢复类改动必须 grep 所有 `display:none` / `visibility:hidden`**，确认无遗漏；恢复代码后不能说"全部恢复"，只能说"已验证的改动"。
5. **临时服务/进程用完立即关闭**，收尾用 `tasklist` + `netstat` 双确认零遗留；自己的测试残留不得算到用户头上。
6. **E2E 分级门禁**：按改动类型决定验证档位——**删除/文档/纯脚本类**改动：`npm run build` + `npm run lint:all` + 受影响 spec（临时档）即可；**行为类**改动（src 业务代码、播放链、布局/动画）才需要全量。**全量 E2E（`test:e2e` / `e2e-suite.mjs` / `e2e-skeleton.mjs --all` 及任何等效方式）未经用户明确允许不得运行**。全量硬预算仍为 ≤5 分钟（300s 看门狗超时即失败），超预算按 testing.md「预算取舍优先级」处理，禁止删断言凑时间。测试服务禁占用户端口（OS 动态分配）、禁按端口/镜像名杀进程（只杀带测试标记的自建进程）。**改动 `run-tests.ps1` 映射 / 加删用例后必须跑 `npm run test:count`**（`-- --write` 同步 `testing.md` 生成块）——它逐条校验「引用的 spec 存在 / pattern 基路径存在 / grep 片段真命中 / 档位恒等式」，已作为 `lint:all` 第 7 门（`lint:test-map`）；靠人眼维护映射会静默腐化（2026-09-23 一次查出 21 个死 grep 片段 + 2 个失效 pattern）。
7. **临时/调试跑批硬规矩**（`e2e-skeleton.mjs` 已机制化）：ad-hoc 单轮墙钟 **≤120s**（跑批器看门狗到点按**进程树**击杀、退码 2）、`retries=0`、指定 spec 文件即调试档（不带 `--all`）；放宽只允许 `--budget/--retries` 显式声明且须在结论说明理由。诊断期间禁止反复跑全量。**凡要跑 playwright 都走 `e2e-skeleton.mjs`**（`test:e2e:*` / `e2e-suite.mjs` / `run-tests.ps1` 增量档共用），别裸调 `playwright test`——config 的 `webServer.command` 是字符串，Windows 下经 shell 启动，收尾只杀到 shell、vite 成孤儿占端口（2026-09-23 实测进程 632s 不返回）。
8. **单步等待/超时 ≤10s（2026-09-21 用户定稿）**：脚本内任何单步等待（`waitForSelector` / `toBeVisible` / `expect.poll` / `waitForTimeout` 等）不得超过 10s；若某处必须 >10s 才能继续执行，**立即停止操作并向用户说明原因**，禁止自行放宽。封顶机制不在此列（用例级 testTimeout 45s/30s、整轮 globalTimeout、webServer 就绪 60s、跑批看门狗 120s/300s 属预算封顶，保留现值）。

> 全站/多页面改动（视觉尺寸 · UX · 动画）未经明确许可不得擅自动手；提案需附可运行 demo。

## 文档索引（按需 Read，不要全量加载）

| 主题 | 文件 | 何时读 |
| --- | --- | --- |
| 架构 / 四层分层 / 代理 / 目录 / Android 原生 | [docs/agents/architecture.md](docs/agents/architecture.md) | 改 store/service/代理/目录结构时 |
| 页面与路由 / Keep-Alive / 搜索传递 | [docs/agents/pages.md](docs/agents/pages.md) | 改页面、路由、导航时 |
| 数据格式 / CMS 解析 / 领域术语 | [docs/agents/data-formats.md](docs/agents/data-formats.md) | 解析 vod_play_url、对接数据源时 |
| 关键模式（Hero/RecordShell/Toast/回退链/过渡/TvMascot…） | [docs/agents/patterns.md](docs/agents/patterns.md) | 写组件、动画、播放器时 |
| CSS / 布局 / 断点细则（断点宪法/流体 token/高度体系/列数梯度/CSS 陷阱/跑马灯/基线隔离法） | [docs/agents/css-layout-conventions.md](docs/agents/css-layout-conventions.md) | 改样式、布局、骨架、断点时 |
| 运行时细则（播放器自愈/跨页签同步/reqSeqRef 竞态/E2E 断言/工具链陷阱） | [docs/agents/runtime-conventions.md](docs/agents/runtime-conventions.md) | 改播放器、跨页签、异步、测试、构建时 |
| 测试依赖映射 / 快速跑法 / 增量测试 | [docs/agents/testing.md](docs/agents/testing.md) | 改完代码跑对应测试时 |
| 文档同步协议 / 协同开发 / .gitignore | [docs/agents/docs-protocol.md](docs/agents/docs-protocol.md) | 完成改动同步文档时 |
| 人机协作约定（UI/观感类必读） | [docs/agents/collaboration.md](docs/agents/collaboration.md) | UI/动画/布局任务前 |
| 版本号 / release-please | [docs/agents/versioning.md](docs/agents/versioning.md) | 发版、改版本号时 |
| 开发命令 / 环境 | [docs/agents/env.md](docs/agents/env.md) | 起服务、构建时 |

详情索引总入口：[docs/agents/index.md](docs/agents/index.md)。

## 常用命令

```bash
npm run dev          # 开发服务器（127.0.0.1:3001，双栈监听，localhost 直连 ::1 无 IPv6 回退）
npm run build        # 生产构建（tsc -b && vite build）；沙箱清 dist 撞批量删除保护时用 npx tsc -b && npx vite build --emptyOutDir false
npm run lint:all     # 7 门总闸：design / css / json / version-sync / test-map / eslint / build
npm run test         # Vitest 单元测试
npm run test:changed # E2E 增量（按「未提交改动」跑相关 spec；命中 >3 spec 会 exit 2 拦下，-Full 放行）
npm run test:count   # 用例计数/映射一致性报告（不跑浏览器，1–2s）；`-- --write` 同步 testing.md
npx playwright test  # ⚠️ 只用于 --list 校准；实跑一律走 npm run test:e2e / e2e-skeleton.mjs
```

## 改动留痕与知识沉淀（changelogs → 知识分层）

**三层各司其职，别一股脑往长期文档里塞。** 当天改动只落片段；**push 前**才做提炼。

| 层 | 写什么 | 时机 |
| --- | --- | --- |
| `changelogs/_pending/<YYYY-MM-DD-HHmm>-<slug>.md` | **每日改动流水**（front-matter: date/module/type/build/files/demo + 旧↔新对照） | 改完当天，**唯一指定出口** |
| 共享知识库：`docs/agents/*.md`、`docs/KNOWLEDGE.md`（ADR） | 跨会话仍成立的**架构 / 约定 / 根因** | **push 前**提炼 |
| 本地长期记忆：`.workbuddy/memory/ref-*.md`（细则）、`MEMORY.md`（**只放不变量**） | 个人上下文的细则与不变量 | **push 前**提炼 |

1. **改完当天只写 `changelogs/_pending/` 片段**；**不要直接写当日 `changelogs/YYYY-MM-DD.md`**，也**不要把当日流水直接塞进 `AGENTS.md` / `MEMORY.md`**。push 前跑 `node scripts/changelog-collect.mjs` 合并并归档；`node scripts/changelog-draft.mjs --since <ref>` 可从 git 改动生成骨架。pre-push 钩子会阻断未合并的片段。机制详 `changelogs/README.md`。
2. **push 前必须提炼一次**：把当日片段里「跨会话仍然成立」的结论按主题归位——团队共享的进 `docs/`，个人细则进 `.workbuddy/memory/ref-*.md`，**只有「不可协商的不变量」才进 `AGENTS.md` / `MEMORY.md`**。散会前留痕（写清了哪些文件）。
3. **内容准入（防膨胀）**：一次性细节、实测数值表、代码片段、历史演变过程、只对单一模块有用的细则，**不得**进 `AGENTS.md` / `MEMORY.md` → 下沉到 `docs/` 分片或 `ref-*.md`。自查：若某条只有「这次才想得起来」的细节才会用到，说明放错位置。
4. **待办清单更新**：以新清单**整段替换**、不保留旧版本、不建并行待办文件；**替换前必须先与用户确认上一版待办是否已完成**；移出项只在末尾「> 移出：」一行留痕。
5. **知识库变更走 PR + review**：改 `AGENTS.md` / `docs/` 等同改代码，小步提交。细则见 `docs/agents/docs-protocol.md`。

## 本地记忆（个人上下文，不进仓库）

- 位置 `.workbuddy/memory/`（已在 `.gitignore`）。结构：**索引层 `MEMORY.md`（自动注入）+ 按需 Read 的 `ref-*.md` 细则 + 每日 `YYYY-MM-DD.md` 工作日志（append-only）**。
- **`MEMORY.md` 只放「每会话必用的不变量 + 指向 ref 的指针」**：踩坑细节 / 根因 / 数值表 / 代码片段一律进 `ref-*.md`。完整文件地图、读取规则、写入规则与准入清单见 `MEMORY.md` 顶部「🗂 记忆体系」。
- **共享事实以本文件 + `docs/KNOWLEDGE.md` 为准**，冲突时信提交文档。

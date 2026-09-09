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

> 全站/多页面改动（视觉尺寸 · UX · 动画）未经明确许可不得擅自动手；提案需附可运行 demo。

## 文档索引（按需 Read，不要全量加载）

| 主题 | 文件 | 何时读 |
| --- | --- | --- |
| 架构 / 四层分层 / 代理 / 目录 / Android 原生 | [docs/agents/architecture.md](docs/agents/architecture.md) | 改 store/service/代理/目录结构时 |
| 页面与路由 / Keep-Alive / 搜索传递 | [docs/agents/pages.md](docs/agents/pages.md) | 改页面、路由、导航时 |
| 数据格式 / CMS 解析 / 领域术语 | [docs/agents/data-formats.md](docs/agents/data-formats.md) | 解析 vod_play_url、对接数据源时 |
| 关键模式（Hero/RecordShell/Toast/回退链/过渡/TvMascot…） | [docs/agents/patterns.md](docs/agents/patterns.md) | 写组件、动画、播放器时 |
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
npm run lint:all     # ESLint + Stylelint
npm run test         # Vitest 单元测试
npx playwright test  # E2E 测试（TMDB Mock 默认启用）
```

## 改动留痕（changelogs）

每轮改动往 `changelogs/_pending/<YYYY-MM-DD-HHmm>-<slug>.md` 写片段（front-matter: date/module/type/build/files/demo + 旧↔新对照）；**不要直接写当日 `changelogs/YYYY-MM-DD.md`**。push 前跑 `node scripts/changelog-collect.mjs` 合并并归档；`node scripts/changelog-draft.mjs --since <ref>` 可从 git 改动生成骨架。pre-push 钩子会阻断未合并的片段。机制详 `changelogs/README.md`。

## 本地记忆

AI 本地记忆在 `.workbuddy/memory/`（不进仓库，个人上下文）。**共享事实以本文件 + `docs/KNOWLEDGE.md` 为准**，冲突时信提交文档。知识库/文档变动走 PR + review。

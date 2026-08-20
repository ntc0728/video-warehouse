# 贡献指南（CONTRIBUTING）

> 本文面向**人类协作者**：如何开始、怎么提代码、文档与知识库怎么同步。AI 辅助工具（Cursor / Claude / Copilot）请读 `AGENTS.md`。

## 1. 项目简介

**Video Warehouse (KinoTV)** — 影视聚合平台，支持多数据源视频浏览、IPTV 直播、收藏管理与智能搜索。
技术栈：React 18 + TypeScript + Vite 6 + Zustand + Tailwind CSS + HLS.js/DASH.js。

## 2. 环境准备

```bash
# 1. 克隆
git clone git@github.com:ntc0728/video-warehouse.git
cd video-warehouse

# 2. 安装依赖（Node.js >= 18, npm >= 9）
npm install

# 3. 启动开发服务器（默认 http://127.0.0.1:3001）
npm run dev
```

TMDB 数据需在设置页填入 Access Token 后才会加载（详见 `KNOWLEDGE.md` 开发指南）。

## 3. 分支与 PR 工作流

- 从 `master` 切功能分支，命名建议：`feat/xxx`、`fix/xxx`、`docs/xxx`、`refactor/xxx`。
- **小步提交**：一次 PR 聚焦一件事，描述写清「做了什么 + 为什么」。
- 至少 **1 人 review** 后合并；**知识库（`AGENTS.md` 等）改动同样需要 review**——它和代码一样重要。
- 合并前请运行 `npm run lint:all` 并跑受影响的测试（见第 7 节）。

## 4. 提交规范

沿用仓库既有的 **conventional-commit 中文前缀**风格（参考 `git log`）：

| 前缀 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档 / 知识库变更 |
| `style:` | 样式调整（不影响逻辑） |
| `refactor:` | 重构 |
| `test:` | 测试 |
| `chore:` | 构建 / 杂项 |

示例：

```
feat: 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，仅桌面端生效）
docs: 同步卡片模块约定与 RecordShell 桌面横向布局到知识库与原理图
```

## 5. 知识库与文档同步

- `AGENTS.md` 是 AI Agent 的**唯一事实源**，所有架构 / 约定以它（及 `KNOWLEDGE.md`、原理图）为准。
- 改完代码后，按 `AGENTS.md` 的「文档同步协议」同步：**测试脚本 / 记忆库 / 知识库 / 原理图 / 流程图**，该更的更、不该更的不动。
- **不要把本地 AI 记忆提交进仓库**：`.workbuddy/`、`.claude/`、`.opencode/` 已在 `.gitignore` 忽略——那是每个人机器上 AI 的私人笔记，允许不同，无需统一。
- 非显然的架构 / 约定决策，写入 `docs/KNOWLEDGE.md` 的「架构决策记录（ADR）」。

## 6. 架构决策记录（ADR）

- **何时写**：做了有长远影响的选型 / 约定（断点策略、状态方案、代理分层、卡片化范围等）。
- **写到哪**：`docs/KNOWLEDGE.md` 的「架构决策记录（ADR）」区，编号顺延 `ADR-XXX`，含 **背景 / 决策 / 后果 / 替代方案**。
- **模板**：见 `KNOWLEDGE.md` 对应章节，直接复制填写即可。

> 为什么要有 ADR：聊天里定的约定如果不落档，换个人接手就丢了；ADR 让「为什么这么定」可追溯、可 review。

## 7. 测试要求

- 改了 **CSS 类名 / 选择器 / DOM 结构** → 必须在**同一次 commit** 更新 `scripts/*.spec.ts` 对应选择器。
- **精准跑测试**，不要全量（省时）：改动映射见 `AGENTS.md` 的「测试依赖映射」。
  ```bash
  # 单个页面（最常见）
  npx playwright test scripts/player.spec.ts
  # 共享组件（如 VideoCard）
  npx playwright test scripts/home.spec.ts scripts/browse.spec.ts scripts/detail.spec.ts scripts/collections.spec.ts scripts/history.spec.ts
  ```
- 单元测试：`npm run test`。

## 8. 协作问答

**Q：我的 AI 本地记忆和同事的不一样，要同步吗？**
A：不需要，也不应该。`.workbuddy/` 本来就不提交。大家对齐的是提交进仓库的 `AGENTS.md` / `KNOWLEDGE.md` / 原理图。本地记忆冲突时，以提交的文档为准。

**Q：我改了布局/约定，文档要动吗？**
A：按 `AGENTS.md` 的「文档同步协议」判断。结构/架构级变更要动原理图/知识库；纯颜色/间距微调通常不用。

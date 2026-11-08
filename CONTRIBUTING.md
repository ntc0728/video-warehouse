# 贡献指南（CONTRIBUTING）

> 本文介绍如何开始、怎么提代码、测试怎么跑。

## 1. 项目简介

**Video Warehouse (KinoTV)** — 影视聚合平台，支持多数据源视频浏览、IPTV 直播、收藏管理与智能搜索。
技术栈：React 18 + TypeScript + Vite 6 + Zustand + Tailwind CSS + HLS.js/DASH.js。

## 2. 环境准备

```bash
# 1. 克隆
git clone git@github.com:ntc0728/video-warehouse.git
cd video-warehouse

# 2. 安装依赖（Node.js >= 18，pnpm >= 10）
#    ⚠️ 本仓库只提交 pnpm-lock.yaml、没有 package-lock.json。
#    请勿用 npm install —— 它不会遵守 lockfile，会拉到不同的依赖树，
#    且会让 node_modules 布局与 CI（pnpm frozen install）不一致。
pnpm install --frozen-lockfile

# 3. 启动开发服务器（默认 http://127.0.0.1:3001）
pnpm dev
```

TMDB 数据需在设置页填入 Access Token 后才会加载。

## 3. 分支与 PR 工作流

- 从 `master` 切功能分支，命名建议：`feat/xxx`、`fix/xxx`、`docs/xxx`、`refactor/xxx`。
- **小步提交**：一次 PR 聚焦一件事，描述写清「做了什么 + 为什么」。
- 至少 **1 人 review** 后合并；文档改动同样需要 review。
- 合并前请运行 `pnpm lint:all` 并跑受影响的测试（见第 5 节）。

## 4. 提交规范

沿用仓库既有的 **conventional-commit 中文前缀**风格（参考 `git log`）：

| 前缀 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档变更 |
| `style:` | 样式调整（不影响逻辑） |
| `refactor:` | 重构 |
| `test:` | 测试 |
| `chore:` | 构建 / 杂项 |

示例：

```
feat: 卡片模块 UI 风格（首页/侧边栏/顶栏/loading 卡片化，仅桌面端生效）
docs: 更新 README 的部署说明
```

## 5. 测试要求

- 改了 **CSS 类名 / 选择器 / DOM 结构** → 必须在**同一次 commit** 更新 `scripts/*.spec.ts` 对应选择器。
- **精准跑测试**，不要全量（省时）：改动与测试的对应关系见 `scripts/README.md` 的「增量测试规则」。
- ⚠️ **禁止裸调 `npx playwright test`**：config 的 `webServer.command` 在 Windows 下经 shell 启动，收尾只杀到 shell，vite 会成为孤儿进程长期占端口。一律走下面两个入口：

  ```bash
  # ① 指定 spec 即「调试档」：单轮墙钟 ≤120s、retries=0
  node scripts/e2e-skeleton.mjs scripts/player.spec.ts

  # ② 或走预置脚本（已在 package.json 里封装好预算与清理）
  pnpm test:e2e:subpages     # source-checker + proxy-setup
  pnpm test:e2e:skeleton     # skeleton + boot-splash
  pnpm test:e2e:boot-iso     # boot-splash-iso
  ```
- **全量 E2E**（`pnpm test:e2e` / `e2e-skeleton.mjs --all`）**未经负责人明确允许不得运行**。
- 单步等待/超时一律 ≤10s；改动测试映射或增删用例后必须跑 `pnpm test:count` 校验一致性。
- 单元测试：`pnpm test`。

## 6. 其他问题

- 有疑问或发现 Bug，请提交 Issue；提交前请先搜索是否已有同类问题。
- 界面 / UX / 全站布局类的大改动，建议先开 Issue 讨论方案再动手。


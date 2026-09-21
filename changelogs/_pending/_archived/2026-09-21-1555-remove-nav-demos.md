---
date: 2026-09-21
module: src/pages(demo) / routes / lint 配置
type: chore
build: npm run build ✓；lint:all ✓；vitest 389 ✓；E2E 按分级门禁（删除类）：三路由无任何 spec 覆盖，受影响 spec 为空；全量未跑（2026-09-21 起未经用户允许禁止全量）
files:
  - src/pages/PlayerLab/（删除）
  - src/pages/PlayerMobileLab/（删除）
  - src/pages/PullToRefreshDemo/（删除）
  - src/components/Layout/routeConfig.ts
  - src/routes.tsx
  - scripts/design-audit.mjs
  - .stylelintrc.json
  - docs/agents/pages.md / architecture.md / testing.md
---

# 删除三个不进正式导航的调试 demo 页（player-lab / player-mobile-lab / ptr-demo）

## 旧 ↔ 新

| | 旧 | 新 |
| --- | --- | --- |
| demo 页 | 3 个目录 ~208KB 代码挂在路由表（标注"不进正式导航"） | 整体删除；routeConfig.ts / routes.tsx 注册同步移除 |
| lint/设计审计隔离 | .stylelintrc ignoreFiles 2 条 + design-audit EXCLUDE_DIRS 2 条（沙盒豁免） | 一并删除（排除钩子保留为空数组，未来再有沙盒可用） |
| 验收方式 | 人工开 demo 页比对 UniversalPlayer | 播放器移动端多端策略已由 E2E 承担（smoke-player-fs-mobile.spec / player.spec 4.12-4.14）；下拉刷新组件保留业务实现 + Vitest 单测 |
| 文档 | pages.md demo 表 / architecture.md 目录树 / testing.md 取舍判据引用 3 路由 | 改为删除留痕 + 指向替代验收手段 |

## 保留说明

- `src/components/ui/PullToRefresh/`（含 AppLayout 业务使用与其单测）**不是** demo，保留。
- 历史文档（DESIGN-DEBT-PLAN / player-remediation-plan 等）对 lab 的记述属既成事实，不改。

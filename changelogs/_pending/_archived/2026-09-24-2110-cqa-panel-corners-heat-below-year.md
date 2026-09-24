---
date: 2026-09-24 21:10
module: home
type: fix
build: pass
files:
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
demo: none
---

# 2026-09-24 2110 CQA 面板顶角直角 + 热度值移入年份下方

## 改动

- 首页顶部导航 chips hover 面板 `.cqa-overlay`：左上/右上去掉圆角（`border-radius: 0 0 lg lg`），贴 header 展开
- 面板内 `.cqa-hotcard` 热度值从右侧列移入 body，置于年份下方
- body 改 flex 纵向 + `gap: --space-xs`，加大标题/年份/热度三行间距
- heat `.n`/`.l` 改同行排列，避免三行堆叠撑破 `--cqa-row-h`（= poster 高）

## 旧↔新

| 位置 | 旧 | 新 |
| --- | --- | --- |
| `.cqa-overlay` 圆角 | 四角 `--radius-lg` | 仅底角 `--radius-lg`，顶角 0 |
| 热度位置 | 卡片右侧独立列 `.cqa-hotcard__heat` | body 内、年份行下方 |
| body 行距 | `margin-top: --space-2xs` | `gap: --space-xs` |

## 验证

- `npm run lint:all` 7/7
- 增量 E2E：skeleton/detail/home（e2e-skeleton）

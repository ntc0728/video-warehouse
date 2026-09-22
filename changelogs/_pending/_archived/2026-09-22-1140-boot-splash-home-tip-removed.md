---
date: 2026-09-22
module: boot-splash
type: 视觉修复（home 形态冗余提示）
build: ✅ npm run build
tests: boot-splash.spec 21/21 ✓（ad-hoc 调试档）
---

# 启动骨架 home 形态不再显示「正在启动…」提示

## 根因

`.bs-tip` 是全形态通用状态行；09-20 曾按「提示应垂直居中」把 home 形态钉在视口中线
（`top:50% + translateY`）。当时 home 形态只有 hero + 1 行不填充，居中合理；
现骨架铺满整个视口后，居中文本正好叠在 hero banner 中央（用户截图反馈冗余）。

## 新旧对照

| | 旧 | 新 |
| --- | --- | --- |
| home 形态提示 | 视口居中「正在启动…」压在 hero 上 | 脚本就绪（`data-shape-ready`）后 `display:none` |
| 无 JS / 脚本失败兜底 | 居中提示 | 仍显示提示（选择器带 `[data-shape-ready]` 门控，静态默认态不命中） |
| 其余形态（plain 居中 / play·player 文案 / 有内容档贴底） | — | 不动 |

## 说明

- BOOT 系列仅 play/player 断言提示文案，home 无提示可见性断言，21/21 无回归。
- 与同日前一条「plain AppLoading 盖脸」整改（2026-09-22-1030 片段）同属启动链治理，独立提交。

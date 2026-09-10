---
date: 2026-09-10 23:55
module: Detail / 首页（方向裁决）
type: fix
build: 通过（pnpm run build）
files:
  - src/pages/Detail/Detail.css
  - scripts/home.spec.ts
  - scripts/chart.spec.ts
---

## 第四轮：两栏重叠修复 + 右栏一行两列 + 宽屏方向裁决

### 方向裁决（用户 2026-09-10）

本工作区此前存在两套冲突实现，用户裁决**以并行会话的在途 WIP 为准**：
宽屏起点 **1024**（非 1280）、首页 rail 重写为 **「今日趋势 TOP20」（`.cqa-trend`）**、
其余项（HeroBili 右卡 6→5、Chart/SearchBox/StickyHeader 调整）保持。

该批代码由并行会话产出，已代为入库（commit `d3a5d69`）并做冒烟验证；断言同步见下。

### 问题一：banner 与 detail-hero-side 重叠（实测 1440 重叠 32px）

**旧逻辑**：`.detail-top` 用默认 `align-items: stretch`，hero 高度被行高拉伸到 453px；
hero 带 `aspect-ratio: 16/9`，在高度已定后浏览器**反过来用 ratio 反算宽度** → 805px，
超过轨道宽 765px → 溢出到右栏。

**新逻辑**：`align-items: start`（hero 自己按「轨道宽 × 9/16」定高）+ hero 显式 `width: 100%`
+ 子项 `min-width: 0`（grid item 默认 `min-width:auto` = min-content，一并防内容撑宽）；
右栏仍用 JS 写入的 `--detail-hero-h` 对齐下沿。

实测 1024/1100/1280/1440/1920/2560 全档：无重叠、间距 7–10px、下沿差 ≤0.5px、按钮行不溢出。

### 问题二：右栏信息改一行两列

右栏 `.detail-info-grid` 由单列改 `repeat(2, minmax(0,1fr))`，卡片内部仍是
「标签一行、值一行」的分行结构（值 `overflow-wrap: anywhere` 防长值溢出）。
实测 1440：9 字段排 5 行（2/2/2/2/1）、无截断，右栏内容高 774 → **541px**。

### 测试断言同步

| 文件 | 过时断言 | 新断言 |
| --- | --- | --- |
| home.spec 070/083 | `.cqa-catcard` 3 卡 × 5 条、点卡跳 /chart | `.cqa-trend` 条目、排名自 1 连续、点条目前往详情 |
| home.spec 077 | 分类卡跳 /chart | 趋势条目跳详情 |
| home.spec 079 | 副标题「今日各分类最热」 | 「TMDB 实时趋势排名」 |
| home.spec 087 | `.cqa-panel__refresh`「加载中…」 | `.cqa-panel__loading`「正在获取」 |
| home.spec 060/061、075 | 1024 视口测圆卡 | 900 视口（圆卡回退区间现为 768–1023） |
| chart.spec 006 | `.chart-list--refreshing` + 胶囊 | `.chart-loading` |

### 验证

`pnpm run build` 通过；e2e `home + detail + person + chart + browse + settings` 共 **45/45 全通过**。

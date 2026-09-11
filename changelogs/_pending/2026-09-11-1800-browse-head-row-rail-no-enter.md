---
date: 2026-09-11 18:00
module: Browse 页（≥1024 栅格）/ 页面转场
type: ui
build: tsc -b 通过；vite build 通过；stylelint 相对 HEAD 净减 2 条（18 → 16，无新增）
files:
  - src/assets/styles/animations.css
  - src/pages/Browse/Browse.css
  - src/pages/Browse/index.tsx
demo: 无（沿用既有栅格，未出新 demo 页）
---

## Browse 首行「胶囊 + 结果头」同行 + 左栏入场动画豁免（Browse / IPTV）

### 旧 → 新

| 项 | 旧 | 新 |
| --- | --- | --- |
| 左栏入场动画 | `.page-transition[data-variant="soft"] > *` 把整页（含左栏）卷进 6px 上移 + 淡入 | Browse / IPTV 页面根 `animation: none`（沿用收藏/历史页 `.record-page` 口径），左栏静态即现；二次进入（revisit）同样豁免 |
| 模式胶囊宽度 | ≥1024 `flex: 0 0 auto`（内容宽，≈180px，宽于左栏） | `flex: 0 0 var(--rail-w)` + `width: var(--rail-w)`，与左栏 `--rail-w` 同宽同列 |
| 胶囊内按钮 | 原 `padding: var(--space-xs) var(--space-lg)` | `flex: 1 1 0` 等分 + `justify-content: center` + `padding: var(--space-xs) var(--space-2xs)` + `white-space: nowrap` |
| `.browse-search-tabs__hint` | 「跨源聚合 · 类型 / 地区 / 评分可组合筛选」≥1024 显示 | **删除**（JSX + 基础规则 + ≥1024 规则） |
| `.browse-sort-bar` 位置 | 结果卡内部首行（栅格 row2 右列） | 提到首行右列，与模式胶囊同一行 |
| `.browse-sort-bar` chrome | ≥1024 有 `background: var(--color-surface)` / `border: 1px solid var(--color-border-light)` / `border-radius: var(--radius-md)` + `padding: var(--space-md) var(--space-lg-xl)` + `margin-bottom` | 三件套全拆（仅留 `padding-left: var(--space-sm)` 与基础 `padding-bottom`） |

### 实现要点

- **栅格 areas 改首行双列**：`'tabs tabs'` → `'tabs head'`。`head` 单元格承载结果区头部——
  智能检索 = `.browse-sort-bar`、直链搜索 = `.browse-source-status-row`，二者互斥，共用 `grid-area: head`。
- **结果卡 `display: contents`**：`.browse-card--results` 在该档位已无 chrome，解体后其子项
  （结果区头部 / `.browse-results-body`）直接落进页面 grid，才能把头部提到 row1。
  解体丢失的 `--space-sm` 卡片内缩转移到 `.browse-results-body { padding: var(--space-sm) }`，
  头部用 `padding-left: var(--space-sm)` 对齐结果栅格左边缘（留白与改动前一致）。
- **为什么没动 JSX**：把 `.browse-sort-bar` 挪进 `.browse-search-tabs` 会影响 TV / 移动端
  （TV 非 isPhone，胶囊 `flex:1` 与排序栏同行会被挤压）；`display: contents` 方案对
  TV / App / 移动零影响（规则全部 `html:not([data-device="app"]):not([data-device="tv"])` + `:not(--mobile/--tv)` 前缀）。
- **胶囊宽度下限风险**：`--rail-w` = clamp(148px, 10vw, 248px)，1440 → 148px。
  两枚按钮（图标 + 「智能检索」/「直链搜索」4 CJK）按原 `--space-lg`（≈16.5px@1440）左右内距
  需 ≈180px，必然溢出（胶囊 `overflow: hidden` 会裁字）→ 收到 `--space-2xs` 并居中。

### 追加（23:55 用户反馈）

- 左栏 filter-bar chip 的 hover / 选中背景框太高 → 上下内边距由
  `calc(var(--space-sm) - var(--space-2xs))`（≈5.9px@1440，chip 高 ≈26px）
  收到 `var(--space-xs)`（≈3.5-4.5px，chip 高 ≈22px）。仅 Browse.css ≥1024 的
  `.filter-bar .filter-bar__chip` 一处，hover / 选中态背景框随 chip 同步变矮。
- 验证：vite build EXIT=0（20.6s）、stylelint 无新增（仍 16 条全为 HEAD 既有）。

### 待用户确认

1. 胶囊按钮内距收到 `--space-2xs` 后的观感（1440 档最紧）。
2. 左栏豁免采用「整页不动画」口径（与收藏/历史页一致），是否接受 Browse / IPTV 整页无入场动画。

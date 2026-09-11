---
date: 2026-09-12
module: pages/Browse
type: ui
build: pass
files:
  - src/pages/Browse/Browse.css
demo: 无（纯 CSS token 调整，未起 dev server）
---

# Browse：最热/最新/最高分 选中态圆角

## 用户指令（2026-09-12 02:55）

> 最热、最新、最高分选中态页添加圆角

## 旧 ↔ 新对照

| 项 | 旧 | 新 |
| --- | --- | --- |
| `.browse-sort-bar__tab` 圆角 | `border-radius: var(--radius-sm)`（1440 ≈ 4.3px） | `border-radius: var(--radius-md)`（1440 ≈ 8.7px，随视口 6→10） |
| 选中态 | 继承 base 的 `--radius-sm`，在 32px 高实心 primary 底上几乎看不出圆角 | 继承 `--radius-md`，与左栏 `.filter-bar__chip` 选中态同款圆角 |

## 关键实现说明

- 桌面端（≥1024，非 TV/App）「最热/最新/最高分」唯一渲染位置 = `.browse-sort-bar__tabs`
  （`Browse/index.tsx:530`）。左栏 `FilterBar` 传 `hideFooter`，其 `.filter-bar__sort-btn`
  （下划线式选中态，`FilterBar.css:205`）不渲染，故无需同步。
- 移动端抽屉内的同名按钮（`Drawer.css:323`）已是 `--radius-full`，不动。
- 未按 `--radius-full` 走胶囊：用户用词是「圆角」而非「胶囊」，且同排的
  `.browse-sort-bar__type`（类型分段控件）才是胶囊语义，排序项保持矩形圆角可区分层级。

## 验证

- `tsc -b` EXIT=0；`vite build` EXIT=0（2294 modules）。
- stylelint（Browse.css）15 条 = HEAD 基线，零净新增。
- 未起 dev server、未 E2E、未 commit。

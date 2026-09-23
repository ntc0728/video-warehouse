---
date: 2026-09-23
module: Browse / FilterBar
type: UI 提案 + 左栏修复
build: ✅ npm run build + lint:all 全绿
tests: 未跑全量 E2E（未放行）；待拍板方案落地后补受影响 spec
files:
  - changelogs/demos/demo-browse-topbar-2026-09-23.html
  - src/pages/Browse/Browse.css
  - src/components/FilterBar/FilterBar.tsx
  - src/pages/Browse/index.tsx
demo: changelogs/demos/demo-browse-topbar-2026-09-23.html
---

# Browse 顶栏四方案 Demo + 左栏去滚动条 + 分类行壳

## 范围（用户拍板）

- 顶栏：检查元素、对齐/风格不协调、**按钮高度不要硬统一**（各自 padding/margin 推导）→ 先出 Demo 待选。
- 左栏：**不允许滚动条**，参考收藏/历史页 RecordShell rail。
- 首进左栏分类「过一会才显示」→ 分类行先渲染壳。

## 顶栏元素清单（≥1024 智能检索首行）

| 左 tabs | 右 head |
|---|---|
| 模式胶囊：智能检索（图标+文字）｜直链搜索 | 类型 7 档分段 · 1px 分隔线 · 排序 3 档 · 共 N 条 |

直链模式右列 = 结果数 + 逐源 badge 行（与排序栏互斥）。

## 旧逻辑 → 新逻辑

1. **顶栏高度硬统一（问题基线，未改真代码）**
   - 旧：`.browse-sort-bar__type/__tab { height:32px }` + 两格 `align-self:stretch` 假等高（Browse.css:164/203/528–567）；模式胶囊/计数各自 pad 推导，三套语言不协调。
   - 新（待拍板）：Demo 四案——0 现状 / **A 光学居中（推荐）** / B 分组松弛+描边 stab / C 极简下划线。
2. **左栏滚动条**
   - 旧：`.browse-page .filter-bar` sticky + `max-height:calc(100dvh-header)` + `overflow-y:auto`（Browse.css:688–689）→ 内容超高即栏内滚动条。
   - 新：去 max-height/overflow-y，改 `overflow:visible`（对齐 RecordShell.css:795 rail）。
3. **首进分类行空洞**
   - 旧：`visibleGenres.length>0` 才渲染分类行（FilterBar.tsx:163）→ genres 接口返回前整行消失。
   - 新：`showGenreRowShell`（Browse 智能模式传入）先渲 label+全部 行壳，chips 落地后补上。

## 待用户拍板

- 顶栏选 A / B / C（或改）；拍板后再改 Browse.css 真代码并补 E2E。

## 验证

- demo：浏览器直开 `changelogs/demos/demo-browse-topbar-2026-09-23.html`（顶栏可切 智能/直链）。
- `npm run build` + `npm run lint:all` 全绿。
- 全量 E2E 未跑（未放行）；顶栏方案拍板落地后再补受影响 spec。

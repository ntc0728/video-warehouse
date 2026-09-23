---
date: 2026-09-23
module: Browse / FilterBar
type: UI 整改 + 提案 Demo
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/browse.spec.ts（skeleton.spec.ts 含 sort-bar 元素计数，可一并）
files:
  - changelogs/demos/demo-browse-topbar-2026-09-23.html
  - src/pages/Browse/Browse.css
  - src/components/FilterBar/FilterBar.tsx
  - src/pages/Browse/index.tsx
demo: changelogs/demos/demo-browse-topbar-2026-09-23.html
---

# Browse 顶栏方案 A 落地 + 左栏去滚动条 + 分类行壳

## 范围（用户拍板）

- 顶栏：检查元素、对齐/风格不协调、**按钮高度不要硬统一**（各自 padding/margin 推导）→ 先出 Demo 待选。
- 左栏：**不允许滚动条**，参考收藏/历史页 RecordShell rail。
- 首进左栏分类「过一会才显示」→ 分类行先渲染壳。
- **拍板：采用方案 A**，但**排序内 tab 样式改为与 `.browse-sort-bar__types` 一致**，**总数仍右对齐**；更新 Demo。

## 顶栏元素清单（≥1024 智能检索首行）

| 左 tabs | 右 head |
|---|---|
| 模式胶囊：智能检索（图标+文字）｜直链搜索 | 类型 7 档分段 · 1px 分隔线 · 排序 3 档 · 共 N 条 |

直链模式右列 = 结果数 + 逐源 badge 行（与排序栏互斥）。

## 旧逻辑 → 新逻辑

1. **顶栏高度硬统一（方案 A 落地）**
   - 旧：`.browse-sort-bar__type/__tab { height:32px }` + 两格 `align-self:stretch` 假等高（Browse.css）；模式胶囊/计数各自 pad 推导，三套视觉语言不协调；排序选中态 primary 实心底，与 types 的 surface+柔影分段语言分叉。
   - 新（方案 A + 拍板修订）：
     - type/tab 去 `height:32`，高度由 `padding: --space-xs --space-md` 推导；
     - `.browse-search-tabs` / `.browse-sort-bar` 去 stretch，改 `align-self:start` 顶对齐，允许不等高；sort-bar 行内 `align-items:center` 光学居中；
     - **排序 `__tabs/__tab` 改与 `__types` 同款分段**：灰底 track（`--color-hover-bg` + `--radius-full` + gap/pad 2xs）+ 选中 `--color-surface` + `--shadow-soft`；
     - 总数 `__count` 保持 `margin-left:auto` **右对齐**，不参与等高。
2. **左栏滚动条**
   - 旧：`.browse-page .filter-bar` sticky + `max-height:calc(100dvh-header)` + `overflow-y:auto` → 内容超高即栏内滚动条。
   - 新：去 max-height/overflow-y，改 `overflow:visible`（对齐 RecordShell.css:795 rail）。
3. **首进分类行空洞**
   - 旧：`visibleGenres.length>0` 才渲染分类行 → genres 接口返回前整行消失。
   - 新：`showGenreRowShell`（Browse 智能模式传入）先渲 label+全部 行壳，chips 落地后补上。

## 待用户拍板

- ~~顶栏选 A / B / C~~ → **已拍板 A（+排序 tab 改 types 同款、总数右对齐）**。

## 验证

- demo：浏览器直开 `changelogs/demos/demo-browse-topbar-2026-09-23.html`（顶栏可切 智能/直链；A 标已落地）。
- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/browse.spec.ts scripts/skeleton.spec.ts --budget 120 --retries 0`。

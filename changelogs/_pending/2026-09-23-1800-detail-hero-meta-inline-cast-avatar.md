---
date: 2026-09-23
module: Detail
type: UI 整改
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/detail.spec.ts（skeleton.spec.ts 含 info-card 计数 8，可一并）
files:
  - src/pages/Detail/index.tsx
  - src/pages/Detail/Detail.css
  - src/assets/styles/variables.css
  - changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
  - changelogs/README.md
demo: changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
---

# Detail 右栏基础信息同行布局 + 国家/发行末尾全宽 + 演员头像调小

## 范围（用户 2026-09-23）

1. banner 右侧「基础信息」：发行年份/状态/时长/语言/TMDB评分/导演/预算/票房 —— **数据在标题右侧同行**；国家、发行**各独占一行放末尾**且数据也在标题右侧；数据过多可换行，**第一行必须与标题对齐**。
2. 演员模块头像**稍微调小**，排列布局不变。

## 旧逻辑 → 新逻辑

1. **右栏 KV 分行**
   - 旧：`Detail.css` hero-side 覆写 `.detail-info-card strong { flex-basis:100% }` + `padding-left` 强制「标签一行、值一行」；国家是 grid 第 7 卡夹在中间。
   - 新：去 `flex-basis:100%`，`strong { flex:1 1 0; min-width:0; overflow-wrap:anywhere }` 吃满剩余同行显示；卡与全宽行均 `align-items:flex-start`（图标/标签微 `margin-top`），值换行时**首行贴标签顶线**。
2. **国家 / 发行末尾全宽**
   - 旧：国家在 `.detail-info-grid` 内（index.tsx:767），仅发行是 `.detail-info-row`。
   - 新：国家移出 grid，grid 后依次渲染 `.detail-info-row`「国家」「发行」；`detail-info-row` 基类改 `align-items:flex-start` + `strong { flex:1 1 0; min-width:0; overflow-wrap:anywhere }`。
   - 窄屏 info-tab 与宽屏 hero-side 共用同一份 `infoCoreNode`，结构变更双端同步；hero-side 定高 + `overflow-y:auto` 兜底不撑破。
   - 骨架侧：原 8 卡 + 2 side-line 恰好对应「电影 8 字段 grid + 国家行 + 发发行行」，`skeleton.spec` 断言 `info-card=8` 不受影响。
3. **演员头像 ×0.875**
   - 旧：`--layout-cast-avatar` 基类 64→80 / 桌面 80→88 / TV 64px。
   - 新：56→70 / 70→77 / 56px（≈ −12.5%）；`.detail-cast-row` `minmax(6rem,1fr)` 不动（排列布局不变）；折叠高度 JS ResizeObserver 实测自适应；骨架同 token 自动同步。

## 验证

- demo：浏览器直开 `changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html`（旧/新/并排 + 长数据开关）。
- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/detail.spec.ts scripts/skeleton.spec.ts --budget 120 --retries 0`。

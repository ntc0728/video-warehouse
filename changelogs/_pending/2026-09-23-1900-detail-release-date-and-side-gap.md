---
date: 2026-09-23
module: Detail
type: UI 整改（三轮）
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/detail.spec.ts + scripts/skeleton.spec.ts（结构断言未变，间距/标签为视觉项）
files:
  - src/pages/Detail/index.tsx
  - src/pages/Detail/Detail.css
  - src/pages/Detail/DetailSkeleton.tsx
  - src/pages/Detail/DetailSkeleton.css
  - changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
  - changelogs/README.md
demo: changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
---

# Detail 基础信息三轮：行距 gap 同源（grid 内外一致）+ 发行时间到日

## 范围（用户 2026-09-23 三轮）

1. 发行年份与语言的 gap 与下方不一致 → 统一。
2. 发行精确到年月日，标签改「发行时间」。
3. 相关骨架同步。

## 旧逻辑 → 新逻辑

1. **行距 grid 内外不一致（根因）**
   - 旧：`.detail-hero-side` flex `gap: --space-md` 与子元素纵向 margin（title mb sm / genres mb sm / info-row mt sm）**叠加** → grid 内部 row-gap = sm，grid 下全宽行 = md + sm，视觉上「发行年份/语言」行距与下方评分/国家/发行行距不等。
   - 新：hero-side `gap` 收为 `--space-sm`（与 grid row-gap 同值）；右栏内 title/genres/info-row 纵向 margin **一律清零**，间距只由父级 flex gap 提供 → grid 内外同一真源。
2. **发行年份 → 发行时间（精确到日）**
   - 旧：`year` 只取 `getFullYear()`，标签「发行年份」，值如 `2024`。
   - 新：新增 `releaseDateStr`（TMDB `release_date` / `first_air_date` 原文 `YYYY-MM-DD`；非法/空日期不显示），标签「发行时间」；hero meta 行仍用短 `year`（紧凑 meta 不变）。
3. **骨架同步**
   - `INFO_CARD_COUNT` 注释「年份」→「发行时间」（数量仍 7，结构未变）。
   - `DetailSkeleton.css` info-grid `gap` 改为 `sm md`（与真实 hero-side grid 同值）；side-line 注释标明间距由父级 gap 提供、不叠 margin。

## 验证

- demo 同文件更新（发行时间到日 + 行距只由 gap 提供 + 对照块重写）。
- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/detail.spec.ts scripts/skeleton.spec.ts --budget 120 --retries 0`。

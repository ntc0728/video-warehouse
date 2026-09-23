---
date: 2026-09-23
module: Detail
type: UI 整改（续）
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/detail.spec.ts + scripts/skeleton.spec.ts（info-card 8→7、side-line 2→3，已改断言；改 spec 后已跑 npm run test:count）
files:
  - src/pages/Detail/index.tsx
  - src/pages/Detail/Detail.css
  - src/pages/Detail/DetailSkeleton.tsx
  - src/pages/Player/index.tsx
  - scripts/skeleton.spec.ts
  - changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
  - changelogs/README.md
demo: changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
---

# Detail 基础信息二轮：评分全宽 + 半宽自动 span + 行距同源 + 时长 0 不显示

## 范围（用户 2026-09-23 二轮）

1. TMDB 评分也独占一行。
2. 导演/语言等数据量大时：半宽放不下 → 自动独占整行。
3. 每个标签上下间距不一致 → 统一。
4. 时长为 0 时不显示。

## 旧逻辑 → 新逻辑

1. **评分全宽**
   - 旧：评分是 grid 内 `.detail-info-card--rating` 卡。
   - 新：移出 grid，grid 后第一条 `.detail-info-row.detail-info-card--rating`；补 `.detail-info-row.detail-info-card--rating svg` 压过 `.detail-info-row svg` 主色（同特异度后写覆盖）。
2. **半宽放不下 → `--span`**
   - 旧：导演/语言在半列内硬换行，首行对齐但占两行、破坏行节奏。
   - 新：`infoGridRef` + ResizeObserver，用 off-screen nowrap probe 量 strong 自然宽；可用宽 = **半列基准宽**（恒定，非当前格宽，防 span 后判据漂移来回抖）− icon − label − gap×2 − margin；`needed > avail+1` → `grid-column: 1/-1`。单列断点清 span。fonts.ready 再测一次。只在 class 真变化时写 DOM。
3. **行距同源**
   - 旧：卡 `padding: 2xs` + hero grid `row-gap: 2xs` + 全宽行 `margin-top: sm` 三套 → 标签上下间距不一致。
   - 新：卡去纵向 padding；行距单一真源 `--space-sm` = grid row-gap = 全宽行 margin-top；hero-side grid `gap: sm md`（行距 sm、列距 md）。
4. **骨架同步**
   - grid 卡 8→7（评分出 grid），side-line 2→3（评分/国家/发行）；`INFO_ROW_COUNT=3`；`skeleton.spec` 断言同步 7+3。
5. **时长为 0 不显示**（用户追加）
   - 旧：`{runtime && …}` —— React 里 `0 &&` 会渲染出字面 `0`（info 卡 / hero meta / Player meta 三处）。
   - 新：`(runtime ?? 0) > 0 &&` 才渲染；undefined 与 0 均不显示「0 分钟」。

## 验证

- demo 同文件更新（长数据开关看导演/语言自动 span + 间距均匀）。
- `npm run build` + `npm run lint:all` 全绿；改 skeleton.spec 后 `npm run test:count` 校验。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/detail.spec.ts scripts/skeleton.spec.ts --budget 120 --retries 0`。

---
date: 2026-09-23
module: Detail
type: UI 调整（基础信息 gap）
build: ✅ npm run build + lint:all 全绿
tests: 受影响 spec：scripts/detail.spec.ts + scripts/skeleton.spec.ts
files:
  - src/pages/Detail/Detail.css
  - src/pages/Detail/DetailSkeleton.css
  - changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
demo: changelogs/demos/demo-detail-hero-meta-inline-2026-09-23.html
---

# Detail 基础信息：标题卡之间 gap 改为 var(--space-md)

## 范围（用户 2026-09-23）

将基础信息内标题（字段卡）之间 gap 值改为 `var(--space-md)`。

## 旧逻辑 → 新逻辑

1. **标题卡之间间距**
   - 旧：`.detail-info-grid` `gap: var(--space-sm)`；hero-side flex gap 同为 sm；全宽行 `margin-top: sm`。
   - 新：三处统一为 `var(--space-md)`——grid `gap`、hero-side flex `gap`、全宽行 `margin-top`（窄屏/非 hero-side 上下文）；hero-side 内 info-row 仍 `margin-top: 0` 由父级 gap 提供。行距单一真源保持，仅真源值 sm→md。
2. **骨架同步**
   - `DetailSkeleton.css` info-grid `gap` 改为 `var(--space-md)`；side-line 注释同步为 md。
3. **Demo 同步**
   - `demo-detail-hero-meta-inline-2026-09-23.html`：hero-side gap 8→12px、info-grid / NEW gap 同步 12px、对照块文案 `--space-sm`→`--space-md`。

## 验证

- `npm run build` + `npm run lint:all` 全绿。
- 受影响 spec：`node scripts/e2e-skeleton.mjs scripts/detail.spec.ts scripts/skeleton.spec.ts --budget 120 --retries 0`。

---
date: 2026-09-24
module: CategoryQuickAccess
type: 样式/交互（面板锚定 popover）
build: ✅ npm run build 通过
files:
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
demo: 无
---

# CQA hover 面板改锚定 popover

## 旧逻辑 → 新逻辑

- **旧**：`.cqa-overlay` `fixed` 铺满 `left/right: var(--page-pad-x)`（跨页 mega-menu 全宽条），仅下圆角。
- **新**：面板 left 锚定触发 chip 左缘（`--cqa-anchor-left`，由 Nav open/scheduleOpen 时 `getBoundingClientRect().left` 写入 store → 内联 style）；宽度 `min(1000px, 100vw-2*pad, content-max)`；`left` clamp 在 `[pad, 100vw-pad-w]` 防溢出；四角 `radius-lg`；删 `right` / `margin-inline` / `border-bottom`。

## 不改

3×3 grid、hover 开合延迟（200/120ms）、子分类/分页逻辑。

## 验证

- `npm run build` ✅
- 预期 E2E：`home.spec` 对 `.cqa-overlay` 仅 count/visible 断言，不受宽度/锚定影响

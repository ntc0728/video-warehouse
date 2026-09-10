---
date: 2026-09-10 21:35
module: detail
type: fix
build: npx tsc -b 通过 · stylelint 通过（余 2 条 px 白名单基线）
files:
  - src/components/StillsLightbox/StillsLightbox.tsx
  - src/components/StillsLightbox/StillsLightbox.css
demo: 无（Playwright 实测几何：zoom y 813–840 居中于 720，thumbs y 848–900）
---

## 走读反馈 · 剧照灯箱缩放控件改到主图下方

### 旧 → 新

- **旧**：`.stills-lightbox__zoom` 是 `position: absolute; right/bottom: var(--space-md)` 的
  **视口右下角浮层**，与图片没有任何几何关系；底部同一条带上还压着
  `.stills-lightbox__thumbs`（`position: absolute; bottom: var(--space-md); left: 50%; transform: translateX(-50%)`）。
  `<768px` 下缩略图条宽 90vw、缩放条贴右，两者底部带**实际重叠**（移动副本里没有 `__zoom` 规则）。
- **新**：灯箱内部改为**三行流式布局** —— 主图区（`flex: 1 1 auto; min-height: 0`，吃掉剩余高度）
  → 缩放条 → 缩略图条，后两行 `position: relative; align-self: center`（保留 relative + z-index 20
  以便仍绘制在 `__scroll`（z-index 5）之上）。JSX 里把缩放块挪到主图区之后。
  - 缩放条落在**当前显示图片的正下方**且水平居中于图片；
  - 主图区下内边距从 `clamp(64px,48px+2vw,96px)` 收到 `0`，行距由 `.stills-lightbox` 的
    `gap: var(--space-sm)` 承担 → 主图区变矮、图片整体上移（1440×900 下 16:9 剧照底边约上移 18px、
    中心约上移 9px，满足「图片稍微上移一点」）；
  - 顺带修掉 `<768px` 下缩放条与缩略图条底部带重叠的老问题。

### 连带清理

`.stills-lightbox__thumbs` 改为流内后，移动副本里的 `bottom: var(--space-sm)`
（`@media (width < 768px)` 与 `html[data-device="app"]` 两处）不再是 no-op 而是会把缩略图条
**向上位移 6px**，已一并删除。

### 覆盖情况

缩放控件此前零自动化覆盖，本次用一次性 Playwright 脚本实测几何（已删除，未入库）：
`.detail-stills-item` → 灯箱 → `__zoom` 与 `__thumbs` 均 `position: relative`，
`__zoom` 水平中心 = 720（视口中心），`__zoom` 在 `__thumbs` 之上、两者均在 `__scroll` 之下。
`scripts/detail.spec.ts` 的 DETAIL-048 只覆盖剧照网格与截断，未打开灯箱——该缺口保留。

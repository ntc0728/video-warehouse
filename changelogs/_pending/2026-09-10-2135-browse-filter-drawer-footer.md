---
date: 2026-09-10 21:35
module: browse
type: fix
build: npm run build 通过 · stylelint 与 HEAD 基线 24/24 持平（零新增）· e2e browse/iptv/detail 19/19
files:
  - src/components/ui/Drawer.tsx
  - src/components/ui/Drawer.css
  - src/pages/Browse/BrowseMobileBar.tsx
  - src/pages/Browse/BrowseMobileBar.css
demo: 无（e2e BROWSE-070/071/077/079 覆盖开关面板与「完成」回写）
---

## 走读反馈 · 移动端 Browse 筛选面板（底部按钮 / 遮挡 / 滑动）

### 1. 「重置 / 完成」没有真正固定 —— 三处叠加

- **① sticky 语义用错**：`.bmb-foot` 写的是 `position: sticky; bottom: 0`，且作为
  `.drawer-body`（`overflow-y: auto` 的**滚动容器**）的最后一个子元素。
  - 内容不足一屏（TMDB genres 未返回时只剩 4 行）→ 没有可粘空间，sticky 完全不生效，
    按钮停在最后一组 chip 后面、面板下半截空白；
  - 滚到底时 `.drawer-body` 自己的 `padding-bottom: var(--space-2xl)`（24px）会把按钮顶开。
- **② 被「返回顶部」圆钮盖住并抢点击**：`.drawer-content` 硬编码 `z-index: 61`，
  而 `BackToTopButton` 是 `position: fixed; z-index: 90` 且 portal 到 `body` ——
  画在面板之上，坐标正好落在「完成」按钮右半边（面板打开前已滚动 >280px 即可复现）。
- **③ 视口高度口径**：面板是 `position: fixed; inset: 0`，没有 `env(safe-area-inset-bottom)`，
  移动端底部安全区未避让。

**改法（结构级）**：
- `Drawer` 新增 `footer?: React.ReactNode` 插槽，渲染为 `.drawer-body` 的**兄弟**节点
  （`.drawer-content` 本就是 `flex-direction: column`），按钮从此不在滚动容器里；
- `.bmb-foot` 去掉 `position: sticky; bottom: 0`；
- `.drawer-body` 补 `min-height: 0`（flex 项默认 `min-height: auto` 会被内容撑开，
  滚动容器就不是「剩余高度」）与 `overscroll-behavior: contain; touch-action: pan-y`；
- `.drawer-footer` 补 `padding-bottom: env(safe-area-inset-bottom)`；
- `.drawer-content--fullscreen .drawer-body` 的 `padding-bottom` 由 `--space-2xl` 收到 `--space-md`
  （原先那 24px 是给 sticky 按钮留位的，现在只会变成死空白）；
- 层级改走全局 token `var(--z-modal-overlay)` / `var(--z-modal)`（1000 / 1001），
  不再硬编码 60/61。

### 2. 面板滑动卡顿

- `.drawer-body` 原有缺失已按上条补齐（`overscroll-behavior: contain` + `touch-action: pan-y`，
  与 `BottomSheet` / `PlayerMobileLab` 的容器口径一致），惯性不再传导给 body。
- 新增 `body:has(.drawer-content) .back-to-top-button { display: none }`：
  该圆钮是 `position: fixed` + `backdrop-filter: blur(8px) saturate(180%)`，
  固定在视口右下、不随面板滚动 → 每帧都要对背后变化的内容重新做模糊采样
  （移动端 GPU 上最贵的常见项之一），而面板打开期间它被不透明面板完全盖住，看不到也点不到。
- **遗留未改**：Radix Dialog 打开期间 `react-remove-scroll` 会在 `document` 上挂
  **非 passive** 的 `touchmove/touchstart/wheel` 监听，每次 touchmove 还会走一遍祖先链判断，
  这是面板内滑动最系统性的卡顿源，属依赖库行为，未擅自改动。

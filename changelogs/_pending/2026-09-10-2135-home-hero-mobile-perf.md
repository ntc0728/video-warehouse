---
date: 2026-09-10 21:35
module: home
type: perf
build: npm run build 通过 · stylelint 与 HEAD 基线 29/29 持平（零新增）· e2e --workers=2 全量 122 passed / 1 skipped
files:
  - src/components/HeroBanner/HeroBanner.tsx
  - src/components/HeroBanner/HeroBanner.css
demo: 无（真机手感项，桌面 DevTools 移动仿真可观察 requestAnimationFrame 合并频次）
---

## 走读反馈 · 移动端首页 banner 滑动卡顿

先排除误判：`touchmove` 已是 passive（window 级显式 `{ passive: true }`，元素级 `touch-action: pan-y`）、
无每帧强制同步布局（`offsetWidth` 只在拖拽开始时读一次缓存进 `bannerWidthRef`）、无 `backdrop-filter`、
无 `left/top/width` 动画。以下是实测确认的成因与处置：

### 1. 每个 touchmove 触发一次全量重渲染（主因）

`handleDragMove` 直接 `setDragOffset(offset)`。移动端 `touchmove` 一帧可触发多次（部分机型 >100Hz），
每次 setState 都会重跑整个 HeroBanner 组件（`renderText` ×3、缩略图窗口、内联 style 重建）。

→ 改为 **rAF 合并**：只保留本帧最后一次坐标，每帧最多一次 `setState`；
`handleDragEnd` 里 `cancelAnimationFrame` 丢弃未执行的帧（否则松手后又补一次 setDragOffset，回弹起点会抖）。

### 2. 同一张主图下载 + 解码两次

- `src` 恒 `w1280`、候选表 `['w780','w1280']` + `sizes="100vw"`：banner 实际渲染宽度 ≈ 视口宽
  （375~430px），**DPR ≥ 2.75 的手机会选到 w1280**（约 1280×720 的解码开销）；
- 而预加载 `bgPreloadSize()` 在 `<1024` 用 **w780** —— 两者不是同一张图，于是每次切换都白下一次 w780
  再下一次 w1280，两次 `decode()` 抢主线程。

→ 新增 `MOBILE_BACKDROP_SIZES = ['w500','w780']`，移动端（`<1024`，与 `bgPreloadSize` 同口径）
封顶 w780，渲染与预加载口径一致、只下载一次；2x 采样对手机屏幕足够。
`srcset` 存在时浏览器只按候选表选图（忽略 `src`），因此 `src` 保持不变也不影响选择。
交叉淡入层、track 层、分类切换滞留层（`staleSnapshot` / crossfadeSwitch 两处派生）共 5 处统一走
新的 `backdropSizes()`。

### 3. 大半径文字阴影落在被动画的文字层内

`.hero-banner__title` 的 `text-shadow` 含 `0 0 60px` 大模糊，而标题在文字 track 里渲染 3 份、
track 正在做 transform 动画 → 每帧都要重新模糊整个文本层。

→ `<768px`（含 `html[data-device="app"]` 恒移动副本）把标题阴影收成 `0 1px 6px`；
移动端标题本就压在图下缘暗部，可读性几乎无损。

### 未处置（记录）

拖拽期间 crossfade 背景层（最多 2 张）与 track（3 张）并存 → 峰值 5 张全宽大图同时驻留。
代码里有明确注释说明 crossfade 常驻是为了避免 track→crossfade 切换时 `<img>` 重挂载导致
WebView 闪白（历史修复），收益与风险不确定，本次未动。

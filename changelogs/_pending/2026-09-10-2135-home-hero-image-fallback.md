---
date: 2026-09-10 21:35
module: home
type: fix
build: npx tsc -b 通过 · stylelint 与 HEAD 基线 29/29 持平（零新增）
files:
  - src/components/HeroBanner/HeroBanner.tsx
  - src/components/HeroBanner/HeroBanner.css
  - src/components/HeroBanner/HeroBili.tsx
  - src/components/HeroBanner/HeroBili.css
demo: 无（拦截 backdrop 请求即可复现：banner 位置出现 MonitorPlay + kinoTV 兜底）
---

## 走读反馈 · 首页 Hero banner 图片加载失败未走公共兜底

### 勘察结论：不符合规范

项目公共兜底是 `LazyImage` 组件（`.lazy-image-container.error` +
`.lazy-image-fallback--brand`：lucide `MonitorPlay` + `kinoTV` 品牌字），
VideoCard / IPTVChannelCard / RecordCard / CategoryQuickAccess **与 HeroBili 右栏卡**都在用。
但 Hero 主图这条链**全程手写 `<img>` + `new Image()` 预加载**，绕过了 LazyImage：

| 路径 | 原状态 |
| --- | --- |
| Classic crossfade 层 | 有 `onError`，但只 `setBannerReady/scheduleStaleClear`（内部状态机），无任何失败 UI |
| Classic track 层 | 完全没有 `onError` |
| Classic 分类切换滞留层 | 完全没有 `onError` |
| Classic 缩略图 current img | 只有 `onLoad`，且 `switching` 只能由 `onLoad` 清除 |
| HeroBili banner img | 完全没有 `onError` |

失败时用户看到的只是 `.hero-banner__main` / `.hero-bili__banner` 的 `#0b0b0e` 深色底
（被动露底，不是规范兜底）。

### 改动

- `HeroBannerClassic` / `HeroBili` 各新增 `failedBackdrops: Set<string>` 与
  `markBackdropFailed(url)`，在 crossfade 层、track 层、滞留层、HeroBili banner 层
  的 `onError` 里登记失败的 backdrop URL。
- 当前显示项的 backdrop 命中失败集合时，渲染公共品牌兜底节点：
  `<div className="lazy-image-fallback lazy-image-fallback--brand">MonitorPlay + kinoTV</div>`，
  外层 `.hero-banner__fallback` / `.hero-bili__banner-fallback` 负责 `position:absolute; inset:0; z-index:1`。
  层叠：背景层(auto) < 兜底 / track(z-index 1) < 渐变遮罩(z-index 1, DOM 在后) < 内容叠加；
  HeroBili 侧箭头 / 圆点 z-index 2~3 仍在兜底之上，交互不受影响。
- **缩略图连带修复**：`HeroThumb` 的 `switching`（`opacity: 0` 的淡入起始态）原先只能由
  `onLoad` 清除，图片失败时该格会永久不可见且 `ready` 已置真（骨架已移除）→ 整块空洞。
  补 `onError` 清掉 `switching` 并回退 `ready=false`，保留骨架占位。

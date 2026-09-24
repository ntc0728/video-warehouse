---
date: 2026-09-24
module: SearchBox, viewport, keyboard
type: 样式/交互修复
build: ✅ npm run build 通过
files:
  - src/components/SearchBox/SearchBox.css
  - src/hooks/useVirtualKeyboardInset.ts
  - src/components/Layout/AppLayout.tsx
  - src/assets/styles/index.css
  - index.html
demo: 无
---

# 搜索框黑框 / 16px 字号 / 虚拟键盘 inset

## 旧逻辑 → 新逻辑

1. **黑框（焦点双框）**
   - 旧：全局 `:focus-visible` 2px 主色 outline 叠在 `.search-box:focus-within` 细高亮上 → 双框/黑框感。
   - 新：`SearchBox.css` 增 `:root:not([data-device="tv"]) .search-box__input:focus-visible { outline: none !important; }`；保留容器 `:focus-within` 细高亮；TV 保留全局焦点框。

2. **16px 字号**
   - 旧：`@media (width≤767px)` 与 `html[data-device="app"]` 对 `input` 强制 `font-size:16px`（防 iOS 缩放）把搜索框顶到 16。
   - 新：`.search-box__input` 在两处排除，`font-size: inherit` → 跟随 `.search-box` 的 `--text-sm`。

3. **键盘遮挡**
   - 旧：viewport 无 `interactive-widget`；底部浮层 `bottom:0` 被软键盘盖住。
   - 新：`index.html` viewport 加 `interactive-widget=resizes-content`；新 hook `useVirtualKeyboardInset` 挂 AppLayout，监听 visualViewport 写 `--kb-inset`；`.modal-content-animate` / `.bottomsheet-content-animate` 的 bottom 改读 `var(--kb-inset, 0px)`。

## 不改

`android/`（gitignored）、TabBar 自身定位（resizes-content 已让布局视口随键盘上移）。

## 验证

- `npm run build` ✅
- 预期 E2E：搜索框 focus 仍可见（容器边框变 primary）；移动端字号不再被 16px 顶大。

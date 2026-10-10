---
date: 2026-09-28 15:12
module: SearchBox
type: fix
build: pass
files:
  - src/components/SearchBox/SearchBox.css
demo: 无
---

# iOS web 点搜索框聚焦局部放大（mobile-web 豁免致字号恒 13px < 16px）

## 问题

iOS Safari（移动端 web）点击顶部搜索框，页面局部放大（viewport 被 WebKit 拉到 input 上）。

## 根因

- iOS/Android Safari 对**聚焦时字号 <16px 的 input** 自动放大视口；本仓 viewport meta 已为 WCAG 1.4.4 移除 `user-scalable=no`（勿回退），只能靠字号挡。
- `index.css` 本有全局两档防缩放：`@media (width<=767px)` 与 `html[data-device="app"]` 下 `input,textarea,select { font-size: 16px }`（特异性仅 (0,0,1)/(0,1,2)）。
- 但 `SearchBox.css` 为保 `--text-sm`(13px) 设计字号把搜索框豁免掉：base `.search-box__input { font-size: inherit }`(0,1,0) 压过全局 (0,0,1) → 搜索框恒 13px → 聚焦放大回归。原「移动端豁免」`@media` 块与 base 同值同特异性，实为死代码。

## 修法

删冗余 `@media` 豁免块，新增按 `data-device` 收窄的 16px（特异性 (0,2,1) 稳压 base）：

```diff
-@media (width <= 767px) {
-  .search-box__input {
-    font-size: inherit;
-  }
-}
+html[data-device="mobile-web"] .search-box__input {
+  font-size: 16px;
+}
 html[data-device="app"] .search-box__input {
   font-size: inherit;
 }
```

- **mobile-web**（真实手机 UA 的 web 端）→ 16px，**任意视口宽度**（含横屏 >767px，data-device 不依赖宽度）；
- **app 端保持豁免**（data-device 值互斥互不干扰，WebView 沿用既有设计决策）；
- **桌面**不命中 → 仍走 base `inherit` → `--text-sm` 设计字号不变。

## 验证

- `npm run build` 通过
- `npm run lint:all` 7 门全过（含 `sync:android-version` 修复 release-please 遗留的 1.29.0 版本漂移）
- 构建产物含 `html[data-device=mobile-web] .search-box__input{font-size:16px}`

---
date: 2026-09-30 02:05
module: 顶栏（SearchBox 焦点环回归修复 · 清除按钮占位 · 搜索框紧贴图标组）
type: fix
build: pass
files:
  - src/components/SearchBox/SearchBox.css
  - src/components/StickyHeader/StickyHeader.css
---

# 顶栏搜索框：焦点黑框回归修复 + 清除按钮不占位 + 紧贴图标组

## 需求

1. 用户报「顶部导航栏中搜索框聚焦状态怎么又出现黑色方型边框」（附截图：浅色页面上输入框被一圈 2px 黑框套住）。
2. 「搜索框内清除按钮，不显示的时候应该不占空间」。
3. 「搜索框贴着 `.sticky-header__hdr-icons`」→ 经确认选项选定「紧贴（去掉间隙）」。

## ① 焦点黑框（回归 · 根因非本组件）

**现象**：桌面非 TV 下，`.search-box__input` 聚焦时被 `outline: 2px solid var(--color-primary)` 套住；
浅色主题 `--color-primary: #000`（`variables.css:51`）→ 即用户看到的黑色直角方框。

**根因（跨会话改动引入）**：本组件早有排除规则（`SearchBox.css:139` 旧版）

```css
:root:not([data-device="tv"]) .search-box .search-box__input:focus-visible { outline: none !important; }
```

靠 **特异性 (0,5,0)** 压过全局焦点环（`index.css:619`）；旧版全局规则是
`:root:not([data-device="tv"]) :focus-visible:not(.no-interaction-visual)` = (0,4,0)。
**另一会话为「projector（投影仪）视同 TV 保留焦点框」给全局规则追加了一个 `:not([data-device="projector"])`**，
特异性被抬到 **(0,5,0)** —— 与本组件排除规则**平手**。两条都带 `!important`，平手时胜负**纯看打包产物顺序**，
而全局规则在产物中位于其后（实测 `index-C85bsGzw.css`：排除规则 idx **20144** / 全局 idx **156784**）→ 全局反超。

**修法**：本组件排除规则同步追加 `:not([data-device="projector"])`，抬到 **(0,6,0)**：

```css
:root:not([data-device="tv"]):not([data-device="projector"]) .search-box .search-box__input:focus-visible {
  outline: none !important;
}
```

同步更新注释：写明「必须**严格高于**全局规则、平手即输（全局顺序在后）」「index.css 每多挂一个 `:not()` 就追平一级，本规则须同步加一级」「只加 `!important` 无效（两边都有）」。
projector 下不适用排除（保留全局 3px 焦点框），与 index.css 新口径一致。

## ② 清除按钮不显示时不占位

**旧**：`.search-box__input { padding-right: var(--comp-thumb-size) }` 常驻（原设计为防 X 出现/消失时文字宽度抖动），
但 `.search-box__clear[data-empty='true']` 只是 `opacity:0` → 空态下这段留白纯浪费。

**新**：按 clear 的可见性切换（`:has()`，项目既有 78 处同用法，老浏览器优雅降级为常驻留白）：

```css
.search-box__input:has(+ .search-box__clear[data-empty='true']) { padding-right: 0; }
```

## ③ 搜索框紧贴图标组（用户确认「紧贴 / 去掉间隙」）

**旧**：`.sticky-header__center` 为 `justify-content: center`，子项 `.search-box-wrap` `width:100%` 受 `max-width` 封顶
→ 搜索框在剩余空间居中，与右侧图标组之间叠了三段空白：① 主轴居中两侧均分 ② center `padding-inline`(--space-xs)
③ `.sticky-header__hdr-icons` `margin-left`(--space-xs)。

**新**（仅桌面档 `≥1024` 且非 app/tv；TV 端保留原间距、token 放大另有呼吸位需求）：

```css
@media (width >= 1024px) {
  html:not([data-device="app"]):not([data-device="tv"]) .sticky-header__center { justify-content: flex-end; padding-inline-end: 0; }
  html:not([data-device="app"]):not([data-device="tv"]) .sticky-header__hdr-icons { margin-left: 0; }
}
```

`≥1024` 即 `.sticky-header__hdr-icons` 的渲染条件（`!isMobile`，TSX `StickyHeader.tsx:234`），移动端不受影响。

## 验证

- `stylelint`（SearchBox.css + StickyHeader.css）**exit 0**；`tsc -b` exit 0；`vite build --emptyOutDir false` 通过。
- 产物 `dist/assets/index-C85bsGzw.css` 逐项核对（`dist/index.html` 已指向它）：
  · 排除规则新形态 `:root:not([data-device=tv]):not([data-device=projector]) .search-box .search-box__input:focus-visible{outline:none!important}` ✓（idx 20087；全局 156784）
  · `search-box__input:has(+.search-box__clear[data-empty=true]){padding-right:0}` ✓（minifier 去空格）
  · `.sticky-header__center{justify-content:flex-end;padding-inline-end:0}` ✓
  · `.sticky-header__hdr-icons{margin-left:0}` ✓
- 测试侧无连带：`browse.spec.ts:BROWSE-012` 只对 `.search-box__clear` 做 `toBeVisible`（Playwright 视 `opacity:0` 仍为 visible，且该步为有值态），`home.spec.ts:056` 只断言桌面输入框可见；`test:count --check` ✓ 全一致，未改用例。
- **未跑 E2E、未跑截图脚本**（红线：需用户允许），视觉结论待用户目视验收。

## 维护提示

`index.css` 由另一会话在改（本轮未触碰）。全局焦点环规则每追加一个 `:not([...])` 就抬高一级，
SearchBox 的排除规则须同步加一级，否则黑框会再次回归。

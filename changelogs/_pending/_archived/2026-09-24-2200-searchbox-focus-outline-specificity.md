---
date: 2026-09-24 22:00
module: SearchBox
type: fix
build: pass
files:
  - src/components/SearchBox/SearchBox.css
demo: 无
---

# 顶栏搜索框聚焦黑框（全局 focus outline 反超排除规则）

## 问题

顶部导航栏搜索框聚焦时 input 外圈出现黑色矩形 outline（`--color-primary: #000` + `outline-offset: 2px`）。

## 根因

- 全局规则 `index.css` `:root:not([data-device="tv"]) :focus-visible:not(.no-interaction-visual)` 以 `!important` 给 2px 主色 outline。
- `SearchBox.css` 本有排除规则，但与全局同特异性 `(0,4,0)` 且同带 `!important` → 胜负只看打包后 CSS 顺序；实测构建产物里全局在后（150013 > 20271），排除被反超。

## 修法

排除选择器插入 `.search-box` 中缀抬特异性至 `(0,5)`，无论打包顺序如何稳定胜出：

```diff
-:root:not([data-device="tv"]) .search-box__input:focus-visible {
+:root:not([data-device="tv"]) .search-box .search-box__input:focus-visible {
   outline: none !important;
 }
```

## 验证

- `npm run build` 通过
- `npm run lint:all` 7 门全过
- 构建产物含新选择器 `.search-box .search-box__input:focus-visible`

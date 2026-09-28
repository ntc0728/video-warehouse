# 移动端报头重设计（用户方案）：☰+居中品牌+版次/搜索右列 / 趋势榜移动 5 条横图 / 删演示值提示

- date: 2026-09-29 03:09
- module: demos/home-style-e-typographic.html
- type: feat
- build: lint:all 7 门全绿 + smoke SMOKE OK + check-demo ALL OK + playwright 临时 spec 三宽度截图实证（1 passed / 0 pageerror，spec 跑完已删）
- files: demos/home-style-e-typographic.html (+58/−17)

## 旧 ↔ 新

1. **移动端报头（≤767，用户拍板方案）**：旧 = 桌面结构缩小（栏目 7 链接 + 功能组右浮，窄宽挤成孤行/三行）。新 = ① `☰` 菜单图标常驻左侧（`#menu-btn` 内联三横线 SVG，原项目 `sticky-header__menu-btn` 同款位置，默认 `hidden` 属性、JS 按断点解除）；② 品牌 `.mast-row` 改 grid `44px/1fr/44px` 严格居中；③ `#edition` 与 `#search-wrap` 由 `syncMobileHead()` JS 搬入新增 `#nav-aside` 右列（版次右对齐 + 搜索图标其下），搜索按钮文案换 `⌕`（桌面文案存 `searchBtnHTML` 还原）；④ 栏目链接（`.mast-nav > a`）与 `.nav-fn`（收藏/历史/设置/夜刊）JS `hidden` 隐藏——导航语义交还原项目移动 Sidebar/TabBar；⑤ `matchMedia("(max-width:767px)")` change 双向同步（缩放窗口桌面形态完整还原）。
2. **edition 单行（用户：「此时 edition 要在一行显示啊」）**：`renderMasthead` 按 `mqHead.matches` 输出——移动端 `l1 · l2` 单行（`2026 年 9 月 29 日 · 星期二 · 第 39 周 · 总第 1,204 期`），桌面保持 `<br>` 两行；`.nav-aside .edition{white-space:nowrap}` 保险；change listener 里同步 `renderMasthead()` 重渲染。
3. **今日趋势榜移动端 5 条**：`renderTrend` 顶部 `n = mqHead.matches ? 5 : 10` 截断，`#trend-sub` 文案动态 `TMDB /trending/all/day · N 条`（桌面 10 / 移动 5 自动切换）。
4. **趋势榜封面横图（用户：「采用横图，不要使用竖图」）**：`pic()` 加第 4 参 `raw`（`data-raw = raw || it.pic`，向后兼容），`renderTrend` 改 `pic(t, 342, "", t.backdrop || t.pic)`（342 = 项目横图 data-w 惯例，源 = trending 快照自带 backdrop w1280）；`.trow .th` aspect `2/3 → 16/9`；th 列宽桌面 `clamp(34,2.6vw,46) → clamp(56,4.4vw,86)`、≤767 `clamp(30,7vw,40) → clamp(64,17vw,76)`。全端生效（桌面 10 条双栏横图）。
5. **删提示文案（用户：「'热度为演示值'等提示信息删除」）**：① `01 继续观看` sub「进度为演示值」整 span 删；② `02 今日趋势榜` sub 删「· 热度为演示值」（条数改动态保留）；③ footer 删「；进度与热度为演示值」。源码头注释同步（①补移动端形态、④改「桌面 10 条·移动 5 条 + 横图」）。
6. **display:none 清单（红线 4 grep 留痕）**：本轮新增 1 条 —— `.menu-btn[hidden],.nav-aside[hidden],.nav-fn[hidden]{display:none}`（`hidden` 属性样式恢复：作者 `display:flex` 会压过 UA 的 `[hidden]`，必须显式恢复）；另有 check-demo 报告的既有 3 条（`.trow .heat`、scrollbar×2）。本轮**无**以 `display:none` 藏栏目/功能项——全部走 `hidden` 属性 + JS。
7. **smoke 配套**：fake el 加 `append/insertBefore` noop、fake win 加 `matchMedia` mock（`matches:false` 走桌面分支，`syncMobileHead` 顶层执行幂等安全）。
8. **`#mast-row` 补 id**：JS `$("mast-row")` 引用（edition 搬回桌面原位用）。

## 验证

- check-demo ALL OK（ids=35 refs=27 refs-not-in-ids=0）；smoke 全过（SMOKE OK，35 项含搜索/换一换/骨架收尾）。
- `npm run lint:all` 7 门全绿（design/css/json/version-sync/test-map/eslint/build；design 门 observe +1 为他人 src 改动非本轮）。
- 截图实证（e2e-skeleton 调试档，spec 跑完即删）：`m390-top` = ☰ 左 + 品牌居中 + 单行版次右对齐 + ⌕ 其下、栏目/功能项全隐；`m390-trend` = sub「· 5 条」+ 5 条横图；`m766-top` 同 390 形态；`m1440-trend` = 10 条双栏横图 + 热度列 + 无提示词。

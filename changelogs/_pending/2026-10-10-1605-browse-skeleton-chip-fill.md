# 2026-10-10 16:0x — Browse 骨架胶囊撑满 + 收藏页 IPTV 全对齐历史页（拍板 B）

## 需求（两轮合并）

第一轮：「browse页左栏每个栏目中胶囊占位数量要撑满容器，目前数量太少了」。
第二轮拍板：② 收藏页 IPTV = B 方案（卡片+网格全对齐历史页 RecordCard）。

## 改动

### Browse 左栏骨架胶囊撑满

- `BrowseChromeSkeleton.tsx`：
  - 基础占位数不变（6/8/8，也是 <1024 移动档最终数量 —— 移动端胶囊整行大块，必须克制）；
  - 新增 `FILL_CHIPS = 14`：每组追加 14 个 `.browse-chrome-skeleton__chip--fill`
    桌面专用撑满块（`ChipGroup` 辅助组件统一渲染）。
- `BrowseChromeSkeleton.css`：
  - `__chip--fill` 基础 `display: none`（移动端不参与布局）；≥1024 块内既有
    `.browse-chrome-skeleton__chip { display: block }`（特异性 0,2,0 > 0,1,0）自然复活；
  - `.filter-bar__row`（骨架作用域）改 `display: flex; flex-direction: column`；
  - `.filter-bar__chips-wrap / __chips-scroll` 骨架作用域 `flex: 1 1 auto;
    min-height: 0; overflow: hidden`（特异性 0,5,1 压过真实 0,3,1 的 flex:0 0 auto）
    —— 富余胶囊按视口高度被裁剪，任意大屏下三组都铺满不露底。

### 收藏页 IPTV 卡片+网格全对齐历史页（拍板 B）

- `Collections/index.tsx`：
  - 「直播」分区弃用 IPTVChannelCard，改历史页同款 `RecordCard`（kind:'iptv'：
    台标候选链 + LIVE 角标 + 频道名跑马灯 + 分组徽标 + 时间位）；
  - `buildChannelCardItem`：直链代理跳转与 History.buildIptvNav 同口径
    （`buildChannelPlayUrl(ch, proxyUrl, proxyPattern)` → `/iptv/play?url&id&name`）；
    时间位 = 最后播放时间（formatFavChannelTime，口径镜像 History.formatPlayTime；
    无播放记录显示 —）；来源位 = 频道分组；
  - 批量模式/单删沿用既有 selected/handleSingleDelete('iptv') → toggleFavorite 流程；
  - 移除 IPTVChannelCard import。
- `Collections.css`：
  - `.collection-page .iptv-channel-grid` 列数 `--iptv-cols` → `--history-cols`
    （(0,2,0) 压 index.css:934）；
  - gap 对齐 `.history-grid` 的 `--space-lg`（(0,4,1) 压 index.css:1267 的 (0,3,1)）。

## 验证

- `tsc -b` + `vite build --emptyOutDir false`：pass。
- stylelint（Collections.css / BrowseChromeSkeleton.css）：0 问题。
- eslint（两 TSX）：0 error 0 warning（修掉 1 处多余 deps）。
- 未实跑 E2E / 未 commit（等验收）。

## 同轮调研结论（未动码，待用户补充现象）

- ⑥ 收藏计数右对齐：全仓仅 Collections.css 定义 `.collection-section-head*`，
  `margin-left:auto`（:37）已进产物，title/count JSX 与样式相对 HEAD 零变化 ——
  代码侧无成因，需用户描述「标题样式受影响」的具体表现。
- ⑤ chip 分面计数：数据（statusCounts 两页均有）→ 类型 → 渲染
  （RecordShell.tsx:199）→ dist 产物（record-filter-chip__count 命中 CmsSourceBlockedModal
  chunk）逐层实证在。注意 IPTV tab 整段隐藏内联筛选（方案 C）；仅在 ≥1024 rail 生效。
- ④ 换一换骨架 vs 真实按钮逐项对齐：padding space-sm 9.5 / gap space-2xs 3（骨架 4 微差）/
  icon --icon-sm 16.9→18.2（骨架 17）/ 竖排文本 text-2xs 11px×3+0.15em ≈ 36-38（骨架 37）；
  骨架 ≈ 38×74，真实 ≈ 36×72 —— 已镜像，无进一步改动依据。

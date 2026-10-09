# 2026-10-09 15:xx — 收藏/历史左栏 chip 分面计数 + topstrip 纯公告条 + 导航字号恢复

## 需求（用户三问）

1. home-topstrip 右侧数据来源 / 是否有必要保留 / UI 调整建议 → **用户拍板 B「纯公告条」**。
2. 收藏、历史左栏 record-inline-filter 全部/已看完/未看完显示数量。
3. 顶部导航什么视口字号变小、依据 → 调研后**用户拍板恢复 --text-sm**。

## 改动

### 口径（分面计数，关键决策）

- 计数 = **去重 + 搜索过滤后、状态筛选前** 的视频项按状态计数 —— 每个 chip 显示
  「点它会得到多少条」（分面筛选标准口径）。
- **不随当前选中状态变化**：若用「筛选后」口径，未选中的 chip 会被当前筛选清零成误导性 0。
- 仅视频项：IPTV 频道无观看进度/状态概念，不参与状态筛选（沿用 2026-09-08 用户既定口径）。

### 文件

- `src/pages/History/index.tsx`：`historyVideos` memo 拆成 `historyVideosBase`（去重+搜索）
  + `statusCounts`（分面计数）+ `historyVideos`（base+状态筛选）三段，避免同一逻辑双写漂移；
  `inlineFilter.statusOptions` 加 `count: statusCounts[k]`。
- `src/pages/Collections/index.tsx`：同款拆分（`collectedVideosBase` / `statusCounts` /
  `collectedVideos`）；状态集为 all/unwatched/watching/watched；
  `_status` 类型为 optional，计数处 `?? 'unwatched'` 兜底（与 `getVideoStatus` 默认值一致）。
- `src/components/RecordShell/RecordShell.tsx`：`statusOptions` 类型加 `count?: number`；
  chip 渲染 `__count` span（count > 0 才显示，对齐 `.status-tab__count` 的 0 隐藏先例）。
- `src/components/RecordShell/RecordShell.css`：`.record-filter-chip__count`
  = 右对齐弱化数字（margin-left:auto、--text-xs、tabular-nums、tertiary 色）；
  选中态随 chip 反色（opacity .72）。移动端「更多筛选」面板（RecordFilterPanel）未加计数
  —— 用户只点名左栏 record-inline-filter，panel 的 options 未传 count。

## 验证

- `tsc -b` + `vite build --emptyOutDir false`：pass。
- stylelint（RecordShell.css）：0 问题；eslint 三文件：0 error
  （History:705 `cmsSourceGuard.requestNavigate` warning 为既有代码，非本轮引入）。
- 未 commit；等用户验收。

---

# 2026-10-09 15:4x — topstrip 纯公告条（B 案）+ 导航 1024–1280 字号恢复（用户拍板）

## ① HomeTopStrip → 纯公告条

- `src/pages/Home/HomeTopStrip.tsx` 重写：只剩「公告」标签 + 右侧
  继续观看/收藏 pill。删除「今日趋势 N 条 + InfoTip 口径 ⓘ」（ⓘ 文案仍指向
  09-29 已删除的左栏榜，失真）、「最热分类」（与分类导航重叠）、「完整热度榜」
  链接（导航已有入口）；随删 useTMDBStore / aggregateCategoryHeat / InfoTip /
  WIDE_CATEGORIES / Link / Icon / Flame / ChevronRight 引用
  （aggregateCategoryHeat / WIDE_CATEGORIES / InfoTip 在 CategoryQuickAccess
  内部仍有消费方，无新增死导出）。
- `src/pages/Home/Home.css`：删 `.home-topstrip__sep / __stat / __stat b /
  __flame / __more / __more:hover` 死规则（留一行说明注释）。
- `scripts/home.spec.ts`：071「今日趋势统计」断言删（宿主消失）；
  079「趋势口径 tooltip」部分删（宿主消失），保留面板口径 ⓘ + 副标题断言，
  就绪信号改首行 `.tmdb-movierow`（用例数不变，13 条）。

## ② StickyHeader 1024–1280 导航字号恢复

- `src/components/StickyHeader/StickyHeader.css`：删 1024–1280 段
  `.sticky-header__nav-label { font-size: var(--text-xs); letter-spacing }` 规则
  —— 字号降档是 2026-09-10「去图标保搜索框」收紧方案的一环，09-29 分类 chips
  移出顶栏后空间宽裕、前提失效（用户拍板恢复）。图标隐藏 / padding 收紧保留。

## 验证

- tsc -b + vite build pass；stylelint（Home.css / StickyHeader.css / RecordShell.css）0；
- `test-count-report.mjs --write` ✓ + `--check` 五项全过；`playwright --list`
  home.spec 13 条解析 ✓。未实跑 E2E、未 commit（等验收）。

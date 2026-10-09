# 2026-10-09 17:45 — Browse 骨架居中真根因 + 公告位改热度 Top20 轮播

## ① Browse 左栏骨架「2 列贴死 / 标签居中」真根因（用户截图实锤，1440 dev）
- 截图特征：分类标签左对齐、**地区/年份标签水平居中**、胶囊顶满格子互相贴死。
- 根因：`FilterBar.css:20` 基础 `.filter-bar__row { display:flex; align-items:center }`（横向布局用）。
  骨架 ≥1024 段把行改 `flex-direction:column` 却没重置 align-items →
  标签居中 + chips 容器收缩 fit-content → 网格列宽收缩到胶囊宽 → 贴死。
  分类行用 `--wrap` 变体（align-items:flex-start）幸存 —— 与截图完全吻合。
- 修复：BrowseChromeSkeleton.css 行覆盖补 `align-items: stretch`（一行，带注释防回归）。
- 教训：骨架只看 Browse.css 的桌面覆盖不够，FilterBar.css 基础规则同样作用于同类名。

## ② 公告位 = 热度 Top20 轮播（用户新需求，取代当日早先「数据源状态」方案）
- `HomeTopStrip.tsx` 重写：props 增 `trending: TMDBVideoItem[]`（Home/index.tsx 传入）；
  popularity 降序取前 20；`useState` index + 5s setInterval 轮换（数据变化归零重建）；
  渲染 20 条纵向 track，`translateY(-i*100%)` + `transition: transform var(--dur-base)` = 上下切换。
- 单条格式：热度值（primary 色 + tabular-nums，≥100 取整/<100 留 1 位）+ 标题（加粗省略）+
  年份 + 类型（电影/剧集，按 mediaType）+ 评分（voteAverage toFixed(1) 分）。
- 移除同日早先加的「数据源 N 个已启用」（useSourceManagerStore 引用一并删除）；
  Home.css 删 `__source` 样式、增 `__rotator/__rotator-track/__rotator-item/__heat/__heat-title`。
- trending 为空时轮播位不渲染，右侧 继续观看/收藏 pill 不变。

## 验证
- stylelint（Home.css + BrowseChromeSkeleton.css）✓（修 2 处 properties-order）
- tsc -b ✓ / vite build ✓（10s）
- 产物断言：新 Browse chunk `index-BLVuESc6.css` 含 `align-items:stretch`；
  `HomeRoute-k2Zw4YNP.js` 含「热度 」；`HomeRoute-DH-Lf-gL.css` 含 rotator 样式。
- 未 commit / 未跑 E2E（等用户验收）。

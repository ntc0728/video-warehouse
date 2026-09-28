---
date: 2026-09-28 23:22
module: demos
type: feat
build: pass
files:
  - demos/home-style-e-typographic.html
demo: demos/home-style-e-typographic.html
---

# Demo E（报刊排版式）融合现有首页全部独有元素

## 问题

`demos/home-style-e-typographic.html` 原是独立风格稿：只有 报头/头条/继续观看/分类索引/趋势表/推荐 tabs 六块，与真实首页（`src/pages/Home/index.tsx`）的元素清单差距大——缺 HomeTopStrip 公告带、HeroBili 轮播与右卡、rail 今日趋势 TOP20 的海报形态、**7 行横滚主体**、FAB、主题切换；数据层还是 demo 自写的 fetch（直连 `<img>` 60+ 并发会触发 `_data.js` 注释里记录的图床挂起根因）。

## 旧逻辑 ↔ 新逻辑

| 首页元素（源码） | 旧 demo | 新融合形态 |
| --- | --- | --- |
| StickyHeader 顶栏（分类导航 + IPTV/收藏/历史/设置 + 搜索 + 主题） | 仅 首页/剧集/…/IPTV + ⌘K | mast-nav 左分类导航 + 右功能组（数据徽章/收藏/历史/设置/**夜刊切换**/搜索） |
| HomeTopStrip 公告带（`HomeTopStrip.tsx`） | 无 | `.topstrip`：公告 · 今日趋势 N ⓘ · 🔥最热分类 · 继续观看/收藏 pill · 完整热度榜 ›（锚到 03 区） |
| HeroBili banner 轮播（`HeroBili.tsx`） | 单图静态头条 | 6 池 crossfade 轮播：5s 自动（悬停/隐藏暂停）+ 左右箭头 + 圆点 + 双 CTA，文案随图切 |
| HeroSideCard 右卡 + 换一换 | 无（仅 3 条文字侧注） | `.hl-side` 图片索引条：16:9 × 6 + 收藏心（localStorage）+ 换一换（0.6s 动画锁） |
| rail 今日趋势 TOP20（`CategoryHeatRow variant="rail"`） | 趋势表 10 行纯文字 | 03 本周新声升级 TOP20：+缩略海报列，≥1440 报刊双栏（1–10 左 / 11–20 右，grid-auto-flow:column） |
| 7 行横滚（`index.tsx` renderHomeRows 同序同标题） | **无** | 04–10 七行：分区编号 + 英文小标 + 横滚 + 分页箭头（端点禁用态），行数据来自 `_data.js` rows |
| 继续观看行 / 分类快捷入口 | 已有 | 保留（01 / 02 编号），分类计数改接 `_data.js` 真实 total |
| BackToTop/Refresh FAB（`BackToTopButton.tsx`） | 无 | 右下 `.fab` 回顶 + 刷新（↻ 重跑 boot），滚动中淡出、停 800ms 淡入（首页同口径） |
| 数据层 | demo 自写 fetch + 直连 img | 切 `demos/_data.js`：`kinoLoad`（7 行组装 + 离线兜底）+ `kinoBindPics`（IO 懒渲染 + weserv 缩图 + 原图回退） |
| 主题切换（StickyHeader theme 按钮） | 无 | 夜刊/日刊双刊形态：`html[data-theme]` 覆盖 --paper/--ink/--rule/--accent/--band/--fill，localStorage 持久 |

其他：

- 收藏心与顶栏「收藏 N」pill 联动；首次打开种 2 个演示收藏（`kino-demo-fav-seeded`），保证 pill 形态可评审。
- 「今日趋势 N」为 demo 口径（CMS 近 7 日去重条数），ⓘ title 注明与首页 TMDB trending 口径差异。
- 推荐 tabs 从「全部/电影/剧集/综艺/动漫」改为「全部/电影/剧集/高分/最新」（7 行池跨行聚合，综艺/动漫无行数据避免空窗）。
- 骨架同步扩展：图片索引条 6 卡、七行 12 卡（与真实布局同尺寸 `.hrow-track` 结构）。
- 首屏预算：headline 48vh → 44vh（给图片索引条让位）；xdev TV/投影仪/超宽适配层保留。

## 验证

- 内联 script 语法检查（new Function）+ id 引用一致性：PASS
- `npm run build` 通过；`npm run lint:all` 7 门全过
- 未跑 E2E（demo HTML 不进构建产物，按分级门禁为纯脚本档）

## 预览

```
npx serve demos  （或任意静态服务）
http://localhost:<port>/home-style-e-typographic.html
http://localhost:<port>/home-style-e-typographic.html?device=tv
```

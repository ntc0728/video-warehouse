---
date: 2026-10-11 01:00
module: Home / HomeTopStrip
type: feat
build: pass
files:
  - src/pages/Home/Home.css
  - src/pages/Home/HomeTopStrip.tsx
demo: demos/home-topstrip-rotator-variants-2026-10-11.html (选型临时、已删)
---

# 2026-10-11 01:00 — 首页「今日热度趋势」topstrip 卡片化 + 简介

## 背景（用户需求 2026-10-11）

用户反馈首页 topstrip 的 `home-topstrip__rotator-item` 样式"太简陋"，经多轮
方案（微缩封面 A / 玻璃态 C）后定稿：
- **卡片化作用于「今日热度趋势」整体**，非每条轮播项各自成卡；
- 卡片同时包住右侧「继续观看 / 收藏」pill（"pill 也并入 trend 卡"）；
- 每条轮播项在评分后新增**简介**（TMDB overview）；
- 空间不足时**只压缩简介**，标题（电影/剧集名）保持完整不截断；
- 轮播项 hover **不再改变背景色**，仅标题变主色。

## 改动

### ① DOM：新增 `.home-topstrip__trend` 包裹层
- **旧**：`.home-topstrip__inner > [crumb, rotator, __right]`（三段直接铺），
  desktop ≥768 下 `.home-topstrip` 本体 border/bg/shadow 已被全局「大屏整改」
  清零（透明），无卡片视觉。
- **新**：`.home-topstrip__inner > .home-topstrip__trend > [crumb, rotator, __right]`，
  卡片样式（`--color-surface-elevated` + 1px `--color-border-light` + `--radius-md`
  + `--shadow-sm`）挂在 `.home-topstrip__trend` 层；`__inner` 保留（E2E
  `home.spec.ts:530` 的 `.home-topstrip__inner` 点击目标仍在，无需改）。

### ② 简介：`.home-topstrip__desc` 新元素
- `HomeTopStrip.tsx` 在评分块之后追加 `{item.description && <span className="home-topstrip__desc">...}`，
  取 TMDB `overview`（`useTMDBStore` 的 trending 映射已把 `overview → description` 填进 `TMDBVideoItem`）。
- CSS：`flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;`
  —— 空间不足由简介单独吸收溢出。

### ③ 标题不截断（2026-10-11 用户明确）
- `.home-topstrip__heat-title` 从 `flex: 0 1 auto; overflow:hidden; text-overflow:ellipsis`
  改为 `flex: 0 0 auto`——去掉 ellipsis/overflow，标题整名保留。

### ④ 轮播项 hover 去掉背景变化（2026-10-11 用户明确）
- 删除 `.home-topstrip__rotator-item:hover { background: var(--color-surface-hover); }`；
- `transition` 从 `background + color` 简化为 `color`；
- 保留 `.home-topstrip__rotator-item:hover .home-topstrip__heat-title { color: var(--color-primary); }`
  作为可点反馈（仅标题变色）。

### ⑤ 轮播项充满剩余宽度
- `.home-topstrip__rotator` 从 `flex: 0 1 auto` 改为 `flex: 1 1 auto`（吃掉 crumb
  之后的剩余宽度）；
- `.home-topstrip__rotator-item` 与 `.home-topstrip__rotator-track` 加 `width: 100%`；
- 修 bug：crumb 曾被 flex:1 抢宽压缩，加 `flex-shrink: 0; white-space: nowrap` 锁定。

### ⑥ 高度回归原值
- `--rotator-h` 曾尝试 `calc(单行 + 上下 padding + 边框)` 支持每条独立卡片；
  卡片化移到 trend 层后，`--rotator-h` 回到 `1.6em`（单行高），padding/border
  由 trend 卡片承担。轮播位移步进同步。

## 走过的弯路（避免复发）
- **方案 A（每条加 20px 微缩封面 + 前 3 名彩色排名徽章 + 热度 pill）**：视觉太挤显乱，用户否决。
- **方案 C（每条玻璃浮起 chip + 底部进度点 + fade+slide）**：用户仍不满意，方向不对。
- 定稿=**"卡片作用于整体"**（demo `home-ui-layout-2026-09-29.html` 的 `.cqa-item`
  是每条独立卡的排名形态，与单行轮播本身是两种形态；本次不采用其排名卡网格）。

## 验证
- `npm run build` ✅（tsc -b + vite build）
- `npm run lint:all` 全 7 门 ✅（design-audit --strict 0 新增违规）
- 相关 spec `.home-topstrip__inner` 选择器仍命中（DOM 层级只是新增 trend 包裹，未删旧层）

## 文件
- `src/pages/Home/HomeTopStrip.tsx`
- `src/pages/Home/Home.css`

## Demo
- 已删除本次为选型临时创建的 `demos/home-topstrip-rotator-variants-2026-10-11.html`

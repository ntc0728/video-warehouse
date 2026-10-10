---
date: 2026-09-29 00:32
module: demos
type: change
build: pass
files:
  - demos/home-style-e-typographic.html
  - demos/_data-e-tmdb.js
demo: demos/home-style-e-typographic.html
---

# Demo E ⑥ 数据源换真实 TMDB（快照）+ 七行跨行去重

评审方案第 ⑥ 项原计划「CMS 七行渲染时跨行去重」，实测 CMS 源电影类目仅 3–4 条、
`vod_score` 覆盖 ≈1%，按首页行名填行必然空行。用户拍板：**数据应来源于 TMDB 接口**。
按项目先例（2026-09-06 chart demo 自包含真实 TMDB 快照）落地为「预拉快照 + 自包含」。

## 数据口径（对齐真实首页 Home/index.tsx）

- **banner / 右卡 / 趋势榜** = `/trending/all/day`（zh-CN，20 条，person 已滤）
- **7 行** = 首页同款 7 端点：now_playing·popular·top_rated·upcoming（region=CN）+ tv popular·top_rated·airing_today，标题逐一对齐 `homeRows`（正在热映/热门电影/高分电影/即将上映/热门剧集/高分剧集/今日播出）
- **继续观看** = trending 尾段演示（真实为本地历史，进度为演示值，与 banner/右卡 id 错开）
- 类型名 = `/genre/{movie,tv}/list` 映射 genre_ids[0]（中文）

## 旧 ↔ 新

| 位置 | 旧 | 新 |
| --- | --- | --- |
| 数据层 | 仅 demos/_data.js（CMS 豆瓣/茅台源 + 离线兜底） | 新增 demos/_data-e-tmdb.js（63.8KB 快照，`window.KINO_E_TMDB`，2026-09-28 拉取）；boot 快照优先，缺失回退原 CMS 链（`_data.js` 不动，图片管线仍用其 kinoBindPics） |
| 七行数据 | _data.js 硬凑（前 4 行同池倒序、行间近全重复） | **行间跨行去重（⑥）**：按 id 贪心消费，行短不回填——实测 20/17/19/10/20/20/17，dup=0，footer 显示「7 行 123 条（已跨行去重）」 |
| 头条文案 | 「今日头条 · CMS 最新收录」/ deck 引 CMS 实时接口 | 「今日头条 · TMDB /trending/all/day 每日趋势」/ deck 引中文 overview |
| 公告带 | 今日趋势=CMS 去重条数、最热分类=counts、title 注明「首页真实口径为 TMDB…」 | 今日趋势=trending 20（口径已落地，title 改述算法与快照时点）；最热类型=trending genreIds[0] 频次（TMDB 无分类 total） |
| footer 统计 | 「收录统计 · 电影 X · 剧集 Y…」（CMS total） | TMDB 分支「TMDB 快照 <date> · 趋势 20 条 · 7 行 N 条（已跨行去重）」；CMS 回退分支保留原文案 |
| 行/趋势/继续 sub | 「真实收录」「近 7 日真实收录」「真实片源」 | 「N 条」「TMDB /trending/all/day · 10 条」「进度为演示值」（含行 `en` 英文小标 NOW PLAYING 等） |

## 刷新方式

临时脚本（`opencode` temp，未入库）读 `.env.local` 的 `VITE_TMDB_ACCESS_TOKEN`，依次拉
`trending/all/day` + 7 行端点 + 2 genre 端点（api.tmdb.org 优先、api.themoviedb.org 回退），
map 后写 `demos/_data-e-tmdb.js`。端点清单与参数（region=CN 等）见 `src/services/tmdbService.ts:222-266`。
**token 未写入任何入库文件。**

## 验证

- 语法+id 校验：script×2 OK、refs 15/15 命中、无删除物残留、`display:none` 仅 2 处既有响应式
- fake DOM 运行时冒烟：快照分支全链（boot→assemble→renderAll）不抛错；7 sections、trend 10 条、跨行 dup=0、topstrip「今日趋势 20 条 · 最热类型 动画 · 收藏 2」、kick=TMDB 口径
- `npm run lint:all` 7 门通过

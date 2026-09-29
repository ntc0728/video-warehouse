# 2026-09-29 · Demo E 报刊排版式 · 全站页面 demo（除首页）

## 背景
首页 `demos/home-style-e-typographic.html` 已定稿。需要把同一套「报刊排版式」皮肤铺到其余页面，供风格评审；要求只新增文件、不干扰其它文件。

## 新增文件（全部在 demos/ 下，无既有文件被修改）

| 文件 | 作用 |
| --- | --- |
| `demos/style-e.css` | 报刊皮肤**共享层**：token（纸色/墨色/衬线/--rail-w/--poster-n/--pad-x）、报头与导航、就地展开搜索、分区头（编号+衬线标题）、左栏 rail（chips 恒 2 列、竖排条目）、卡片网格与四角标、横版卡、趋势表（≥1440 双栏）、kpic 图片容器、骨架、按钮/分段/开关/字段、表格、FAB、页脚、断点（1023/767/hover:none/reduced-motion）、TV+投影仪设备层 |
| `demos/style-e-boot.js` | **启动层**：TMDB 快照组装（与首页同口径，缺失回退 `_data.js` CMS）、报头/页脚/FAB 渲染、主题（localStorage）、搜索（建议下拉 + ⌘K）、图片 IO 绑定、收藏 localStorage、?device=tv\|beamer |
| `demos/e-index.html` | 全站索引（12 个页面 → 路由 → 真实对照文件） |
| `demos/e-browse.html` | 浏览/搜索：左栏筛选（类型/分类/地区/年份/排序）+ 网格 + 排序条 + 逻辑分页（每页 cols×5，totalPages>1 才渲染） |
| `demos/e-chart.html` | 热度榜：6 分类 tab + 排名行 + 无缝滚动 + 口径 tooltip |
| `demos/e-detail.html` | 详情：头图对开 + CTA + 概览/播放列表/季信息/剧照 tab + 资料表 + 相似推荐 |
| `demos/e-person.html` | 人物：档案对开 + 作品年表（按年份分组） |
| `demos/e-player.html` | 播放：16:9 播放区 + 集数/线路 + 右侧播放列表与推荐 |
| `demos/e-iptv.html` | IPTV 列表：左栏分组 + 源 chips + 频道网格 + EPG 侧栏（三列） |
| `demos/e-iptv-player.html` | IPTV 播放：独立全屏（fixed inset:0）+ 切台/收藏/节目单/全屏 |
| `demos/e-collections.html` | 收藏：RecordShell 方案 A 左栏 + 算珠时间轴 + 批量管理 |
| `demos/e-history.html` | 历史：左栏筛选 + 算珠时间轴（今天/昨天/本周/本月/更早）+ 横版卡 |
| `demos/e-settings.html` | 设置：左栏 6 tab + 开关/选择/文本字段 + 导出配置 |
| `demos/e-source-checker.html` | 源检测：一键检测 + 4 分区 + 节点延迟表 |

## 关键口径（防「假数据/凭空造模块」）
- **真实**：标题 / 海报 / backdrop / 评分 / 年份 / 类型 / 剧情 → TMDB 快照 `_data-e-tmdb.js`（与首页同口径，快照缺失回退 `_data.js`）。
- **真实行为**：筛选、排序、分页跳页、搜索建议、收藏（跨 demo 共享 localStorage `kino-demo-favs`）、历史增删/批量/清空、设置开关与主题/强调色写入 localStorage、IPTV 切台与节目单、播放器播放/进度拖拽/倍速/全屏、**源检测的网络延迟为真实 fetch 测量**。
- **演示值（界面已标注）**：播放进度、热度值、收藏种子、地区、IPTV 频道表与 EPG、源检测的 IPTV 源/视频源/代理结果、人物档案与职务、季信息/线路/集数。
- 详情页不虚构演职员与 stills（快照无 credits/stills 端点），以「相似推荐 + 真实 backdrop」替代并在页面注明。

## 对齐的真实实现（先读源码再写）
- 左栏宽度 `--rail-w: clamp(148px,10vw,248px)`（`src/assets/styles/layout-tokens.css:33`）。
- Browse chips 恒 2 列 + 长词独占整行（`FilterBar.tsx` isWideLabel）；排序「最热/最新/最高分」（`FilterBar/constants.ts` + `Browse/constants.ts`）。
- Chart 6 tab + 今日/本周 window（`Chart/index.tsx` CHART_TABS / TREND_WINDOWS）。
- Settings 6 tab 文案（`SettingsTabBar.tsx` SETTINGS_TABS）。
- Collections/History 左栏与状态/排序文案（`Collections/index.tsx`、`History/index.tsx`）。
- IPTVPlayer 独立顶层路由 → `position:fixed;inset:0` + 100dvh。

## 自检
- 13 个 html 的内联 JS + `style-e-boot.js` 全部通过 `vm.Script` 语法编译。
- 各页 JS 中 `getElementById` 引用的 id 全部存在于 DOM（脚本化校验，未跑浏览器）。
- 未运行任何浏览器/截图/冒烟脚本（红线 24），验收权在用户。

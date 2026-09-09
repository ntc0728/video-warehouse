# 页面与路由 · Keep-Alive · 搜索传递

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## 页面原理图与流程图

**位置**: `docs/page-diagrams/`

**核心文件**:

- `index.html` — 索引页，导航到所有页面原理图和流程图
- `flowchart.html` — 项目流程图（页面导航地图 + 数据流架构 + 核心播放流程），所有页面节点可点击跳转
- `diagram-data.json` — 真实 API 数据（由 `scripts/fetch-diagram-data.mjs` 生成）
- `diagram-common.js` — 共享数据加载和渲染工具
- `shared.css` — 共享样式

**10 个页面原理图**: home / browse / detail / player / iptv / settings / collections / history / source-checker / person

**联动机制**:

- 流程图中页面节点可点击 → 跳转到对应原理图
- 原理图 page-nav 有 "📊 流程图" 链接 → 跳回流程图并高亮当前页面节点
- 索引页有流程图入口卡片

**数据获取脚本**: `scripts/fetch-diagram-data.mjs`

```bash
node scripts/fetch-diagram-data.mjs                    # 获取 CMS + IPTV 数据
TMDB_TOKEN=xxx node scripts/fetch-diagram-data.mjs     # 同时获取 TMDB 数据
```

**本地预览**: 在 `docs/page-diagrams/` 目录下启动 HTTP 服务器即可预览。



## 页面与路由

| 页面      | 路由                | 核心组件                                                                                         | 数据源                                                                                 |
| ------- | ----------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 首页      | `/`               | HeroBanner（缩略图覆盖式布局 + 移动端滑动动画） + CategoryQuickAccess（**全端显示**，点击跳 /browse） + TMDBMovieRow ×7 | TMDB trending/nowPlaying/popular/topRated/upcoming/popularTv/topRatedTv/airingToday |
| 浏览/搜索   | `/browse`         | 搜索 tabs + FilterBar + SortBar + BrowseGrid（双卡片布局，搜索框统一由顶部导航 SearchBox 提供）                    | TMDB discover/search + CMS searchAll                                                |
| 热度榜    | `/chart`          | Chart：6 分类 tab + 排名榜行（top3 暖橙）+ useInfiniteScroll 无缝滚动（按 id 去重 + popularity 重排）+ 口径 tooltip + 切 tab 刷新态（旧行降沉 + 零高度 sticky「加载中」胶囊，⚠️ sticky 不能放 grid 内——grid item 只能在自身 row track 内移动）+ flex 链满容器高度；入口 = 首页热度榜分类卡与「查看完整榜单」 | TMDB discover popularity.desc 分页 + trending（趋势榜） |
| 详情      | `/detail/:id`     | DetailHeader + TabBar + CastList + StillsLightbox                                            | TMDB movie/tv detail + CMS searchVideoByTitle                                       |
| 播放      | `/play/:id`       | UniversalPlayer + Sidebar (PlayLineList + EpisodeList)                                       | CMS vod_play_url 解析 → HLS/DASH/Native Adapter                                       |
| IPTV    | `/iptv`           | IPTVChannelList + EPGProgramList                                                             | M3U 解析 + EPG XMLTV 匹配                                                               |
| 设置      | `/settings`       | List + Modal + ThemeSwitcher                                                                 | useSettingsStore (localStorage AES-GCM)                                             |
| 收藏      | `/collections`    | RecordShell + CollectionGrid                                                                 | useUserStore (IndexedDB)                                                            |
| 历史      | `/history`        | 融合 Tab（综合/视频/IPTV）+ RecordCard 横版卡 + 更多筛选（状态 chips + 排序）+ 批量管理 + 桌面算珠时间轴                     | useUserStore + useIPTVStore (IndexedDB)                                             |
| 源检测     | `/source-checker` | SourceTable                                                                                  | videoService.checkAllVideoSources                                                   |
| 人物      | `/person/:id`     | PersonHeader + MovieCredits                                                                  | TMDB person detail + credits                                                        |
| IPTV 播放 | `/iptv/play`      | IPTVPlayer (独立全屏)                                                                            | IPTV channel stream                                                                 |


## Keep-Alive 路由

AppLayout 使用 Keep-Alive 模式：所有已访问页面保持挂载，通过 CSS `display` 切换可见性。  
路由切换不触发 unmount/remount，修改页面状态时需考虑组件已挂载的二次进入场景。

**路由 chunk 预加载（消除双重 AppLoading）**：`routeConfig.ts` 的 `lazyWithRetry` 暴露 `preload()`。`preloadInitialRoute()` 在 `main.tsx` 首屏渲染**前**调用，预拉「当前 URL 对应」的路由 chunk（warm 命中缓存时 Suspense 同步解析，避免首屏「Suspense fallback → 页面自身 loading」双重 AppLoading）。`preloadAllRoutes()` 在 `AppLayout` 挂载后**立即**执行（不再等待 `requestIdleCallback`/setTimeout），缩短首屏后的窗口期，导航场景基本不再触发两次 AppLoading。`import()` 只求值模块、不挂载、不触发数据请求，无副作用。

**SearchBox 懒加载热门搜索**：SearchBox 常驻顶栏，`trending`（`/trending/all/day`）改为「下拉打开且 `showHotSearch` 为真」时才拉取，避免「非首页刷新即请求 trending」；首页数据仍由 `fetchAllHomeData` 负责。

**⚠️ 异步数据 + 布局测量的隐形雷区**  
隐藏页（`display:none`，`clientWidth=0`）期间完成的异步加载（如剧照 `/images`、推荐、CMS 源）会让任何「依赖容器尺寸」的逻辑（`useEffect` 里 `if (clientWidth<=0) return`、用 `getComputedStyle` 读 `gridTemplateColumns` 算列数等）永久失效，且 `display:none` 的元素 `ResizeObserver` 不触发、显示后也无法纠正。受影响的 UI：详情页剧照 2 行截断、任何分页/虚拟滚动/自适应列数。  
**正确做法**：测量逻辑在容器不可见（`clientWidth<=0`）时改用「视口宽度估算兜底」（按 CSS 列宽公式 `clamp(8rem, 6rem+8vw, 16rem)` 推算列数），保证状态一定是有限值；页面显示后 `ResizeObserver` 用真实列数纠正。复现手法：`page.route` 给目标接口加 `setTimeout` 延迟 → 导航进页 → `page.goBack()` 隐藏 → 等延迟过 → `page.goForward()` 显示 → 断言（详见 `scripts/detail.spec.ts` DETAIL-048）。



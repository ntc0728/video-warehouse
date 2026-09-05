# CategoryQuickAccess 方案 A2 实施方案（>1280 桌面）

> 2026-09-06 · 基于 demo `changelogs/demos/demo-category-quick-access-a2-2026-09-06.html`（v2.3 已确认形态）
> 原则：≤1280 / TV / app 端**零改动**（现有 7 彩色圆卡保留）；仅 >1280 桌面启用新「频道导航 + 热门分类面板」。

## 一、已拍板的设计结论

1. **导航条**（hero 上方）：首页 / 电影 / 剧集 / 综艺 / 动漫 / 纪录片 / 排行榜 文字+图标 chip；「全部分类 →」跳 `/browse?category=all`（复用现有 onCategorySelect('all')）。chip 点击**不跳转**，展开下方面板。
2. **默认「首页」面板，加载即显示**：分类热度榜——前 3 个分类卡（1 行 3 列）：排名 + 分类名 + Σpopularity 热度 + 热度条 + 该分类 **top3 热门搜索值**（排名 + 28×40 小海报 + 标题 + 🔥popularity）。
3. **分类面板**：子分类 chips 行 + **3 行 × 3 列 = 9 个紧凑内容卡**（横排：排名内联 + 海报 54×80 + 标题/年份/★ + 右侧 🔥popularity）。
4. **子分类**：电影/剧集 = TMDB 全量 genre list（zh-CN，首 chip「全部」= trending 当日榜）；综艺/动漫/纪录片 = 主 genre × 相关 genre 的**真实交叉组合**（`with_genres=主,副` AND，实测均有数据）；排行榜 = 日榜/周榜/电影榜/剧集榜。
5. **热度口径** = TMDB popularity 原始值；多分类命中**重复计入**（桶规则天然如此）。
6. **hero 下移**：面板在文档流中推挤（非覆盖）。
7. **点击内容卡 → `/detail/{composite-id}`**（复用 `tmdb-movie-{id}` / `tmdb-tv-{id}` 复合 id 约定）。

## 二、图标方案（lucide，经 `<Icon>` 组件，禁直接内联 SVG）

| 位置 | lucide 图标 | Icon size 档 | 说明 |
|---|---|---|---|
| 导航「首页」 | `Home` | md | --icon-md = text-base×1.43 |
| 导航「电影」 | `Film` | md | 沿用现有 CATEGORIES 图标 |
| 导航「剧集」 | `Tv` | md | 同上 |
| 导航「综艺」 | `Mic2` | md | 同上 |
| 导航「动漫」 | `Sparkles` | md | 同上 |
| 导航「纪录片」 | `Video` | md | 现为 Camera（demo 语境纪录片更贴摄像机语义；移动端圆卡维持 Camera 不动） |
| 导航「排行榜」 | `Trophy` | md | 同上 |
| 导航「全部分类」 | `LayoutGrid` + `ChevronRight` | md / xs | 右侧箭头指示跳转 |
| 热度徽标/热度值 | `Flame` | xs | 替代 demo 中的 🔥 emoji（全站禁 emoji 图标语义） |
| 评分 | `Star` | xs | hotcard meta 行 |
| 面板标题 | `Flame` | sm | 「分类热度榜」/分类面板标题前缀 |

约束：移动端圆卡的图标映射**不动**（仍 LayoutGrid/Film/Tv/Mic2/Sparkles/Camera/Trophy），仅 >1280 新导航使用上表；不满足 `--icon-*` 档位的硬编码 px 一律不允许。

## 三、数据方案（Layer 3 service / Layer 2 store）

### 复用（零新增请求的部分）
- **默认面板 + 导航热度徽标**：直接消费 `useTMDBStore.trending`（`/trending/all/day`，首页 fetchAllHomeData 已拉取；SearchBox 热搜同源共享）——**首屏零额外请求**。
- TMDBVideoItem 已含 `mediaType / genreIds / popularity / posterPath / voteAverage / year / 复合id`，桶聚合纯前端计算。

### 新增 service（tmdbService.ts）
```ts
// 分类面板专用 discover：sort popularity.desc、vote_count.gte 放宽到 10
// （现有 discoverMovie/TV 硬编码 gte=50，会过滤掉综艺×新闻等小池子）
export async function discoverCategory(
  mediaType: 'movie' | 'tv',
  genreIds: number[],
  options?: { signal?: AbortSignal },
): Promise<TMDBPaginatedResponse<TMDBMovie | TMDBTVShow>>
```

### 导出 store 纯映射函数（useTMDBStore.ts）
`mapTrendingToVideoItem / mapMovieToVideoItem / mapTVToVideoItem` 由模块私有改为 `export`（纯函数，无状态副作用），供面板数据模块把 trending/discover 原始响应统一归一为 TMDBVideoItem（复合 id 与全站一致）。

### 新增组件级数据模块（CategoryQuickAccess/categoryPanelData.ts）
- `WIDE_CATEGORIES`：7 分类定义（key/label/图标/数据源/子分类表）。
  - 综艺子分类：全部(10764) / 家庭亲子(10764,10751) / 谈话(10764,10767) / 新闻(10764,10763)
  - 动漫子分类：全部(16) / 动作冒险(16,10759) / 喜剧(16,35) / 科幻&奇幻(16,10765) / 儿童(16,10762)
  - 纪录片子分类：全部(99) / 历史(99,36) / 犯罪(99,80) / 音乐(99,10402) / 战争(99,10752)
  - 排行榜子分类：日榜 all/day / 周榜 all/week / 电影榜 movie/week / 剧集榜 tv/week
  - 电影/剧集子分类：`fetchMovieGenres/fetchTVGenres`（zh-CN）懒加载 + 「全部」chip
- `aggregateCategoryHeat(items)`：按桶聚合 → `{ key, count, heat, top3 }[]`（热度徽标 + 默认面板共用）。
- `fetchCategoryPanel(catKey, subId, signal)`：返回 `TMDBVideoItem[]`（≤9）；模块级 `Map` 缓存（key=`cat:sub`），重复展开零请求；in-flight 去重。

### 端点清单（全部真实 TMDB，zh-CN 由 fetchTMDB 统一注入）
| 用途 | 端点 |
|---|---|
| 默认面板/徽标 | `/trending/all/day`（store 复用） |
| 电影/剧集「全部」 | `/trending/movie/day`、`/trending/tv/day` |
| 电影/剧集子 genre | `/discover/{movie,tv}?with_genres=X` |
| 综艺/动漫/纪录片 | `/discover/{tv,movie}?with_genres=主` 或 `主,副` |
| 排行榜 | `/trending/{all,movie,tv}/{day,week}` |

## 四、组件与样式方案

### 文件与改动面
| 文件 | 改动 |
|---|---|
| `CategoryQuickAccess.tsx` | 重写：保留 ≤1280/TV 圆卡渲染分支；新增 `isWide` 分支（导航条 + 面板 + 状态机 `activeKey/subSel`） |
| `CategoryQuickAccess.css` | **末尾追加** `@media (width > 1280px)` 块（现有规则逐字节不动） |
| `categoryPanelData.ts` | 新增（组件目录内） |
| `tmdbService.ts` | 新增 `discoverCategory` |
| `useTMDBStore.ts` | 3 个 mapper 加 `export` |
| `Home/index.tsx` | **不动**（props 不变） |

### 状态机（组件内 useState，Keep-Alive 下二次进入保持面板展开，符合 Keep-Alive 语义）
- `activeKey: CategoryKey | null`（默认 `null` → 渲染「首页」默认面板，即加载即显示）
- `subSel: Record<string, string|number>`
- `panelItems: TMDBVideoItem[] | null` + `panelLoading`
- 切 chip：`setActiveKey` → 有缓存直接渲染，否则 fetchCategoryPanel（AbortController 防快速连点竞态）

### CSS 契约（v2.2 token，与 demo 逐字对齐）
- 导航行高 = `--comp-tab-height` + `--space-xs` 上内边距；chip padding `0 --space-sm`；hover `--color-surface-hover`；激活态 `--color-bili` 文字 + 2px 底线。
- 面板 = 卡片模块规范：`var(--color-surface)` + `1px solid var(--color-border-light)` + `var(--radius-lg)`；面板内卡（catcard/hotcard）= `var(--radius-md)` + `--color-border-light` 边框 + hover `--color-bili-light` 系边框。
- 字号：面板标题 `--text-base`、chip/卡标题 `--text-sm`、meta/热度 `--text-xs`；热度色 `--color-bili`；排名色 `--color-text-tertiary`（top1-3 `--color-bili`）。
- catgrid/hotgrid：`repeat(3, 1fr)`，**无降级媒体查询**（>1280 块内恒 3 列）。
- 海报：LazyImage（w185 尺寸），hotcard 54×80、catcard 行 28×40；`prefers-reduced-motion` 下去 hover 位移。

## 五、路由与跳转

| 元素 | 行为 |
|---|---|
| 导航 chip | 展开/切换面板（不跳转） |
| 「全部分类 →」 | `onCategorySelect('all')` → `/browse?category=all`（现有链路） |
| catcard | `setActiveKey(cat)` 展开对应分类面板 |
| hotcard | `navigate('/detail/{composite-id}')`（useCustomNavigate，禁直接 useNavigate） |
| ≤1280 圆卡 | 现状不变：`onCategorySelect(key)` |

## 六、测试方案（同提交）

- **mock**：现有规则已覆盖全部新端点（`/trending/` 通用、`/discover/{movie,tv}`、`/genre/*`）。仅调整 `TRENDING_RESULTS` 的 `genre_ids` 按索引变化（ movie 项混入 99、tv 项混入 16/10764），使桶聚合出现 ≥3 个非零分类；不改老断言依赖的字段。
- **home.spec.ts 新增 `1.3c 宽屏分类面板`（>1280 视口 1440）**：
  1. 导航渲染 7 chip + 全部分类，Icon svg 存在，热度徽标 ≥3 个；
  2. 默认面板加载即显示：3 个 catcard、每个含 3 条热门数据行；
  3. 点「电影」chip → 子分类 chips + 9 个 hotcard；点子分类 chip 面板不消失（内容切换）；
  4. 「全部分类」→ URL 含 `/browse`；
  5. 1280 视口回归：圆卡仍在（`>1280` 严格大于，1280 不命中宽屏分支）。
- **映射**：`run-tests.ps1` 的 CategoryQuickAccess 条目 grep `1\.3` 已覆盖 1.3c，无需改映射。
- 回归范围：`home.spec.ts` + `cross-page.spec.ts`（StickyHeader/分类联动）。

## 七、风险与对策

| 风险 | 对策 |
|---|---|
| `api.themoviedb.org` 部分网络不可达 | fetchTMDB 现有域名策略不动（demo 已验证 api.tmdb.org 备用域名可用）；本方案不引入新域名行为，如需双域名回退另立任务 |
| discover `vote_count.gte=50` 过滤小池子 | 新增 discoverCategory 放宽至 10 |
| Keep-Alive 二次进入面板状态残留 | 属预期（保持展开），缓存命中零请求 |
| 快速连点 chip 竞态 | AbortController + in-flight Map 去重 |
| mock 下 discover/tv 返回 movie 形态数据 | 与现有 browse TV 用例同源，映射器已兼容（name 空时回退 title） |

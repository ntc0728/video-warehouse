# AGENTS.md — AI Agent 项目指南

> 本文件是 AI Agent 的工作指南。Cursor / Aider / Windsurf / Claude / Copilot 等工具应优先阅读此文件。推理过程禁止使用英文，一律使用中文。

## 项目概述

**Video Warehouse (KinoTV)** — 影视聚合平台，支持多数据源视频浏览、IPTV 直播、收藏管理和智能搜索。
技术栈：React 18 + TypeScript + Vite 6 + Zustand + Tailwind CSS + HLS.js/DASH.js。

## 架构设计（四层分层）

```
Layer 1: 页面组件 (React)        → 用户交互、UI 渲染
Layer 2: Zustand Store (状态管理) → 数据缓存、状态分发
Layer 3: Service 层 (API 封装)    → 请求构建、响应解析
Layer 4: 外部数据源               → TMDB API / CMS 采集站 / IPTV M3U / EPG / IndexedDB
```

### Store → Service → API 映射

| Store | Service | 外部数据源 | 代理 |
|-------|---------|-----------|------|
| useTMDBStore | tmdbService | TMDB API v3 (api.tmdb.org/3) | 直连 (CORS) |
| useSettingsStore | sourceService | video-sources.json / iptv-sources.json | 本地文件 |
| useUserStore | database (idb) | IndexedDB | 本地存储 |
| useIPTVStore | iptvService + epgService | M3U 播放列表 + XMLTV EPG | Video Proxy |
| usePlayerStore | videoService | CMS 采集站 API (28 源) | Video Proxy |
| useVideoStore | videoService | CMS 采集站 API | Video Proxy |
| useNavStore | — | 页面导航状态 | 内存 |
| useRecommendStore | tmdbService | TMDB trending | 直连 |

## 代理配置

| 代理 | URL 模式 | 用途 |
|------|---------|------|
| Video Proxy (CORS) | `https://your-video-proxy.example.com/proxy?url={encoded}` | CMS API 请求、M3U 文件获取、EPG XML 获取 |
| IPTV Proxy (M3U8) | `https://your-iptv-proxy.example.com/m3u8-proxy?url={encoded}` | IPTV 直播流代理（重写内部 URL） |
| TS Proxy | `https://your-iptv-proxy.example.com/ts-proxy?url={encoded}` | TS 分片代理 |

CMS API 和 IPTV M3U 请求必须通过 Video Proxy 代理（浏览器跨域限制）。TMDB API 原生支持 CORS，直连即可。

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

| 页面 | 路由 | 核心组件 | 数据源 |
|------|------|---------|--------|
| 首页 | `/` | HeroBanner（缩略图覆盖式布局 + 移动端滑动动画） + CategoryQuickAccess + TMDBMovieRow ×7 | TMDB trending/nowPlaying/popular/topRated/upcoming/popularTv/topRatedTv/airingToday |
| 浏览/搜索 | `/browse` | 搜索 tabs + FilterBar + SortBar + BrowseGrid（双卡片布局，搜索框统一由顶部导航 SearchBox 提供） | TMDB discover/search + CMS searchAll |
| 详情 | `/detail/:id` | DetailHeader + TabBar + CastList + StillsLightbox | TMDB movie/tv detail + CMS searchVideoByTitle |
| 播放 | `/play/:id` | UniversalPlayer + Sidebar (PlayLineList + EpisodeList) | CMS vod_play_url 解析 → HLS/DASH/Native Adapter |
| IPTV | `/iptv` | IPTVChannelList + EPGProgramList | M3U 解析 + EPG XMLTV 匹配 |
| 设置 | `/settings` | List + Modal + ThemeSwitcher | useSettingsStore (localStorage AES-GCM) |
| 收藏 | `/collections` | RecordShell + CollectionGrid | useUserStore (IndexedDB) |
| 历史 | `/history` | RecordShell + Timeline + ProgressBar | useUserStore (IndexedDB) |
| 源检测 | `/source-checker` | SourceTable | videoService.checkAllVideoSources |
| 人物 | `/person/:id` | PersonHeader + MovieCredits | TMDB person detail + credits |
| IPTV 播放 | `/iptv/play` | IPTVPlayer (独立全屏) | IPTV channel stream |

## 关键数据格式

### CMS vod_play_url 解析
```
线路1$第1集$http://example.com/ep1.m3u8#第2集$http://example.com/ep2.m3u8$$$线路2$第1集$http://example2.com/ep1.m3u8
```
- `$$$` 分隔播放线路
- `#` 分隔集数
- `$` 分隔集标题和 URL
- URL 后缀决定适配器: `.m3u8` → HLS (hls.js), `.mpd` → DASH (dash.js), 其他 → Native

### 数据源配置文件
- `public/data/video-sources.json` — 28 个 CMS 采集站（苹果 CMS V10 API）
- `public/data/iptv-sources.json` — 24 个 IPTV M3U 源
- `public/data/epg-sources.json` — 3 个 EPG XMLTV 源

## 领域术语

详见 `CONTEXT.md`。关键术语：vod_id / vod_play_url / vod_play_from / Episode / Playback Source / Adapter / Hot Switch / Cold Switch / CMS Source / episodeUrl / vodId / cmsSourceId。

## 开发命令

```bash
npm run dev          # 开发服务器 (127.0.0.1:3001)
npm run build        # 生产构建（tsc -b && vite build）
npm run lint:all     # ESLint + Stylelint
npm run test         # Vitest 单元测试
npx playwright test  # E2E 测试（TMDB Mock 默认启用，-RealApi 关闭）
```

> **⚠️ 代码修改后必须执行 `npm run build`**
> 禁止用 `npx tsc --noEmit --skipLibCheck` 替代——`--skipLibCheck` 会跳过 `noUnusedLocals` 检查，导致未使用变量提交后 CI 构建失败。
> 正确流程：修改代码 → `npm run build` 验证通过 → `git commit` → `git push`。

> **⚠️ 改动必须及时 commit，不要堆积在工作区**
> 所有改动若不 commit，子代理或其他操作可以一键覆盖全部。每完成一个独立功能就立即 commit。

> **⚠️ 子代理操作前必须 commit 保护现有改动**
> 子代理可能重写非指定文件。使用子代理前，先 `git stash` 或 commit 保护当前状态。

> **⚠️ CSS 检查必须 grep 所有 display:none 规则**
> 恢复代码后必须用 `grep` 搜索所有 `display: none` / `visibility: hidden` 确认无遗漏，不能只看 git diff 标记。

> **⚠️ 不要在未逐行确认时声称"恢复完成"**
> 只说"已验证的改动"，不说"全部恢复"。除非逐文件逐行确认过，否则用"大部分已恢复，待验证"。

## TMDB Mock 策略

测试通过 `scripts/fixtures/mock-tmdb.ts` 拦截 `api.tmdb.org` 请求，返回本地 mock 数据。

| 模式 | 命令 | Token 风险 |
|------|------|-----------|
| Mock 模式（默认） | `npx playwright test` | 无 |
| 真实 API 模式 | `TMDB_MOCK=false npx playwright test` | 有 |
| 增量测试 | `.\scripts\run-tests.ps1`（mock）/ `-RealApi`（真实） | 按模式 |

Mock 覆盖：trending / search / discover / movie detail / tv detail / person / genres / images。

## 关键目录

```
src/
├── components/          # 通用组件（ui/ + common/ + Layout/ + UniversalPlayer/ + ...）
├── pages/               # 页面组件（Home/ Browse/ Detail/ Player/ IPTV/ Settings/ ...）
├── services/            # Service 层（tmdbService / videoService / iptvService / epgService / httpClient）
├── stores/              # Zustand Store（8 个）
├── types/               # TypeScript 类型定义
├── hooks/               # 自定义 Hooks
└── lib/                 # 工具函数
worker/                  # Cloudflare Workers（m3u8-proxy.js / cors-proxy.js）
docs/page-diagrams/      # 页面原理图 + 流程图 + 真实数据
scripts/                 # 构建脚本 + E2E 测试 + 数据获取脚本
public/data/             # 数据源配置 JSON
```

## Keep-Alive 路由

AppLayout 使用 Keep-Alive 模式：所有已访问页面保持挂载，通过 CSS `display` 切换可见性。
路由切换不触发 unmount/remount，修改页面状态时需考虑组件已挂载的二次进入场景。

**路由 chunk 预加载（消除双重 AppLoading）**：`routeConfig.ts` 的 `lazyWithRetry` 暴露 `preload()`。`preloadInitialRoute()` 在 `main.tsx` 首屏渲染**前**调用，预拉「当前 URL 对应」的路由 chunk（warm 命中缓存时 Suspense 同步解析，避免首屏「Suspense fallback → 页面自身 loading」双重 AppLoading）。`preloadAllRoutes()` 在 `AppLayout` 挂载后**立即**执行（不再等待 `requestIdleCallback`/setTimeout），缩短首屏后的窗口期，导航场景基本不再触发两次 AppLoading。`import()` 只求值模块、不挂载、不触发数据请求，无副作用。

**SearchBox 懒加载热门搜索**：SearchBox 常驻顶栏，`trending`（`/trending/all/day`）改为「下拉打开且 `showHotSearch` 为真」时才拉取，避免「非首页刷新即请求 trending」；首页数据仍由 `fetchAllHomeData` 负责。

**⚠️ 异步数据 + 布局测量的隐形雷区**
隐藏页（`display:none`，`clientWidth=0`）期间完成的异步加载（如剧照 `/images`、推荐、CMS 源）会让任何「依赖容器尺寸」的逻辑（`useEffect` 里 `if (clientWidth<=0) return`、用 `getComputedStyle` 读 `gridTemplateColumns` 算列数等）永久失效，且 `display:none` 的元素 `ResizeObserver` 不触发、显示后也无法纠正。受影响的 UI：详情页剧照 2 行截断、任何分页/虚拟滚动/自适应列数。
**正确做法**：测量逻辑在容器不可见（`clientWidth<=0`）时改用「视口宽度估算兜底」（按 CSS 列宽公式 `clamp(8rem, 6rem+8vw, 16rem)` 推算列数），保证状态一定是有限值；页面显示后 `ResizeObserver` 用真实列数纠正。复现手法：`page.route` 给目标接口加 `setTimeout` 延迟 → 导航进页 → `page.goBack()` 隐藏 → 等延迟过 → `page.goForward()` 显示 → 断言（详见 `scripts/detail.spec.ts` DETAIL-048）。

## 关键模式与约定

### RecordShell（收藏页/历史页共用外壳）

`src/components/RecordShell/` — 收藏页和历史页的共用布局组件：
- **桌面（≥768px）：顶部横向卡片筛选栏** — `.record-aside` 由竖向侧栏改为横向（`flex-flow: row wrap`、宽度 100%），顶部常驻 sticky 卡片：第 1 行 = 标题 + 影视/IPTV 分段 + 搜索框（弹性撑开）+ 批量/清除工具栏（靠右），第 2 行 = 状态筛选芯片（横向、可换行、独占整行）；主区 `.record-main` 在其下方
- **移动（≤767px）方案 M6**：顶部 sticky 精简栏，滚动时自动折叠状态芯片行，仅留分段+搜索+筛选按钮（**保持不变**）
- CSS 在 `RecordShell.css`，两页共享；实现方式为「末尾追加 `@media (width >= 768px)` 块覆盖默认竖向布局」，原移动端规则逐字节未动，确保移动端零影响；桌面侧栏 `width:100%` 的元素在移动横向 flex 行必须显式 `width:auto` 复位

### 卡片模块 (Card Module) UI 约定

项目级统一视觉风格：每个功能区块作为独立「卡片模块」：
- 背景 `var(--color-surface)` + `1px solid var(--color-border-light)` 边框 + `var(--radius-lg)` 圆角 + `var(--shadow-sm)` 阴影
- 模块（卡片）之间间距统一 `var(--space-sm)`
- **所有设备启用**（移动端/平板/桌面端），卡片样式直接写在组件样式中，无需媒体查询包裹

应用位置：
- 侧边栏 `HomeSidebar` + 顶部导航 `StickyHeader` — 桌面端（≥1024px）采用**连接式布局**：Sidebar 左对齐（top/bottom/left=0）、宽度 `clamp(160px, 12vw, 240px)`、Header 与 Sidebar 无缝对接（margin=0、无边框无阴影），形成统一的 L 型导航区域 — `Layout.css` 内 `@media (width >= 1024px)`
- 首页 `HeroBanner` / `CategoryQuickAccess` / 每个 `TMDBMovieRow` — `Home.css`（`.home-page` 作用域）
- 浏览页双卡片结构 — `Browse.css`：
  - Card 1（搜索区）：搜索 tabs + FilterBar（`hideFooter` 隐藏排序 footer），`flex-shrink: 0` 防挤压（SearchBox 已移至顶部导航，通过 `usePageSearchStore` 注册回调）
  - Card 2（结果区）：排序栏 + SourceStatusIndicator + 结果网格 + 懒加载哨兵，`flex: 1 1 0` 填充剩余空间
- IPTV 页 `.iptv-top-card`（筛选控制）+ `.iptv-grid-card`（频道网格）— `IPTV.css`
- 人物页 `.person-hero`（资料卡片）+ `.person-grid-card`（Tab+作品网格）— `Person.css`
- 详情页 `detail-hero` — 去掉负 margin，受 page-padding 约束（`Detail.css`）
- 设置页桌面端 `.settings-desktop-card` — TabBar + 内容区放入**同一张大卡片**，section 去卡片化、之间用分割线（`border-top`）分隔（`Settings.css`）；移动端子页布局不变

骨架占位扫光速度：全局变量 `var(--card-shimmer-duration)`（默认 `3s`，原 `1.5s`）定义在 `variables.css` 的 `:root`；`LazyImage` / `TMDBMovieRow` 行骨架 / `SkeletonCard` / `SkeletonIPTVCard` 统一引用，调快慢只需改这一处。

### HeroBanner 组件

`src/components/HeroBanner/` — 首页 Hero 横幅轮播：
- **布局**：左侧主背景图（左右滑动切换）+ 右侧缩略图列（absolute 定位覆盖在 banner 边缘）
- **缩略图**：`position: absolute; z-index: 10`，`overflow: hidden` 不影响 banner 圆角；激活态使用 `2px solid var(--color-primary)` 边框 + `var(--color-primary-shadow)` 阴影；点击跳转 detail 页；标题仅激活态显示
- **滑动切换动画（所有客户端）**：`activeIndex` 切换统一走 `slide-left`（前进，新图从右滑入）/ `slide-right`（后退，新图从左滑入）；自动轮播（5s）也设置 `slideDir='left'` 走滑动切换；滑动后 1000ms 冷却期内暂停自动轮播。`.slide-*` 规则定义在 `HeroBanner.css` 全局作用域（非移动端媒体查询内），选择器特异性高于 `.is-active` crossfade。**桌面端悬停缩略图预览**由 `handleThumbEnter` 显式清除 `slideDir`（设 null）→ 回退为 crossfade（`heroBgFadeIn`）。**注意**：slide 动画结束后**不**重置 `slideDir`（保持方向类），否则 `.is-active` 层会回退匹配默认 crossfade 规则、因 `animation-name` 改变重新播放淡入，导致「闪一下、短暂出现上一张图片」。
- **高度**：`min-height: var(--layout-hero-banner-min-h)` + `max-height: min(70vh, var(--layout-hero-banner-max-h))`（vh + vw 双上限，防止超宽屏溢出）
- **预加载**：自动轮播时预加载下一张背景图（w1280）+ 缩略图窗口前后各 2 张（w500）
- **bannerReady**：仅 items 从空变为有时重置，**切换分类（items 已有数据再变化）时务必保持 `true`、绝不可重置为骨架**——否则缩略图会走「真实图→骨架→真实图」硬切换 = "闪一下"（这是历史回归点，已修复）。切换时由 `HeroThumb` 自带的「预加载完成再换图」机制在新/旧海报间平滑交叉淡入（旧图持续显示直到新图就绪）；主图背景层 `key={item.id}`（非下标），新类目首项 id 不同 → 新建 `<img>`、旧图随旧层卸载，不滞留旧图。
- **无障碍**：`prefers-reduced-motion: reduce` 时禁用所有动画

### Toast 系统

`src/components/ui/toastBus.ts` + `Toast.tsx`：
- `toast.show(opts)` — 入队，排队等待（前一个 toast 超时后才显示下一个）
- `toast.replace(opts)` — 清空队列立即显示新 toast（快速连续提示场景，如版本号连续点击）
- ToastProvider 只渲染 `items[0]`（队列首项），`ToastContainer` 因 `item.id` 变化触发 useEffect 重跑

### IPTV 直播播放独立逻辑

`UniversalPlayer`（`src/components/UniversalPlayer/`）在 `mode === 'iptv'`（`IPTVPlayer` 调用）下走**独立播放逻辑**，与点播（`mode === 'video'`）区分，**不要复用点播的播放/提示交互**：
- **自动播放**：`usePlayerCore.handleCanPlay` 在 `autoPlay=true` 且流可播放时直接 `video.play()`，加载即播；被浏览器拦截（多因带声音且无用户手势）时静音兜底重试一次，避免黑屏与中间播放按钮。
- **无中间播放按钮**：中间暂停遮罩 `.up-player-paused-overlay` 仅在 `mode !== 'iptv'` 时渲染，IPTV 直播不显示大播放按钮（点播保留，供用户点击开始）。
- **右上角无点播提示**：`ToastTrigger`（`.up-player-toast`）在 `mode === 'iptv'` 时直接跳过 store 订阅，右上角**不显示任何**点播类操作提示（音量 / 切换线路 / 播放暂停 / 倍速 / 循环 / 画中画 / 镜像 / 比例 / 解码）。IPTV 的提示由其自身独立逻辑负责。
- **键盘快捷键跳过**：`useKeyboardShortcuts` 在 `mode === 'iptv'` 时移除空格键的播放/暂停（直播无暂停语义），仅保留音量/全屏/静音/Escape。
- **遥控器跳过**：`useTVInput` 在 `mode === 'iptv'` 时遥控器播放/暂停键不触发 `togglePlay`。

### Browse 懒加载

- 哨兵节点 `<div ref={sentinelRef}>` **无条件渲染**（不用 searchMode 条件包裹），跨状态持久
- 整页 loading 仅在首屏无数据时显示：`initialLoading = isLoading && results.length === 0`，与 `loading` 布尔区分
- 避免加载更多时卸载网格导致滚动跳顶
- **双卡片结构**：Card 1（搜索区：搜索 tabs + FilterBar，`hideFooter` 隐藏排序 footer）+ Card 2（结果区：排序栏 + SourceStatusIndicator + 结果网格 + 懒加载哨兵）
- **筛选切换清空搜索词**：切换 FilterBar 筛选/排序时清空 `query`，让 discover 接管（`useBrowseData` 的 `filterSig` effect 在有 `urlQ` 时跳过 fetch）
- **TMDB search reset**：`search()` 和 `fetchDiscover()` 在 `forceReset=true` 时立即清空旧结果，UI 才能显示 loading 而非停留在旧数据上
- **合并结果排序**：`mediaType=all` 合并 movie + tv 后按用户选择的 `sortBy`/`sortOrder` 重排（评分相同时按投票数降序兜底）

### 搜索词传递（Keep-Alive 兼容）

- 顶部导航 SearchBox: `navigate('/browse', { state: { q } })`
- Browse 页: `useState` 初始化读 `location.state.q` + `useEffect` 监听 `location.state.q` 变化同步 query（Keep-Alive 二次进入）
- **POP 导航清空**：刷新/直接访问/后退时（`navigationType === 'POP'`）不读 `location.state.q`、不触发搜索 — `createBrowserRouter` 下 `window.history.state` 在刷新后被浏览器保留，会导致顶部 SearchBox 残留上次搜索词
- SearchBox: `lastSearchedRef` 在 `location.pathname` 变化时重置（解除相同搜索词的导航阻止）

### 工具类与 Tokens

- **`.no-interaction-visual`**：移除 hover/active/focus 视觉反馈的工具类，用于 logo、品牌名等不需要交互反馈的元素（`index.css`）
- **Logo tokens**：流式尺寸变量（`variables.css`）—— `--layout-logo-size`（48→64px）、`--layout-logo-size-sm`（40→52px）、`--layout-logo-size-lg`（56→72px）；`--layout-brand-font-size`（20→24px）、`--layout-brand-font-size-sm`（16→20px）、`--layout-brand-font-size-lg`（24→28px）。Sidebar 和 StickyHeader 的 logo 统一使用这些 token

### 页面进入过渡统一约定

- **共享工具类 `.page-transition-enter`**：定义在 `src/assets/styles/animations.css` 的 `@keyframes page-enter-fade`（淡入 + `translateY(8px)→0`，`0.28s var(--ease-out-expo) both`），已含 `prefers-reduced-motion: reduce` 守卫。**所有缺少进入动画的页面根容器都应加该类**：Detail / Person / SourceChecker / RecordShell（收藏·历史）。Browse（`.browse-page`）、IPTV（`.iptv-content`）、Settings（`.settings-page`）已有各自进入动画，勿重复加。**特例 — 首页**：`.home-page` 内嵌的 HeroBanner 自带 background crossfade + 缩略图揭示，且其缩略图/背景层是 `will-change`/`z-index` 的 **GPU 合成层**；若祖先（`.home-page` 根）带 `page-enter-fade` 的 `transform` 动画，会触发这些合成层重绘**闪烁（"闪一下"）**。因此首页的 `.page-transition-enter` **刻意落在仅包裹非 Hero 内容的 `.home-page__content` 包装层**（HeroBanner 作为其兄弟节点，祖先不再有 transform 动画），既保留进入淡入上移动画，又消除缩略图闪烁；HeroBanner 在 Keep-Alive 二次进入时保持静止（顺带规避其"上一张图闪现"的已知问题）。
- **Keep-Alive 二次进入过渡（已支持重放）**：AppLayout 用 CSS `display` 切换可见性。由于元素本身保持挂载、仅祖先容器在 `display:none ↔ contents` 间切换、元素自身的 `display` 从未变化，浏览器**不会自动重放**根容器 CSS animation。为此 AppLayout 内置 `useLayoutEffect`：每当 `activeRouteKey` 变化（含二次进入），对激活路由内**带 `.page-transition-enter`** 的根容器执行「移除类 → 强制同步 reflow → 重新添加类」，可靠地重放进入动画。该机制为 **opt-in**：仅作用于显式带 `.page-transition-enter` 的页面根（如首页 `.home-page`），其余页面（Browse/IPTV/Settings 用各自进入动画）不受影响；`prefers-reduced-motion` 下 `page-transition-enter` 已禁用动画，重放无可见效果。二次进入**不再使用 View Transitions API**——整页快照在常驻多页 DOM 下开销过大（移动端尤其明显），与 Keep-Alive 的瞬时切换目标冲突，已彻底移除（`RouteTransition.css` / `RouteTransition.tsx` 删除，所有 `navigate(..., { viewTransition: true })` 改为 `navigate(...)`）。新增导航入口时**不要**再加 `viewTransition: true`。
- **首页「类目切换」过渡（图片参与、无闪跳）**：切换首页/其他分类时，整页内容（`.home-page__content` 内的行海报 + 快捷分类）由 `Home/index.tsx` 在 `deferredCategory` 变化时重放 **`.home-cat-fade`**（`opacity 0→1`，`0.28s`，与 `page-transition-enter` 对齐，动画结束移除类、首挂载跳过以免与路由进入动画叠加）。**关键约束：该过渡只用 `opacity`、绝不含 `transform`**——对 HeroBanner 的 GPU 合成缩略图层用 `transform` 会触发重绘闪烁（即"闪一下"），故刻意避开；HeroBanner 自身的缩略图交叉淡入（`HeroThumb`）与主图 `key=item.id` 已让其图片参与过渡，无需外部 transform。不要给 `.home-page` 或任何 HeroBanner 祖先加 `transform` 类动画。

**导航 API 强约束**：所有业务导航一律使用 `src/lib/navigation.ts` 的 `useCustomNavigate()`，禁止直接 `import { useNavigate } from 'react-router-dom'`（已由 ESLint `no-restricted-imports` 封死，仅 `src/lib/navigation.ts` 豁免）。`useCustomNavigate` 的 options 类型 `CustomNavigateOptions` 已从 `NavigateOptions` 剔除 `viewTransition`，从类型层面彻底杜绝重新启用 View Transitions 导致的移动端切换卡顿。
- **Suspense 兜底**：`AppLayout` 的 `LoadingFallback` 也已加 `.page-transition-enter`，冷加载时不再生硬弹出。

### .gitignore 策略

- `docs/*` + `!docs/page-diagrams/` — 仅提交原理图目录，docs/ 其余忽略
- `scripts/*.ts` + `!scripts/*.spec.ts` — 仅保留 E2E 测试脚本
- `scripts/*.mjs` + `!scripts/fetch-diagram-data.mjs` — 仅保留数据获取脚本，工具脚本不提交
- AI 工具本地配置（.workbuddy/ .claude/ .opencode/ .codegraph/ 等）全部忽略
- AGENTS.md / CLAUDE.md / .cursorrules / .github/copilot-instructions.md — **提交**（团队共享）

## 测试依赖映射（精准跑测试，不要全量跑）

> 修改源文件后，只跑对应列的测试文件。共享组件变更才会影响多个测试文件。

### 页面代码 → 测试文件（1:1）

| 修改的源文件 | 跑这个测试 | test 数 |
|-------------|-----------|---------|
| `src/pages/Home/` | `scripts/home.spec.ts` | 15 |
| `src/pages/Browse/` | `scripts/browse.spec.ts` | 19 |
| `src/pages/Detail/` | `scripts/detail.spec.ts` | 15 |
| `src/pages/Player/` | `scripts/player.spec.ts` | 35 |
| `src/pages/IPTV/` | `scripts/iptv.spec.ts` | 20 |
| `src/pages/Settings/` | `scripts/settings.spec.ts` | 21 |
| `src/pages/Collections/` | `scripts/collections.spec.ts` | 20 |
| `src/pages/History/` | `scripts/history.spec.ts` | 20 |
| `src/pages/SourceChecker/` | `scripts/source-checker.spec.ts` | 21 |

### 共享组件 → 测试文件（1:N）

| 修改的源文件 | 影响的测试文件 | 合计 test 数 |
|-------------|--------------|-------------|
| `src/components/UniversalPlayer/` | player + iptv-player | 49 |
| `src/components/VideoCard/` | home + browse + detail + collections + history | 87 |
| `src/components/SearchBox/` | browse + search-features | 34 |
| `src/components/RecordShell/` | collections + history | 39 |
| `src/components/StatusTabs/` | collections + history | 39 |
| `src/components/FilterBar/` | browse | 18 |
| `src/components/HeroBanner/` | home + cross-page | ~25 |
| `src/components/Layout/` | mobile-web-sidebar + 全部页面加载测试 | ~100+ |
| `src/components/StickyHeader/` | 全部页面加载测试 | ~100+ |
| `src/components/ui/Toast.tsx` / `toastBus.ts` | settings (版本号点击) | 21 |
| `src/services/tmdbService.ts` | home + browse + detail + person | ~63 |
| `src/services/videoService.ts` | browse + player + source-checker | 74 |
| `src/services/iptvService.ts` | iptv + iptv-player | 34 |
| `src/stores/useTMDBStore.ts` | home + browse + detail | ~48 |
| `src/stores/useSettingsStore.ts` | settings + source-checker | 42 |
| `src/stores/useUserStore.ts` | collections + history | 39 |

### 快速跑法

```bash
# 单个页面（最常见）
npx playwright test scripts/player.spec.ts

# 共享组件（如 VideoCard）
npx playwright test scripts/home.spec.ts scripts/browse.spec.ts scripts/detail.spec.ts scripts/collections.spec.ts scripts/history.spec.ts

# 全量（仅 CI 或发版前）
npx playwright test
```

### 判断规则

```
IF 只改了 src/pages/Xxx/ 目录下的文件
THEN 只跑该页面对应的 1 个 spec 文件

IF 改了 src/components/ 下的共享组件
THEN 按上表跑所有受影响的 spec 文件

IF 改了 src/services/ 或 src/stores/ 下的文件
THEN 按上表跑所有受影响的 spec 文件

IF 改了多个目录
THEN 取所有受影响 spec 文件的并集（去重）
```

## 文档同步协议（AI Agent 必读）

> 完成代码变更后，逐项检查以下规则。满足条件的必须同步更新，不得跳过。

### 规则 1：测试脚本 — 与代码同提交

```
IF 你修改了 CSS 类名 / DOM 结构 / 选择器
THEN 同一次 commit 中更新 scripts/*.spec.ts 对应的选择器

IF 你新增了用户交互流程（新按钮、新 Tab、新模式）
THEN 新增对应的 E2E 测试用例

IF 你删除了某个 UI 区块（如 suggestions）
THEN 删除或重写依赖该区块的测试用例
```

**位置**: `scripts/*.spec.ts`
**时机**: 必须与代码变更在同一个 commit 中

### 规则 2：记忆库 — 做完就写

```
IF 你完成了实质性工作（修 bug、加功能、重构、技术选型）
THEN 在 .workbuddy/memory/YYYY-MM-DD.md 追加一条记录

IF 你确立了项目级约定或可复用模式
THEN 追加到 .workbuddy/memory/MEMORY.md
```

**位置**: `.workbuddy/memory/YYYY-MM-DD.md`（日志）+ `.workbuddy/memory/MEMORY.md`（长期）
**时机**: 每次工作会话结束时
**内容**: 做了什么 + 为什么这么做 + 踩了什么坑（不要写"搜索了XX文件"这种过程噪音）

### 规则 3：知识库 — 架构变了才动

```
IF 新增了 Store / Service / 核心组件 / 页面路由 / 代理配置
THEN 更新 AGENTS.md 对应章节 + CONTEXT.md（如涉及新术语）

IF .gitignore 策略变化
THEN 更新 AGENTS.md ".gitignore 策略"章节
```

**位置**: `AGENTS.md`（综合）+ `CONTEXT.md`（术语）
**时机**: 架构变更时
**不更新**: Store 内部逻辑修改、组件 props 调整、CSS 微调

### 规则 4：页面原理图 — 布局结构变了才动

```
IF 页面布局结构变化（新增/删除区域、核心组件替换）
THEN 更新 docs/page-diagrams/<page>.html

IF 新增交互模式（如 toast.replace、懒加载策略变化）
THEN 在对应原理图的"交互"或"数据流"区追加说明

IF 新增页面
THEN 创建 docs/page-diagrams/<page>.html + 更新 index.html 索引
```

**位置**: `docs/page-diagrams/*.html`
**时机**: 页面结构变更时
**不更新**: 颜色、间距、内部逻辑优化

### 规则 5：流程图 — 导航/架构变了才动

```
IF 新增/删除页面（导航地图变）
THEN 更新 flowchart.html 的"页面导航地图"SVG

IF Store/Service 层新增/删除
THEN 更新 flowchart.html 的"数据流架构"SVG

IF 代理配置变化
THEN 更新 flowchart.html + AGENTS.md 代理表
```

**位置**: `docs/page-diagrams/flowchart.html`
**时机**: 导航或架构变更时
**不更新**: 页面内部变化、内部重构

### 快速判断表

| 变更类型 | 测试 | 记忆 | 知识库 | 原理图 | 流程图 |
|---------|------|------|--------|--------|--------|
| CSS bug 修复 | — | 日志 | — | — | — |
| 类名/选择器变更 | ✅ 同提交 | 日志 | — | — | — |
| 新增页面 | ✅ | 日志+长期 | ✅ | ✅ 新建 | ✅ |
| 新增核心组件 | ✅ | 日志+长期 | ✅ | ✅ 受影响页 | — |
| 架构分层变化 | ✅ | 日志+长期 | ✅ | ✅ | ✅ |
| 代理配置变化 | — | 长期 | ✅ | ✅ | ✅ |
| .gitignore 策略 | — | 长期 | ✅ | — | — |
| 新增领域术语 | — | — | ✅ | — | — |
| 内部重构（不改外部接口） | ✅ | 日志 | — | — | — |

---

## 协同开发与知识库维护

> 多人协作时，AI 辅助工具（Cursor / Claude / Copilot 等）会在每位开发者机器上各自维护一份**本地记忆**。本节规定「哪些文件必须一致、哪些允许不同、冲突怎么办」，避免同事之间因本地文件不一致而踩坑。

### 两类文件的定位

| 类别 | 文件 | 是否提交 | 协同策略 |
|------|------|---------|---------|
| **共享知识库（唯一事实源）** | `AGENTS.md` `CLAUDE.md` `.cursorrules` `.github/copilot-instructions.md` `CONTEXT.md` `docs/page-diagrams/` `docs/KNOWLEDGE.md` | ✅ 提交（团队共享） | 全队一致，靠 git + PR review 同步 |
| **本地 AI 记忆（个人上下文缓存）** | `.workbuddy/memory/` `~/.workbuddy/MEMORY.md` 云端 profile | ❌ 不提交（已被 `.gitignore` 忽略） | 每位开发者独立、天然允许不同，无需统一 |

### 核心原则

1. **共享知识库是唯一事实源**：所有架构 / 约定以提交进仓库的 `AGENTS.md` 等为准，而非某个人机器上的本地记忆。
2. **本地记忆只是补充、允许不同**：`.workbuddy/` 不进仓库，每位同事的 AI 各自积累，过期也无妨；但它**不得在与提交文档冲突时喧宾夺主**。
3. **冲突时以提交的文档为准**：若某同事本地记忆记的旧结论与最新 `AGENTS.md` / `KNOWLEDGE.md` 不一致，AI 应优先读提交文档（见下条）。
4. **聊天约定的「提升」规则**：任何非显然的约定（布局断点、命名、技术选型），必须落进 `AGENTS.md` / 原理图 / `KNOWLEDGE.md` 的 ADR 才算「团队共享」；只留在某人本地记忆里等于没共享。
5. **知识库变更走 PR + review**：改 `AGENTS.md` 等同改代码，小步提交，避免多人同时大改导致合并冲突（它本就是代码级文档）。

### AI 行为约束（本文件的意图）

- 当本地记忆与提交的 `AGENTS.md` / `KNOWLEDGE.md` 冲突时，**信提交文档**。
- 完成实质性工作后，按上方「文档同步协议」更新对应文档；同时可在本地 `.workbuddy/memory/` 记日志（不提交、无妨）。

### 新同事 onboarding

1. `git clone` → 自动获得 `AGENTS.md` + 原理图 + `KNOWLEDGE.md`
2. 其 AI 工具读取这些文件 → 立刻了解架构与约定
3. 本地 `.workbuddy/memory/` 在前几次对话中自动积累，不影响上手

### 相关文件

- 人类协作流程与提交规范：`CONTRIBUTING.md`
- 架构决策留痕（ADR 模板与示例）：`docs/KNOWLEDGE.md` → 「架构决策记录（ADR）」

---

## 人机协作约定（UI / 观感类任务必读）

> 历史教训：多次对话陷入「纯文字诊断 → 猜意图 → 改 CSS → 不符合预期」的循环。
> 用户看不到代码，只能看到我的文字描述，导致反复返工。以下约定旨在把「猜疑」环节
> 前置、压缩到最低成本，让每次改动可验证、可对照。

### 1. 观感类问题 → 先做可预览的视觉 Demo，再落代码
- 动画 / 过渡 / 布局 / 折叠展开等**纯观感**问题，不要只写文字描述。
- 优先产出一个**可运行的 HTML 对比 Demo**（A = 当前逻辑 / B = 新逻辑），用浏览器
  `preview_url` 预览给用户看，由其判断「对味不对味」，再落到项目代码。
- 适合资源：本仓库 `docs/page-diagrams/` 同级可放临时 demo；或直接用 `image_gen` /
  截图对照。

### 2. 每次逻辑改动 → 必附「旧逻辑 ↔ 新逻辑」对照块
固定格式，用户一眼核对是否对齐预期：
```
【问题】一句话描述现象
【旧逻辑】当前实现 + 为什么会有问题（引用具体代码/文件:行）
【新逻辑】改成什么 + 解决点
【预览】preview_url(...) 或 截图
```
不为描述而描述；对照块是强制产出，不是可选说明。

### 3. 需求有歧义 → 先给 2 个候选 Demo，而非直接改
- 接到 UI 诉求时，若实现方向不唯一，**先反问**「你想要的效果更接近 A 还是 B？」，
  并立刻做一个最小 Demo 让用户选，确认后再改真代码。
- 避免凭猜测直接改、改完才发现方向错、白改 n 次。

### 4. 参照物优先
- 用户描述 UI 诉求时，**优先提供参照**：截图 / 录屏 / 某个网站链接 / 手绘。
- 若用户给了参照，以参照为唯一验收标准，不自行发挥。
- 若用户没给参照且描述模糊，按第 3 条先出候选 Demo。

### 5. 意图复述 + 快速 Mock 确认
- 收到需求后，先用一句话**区分「表面诉求」与「实际目的」**复述意图；
- 给一个 30 秒能看的 Mock，用户确认「对，就是这个」后再实现，把猜疑成本压到最低。

### 适用边界
- 纯逻辑 / 数据 / 性能类改动（无视觉效果）仍以代码 + 对照块为主，不强制 Demo。
- 紧急修复可先改后补 Demo，但需在回复中说明「已先修、Demo 待补」。

### 6. 改动留痕：写入 `changelogs/`（每次改动必更新）
- 详细机制见 `changelogs/README.md`。核心：
  - **每日一文件** `changelogs/YYYY-MM-DD.md`，同日多次改动追加到同一文件。
  - **每次改动（无论大小）完成即追加一条记录**：问题 / 旧逻辑 / 新逻辑 / 涉及文件 / 关联 Demo / 构建结果。
  - **Demo 永久留存**，统一放在 `changelogs/demos/`，**不得删除**；观感类改动必须有可预览 Demo。
  - 新增 Demo 时同步登记到 `changelogs/README.md` 的「Demo 索引」表。

---

## 版本号管理（Versioning）

> 版本号唯一可信源 = `package.json` 的 `version` 字段，由 release-please 依据 Conventional Commits 自动维护，**禁止手工乱改**。

### 1. 版本号规则（SemVer + 通道）

- 格式：`MAJOR.MINOR.PATCH[-预发布通道]`，例如 `0.1.0`、`1.2.3-beta.1`。
- **MAJOR（X）**：破坏性变更 / 里程碑。
- **MINOR（Y）**：新增可见功能（0.x 阶段破坏性变更也升 MINOR，因 API 尚未稳定）。
- **PATCH（Z）**：修复 / 样式 / 重构（无行为变化）。
- 预发布通道：`-alpha.N` / `-beta.N` / `-rc.N`；正式发布时去掉通道。
- 当前阶段为 `0.x`（未稳定）；首个稳定版定为 `1.0.0`（功能闭环、移动端方案落地、E2E 稳定时再升）。

### 2. 自动版本（release-please）

- 配置：`.release-please-config.json`、`.release-please-manifest.json`（记录最近发布版，当前 `1.0.0`）。
- 工作流：`.github/workflows/release-please.yml`（监听 `master` 推送，已声明 `permissions: { contents: write, pull-requests: write }`）→ 自动开版 PR、更新 `package.json`/`CHANGELOG.md`、打 `vX.Y.Z` tag、生成 GitHub Release。
- 提交信息遵循 Conventional Commits：`feat:` 升 MINOR/PATCH、`fix:` 升 PATCH、`BREAKING CHANGE`/`feat!` 升 MINOR（0.x 阶段）。
- **首次发布实测为 `1.0.0`**（release-please 对首个 release 默认产出 `1.0.0`，而非 `0.1.0`）；后续按 SemVer 规则递增。
- ⚠️ **前置条件（让 release-please 能创建 PR，二选一）**：
  1. **首选（管理员，已实测可用）**：仓库 **Settings → Actions → General** 勾选 **「Allow GitHub Actions to create and approve pull requests」**，并将「Workflow permissions」设为 **Read and write permissions**。2026-07-31 实测：开启后默认 `GITHUB_TOKEN` 即可直接开版 PR（PR #1 / 1.1.0 成功创建，整条链路跑通）。
  2. **兜底（无 admin / 无法改仓库设置时）**：在仓库 **Settings → Secrets and variables → Actions → Repository secrets** 新增 `RELEASE_PLEASE_TOKEN`，值为一个带 `repo`（含 `public_repo`/`repo:status`/`read:org` 等足够权限）范围的 Personal Access Token；工作流已配置 `token: ${{ secrets.RELEASE_PLEASE_TOKEN || github.token }}` 自动优先使用它。该复选框只限制默认 `GITHUB_TOKEN`，用 PAT 可绕过。
  - 若两者都未满足，Action 会在开版 PR 步骤报 `GitHub Actions is not permitted to create or approve pull requests` 而失败（此时版本号已算好、CHANGELOG 已生成，仅缺 PR/tag/Release）。

- **本地兜底（无 admin / 无法配置 Secrets 时）**：用自己账号的 PAT（GitHub 账号 Settings → Developer settings → PAT，勾 `repo`）在本地跑，不依赖仓库 Secrets，也不受「禁止 Actions 创建 PR」限制。PAT 是**个人账号**创建（任何成员都能建），与仓库 admin 无关：
  ```powershell
  $env:GITHUB_TOKEN = "ghp_你的PAT"
  # 开版 PR（走 PAT，绕过仓库权限限制）
  npx release-please release-pr --repo-url ntc0728/video-warehouse
  # 在 GitHub 合并该 PR 后，生成本对应的 GitHub Release + tag
  npx release-please github-release --repo-url ntc0728/video-warehouse
  ```
  - 注意：因 `package.json`/CHANGELOG/manifest 已是某一版本，release-please 不会重复算版，而是把这次当作「完成该版本发布」；若它判定已发布而未生成 GitHub Release，可直接基于现有 `vX.Y.Z` tag 在 GitHub 手动建 Release，内容用 `CHANGELOG.md` 对应段落即可。
  - 陈旧分支 `release-please--branches--master` 若残留，先 `git push origin --delete release-please--branches--master` 再重跑，避免重开过期 PR。

### 3. 双端版本同步（Capacitor Android）

- 脚本 `scripts/sync-capacitor-version.mjs` 在 `build:android` 时从 `package.json` 读 SemVer，写入 `capacitor.config.ts` 的 `version`（含通道）并派生 `android.versionCode`。
- **versionCode 公式**：`major*100000 + minor*1000 + patch*10 + 通道序`（release=3 / rc=2 / beta=1 / alpha=0），保证 `rc < 正式`、跨版本严格递增，且要求 `patch < 100`。
- 独立命令：`npm run sync:capacitor-version`。

### 4. 应用内展示

- 设置页「关于」标签（`src/pages/Settings/tabs/AboutTab.tsx`）从 `package.json` 动态读取版本号，并显示 `平台 · 通道`（Web/Android × 正式版/开发版，靠 `import.meta.env.CAPACITOR` / `DEV` 判断）。
- 「更新日志」入口（`ChangelogContent.tsx`）渲染仓库根 `CHANGELOG.md`（release-please 自动维护）。
- 架构决策见 `docs/KNOWLEDGE.md` ADR-004；改动留痕见 `changelogs/`。

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

| Store                 | Service                  | 外部数据源                                  | 代理          |
| --------------------- | ------------------------ | -------------------------------------- | ----------- |
| useTMDBStore          | tmdbService              | TMDB API v3 (api.tmdb.org/3)           | 直连 (CORS)   |
| useSettingsStore      | sourceService            | video-sources.json / iptv-sources.json | 本地文件        |
| useUserStore          | database (idb)           | IndexedDB                              | 本地存储        |
| useIPTVStore          | iptvService + epgService | M3U 播放列表 + XMLTV EPG                   | Video Proxy |
| usePlayerStore        | videoService             | CMS 采集站 API                            | Video Proxy |
| useSourceManagerStore | sourceService            | 视频/IP/EPG 三源统一管理（启用+顺序+聚合 URL 回写）      | 本地文件        |
| useNavStore           | —                        | 页面导航状态                                 | 内存          |

## 代理配置

| 代理                 | URL 模式                                                         | 用途                             |
| ------------------ | -------------------------------------------------------------- | ------------------------------ |
| Video Proxy (CORS) | `https://your-video-proxy.example.com/proxy?url={encoded}`     | CMS API 请求、M3U 文件获取、EPG XML 获取 |
| IPTV Proxy (M3U8)  | `https://your-iptv-proxy.example.com/m3u8-proxy?url={encoded}` | IPTV 直播流代理（重写内部 URL）           |
| TS Proxy           | `https://your-iptv-proxy.example.com/ts-proxy?url={encoded}`   | TS 分片代理                        |

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

| 模式          | 命令                                              | Token 风险 |
| ----------- | ----------------------------------------------- | -------- |
| Mock 模式（默认） | `npx playwright test`                           | 无        |
| 真实 API 模式   | `TMDB_MOCK=false npx playwright test`           | 有        |
| 增量测试        | `.\scripts\run-tests.ps1`（mock）/ `-RealApi`（真实） | 按模式      |

Mock 覆盖：trending / search / discover / movie detail / tv detail / person / genres / images。

> **⚠️ 播放页沙箱 mock（2026-09-01）**：`scripts/player.spec.ts` 改从 `scripts/fixtures/cms-mock.ts` 引入  
> `test`（它内部 `extend` 自 `mock-tmdb`）。`cms-mock` 在 TMDB 拦截之外再叠加两条规则：
>
> 1. 拦截 CMS 搜索请求（`ac=videolist`，**注意经 CORS 代理包装后会被编码成 `ac%3Dvideolist`**，两者都要匹配）  
>    返回固定 `CMSListResponse`（`vod_play_url` 指向本地 `cms-mock.local` 的 HLS 流），使播放器可靠挂载 `.up-universal-player`。
> 2. 拦截 `cms-mock.local` 的 m3u8/ts，从 `scripts/fixtures/hls/stream/`（ffmpeg 生成的本地 HLS）直接 fulfill，hls.js 可完整初始化。  
>    这样播放页测试不再依赖沙箱不可达的 CORS 代理 / CMS 源，消除 M04/M09/M12/M15 等移动端 flake。

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


### Android 原生代码（DLNA 投屏 / 启动屏补丁）

`android/` 整目录被 gitignore，CI 靠 `cap add android` + `cap sync android` 重建。因此原生代码/资源的**唯一源**放在 `scripts/` 下，由构建脚本在 cap sync 后复制进 android/：

- `scripts/android-res-patch/` — res 资源补丁（values/values-night/values-v31 启动屏 + colors.xml），`build-android.ps1` 复制到 `android/app/src/main/res/`
- `scripts/android-dlna-patch/java/` — DLNA 投屏原生 Java 源码（`MainActivity.java` + `cast/` 包），由幂等脚本 `scripts/patch-android-dlna.ps1` 复制到 `android/app/src/main/java/` 并合并 Manifest 权限

投屏链路：前端 `castService.ts` 定义 `window.CastBridge` 契约（`CastDevice`/`CastBridge`）→ `MainActivity` 注册 `CastBridgePlugin`（Capacitor 6 原生插件，`@PluginMethod` 注解）+ `onPageLoaded` 注入 shim 代理到 `Capacitor.Plugins.CastBridge` → `SSDPDiscovery`（MulticastSocket + MulticastLock + M-SEARCH，3s 预算）发现 DLNA 设备 → `UPnPAVTransport`（SOAP SetAVTransportURI + 自动 Play/Play/Pause/Stop/Seek/SetVolume）推送。新增/修改 Android 原生代码必须同步 `scripts/android-dlna-patch/` 与 `scripts/patch-android-dlna.ps1`，不得直接改 android/（会被重建覆盖）。**PS5.1 下含中文的 .ps1 必须带 UTF-8 BOM**（无 BOM 按 GBK 解码会 parse error）。iOS 端尚未实现同名桥，`getCastBridge()` 返回 null → 投屏空态。

**投屏权限流程（2026-08-19）**：`CastBridge` 契约含 `ensurePermission(): Promise<'granted'|'denied'>` + `openAppSettings(): Promise<void>`。`CastSheet` native 打开时先 `ensureCastPermission()`（`castService.ts`；桥未实现返回 `'unsupported'` → 按旧流程继续，向后兼容老 App/测试 mock），`denied` → 显示🔒「需要投屏权限」+「去设置授权」按钮（调 `openAppSettings` 跳系统应用设置页）；`granted` → 正常发现。原生侧：`CastBridgePlugin.ensurePermission` 在 API 33+ 检查/请求 `NEARBY_WIFI_DEVICES`（`@PermissionCallback` 回调；老系统直接 granted），`openAppSettings` 走 `Settings.ACTION_APPLICATION_DETAILS_SETTINGS`。`patch-android-dlna.ps1` 会合并 `NEARBY_WIFI_DEVICES` 权限。注意 Capacitor 6 `PermissionState` 是独立枚举（`com.getcapacitor.PermissionState`），需显式 import。Web Cast（Google Cast）不走权限前置——系统设备选择器自带授权。

**后台听视频链路（2026-08-31）**：三级实现，`usePlayerStore.backgroundPlay` 开关驱动。**P1（全平台）**：`useMediaSession.ts`（`UniversalPlayer/hooks/`）集成 `navigator.mediaSession` ——锁屏媒体卡片（标题/副标题/进度）+ 媒体键 play/pause/seek±10s/上一集·下一集；`usePlayerCore` 经新增 `mediaSession` option 接入，`UniversalPlayer` 用 `useMemo` 构造 info（点播=title+episodeLabel，IPTV=channelName）+ `streamUrl` + `onPrev/onNext` 接线。开关关闭时不注册元数据（锁屏无卡片）。**P2（iOS Safari）**：`backgroundAudioService.ts` 的 `getIOSBackgroundAudioCapability()` 返回 `'supported'`（iOS 17+ `ManagedMediaSource` 可用，`HLSAdapter` 已配 `preferManagedMediaSource:true` → 后台续播由浏览器保证）/`'unsupported'`（旧 iOS 切后台必停，前端无法绕过）/`'irrelevant'`（非 iOS 或 Android App 端）；`MobileMoreSheet` 开关 onChange 在 `unsupported` 时提示「建议升级 iOS 17+」。**P3（Android App）**：`backgroundAudioService.ts` 定义 `window.MediaBridge` 契约（`MediaBridge`：start/play/pause/stop/seek/getState）+ `getMediaBridge()` + `isNativeMediaServiceSupported()`；`useMediaSession` 监听 `visibilitychange`，切后台时 `bridge.start({url, title, artist})` → `seek(pos)` → `play()` 接管音频、暂停 WebView video（省电 + 避免双音轨），切回前台 `bridge.stop()` 并恢复 video 播放；Web/iOS 无桥跳过、P1 兜底。原生侧（与 CastBridge 同体系，唯一源在 `scripts/android-dlna-patch/`）：`MainActivity` 注册 `MediaBridgePlugin`（Capacitor 6 插件，`@PluginMethod` 驱动 `start/play/pause/stop/seek/getState`）+ `injectMediaBridgeShim` 注入 `window.MediaBridge` 代理到 `Capacitor.Plugins.MediaBridge` → `MediaService`（前台 Service + `MediaPlayer` 独立解码 + `MediaSessionCompat` 锁屏控制 + `NotificationCompat`+`MediaStyle` 前台通知，API 22–34 兼容；API 34 用 `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`）。`patch-android-dlna.ps1` 追加 `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` 权限 + 声明 `MediaService`（`foregroundServiceType=specialUse` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`）。新增/修改 Android 原生媒体代码同样必须同步 `scripts/android-dlna-patch/` 与 `scripts/patch-android-dlna.ps1`，不得直接改 android/。


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

- 顶部导航 `StickyHeader` 承载全局导航；桌面 web / TV **已无左侧栏**（旧 `HomeSidebar` 于 2026-08-29 删除）：桌面经顶栏补充 IPTV + 设置入口（`StickyHeader` 的 `EXTRA_NAV_ITEMS` / `SETTINGS_NAV_ITEM` 在 `!isMobile` 时渲染），移动 web / app 经抽屉侧栏 / 底部 TabBar。`--sidebar-width*` token 仍保留供移动端 `Sidebar.tsx` 使用。
- 首页 `HeroBanner` / `CategoryQuickAccess` / 每个 `TMDBMovieRow` — `Home.css`（`.home-page` 作用域）
- 浏览页双卡片结构 — `Browse.css`：
  - Card 1（搜索区）：搜索 tabs + FilterBar（`hideFooter` 隐藏排序 footer），`flex-shrink: 0` 防挤压（SearchBox 已移至顶部导航，通过 `usePageSearchStore` 注册回调）
  - Card 2（结果区）：排序栏 + SourceStatusIndicator + 结果网格 + 懒加载哨兵，`flex: 1 1 0` 填充剩余空间
- IPTV 页 `.iptv-top-card`（筛选控制）+ `.iptv-grid-card`（频道网格）— `IPTV.css`
- 人物页 `.person-hero`（资料卡片）+ `.person-grid-card`（Tab+作品网格）— `Person.css`
- 详情页 `detail-hero` — 去掉负 margin，受 page-padding 约束（`Detail.css`）
- 设置页桌面端 `.settings-desktop-card` — TabBar + 内容区放入**同一张大卡片**，section 去卡片化、之间用留白（margin-top + padding-top）分隔，无分割线（`Settings.css`）；移动端子页布局不变

骨架占位扫光速度：全局变量 `var(--card-shimmer-duration)`（默认 `3s`，原 `1.5s`）定义在 `variables.css` 的 `:root`；`LazyImage` / `TMDBMovieRow` 行骨架 / `SkeletonCard` / `SkeletonIPTVCard` 统一引用，调快慢只需改这一处。


### HeroBanner 组件

`src/components/HeroBanner/` — 首页 Hero 横幅轮播：

- **HeroBili 宽屏分支（>1280 桌面专用，TV 不启用）**：`HeroBili.tsx` 左 banner 轮播（前 6 张池）+ 右栏 3×2 竖版卡（banner 池外条目）+「换一换」（只推进 shuffleOffset、与轮播解耦，0.6s 动画锁防抖）。右栏卡 `.hero-side-card` 带 `1px solid var(--color-border-light)` 边框（卡片模块规范）；封面 = `LazyImage`（骨架占位 + 失败走默认品牌兜底 MonitorPlay+kinoTV，与「继续观看」卡同链路），**勿改回裸 `<img>`**。
- **布局**：左侧主背景图（左右滑动切换）+ 右侧缩略图列（absolute 定位覆盖在 banner 边缘）
- **缩略图**：`position: absolute; z-index: 10`，`overflow: hidden` 不影响 banner 圆角；激活态使用 `2px solid var(--color-primary)` 边框 + `var(--color-primary-shadow)` 阴影；点击跳转 detail 页；标题仅激活态显示
- **滑动切换动画（所有客户端）**：`activeIndex` 切换统一走 `slide-left`（前进，新图从右滑入）/ `slide-right`（后退，新图从左滑入）；自动轮播（5s）也设置 `slideDir='left'` 走滑动切换；滑动后 1000ms 冷却期内暂停自动轮播。`.slide-*` 规则定义在 `HeroBanner.css` 全局作用域（非移动端媒体查询内），选择器特异性高于 `.is-active` crossfade。**桌面端悬停缩略图预览**由 `handleThumbEnter` 显式清除 `slideDir`（设 null）→ 回退为 crossfade（`heroBgFadeIn`）。**注意**：slide 动画结束后**不**重置 `slideDir`（保持方向类），否则 `.is-active` 层会回退匹配默认 crossfade 规则、因 `animation-name` 改变重新播放淡入，导致「闪一下、短暂出现上一张图片」。
- **高度**：`min-height: var(--layout-hero-banner-min-h)` + `max-height: min(70vh, var(--layout-hero-banner-max-h))`（vh + vw 双上限，防止超宽屏溢出）
- **预加载**：自动轮播时预加载下一张背景图（w1280）+ 缩略图窗口前后各 2 张（w500）
- **bannerReady**：仅 items 从空变为有时重置，**切换分类（items 已有数据再变化）时务必保持 `true`、绝不可重置为骨架**——否则缩略图会走「真实图→骨架→真实图」硬切换 = "闪一下"（这是历史回归点，已修复）。
- **缩略图列不重挂载（2026-08-13）**：缩略图列**绝不挂 `key={categoryId}`**（曾因分类切换强制整列重挂载 → 「骨架→图」跳变；已移除）。HeroThumb 按 `key={pos}` 复用，item 引用变化走「预加载完成再换图」；换图时旧图快照进 `--prev` 垫底层（DOM 先渲染在下层）、新图 `--switching`（opacity 0）→ onLoad 后类移除 → `transition: opacity 0.3s` 淡入 → 延时清理 effect 移除 prev 层；首帧挂载无切换类 → opacity 1 常显（原行为不变）。
- **主图分类切换过渡（2026-08-13）**：分类切换时主图**不得硬切**（旧图卸载 → 新图加载期间空白 → 蹦出）。实现 = 渲染期派生 + `switchReady` 状态机：
  - 切换帧（items 引用变化）由**渲染期派生**（`itemsChanged = prevItemsRef.current !== displayItems`，ref 在 useLayoutEffect 每 commit 后同步更新）：旧活跃图快照 → `--stale` 滞留层垫底（DOM 底层 opacity 1）+ **新层不渲染**。
  - `useLayoutEffect` 同帧 `setStaleSnapshot`（幂等同值，供过渡期继续垫底）+ `setSwitchReady(false)` + `new Image()` 预加载新首项图（`switchLoadRef` 防快速连点竞态）；就绪（onload/onerror fail-open）→ `switchReady=true` → 新层挂载即 is-active（图片已缓存 → heroBgFadeIn 0.8s 淡入完整播放）。
  - 清理 effect（switchReady 后 1.2s，不依赖动画事件，reduced-motion 同样清理）移除滞留层。
  - **⚠️ 过渡期判断 = `itemsChanged || !switchReady`**：渲染期派生只覆盖切换那一帧，后续过渡帧由 state 维持；**绝不可**用「effect setState 标记过渡」——img 挂载时闭包陈旧 + load 事件早发会永久卡在透明层（首版实现实测踩坑）。
  - **⚠️ 轮播回归教训（2026-08-13）**：主 `useLayoutEffect` 依赖**只允许 `[displayItems]`**——曾误加 `displayIndex`，导致轮播/悬停/拖拽（displayIndex 变化）每次都触发 `setActiveIndex(0)/setBgIndices([0])/setSlideDir(null)`，自动轮播被永久重置回第一张。`prevItemsRef/prevDisplayIdxRef` 的同步移入**独立无副作用** `useLayoutEffect([displayItems, displayIndex])`（只写 refs，声明在主页 effect 之后保证先读旧值）。
- **无障碍**：`prefers-reduced-motion: reduce` 时禁用所有动画

### Toast 系统

`src/components/ui/toastBus.ts` + `Toast.tsx`：

- `toast.show(opts)` — 入队，排队等待（前一个 toast 超时后才显示下一个）
- `toast.replace(opts)` — 清空队列立即显示新 toast（快速连续提示场景，如版本号连续点击）
- ToastProvider 只渲染 `items[0]`（队列首项），`ToastContainer` 因 `item.id` 变化触发 useEffect 重跑


### IPTV 频道台标回退链（三级）

频道卡片/播放器台标按**三级回退链**生成候选 URL 列表，按序尝试，全部失败才走字母占位（`LazyImage` letter / `ChannelLogoCell` / `LogoFallback`）：

1. **一级**：M3U 自带 `tvg-logo`（`channel.logo`，候选链首项）
2. **二级**：EPG XMLTV `<icon>` —— `parseXMLTV` 提取 `<channel>` 子节点 `<icon src>`（`EPGChannelInfo.icon`），经 `matchEPGChannel` 匹配后入链
3. **三级**：在线台标库按规范化名拼 URL —— `https://live.fanmingming.cn/tv/{name}.png`、`https://raw.githubusercontent.com/wanglindl/TVlogo/main/img/{name}.png`

核心实现 `src/services/channelLogo.ts`：

- `toLogoName(name)`：去括号注释（`[蓝光]`）→ 去清晰度标记（高清/HD/超清/标清/极致/极速/流畅/蓝光，**保留 4K/8K**）→ 循环去尾部频道定位词（综合/新闻/文艺/体育/影视/财经/纪录/科教/戏曲/少儿/音乐/国防军事/农业农村/社会与法/频道）→ 去分隔符（空格/连字符/下划线/点号/间隔号），**保留 `+` 号**（`CCTV5+` 不变）；与 EPG 匹配用的 `normalizeName` 不同——不能去掉「卫视」等品牌词
- `resolveChannelLogoCandidates(channel, epgChannels?, proxyUrl?, epgIndex?)`：返回去重候选列表；第 4 参 `epgIndex`（EPG 预索引）存在时 EPG 匹配 O(1) 查表，否则回退全量遍历；**http 台标在 https 部署下会被混合内容拦截**，经主代理 `/file-proxy?url=` 转 https，无代理则丢弃
- session 级 `failedLogoUrls` 失败记忆：已 404/挂起的 URL 不再进入候选链，避免无台标频道（数百张卡片）对在线库重复 404 请求

接入点：`LazyImage` 新增可选 `srcCandidates` prop（`src` 失败后依次尝试，链尽才 error 态，不传时行为与原来完全一致）；`IPTVChannelCard` 用 `resolveChannelLogoCandidates` 结果渲染；IPTV 页复用现有 `fetchAndParseEPG()`（IndexedDB TTL 缓存 + in-flight 合并，**不增加 EPG 请求量**）取 `data.channels` 传给卡片；播放器 `UniversalPlayer` 经 `useEPGData` 的 `epgChannels` 组装候选传入 OSD，侧栏 `ChannelLogoCell` 手动循环候选。新增台标相关测试：`scripts/iptv.spec.ts`（IPTV-080/081 条件式用例，mock 在线库与 EPG 请求）。

**EPG 预索引（性能关键）**：`matchEPGChannel` 原实现每频道全量遍历数千 EPG 频道（数百卡片 × 数千频道 = 百万次 `normalizeName`），EPG 就绪瞬间主线程卡顿。`epgService.ts` 新增 `buildEPGChannelIndex(channels)` 一次性构建（`EPGChannelIndex`：tvg-id / 规范化名 / 原始名三张 Map），`matchEPGChannelIndexed` 精确匹配 O(1)、模糊包含兜底线性（触发率低）；`matchEPGChannel` 内部改走索引（向后兼容），`matchAllChannels` 批量匹配也复用索引。**页面层必须一次性构建索引传给卡片**：IPTV 页 `useMemo` 构建（依赖 `epgChannels`）；收藏/历史页经 `getCachedEPGData()`（**零网络**，仅读 IndexedDB 缓存，无缓存直接跳过）读 `data.channels` 构建后传 `epgIndex` prop——收藏/历史页的 IPTV 卡台标因此受益于 EPG icon 二级回退。


### IPTV 频道列表加载（竞速窗口，防慢源拖尾）

`fetchAndParsePlaylist`（`src/services/iptvService.ts`）原实现 `Promise.allSettled` 等**全部源** settle：单源 15s 超时 × 1 次重试，任一失效源即可拖住整页最长 30s 处于 loading。现改为**竞速窗口** `settleWithWindow(promises, 1500, 20000)`：

- 并行拉取所有源，**首个成功源到达后最多再等 1.5s 收尾**即返回（正常 2~4s 出结果，多源聚合语义保留——其余快源结果一并合并）
- **零成功时等全部 settle 快速失败**（全部源立即报错时 ~1s 返回，不等待上限）；仅当部分源「慢但健康」时由**绝对上限 20s** 兜底
- **⚠️ 上限/单源超时不宜过紧**：曾用 8s 导致经代理响应慢（>8s）但健康的源全部被 abort → 「所有源加载失败/加载不出来」——现单源超时 20s + 不重试（M3U 列表对失效源重试收益极低），慢源不再误杀
- 窗口关闭时**放弃的源不计入 `sourceErrors`**（`PENDING_ABANDONED` 标记区分真实失败与放弃等待），避免「N 个源加载失败」误报

配套 `useIPTVStore.refreshChannels`：**已有频道数据时静默刷新**（`isLoading: channels.length === 0`），旧数据继续展示、不进入全屏 loading；仅首次无缓存时才显示加载态（快路径 ≤ 首成功 + 1.5s）。

**Keep-Alive 下离开页面的后台活动治理**（AppLayout 用 `display` 切换可见性、组件不卸载，unmount 清理永不执行）：

- IPTV 页可用性检测：`useEffect` 监听 `location.pathname`，**路由离开即 `abortAvailabilityCheck()`**（替代不可靠的 unmount 清理）
- `useIPTVAutoRefresh`：仅在 `location.pathname === '/iptv'` 时注册轮询 interval，离开即 clearInterval，回来重建（避免隐藏页后台拉 M3U）
- `/iptv/play` 是顶层独立路由（不走 AppLayout），离开即卸载、播放器实例正常销毁，无泄漏


### IPTV 直播播放独立逻辑

`UniversalPlayer`（`src/components/UniversalPlayer/`）在 `mode === 'iptv'`（`IPTVPlayer` 调用）下走**独立播放逻辑**，与点播（`mode === 'video'`）区分，**不要复用点播的播放/提示交互**：

- **自动播放**：`usePlayerCore.handleCanPlay` 在 `autoPlay=true` 且流可播放时直接 `video.play()`，加载即播；被浏览器拦截（多因带声音且无用户手势）时静音兜底重试一次，避免黑屏与中间播放按钮。
- **无中间播放按钮**：中间暂停遮罩 `.up-player-paused-overlay` 仅在 `mode !== 'iptv'` 时渲染，IPTV 直播不显示大播放按钮（点播保留，供用户点击开始）。
- **提示体系（双轨）**：① 全局 `toastBus`（sonner）——普通页面顶部居中（导航栏下方），播放器页面中间靠上（top 42%），`success/warning/error` 语义色图标，统一 3s，用于**错误/成功/警告**类。② 播放器**操作类**提示独立走 `PlayerToast`（`.up-player-toast`，播放器**右上角**）——播放/暂停、音量、切线路、切频道、频道号输入等；`show(msg, duration, type)` 统一 3s，命令式 `playerToast()` 供组件顶层 hooks 调用（ToastTrigger/useTVInput/useIPTVNavigation/useKeyboardShortcuts）。`ToastTrigger` 在 `mode === 'iptv'` 跳过点播类订阅；IPTV 切线路由 `handleSourceSwitch` 提示（右上角）。IPTV 播放页：非 TV 放大图标在**右下角**；**TV 端默认全屏**（挂载时 requestFullscreen，拦截静默）且不显示放大图标；TV 遥控器音量弹**音量柱** + 右上角提示，换频道/频道号输入右上角提示。
- **键盘快捷键跳过**：`useKeyboardShortcuts` 在 `mode === 'iptv'` 时移除空格键的播放/暂停（直播无暂停语义），仅保留音量/全屏/静音/Escape。
- **遥控器跳过**：`useTVInput` 在 `mode === 'iptv'` 时遥控器播放/暂停键不触发 `togglePlay`。
- **裸流降级识别（D1）**：`HLSAdapter` 对 `manifestParsingError`（拿到内容但解析失败）上报带 `code='BARE_STREAM'` 的错误，与 `manifestLoadError`（网络层失败，维持「频道源不可用」走 A3）区分。`UniversalPlayer` 在 `mode==='iptv'` 且未对当前 URL 降级过时，用 `degradedType` state 临时将播放器类型覆盖为 `flv`，重建 `MPEGTSAdapter` 重试**同一 URL**（每 URL 仅 1 次，URL 变化时复位）。worker `m3u8-proxy` 对非 `#EXTM3U` 内容（`isM3U8Content` 判断）直接透传源站二进制（不重写、不缓存），使 mpegts.js 能拉裸 TS/FLV 流——**零额外请求识别裸流**。

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

- **共享工具类 `.page-transition-enter`**：定义在 `src/assets/styles/animations.css` 的 `@keyframes page-enter-fade`（淡入 + `translateY(8px)→0`，`0.28s var(--ease-out-expo) both`），已含 `prefers-reduced-motion: reduce` 守卫。**所有缺少进入动画的页面根容器都应加该类**：Detail / Person / SourceChecker / RecordShell（收藏·历史）。Browse（`.browse-page`）、IPTV（`.iptv-content`）、Settings（`.settings-page`）已有各自进入动画，勿重复加。**特例 — 首页**：`.home-page` 内嵌的 HeroBanner 自带 background crossfade + 缩略图揭示，且其缩略图/背景层是 `will-change`/`z-index` 的 **GPU 合成层**；若祖先（`.home-page` 根）带 `page-enter-fade` 的 `transform` 动画，会触发这些合成层重绘**闪烁（"闪一下"）**。因此首页的 `.page-transition-enter` **刻意落在仅包裹非 Hero 内容的 `.home-page__content` 包装层**（HeroBanner 作为其兄弟节点，祖先不再有 transform 动画），既保留进入淡入上移动画，又消除缩略图闪烁；HeroBanner 在二次进入时保持静止（首页被刻意排除在 VT 交叉淡入与重进抑制之外，顺带规避其"上一张图闪现"的已知问题）。
- **方案 B（无 Keep-Alive）下的页面进入过渡（2026-08 修订）**：当前 AppLayout 每次路由切换重新挂载页面（见上文「路由渲染器」）。若页面根容器每次都从 `page-transition-enter` 的 `opacity:0` 起播，二次进入会「先空白再出现数据」、快速连点尤为晃眼。**治理方式（方案 A — data-revisit 门控）**：AppLayout 用模块级 `visitedRoutes` 记录已访问路由，给 `.page-transition` 打 `data-revisit="true"`（仅对再次进入的路由）；`animations.css` 据此把 `.page-transition-enter` / `--stagger` 及其子元素置 `animation:none`，已挂载页面直接 `opacity:1` 呈现、不再从透明起播 → 无空白帧、无抖动。首页 `.home-page__content` 在上述 CSS 规则中被 `:not()` 排除，保持专属过渡、不参与抑制。**View Transitions（document.startViewTransition 交叉淡入）曾在此启用，但实测在方案 B 下反而有害**：(1) 首次进入因 flushSync 提交引发布局抖动；(2) 二次进入时缓存命中本应瞬间可见的页面在 VT 交叉淡入期间被拍成空白快照，把白色间隙时长拉长。故已彻底移除 VT，`useCustomNavigate` 现只走 react-router 原生 navigate（见「导航 API 强约束」）。
- **首页分类入口（2026-08-29 修订：页面内类目切换已彻底移除）**：首页**不再有页面内类目切换**——旧 `HomeSidebar` 与 `Home/index.tsx` 的 `CategoryView` 已删除，分类切换统一走路由：点击 `CategoryQuickAccess` 卡片 → `navigate('/browse?category=...')`（各端一致）。**以下历史机制均已不存在，勿再引用**：`displayedCategory` / `catSwitching` / `.home-cat-dim` / `home-cat-fade-*` / `fadePhase` / `useHomeCategoryStore` / `pages/Home/categoryConfig.ts` / `pages/Home/preloadRowCovers.ts` / `CategoryQuickAccess` 的 `activeCategory` prop 与 `--active` 样式。**仍保留的约束**：(1) `animation-fill-mode: none` 保留在 `.home-page__content` 上（防 `page-transition-enter` 的 `both` fill 永久锁定 opacity）；(2) 不要给 `.home-page` 或任何 HeroBanner 祖先加 `transform` 类动画（GPU 合成缩略图层会重绘闪烁，即「闪一下」）。

**导航 API 强约束**：所有业务导航一律使用 `src/lib/navigation.ts` 的 `useCustomNavigate()`，禁止直接 `import { useNavigate } from 'react-router-dom'`（已由 ESLint `no-restricted-imports` 封死，仅 `src/lib/navigation.ts` 豁免）。`useCustomNavigate` 现只走 react-router 原生 navigate（不启用 View Transitions——见「页面进入过渡统一约定」：VT 在方案 B 下会引入抖动与白色间隙回归）。二次进入的「先空白再出现数据」闪烁由 AppLayout 的 `data-revisit` 门控消除，与导航方式无关（无论经 `useCustomNavigate` 还是侧栏 `<Link>` 改走的 `useCustomNavigate` onClick，重进门控都生效）。

- **Suspense 兜底**：`AppLayout` 的 `LoadingFallback` 也已加 `.page-transition-enter`，冷加载时不再生硬弹出。


### 共享加载态约定（小电视 TvMascot）

- **唯一加载角色 `TvMascot`**：B 站同款「小电视」SVG 角色（TV 身 + 双天线耳朵 + 笑脸 + 电波），定义在 `src/components/ui/TvMascot/`（与 `PullToRefresh`、`UniversalPlayer` 加载态共用同一份 SVG + 配色，严禁再内联重复定义）。**所有环形/转圈加载图标（lucide `Loader` / `Tv`、`.up-loading-spinner` / `.up-iptv-buffering-spinner` / `.up-cast-spinner` 等）已全部移除**，新加载态一律用 `TvMascot`。
- **统一 props**：`armed`（耳朵直立 + 头顶电波）、`blink`（眨眼，用于 refreshing/success）、`earProgress`（0→1 耳朵竖起进度，随下拉进度）、`is-shaking`（刷新时摇摆）、`className`（可挂 `ptr-tv--on-dark` 适配黑色舞台）。`PullIndicator` 已封装「图标为主、文本为辅」的 B 站情绪化三段式文案（再拉就刷新 / 够啦松开人家嘛 / 更新中… / 更新啦）。
- **PullToRefresh 两变体**：`default`=顶部导航栏下方居中（靠 SVG filter 光晕 `#ptr-halo` 把小电视托起与图片分离，文字走深色填充 + 白色描边 `paint-order: stroke fill`）；`settings`=页面正中间圆形刷新按钮（自带 `--color-surface` 圆钮 + 阴影）。**陷阱**：`settings` 变体文本胶囊自带浅色背景，**必须走 `color: var(--color-text-secondary)`（主题文字色），不能继承 base 的 `--color-on-image`（白字）——否则浅色主题下白字压白底不可见**（2026-08-30 修复 `2e0ca40`）。
- **播放器加载/缓冲**：`UniversalPlayer` 缓冲浮层用 `<TvMascot className="ptr-tv--on-dark" blink is-shaking />`；首帧准备（非缓冲）时也需显示「加载中…」文本，避免出现「只有小电视、无文案」的裸电视态（2026-08-30 修复 `bfdaacf`）。播放页进入时右侧 `PlayerSidebarSkeleton`（CMS/季/集三栏 shimmer）必须每次渲染，不再用全屏 `AppLoading` 覆盖播放器（2026-08 `ecc197c`）。

### .gitignore 策略

- `docs/*` + `!docs/KNOWLEDGE.md` + `!docs/TEST-CASES.md` + `!docs/KNOWN-ISSUES.md` + `!docs/PRODUCTION-REVIEW-*.md` — 仅提交知识库 / 测试案例 / 已知问题 / 生产级对标报告文档，docs/ 其余（含 `docs/page-diagrams/` 原理图）忽略
- `scripts/*.ts` + `!scripts/*.spec.ts` + `!scripts/global-setup.ts` — 仅保留 E2E 测试脚本与全局初始化
- `scripts/*.mjs` + `!scripts/fetch-diagram-data.mjs` — 仅保留数据获取脚本，工具脚本不提交
- `scripts/fixtures/` — 本地测试夹具，忽略（不参与 E2E，见「测试基建修复」）
- AI 工具本地配置（.workbuddy/ .claude/ .opencode/ .codegraph/ 等）全部忽略
- AGENTS.md / CLAUDE.md / .cursorrules / .github/copilot-instructions.md — **提交**（团队共享）

## 测试依赖映射（精准跑测试，不要全量跑）

> 修改源文件后，只跑对应列的测试文件。共享组件变更才会影响多个测试文件。


### 页面代码 → 测试文件（1:1）

> test 数：playwright 用例为 `npx playwright test --list` 实际枚举数（2026-09-06 校准，全量 301 条 / 25 个 spec）。沙箱真实 CMS 源常加载不出、无法复现「真实播放」类问题，可用 ffmpeg 本地 HLS + Playwright `page.route` 冒充流（详见记忆库「本地 HLS 冒充流范式」）。「A + B」写法 = 静态 `test(` 数 + 动态生成用例数，合计等于 `--list` 总数。表中标注「(vitest 单元测试)」的行为 Vitest 单元测（`npm run test`），不计入 playwright 枚举数。

| 修改的源文件                                               | 跑这个测试                                                  | test 数 |
| ---------------------------------------------------- | ------------------------------------------------------ | ------ |
| `src/pages/Home/`                                    | `scripts/home.spec.ts`                                 | 58     |
| `src/pages/Browse/`                                  | `scripts/browse.spec.ts`                               | 24     |
| `src/pages/Chart/`                                   | `scripts/chart.spec.ts`                                | 6      |
| `src/pages/Detail/`                                  | `scripts/detail.spec.ts`                               | 21     |
| `src/pages/Player/`                                  | `scripts/player.spec.ts` + `scripts/player-failover.spec.ts` | 31 + 1 |
| `src/components/UniversalPlayer/`（全屏整改/移动端 toast 专项） | `scripts/smoke-player-fs-mobile.spec.ts`               | 7      |
| `src/pages/IPTV/`                                    | `scripts/iptv.spec.ts` + `scripts/iptv-player.spec.ts` | 13 + 6 |
| `src/pages/Settings/`                                | `scripts/settings.spec.ts`                             | 24 + 1 |
| `src/pages/Collections/`                             | `scripts/collections.spec.ts`                          | 6      |
| 跨页签 IDB 一致性（收藏收敛 `col-{videoId}` 主键）              | `scripts/collection-cross-tab.spec.ts`                 | 1      |
| 跨页签实时同步（BroadcastChannel 广播 → 另一页签内存快照静默刷新）    | `scripts/user-cross-tab.spec.ts`                       | 1      |
| IPTV 收藏/播放历史跨页签同步（storage 事件 → rehydrate + isFavorite 重派生） | `scripts/iptv-cross-tab.spec.ts`              | 1      |
| 设置静态配置跨页签同步（storage 事件白名单合并，theme/skin 真实 DOM 翻转）    | `scripts/settings-cross-tab.spec.ts`          | 1      |
| `src/pages/History/`                                 | `scripts/history.spec.ts`                              | 11     |
| `src/pages/SourceChecker/`                           | `scripts/source-checker.spec.ts`                       | 5      |
| `src/pages/Person/`                                  | `scripts/person.spec.ts`                               | 8      |
| 跨页联动回归                                               | `scripts/cross-page.spec.ts`                           | 17     |
| 详情页回归（原 DETAIL 段）                                    | `scripts/regression-detail.spec.ts`                    | 21     |
| 9.1 自测问题修复                                           | `scripts/fix-2026-08.spec.ts`                          | 10     |
| UI 整改专项（顶栏头像/分类入口(全端)/browse 刷新/设置动画/modal 宽度）       | `scripts/ui-fixes.spec.ts`                             | 10     |
| 全局问题专项（字体体系/皮肤字体自托管/基准统一/IPTV 占位/跟随系统/收藏动画）          | `scripts/global-fixes.spec.ts`                         | 9      |

> 注：`+N` 为 9.1 修复专项 `fix-2026-08.spec.ts` 中涉及该页的用例数（白屏/封面/汉堡/横屏/TabBar/免责声明 各页共通的修复验证）。


### 共享组件 → 测试文件（1:N）

| 修改的源文件                                        | 影响的测试文件                                                                        | 合计 test 数     |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------- |
| `src/components/UniversalPlayer/`             | player + iptv + iptv-player + smoke-player-fs-mobile                           | 57            |
| `src/components/VideoCard/`                   | home + browse + detail + collections + history + person                        | 110           |
| `src/components/SearchBox/`                   | browse + cross-page                                                            | 40            |
| `src/components/RecordShell/`                 | collections + history                                                          | 17            |
| `src/components/RecordFilterPanel/`           | collections + history                                                          | 17            |
| `src/components/StatusTabs/`                  | collections + history                                                          | 17            |
| `src/components/FilterBar/`                   | browse                                                                         | 24            |
| `src/components/HeroBanner/`                  | home + cross-page                                                              | 57            |
| `src/components/Layout/`                      | 全部页面加载测试（home/browse/detail/...各首屏用例）                                          | 逐个 spec 首屏用例  |
| `src/components/StickyHeader/`                | 全部页面加载测试                                                                       | 逐个 spec 首屏用例  |
| `src/components/ui/Toast.tsx` / `toastBus.ts` | settings (版本号点击)                                                               | 24            |
| `src/services/tmdbService.ts`                 | home + browse + detail + person                                                | 93            |
| `src/services/videoService.ts`                | browse + player + source-checker                                               | 36            |
| `src/services/iptvService.ts`                 | iptv + iptv-player                                                             | 19            |
| `src/services/channelLogo.ts`                 | iptv + iptv-player（台标候选链用例 IPTV-080/081）+ collections + history（EPG icon 台标渲染） | 33            |
| `src/services/epgService.ts`                  | iptv + iptv-player + collections + history（EPG 匹配/缓存读取）                        | 各 spec EPG 用例 |
| `src/components/LazyImage/`                   | home + browse + detail + collections + history + person + iptv（台标/海报图片加载用例）    | 各 spec 图片用例   |
| `src/stores/useTMDBStore.ts`                  | home + browse + detail                                                         | 85            |
| `src/stores/useSettingsStore.ts`              | settings + source-checker                                                      | 29            |
| `src/stores/useUserStore.ts`                  | collections + history                                                          | 12            |
| `src/components/ui/PullToRefresh/`            | (vitest 单元测试) `src/components/ui/PullToRefresh/PullToRefresh.test.tsx`         | 4             |

> 注：`search-features.spec.ts`、`mobile-web-sidebar.spec.ts` 等旧测试已彻底删除（原归档目录 `scripts/backup-specs/` 于 2026-08-29 连同 8 个一次性 `.mjs` 工具脚本一并清理，已备份至 `backups/scripts-untracked-20260829/`），映射表中不再引用。`playwright.config.ts` 的 `testIgnore` 规则已随之移除。

### 快速跑法

```bash
# 单个页面（最常见）
pnpm exec playwright test scripts/player.spec.ts

# 共享组件（如 VideoCard）
pnpm exec playwright test scripts/home.spec.ts scripts/browse.spec.ts scripts/detail.spec.ts scripts/collections.spec.ts scripts/history.spec.ts

# 全量（仅 CI 或发版前）
pnpm exec playwright test
```


### 增量测试（推荐日常使用）

`scripts/run-tests.ps1` 支持**文件级精粒度映射**（`$uiPrecisionMap`：改哪个文件只跑其相关 describe 段，而非整个 spec）：

```powershell
# 自动检测 git 改动并匹配映射（推荐）
.\scripts\run-tests.ps1 -AutoDetect

# 手动指定改动文件，验证匹配效果（不实际跑时可加 -Files）
.\scripts\run-tests.ps1 -Files @("src/components/HeroBanner/HeroBanner.tsx")

# 手动按 describe 段号/测试编号精准过滤（Grep 透传 playwright --grep）
.\scripts\run-tests.ps1 -Grep "1\.2"
.\scripts\run-tests.ps1 -Grep "HOME-010|HOME-011|HOME-012"

# 发版前真实 API 回归
.\scripts\run-tests.ps1 -Group regression -RealApi
```

**映射维护约定**（改动代码后同步维护）：

- 新增/修改组件或页面文件时，检查 `scripts/run-tests.ps1` 的 `$uiPrecisionMap` 是否有对应条目；没有则补充（`spec` = 受影响的 spec 文件，`grep` = 相关 describe 段号或测试编号）
- **grep 优先用 describe 段号**（如 `1\.2` 覆盖整个 HeroBanner 段）：段内新增用例自动涵盖，映射无需随用例增减维护
- ⚠️ **段号是正则**：`.` 必须转义（`1.2` 的 `.` 会通配任意字符，误命中含 `1023px` 等 1?2 序列的其他段标题），写 `1\.2`
- **映射覆盖范围**：`$uiPrecisionMap` 已覆盖所有共享组件（HeroBanner/CategoryQuickAccess/Layout/StickyHeader/SearchBox/VideoCard/LazyImage/RecordShell/StatusTabs/StillsLightbox/IPTVChannelCard/EPGProgramList/SourceManager/TokenRequired/ui/UniversalPlayer）+ 各页面文件；`$logicTestMap` 统一 `{spec, grep}` 结构，`spec` 含 `"vitest"` 标记触发单测，关键服务/Store 文件联动对应页面 E2E 段；未覆盖的组件落 `$uiTestMap` 粗粒度兜底
- **映射失效检测（自动）**：每次运行时校验 grep 段号在对应 spec 中是否仍存在——describe 段被删除/重命名导致零命中时输出黄色警告「映射可能过时，请更新映射」，防止改代码后旧映射静默失效
- 未匹配到映射的变更文件会输出黄色警告并**不跑对应测试**——提示补映射或用 `-Grep` 手动指定

**判断规则**：

```
IF 只改了 src/pages/Xxx/ 目录下的文件
THEN 跑对应 spec（优先查 $uiPrecisionMap 是否有该文件的精确条目）

IF 改了 src/components/ 下的共享组件
THEN 优先用 -AutoDetect / 查 $uiPrecisionMap；无映射时按上表跑所有受影响 spec

IF 改了 src/services/ 或 src/stores/ 下的文件
THEN 按上表跑所有受影响的 spec 文件（逻辑层自动加跑 vitest）

IF 改了多个目录
THEN 取所有受影响测试的并集（去重）
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

| 变更类型          | 测试    | 记忆    | 知识库 | 原理图    | 流程图 |
| ------------- | ----- | ----- | --- | ------ | --- |
| CSS bug 修复    | —     | 日志    | —   | —      | —   |
| 类名/选择器变更      | ✅ 同提交 | 日志    | —   | —      | —   |
| 新增页面          | ✅     | 日志+长期 | ✅   | ✅ 新建   | ✅   |
| 新增核心组件        | ✅     | 日志+长期 | ✅   | ✅ 受影响页 | —   |
| 架构分层变化        | ✅     | 日志+长期 | ✅   | ✅      | ✅   |
| 代理配置变化        | —     | 长期    | ✅   | ✅      | ✅   |
| .gitignore 策略 | —     | 长期    | ✅   | —      | —   |
| 新增领域术语        | —     | —     | ✅   | —      | —   |
| 内部重构（不改外部接口）  | ✅     | 日志    | —   | —      | —   |

---

## 协同开发与知识库维护

> 多人协作时，AI 辅助工具（Cursor / Claude / Copilot 等）会在每位开发者机器上各自维护一份**本地记忆**。本节规定「哪些文件必须一致、哪些允许不同、冲突怎么办」，避免同事之间因本地文件不一致而踩坑。

### 两类文件的定位

| 类别                    | 文件                                                                                                                              | 是否提交                      | 协同策略                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- |
| **共享知识库（唯一事实源）**      | `AGENTS.md` `CLAUDE.md` `.cursorrules` `.github/copilot-instructions.md` `CONTEXT.md` `docs/page-diagrams/` `docs/KNOWLEDGE.md` | ✅ 提交（团队共享）                | 全队一致，靠 git + PR review 同步 |
| **本地 AI 记忆（个人上下文缓存）** | `.workbuddy/memory/` `~/.workbuddy/MEMORY.md` 云端 profile                                                                        | ❌ 不提交（已被 `.gitignore` 忽略） | 每位开发者独立、天然允许不同，无需统一       |

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

- 收到需求后，先用一句话**区分「表面诉求」与「实际目的」**&#x590D;述意图；
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
- 项目已发布：首次发布实测产出 `1.0.0`（2026-07），当前版本 `1.1.0`（见 `package.json` / `.release-please-manifest.json` / `CHANGELOG.md`，三者是唯一可信源）。


### 2. 自动版本（release-please）

- 配置：`.release-please-config.json`、`.release-please-manifest.json`（记录最近发布版，当前 `1.1.0`）。
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


# AGENTS.md — AI Agent 项目指南

> 本文件是 AI Agent 的工作指南。Cursor / Aider / Windsurf / Claude / Copilot 等工具应优先阅读此文件。

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
| Video Proxy (CORS) | `https://video-warehouse.nmziptv.top/proxy?url={encoded}` | CMS API 请求、M3U 文件获取、EPG XML 获取 |
| IPTV Proxy (M3U8) | `https://iptv.nmz996.cc.cd/m3u8-proxy?url={encoded}` | IPTV 直播流代理（重写内部 URL） |
| TS Proxy | `https://iptv.nmz996.cc.cd/ts-proxy?url={encoded}` | TS 分片代理 |

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
| 首页 | `/` | HeroBanner + CategoryQuickAccess + TMDBMovieRow ×7 | TMDB trending/nowPlaying/popular/topRated/upcoming/popularTv/topRatedTv/airingToday |
| 浏览/搜索 | `/browse` | SearchBox + FilterBar + BrowseGrid | TMDB discover/search + CMS searchAll |
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
npm run build        # 生产构建
npm run lint:all     # ESLint + Stylelint
npm run test         # Vitest 单元测试
npx playwright test  # E2E 测试
```

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

## 关键模式与约定

### RecordShell（收藏页/历史页共用外壳）

`src/components/RecordShell/` — 收藏页和历史页的共用布局组件：
- **桌面（≥768px）方案 C**：左侧 sticky 筛选栏（标题 + 搜索 + 影视/IPTV 分段 + 状态芯片竖排 + 批量/清除按钮）+ 右侧卡片主区
- **移动（≤767px）方案 M6**：顶部 sticky 精简栏，滚动时自动折叠状态芯片行，仅留分段+搜索+筛选按钮
- CSS 在 `RecordShell.css`，两页共享；桌面侧栏 `width:100%` 的元素在移动横向 flex 行必须显式 `width:auto` 复位

### Toast 系统

`src/components/ui/toastBus.ts` + `Toast.tsx`：
- `toast.show(opts)` — 入队，排队等待（前一个 toast 超时后才显示下一个）
- `toast.replace(opts)` — 清空队列立即显示新 toast（快速连续提示场景，如版本号连续点击）
- ToastProvider 只渲染 `items[0]`（队列首项），`ToastContainer` 因 `item.id` 变化触发 useEffect 重跑

### Browse 懒加载

- 哨兵节点 `<div ref={sentinelRef}>` **无条件渲染**（不用 searchMode 条件包裹），跨状态持久
- 整页 loading 仅在首屏无数据时显示：`initialLoading = isLoading && results.length === 0`，与 `loading` 布尔区分
- 避免加载更多时卸载网格导致滚动跳顶

### 搜索词传递（Keep-Alive 兼容）

- 顶部导航 SearchBox: `navigate('/browse', { state: { q } })`
- Browse 页: `useState` 初始化读 `location.state.q` + `useEffect` 监听 `location.state.q` 变化同步 query（Keep-Alive 二次进入）
- SearchBox: `lastSaredRef` 在 `location.pathname` 变化时重置（解除相同搜索词的导航阻止）

### .gitignore 策略

- `docs/*` + `!docs/page-diagrams/` — 仅提交原理图目录，docs/ 其余忽略
- `scripts/*.ts` + `!scripts/*.spec.ts` — 仅保留 E2E 测试脚本
- AI 工具本地配置（.workbuddy/ .claude/ .opencode/ 等）全部忽略
- AGENTS.md / CLAUDE.md / .cursorrules / .github/copilot-instructions.md — **提交**（团队共享）

## 测试依赖映射（精准跑测试，不要全量跑）

> 修改源文件后，只跑对应列的测试文件。共享组件变更才会影响多个测试文件。

### 页面代码 → 测试文件（1:1）

| 修改的源文件 | 跑这个测试 | test 数 |
|-------------|-----------|---------|
| `src/pages/Home/` | `scripts/home.spec.ts` | 15 |
| `src/pages/Browse/` | `scripts/browse.spec.ts` | 18 |
| `src/pages/Detail/` | `scripts/detail.spec.ts` | 15 |
| `src/pages/Player/` | `scripts/player.spec.ts` | 35 |
| `src/pages/IPTV/` | `scripts/iptv.spec.ts` | 20 |
| `src/pages/Settings/` | `scripts/settings.spec.ts` | 21 |
| `src/pages/Collections/` | `scripts/collections.spec.ts` | 20 |
| `src/pages/History/` | `scripts/history.spec.ts` | 19 |
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
| `src/components/HeroBanner/` | home | 15 |
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

# KinoTV 项目知识库

## 目录

- [项目架构详解](#项目架构详解)
- [API 文档](#api-文档)
- [开发指南](#开发指南)
- [部署文档](#部署文档)
- [架构决策记录（ADR）](#架构决策记录adr)

---

## 项目架构详解

### 1. 技术栈概览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | React | 18.3.x | UI 框架，支持并发特性 |
| **语言** | TypeScript | 5.7.x | 类型安全 |
| **构建** | Vite | 6.3.x | 极速开发服务器和构建 |
| **路由** | React Router | 7.6.x | 单页应用路由 |
| **样式** | Tailwind CSS | 3.4.x | 原子化 CSS 框架 |
| **组件库** | Radix UI | 1.x | 无障碍基础组件 |
| **状态管理** | Zustand | 5.0.x | 轻量级状态管理 |
| **HTTP** | Axios | 1.16.x | HTTP 请求库 |
| **播放器** | HLS.js | 1.6.x | HLS 流媒体播放 |
| **存储** | idb (IndexedDB) | 8.0.x | 本地数据持久化 |
| **测试** | Vitest + Playwright | 4.1.x / 1.61.x | 单元测试 + E2E 测试 |

### 2. 项目目录结构

```
video-warehouse/
├── src/                          # 源代码目录
│   ├── assets/styles/           # 全局样式 + Design Tokens
│   │   ├── variables.css        # CSS 变量定义（Design Tokens）
│   │   ├── index.css            # 全局样式入口
│   │   └── animations.css       # 动画定义
│   │
│   ├── components/              # 通用组件
│   │   ├── ui/                  # 基础 UI 组件（Radix 封装）
│   │   │   ├── Accordion.css
│   │   │   ├── BottomSheet.css
│   │   │   └── ...
│   │   ├── common/              # 业务通用组件
│   │   │   ├── AppLoading/
│   │   │   ├── BackToTopButton/
│   │   │   └── ...
│   │   ├── Layout/              # 布局组件
│   │   │   ├── AppLayout.tsx    # 应用主布局
│   │   │   ├── Sidebar.tsx      # 侧边栏
│   │   │   └── StickyHeader.tsx # 顶部导航栏
│   │   ├── UniversalPlayer/     # 多源播放器
│   │   │   ├── UniversalPlayer.tsx
│   │   │   ├── PlayerCore.tsx
│   │   │   ├── ControlBar/      # 播放控制栏
│   │   │   └── hooks/           # 播放器相关 Hooks
│   │   ├── HeroBanner/          # 首页轮播组件
│   │   ├── VideoCard/           # 视频卡片组件
│   │   ├── IPTVChannelCard/     # IPTV 频道卡片
│   │   └── ...                  # 其他业务组件（20+ 目录）
│   │
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useMediaQuery.ts     # 媒体查询 Hook
│   │   ├── useNetworkSpeed.ts   # 网络速度检测
│   │   └── ...
│   │
│   ├── pages/                   # 页面组件
│   │   ├── Home/                # 首页
│   │   ├── Browse/              # 筛选页
│   │   ├── Detail/              # 详情页
│   │   ├── Player/              # 播放页
│   │   ├── IPTV/                # IPTV 直播页
│   │   ├── Settings/            # 设置页
│   │   ├── Collections/         # 收藏页
│   │   ├── History/             # 历史记录页
│   │   └── Person/              # 人物详情页
│   │
│   ├── services/                # 服务层
│   │   ├── httpClient.ts        # HTTP 请求封装（axios）
│   │   ├── videoService.ts      # 视频数据服务
│   │   ├── iptvService.ts       # IPTV 数据服务
│   │   ├── tmdbService.ts       # TMDB API 服务
│   │   ├── database.ts          # IndexedDB 数据库操作
│   │   ├── epgService.ts        # EPG 电子节目单服务
│   │   └── sourceService.ts     # 视频源配置服务
│   │
│   ├── stores/                  # Zustand 状态管理（index.ts 导出 7 个 store）
│   │   ├── usePlayerStore.ts    # 播放器状态
│   │   ├── useSettingsStore.ts  # 设置状态（含 AES-GCM 加密敏感字段）
│   │   ├── useIPTVStore.ts      # IPTV 状态
│   │   ├── useUserStore.ts      # 用户数据（收藏 + 历史，IndexedDB）
│   │   ├── useTMDBStore.ts      # TMDB 数据状态
│   │   ├── useNavStore.ts       # 页面导航状态
│   │   ├── useKeepAliveStore.ts # Keep-Alive 缓存状态
│   │   └── index.ts             # Store 统一导出（7 个；useSourceManagerStore/useHomeCategoryStore/usePageSearchStore 按需直接导入，不在此 barrel）
│   │
│   │   # 注：useRatingStore 合并入 useUserStore；useRecommendStore 随 DailyPicks 删除移除；
│   │   #     useSubtitleStore 拆分合并；useSourceManagerStore/useHomeCategoryStore/usePageSearchStore 按需直接引用
│   │
│   ├── types/                   # TypeScript 类型定义
│   │   ├── video.ts             # 视频相关类型
│   │   ├── iptv.ts              # IPTV 相关类型
│   │   ├── player.ts            # 播放器相关类型
│   │   ├── store.ts             # Store 状态类型
│   │   └── ...
│   │
│   ├── lib/                     # 工具函数
│   │   ├── cn.ts                # clsx + tailwind-merge
│   │   └── ...
│   │
│   └── test/                    # 测试工具
│       ├── setup.ts             # 测试配置
│       └── render.tsx           # 自定义渲染器
│
├── worker/                      # Cloudflare Workers
│   ├── m3u8-proxy.js            # M3U8 流代理
│   ├── cors-proxy.js            # CORS 代理
│   ├── wrangler.toml            # M3U8 代理配置
│   └── wrangler-cors.toml       # CORS 代理配置
│
├── scripts/                     # 构建脚本
│   ├── run-tests.ps1            # 测试运行脚本
│   ├── build-android.ps1        # Android 构建脚本
│   └── generate-icons.mjs       # 图标生成脚本
│
├── public/                      # 静态资源
│   ├── data/
│   │   ├── video-sources.json   # 视频源配置
│   │   └── iptv-sources.json    # IPTV 源配置
│   └── ...
│
├── docs/                        # 项目文档
│   └── KNOWLEDGE.md             # 知识库（本文件）
│
├── AGENTS.md                    # AI Agent 规则
├── package.json                 # 项目配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
├── tailwind.config.js           # Tailwind 配置
├── eslint.config.js             # ESLint 配置
└── .stylelintrc.json            # Stylelint 配置
```

### 3. 核心架构模式

#### 3.1 播放器适配器模式

播放器采用适配器模式，支持多种流媒体格式：

```
UniversalPlayer
    ├── PlayerCore (视频元素)
    ├── usePlayerCore (播放器逻辑)
    │   ├── HLSAdapter (HLS 流)
    │   ├── DASHAdapter (DASH 流)
    │   └── NativeAdapter (原生 MP4)
    └── ControlBar (控制栏)
```

**适配器接口**：
```typescript
interface IPlayerAdapter {
  init(video: HTMLVideoElement): void;
  loadSource(url: string): void;
  destroy(): void;
  switchSource(url: string): void;
  // ... 其他方法
}
```

#### 3.1.1 播放器控制栏

控制栏包含以下操作（`ControlBar.tsx`）：

| 组件 | 功能 | 快捷键 |
|------|------|--------|
| PlayButton | 播放/暂停 | Space |
| VolumeControl | 音量调节 | ArrowUp/Down |
| SpeedControl | 倍速切换 | - |
| SubtitleControl | 字幕导入 | - |
| ResolutionSwitch | 清晰度切换 | - |
| LoopButton | 循环模式（关闭/单集/列表） | L |
| MirrorButton | 镜像画面 | - |
| RatioButton | 画面比例（默认/4:3/16:9/铺满） | - |
| ScreenshotButton | 截图 | - |
| DecoderSwitch | 解码模式（硬解/软解） | - |
| PiPButton | 画中画 | - |
| FullscreenButton | 全屏 | F |
| RefreshButton | 刷新（IPTV） | - |

**Toast 提示**：操作时在右上角显示提示（`ToastTrigger.tsx`）：
- 音量：`音量 80%`
- 倍速：`倍速 1.5x` / `正常倍速`
- 循环：`单集循环` / `列表循环` / `循环关闭`
- 镜像：`镜像已开启` / `镜像已关闭`
- 比例：`比例 16:9` / `铺满画面` / `默认比例`
- 解码：`已切换到硬解` / `已切换到软解`
- 画中画：`已开启画中画` / `已关闭画中画`
- 截图：`截图已保存: xxx.png` / 失败提示

**截图限制**：
- `video.readyState < 2` 时提示视频未就绪
- 跨域视频源会导致 `canvas.toDataURL()` 抛异常
- 需独立 try-catch 处理 `drawImage` 和 `toDataURL`

**PiP 画中画**：
- 使用浏览器原生 PiP API
- `isPiP` 为 true 时必须跳过自定义宽高比样式，否则 PiP 窗口比例失真

#### 3.2 状态管理分层

```
┌─────────────────────────────────────────┐
│  UI 状态 (React useState)               │
│  - 控制栏可见性                          │
│  - 弹窗状态                             │
│  - 加载状态                             │
├─────────────────────────────────────────┤
│  跨组件状态 (Zustand)                   │
│  - 播放器状态 (usePlayerStore)          │
│  - 设置状态 (useSettingsStore)          │
│  - IPTV 状态 (useIPTVStore)             │
│  - 源管理状态 (useSourceManagerStore)   │
├─────────────────────────────────────────┤
│  持久化状态                             │
│  - 历史记录 → IndexedDB                 │
│  - 收藏 → IndexedDB                     │
│  - IPTV 缓存 → IndexedDB                │
│  - 用户设置 → localStorage              │
│  - 搜索历史 → localStorage              │
└─────────────────────────────────────────┘
```

#### 3.3 数据流架构

```
用户操作
    ↓
React 组件
    ↓
Zustand Store (状态更新)
    ↓
Services (API 调用)
    ↓
httpClient (axios)
    ↓
CORS 代理 (Cloudflare Worker)
    ↓
外部 API / CMS 源
    ↓
数据返回
    ↓
Store 更新 → 组件重渲染
```

### 4. 设计系统

#### 4.1 Design Tokens

所有设计变量定义在 `src/assets/styles/variables.css`：

**Typography（字号）**：
```css
--text-xs:   clamp(0.75rem, 0.69rem + 0.254vw, 0.8125rem);  /* 12→13 */
--text-sm:   clamp(0.8125rem, 0.752rem + 0.254vw, 0.875rem); /* 13→14 */
--text-base: clamp(0.875rem, 0.812rem + 0.254vw, 0.9375rem); /* 14→15 */
--text-lg:   clamp(0.875rem, 0.73rem + 0.445vw, 1rem);       /* 14→16 */
--text-xl:   clamp(1rem, 0.846rem + 0.471vw, 1.125rem);      /* 16→18 */
--text-2xl:  clamp(1.25rem, 1.03rem + 0.669vw, 1.5rem);      /* 20→24 */
--text-3xl:  clamp(1.625rem, 1.366rem + 0.758vw, 1.875rem);  /* 26→30 */
```

**Spacing（间距）**：
```css
--space-3xs: clamp(1px,  0.047rem + 0.029vw, 2px);
--space-2xs: clamp(1px,  0.047rem + 0.058vw, 3px);
--space-xs:  clamp(3px,  0.151rem + 0.087vw, 6px);
--space-sm:  clamp(6px,  0.398rem + 0.145vw, 12px);
--space-md:  clamp(8px,  0.582rem + 0.261vw, 18px);
--space-lg:  clamp(12px, 0.836rem + 0.404vw, 28px);
--space-xl:  clamp(16px, 1.081rem + 0.622vw, 40px);
--space-2xl: clamp(24px, 1.532rem + 0.808vw, 56px);
--space-3xl: clamp(32px, 1.915rem + 1.156vw, 80px);
```

**响应式断点**（v1.7.0 起收敛为 2/3/5）：
| 断点 | 宽度 | 卡片列数 |
|------|------|----------|
| Mobile | < 768px | 2 列 |
| Tablet | 768px - 1023px | 3 列 |
| Desktop | ≥ 1024px | 5 列 |
| Large | ≥ 1280px | 7 列 |
| 2K/4K | ≥ 1920px | 7 列 |
| TV | ≥ 3840px | 大字体、大触控区 |

#### 4.2 主题系统

支持三种主题模式：

```typescript
// 主题类型
type Theme = 'light' | 'dark' | 'system';

// CSS 变量切换
[data-theme="light"] {
  --color-background: #f5f5f5;
  --color-surface: #fff;
  --color-text: #000;
}

[data-theme="dark"] {
  --color-background: #141414;
  --color-surface: #1f1f1f;
  --color-text: #fff;
}
```

#### 4.3 设备适配

通过 `data-device` 属性适配不同设备：

```html
<html data-device="tv">        <!-- TV 设备 -->
<html data-device="app">       <!-- 原生 App -->
<html data-device="mobile-web"> <!-- 移动端 Web -->
<html data-device="">           <!-- 桌面端 -->
```

**焦点框与键盘可见性**：
- 非 TV（`data-device` 非 `"tv"`，含桌面 `''` / `mobile-web` / `app`）：全局 `:root:not([data-device="tv"]) :focus-visible { outline:none !important; box-shadow:none !important }` 清零焦点框，键盘导航下不显示任何 outline / box-shadow 焦点环；焦点可见性由 hover、可见性（如箭头 `:focus-within` 显示）等提示承担。
- TV（`[data-device="tv"]`）：保留显式焦点框（`outline` + `outline-offset`）供遥控器方向键导航，独立于上述清零规则。`logo / 品牌名` 等无交互反馈元素用 `.no-interaction-visual` 类强制无框。

**交互元素视觉细节（均走 Design Token，禁止硬编码）**：
- 首页 TMDB 行左右箭头：桌面端默认 `opacity:0`，悬停 `.tmdb-movierow-wrapper` 或 `:focus-within` 时 `opacity:1` 淡入；移动端不渲染、TV 端 `display:none`。
- 左侧侧边栏 `.home-sidebar__item`：横向 `padding` = `--space-xl`、上下 `padding` + 图标↔标题 `gap`（备用）= `--space-lg`；**坑：`.home-sidebar__label` 是 `position:absolute`，不吃父级 flex `gap`，图标↔标题间距由 `label.left: calc(--space-xl + --icon-md + --space-xl)` 控制**。
- 移动端分类快选 `.category-quick-access__inner`：`gap` = `--space-lg`（旧 `--space-2xl` 对 40px 圆形卡片偏松）。

---

## API 文档

### 1. TMDB API

#### 1.1 认证

TMDB API 使用 Bearer Token 认证：

```typescript
// src/services/tmdbService.ts
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_TOKEN = localStorage.getItem('tmdb-token');

const headers = {
  'Authorization': `Bearer ${TMDB_TOKEN}`,
  'Content-Type': 'application/json'
};
```

#### 1.2 主要接口

**获取热门电影**：
```typescript
GET /movie/popular?language=zh-CN&page=1

Response: {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}
```

**获取电影详情**：
```typescript
GET /movie/{id}?language=zh-CN&append_to_response=credits,videos

Response: {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  credits: { cast: Cast[]; crew: Crew[] };
  videos: { results: Video[] };
  // ... 更多字段
}
```

**搜索电影**：
```typescript
GET /search/movie?query={query}&language=zh-CN&page=1

Response: {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}
```

**获取演员作品**：
```typescript
GET /person/{id}/movie_credits?language=zh-CN

Response: {
  cast: Cast[];
  crew: Crew[];
}
```

### 2. CMS 视频源 API

#### 2.1 视频源配置

视频源配置存储在 `public/data/video-sources.json`（**嵌套对象结构**，`api_site` 以域名/ID 为 key；`sourceService.getVideoSources()` 用 `Object.entries(data.api_site)` 展开为 `{ id, name, api, detail }` 数组）：

```json
{
  "cache_time": 7200,
  "api_site": {
    "iqiyizyapi.com": {
      "name": "爱奇艺资源",
      "api": "https://iqiyizyapi.com/api.php/provide/vod",
      "detail": "https://iqiyizyapi.com"
    },
    "dbzy.tv": {
      "name": "豆瓣资源",
      "api": "https://caiji.dbzy5.com/api.php/provide/vod",
      "detail": "https://dbzy.tv"
    }
  }
}
```

> 增删源：在 `api_site` 下增删键即可（key 即源 id，须唯一）。设置页「视频源」多选索引即按此对象展开后的数组下标。

#### 2.2 获取视频列表

```typescript
GET {api}?ac=list&wd={keyword}

Response: {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: string;
  total: number;
  list: VideoItem[];
}
```

#### 2.3 获取视频详情

```typescript
GET {detail}?ac=detail&ids={id}

Response: {
  code: number;
  msg: string;
  list: VideoDetail[];
}
```

### 3. IPTV API

#### 3.1 IPTV 源配置

IPTV 源配置存储在 `public/data/iptv-sources.json`：

```json
[
  {
    "name": "直播源",
    "url": "https://example.com/iptv.m3u",
    "type": "m3u"
  }
]
```

#### 3.2 M3U 解析

```typescript
// src/services/iptvService.ts
interface IPTVChannel {
  id: string;
  name: string;
  group: string;
  url: string;
  logo?: string;
  tvgId?: string;
}
```

### 4. EPG API

#### 4.1 EPG 数据获取

```typescript
// src/services/epgService.ts
interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
}
```

### 5. Cloudflare Worker API

#### 5.1 M3U8 代理

```typescript
// worker/m3u8-proxy.js
// 请求格式
GET /m3u8-proxy?url={encoded_url}

// 功能
- 代理 M3U8/TS 流
- 解决跨域问题
- URL 重写
```

#### 5.2 CORS 代理

```typescript
// worker/cors-proxy.js
// 请求格式
GET /cors-proxy?url={encoded_url}

// 功能
- 代理 API 请求
- 添加 CORS 头
- 解决浏览器跨域限制
```

---

## 开发指南

### 1. 环境准备

#### 1.1 系统要求

- **Node.js**: >= 18
- **npm**: >= 9
- **操作系统**: Windows / macOS / Linux

#### 1.2 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd video-warehouse

# 安装依赖
npm install
```

#### 1.3 配置 TMDB

1. 前往 [TMDB](https://www.themoviedb.org/settings/api) 申请 API 密钥（免费）
2. 进入应用设置页面，填入 TMDB Access Token
3. 首页将自动加载热门影视数据

### 2. 开发命令

#### 2.1 启动开发服务器

```bash
npm run dev
```

访问 http://127.0.0.1:3001

#### 2.2 代码检查

```bash
# 完整检查（推荐提交前运行）
npm run lint:all

# 单独检查
npm run lint          # ESLint 检查
npm run lint:css      # Stylelint 检查

# 自动修复
npm run lint:fix      # 修复 ESLint 问题
npm run lint:css:fix  # 修复 CSS 问题
```

#### 2.3 测试

```bash
# 单元测试
npm run test           # 单次运行
npm run test:watch     # 监听模式
npm run test:coverage  # 覆盖率报告

# E2E 测试（mock 模式，默认）
npx playwright test    # 运行所有测试

# E2E 增量测试（按 git diff 自动匹配 spec）
npm run test:smart     # run-tests.ps1 -AutoDetect
npm run test:smoke     # 冒烟组（home/browse/player）
npm run test:regression # 回归组（全量 spec 集合）
```

**测试策略要点**（详见 `scripts/README.md` 与 `AGENTS.md`「测试依赖映射」）：

- **TMDB Mock 策略**：`scripts/fixtures/mock-tmdb.ts` 拦截 `api.tmdb.org` 请求返回本地 mock 数据；默认模式无 Token 风险。真实 API 模式：`TMDB_MOCK=false npx playwright test`（发版前回归用）。
- **增量映射**：改 `src/pages/Xxx/` 只跑对应 spec；改共享组件（VideoCard/HeroBanner/Layout/StickyHeader/UniversalPlayer/RecordShell/StatusTabs/SearchBox/FilterBar/Toast 等）按 AGENTS.md 映射表跑所有受影响 spec；改 `src/stores/**` / `src/hooks/**` 跑 vitest。**详情页改动需同时跑 `detail.spec.ts` + `regression-detail.spec.ts`**。
- **测试基建约定**：`playwright.config.ts` 配置 `testIgnore: '**/backup-specs/**'` 排除 gitignore 的旧测试备份（308 用例不参与 E2E）；主目录 13 个 spec 共 181 用例应零失败。
- **跑前须知**：需要 dev server（`npm run dev`，端口 3001）；Playwright 配置 `reuseExistingServer: true`。

#### 2.4 构建

```bash
# 构建生产版本
npm run build

# 本地预览
npm run preview
```

### 3. 代码规范

#### 3.1 TypeScript 规范

- 使用严格模式（`strict: true`）
- 优先使用 `interface` 定义对象类型
- 使用 `type` 定义联合类型、交叉类型
- 避免使用 `any`，使用 `unknown` 替代

```typescript
// ✅ 推荐
interface Video {
  id: string;
  title: string;
  sources: VideoSource[];
}

type VideoType = 'movie' | 'tv';

// ❌ 避免
const data: any = {};
```

#### 3.2 React 组件规范

- 使用函数组件 + Hooks
- 组件文件使用 PascalCase
- 使用 `export default` 导出组件
- Props 使用 `interface` 定义

```typescript
// ✅ 推荐
interface VideoCardProps {
  video: Video;
  onClick?: (video: Video) => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <div onClick={() => onClick?.(video)}>
      {video.title}
    </div>
  );
}
```

#### 3.3 CSS 规范

- 使用 BEM 命名规范
- 使用 CSS 变量（Design Tokens）
- 避免使用 `px`，使用 CSS 变量
- 使用 Tailwind CSS 工具类

```css
/* ✅ 推荐 */
.video-card {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.video-card__title {
  font-size: var(--text-base);
}

/* ❌ 避免 */
.video-card {
  padding: 12px;
  border-radius: 8px;
}
```

#### 3.4 状态管理规范

- 使用 Zustand 进行状态管理
- 使用 selector 订阅状态
- 避免全量订阅

```typescript
// ✅ 推荐（仅订阅需要的切片，避免全量订阅导致无关渲染）
const channels = useIPTVStore((s) => s.channels);

// ❌ 避免（全量解构，任何状态变化都会触发重渲染）
const { channels, groups, filter } = useIPTVStore();
```

### 4. 项目配置

#### 4.1 路径别名

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

#### 4.2 Vendor 拆分

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'radix-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
          'state-vendor': ['zustand'],
          'hls-vendor': ['hls.js'],
          'idb-vendor': ['idb'],
          'http-vendor': ['axios'],
          'utils-vendor': ['clsx']
        }
      }
    }
  }
});
```

---

## 部署文档

### 1. Cloudflare Pages 部署

#### 1.1 前置条件

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 安装 Wrangler CLI：

```bash
npm install -g wrangler
```

3. 登录 Cloudflare：

```bash
npx wrangler login
```

#### 1.2 部署前端

```bash
# 一键构建并部署到 Cloudflare Pages
npm run deploy:pages
```

执行流程：
1. `npm run build` - 构建生产版本（TypeScript 编译 + Vite 构建）
2. `npx wrangler pages deploy dist --project-name video-warehouse` - 部署到 Pages

部署完成后，访问 `https://video-warehouse.pages.dev`

#### 1.3 自定义域名

1. 在 Cloudflare Pages 项目设置中添加自定义域名
2. 配置 DNS 记录指向 Cloudflare Pages
3. 等待 SSL 证书自动签发

### 2. Cloudflare Workers 部署

#### 2.1 M3U8 流代理

```bash
# 部署 M3U8 代理 Worker
npm run deploy:worker
```

部署 `worker/m3u8-proxy.js` 到 Cloudflare Workers，用于：
- 代理 M3U8/TS 流地址
- 解决 IPTV 频道跨域播放问题
- URL 重写和转发

#### 2.2 CORS 代理

```bash
# 部署 CORS 代理 Worker
npm run deploy:cors
```

部署 `worker/cors-proxy.js`，用于：
- 代理视频采集 API 请求
- 解决浏览器跨域限制

#### 2.3 Worker 配置

在设置页面配置 Worker URL：
- 流代理地址：`https://your-worker.workers.dev`
- CORS 代理地址：`https://your-cors-proxy.workers.dev`

### 3. Android 打包

#### 3.1 前置条件

1. 安装 Android Studio
2. 配置 Android SDK
3. 配置 Java/JDK

#### 3.2 初始化 Android 项目

```bash
# 首次执行，创建 Android 项目结构
npx cap add android
```

#### 3.3 一键构建 APK

```bash
# PowerShell 版本（推荐）
.\scripts\build-android.ps1           # Debug APK
.\scripts\build-android.ps1 -Release  # Release APK

# Batch 版本
scripts\build-android.bat              # Debug APK
scripts\build-android.bat --release    # Release APK
```

构建流程：
1. 安装 npm 依赖
2. 构建 Web 资源（CAPACITOR=true）
3. 同步 Capacitor 资源到 Android
4. 使用 Gradle 构建 APK

APK 输出位置：
- Debug：`android/app/build/outputs/apk/debug/`
- Release：`android/app/build/outputs/apk/release/`

#### 3.4 其他 Android 命令

```bash
# 一键构建
npm run build:android

# 在 Android Studio 中打开项目
npm run open:android

# 生成应用图标
npm run icons:android
```

### 4. TV 端部署

#### 4.1 WebOS（LG TV）

1. 安装 LG WebOS SDK
2. 使用 `npx cap sync` 同步资源
3. 使用 WebOS IDE 打包和部署

#### 4.2 Tizen（Samsung TV）

1. 安装 Tizen Studio
2. 使用 `npx cap sync` 同步资源
3. 使用 Tizen IDE 打包和部署

#### 4.3 其他 TV 平台

- **Roku**: 使用 Roku SDK
- **Apple TV**: 使用 Xcode
- **PlayStation**: 使用 PlayStation SDK
- **Xbox**: 使用 GDK
- **Google TV**: 使用 Android TV SDK

### 5. 环境变量

#### 5.1 开发环境

创建 `.env.local` 文件：

```env
# TMDB API
VITE_TMDB_TOKEN=your_tmdb_token

# 代理配置
VITE_PROXY_URL=https://your-proxy.workers.dev
VITE_CORS_PROXY_URL=https://your-cors-proxy.workers.dev
```

#### 5.2 生产环境

在 Cloudflare Pages 中配置环境变量：

1. 进入项目设置 → Environment variables
2. 添加生产环境变量
3. 重新部署项目

---

## 附录

### A. 常见问题

**Q: 开发服务器启动失败？**
A: 检查 Node.js 版本是否 >= 18，运行 `npm install` 重新安装依赖。

**Q: 视频无法播放？**
A: 检查是否配置了正确的代理地址，确认视频源 API 可用。

**Q: IPTV 频道无法加载？**
A: 检查 M3U8 代理是否部署成功，确认频道 URL 有效。

### B. 相关链接

- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vite 文档](https://vitejs.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Zustand 文档](https://docs.pmnd.rs/zustand/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)

### C. 更新日志

> **版本口径说明**：下方 `v1.0.0~v1.7.0` 为项目早期**内部功能里程碑**（2026-07-30 前手工标注，未打 git tag）；自 2026-07-30 起版本号由 release-please 接管（见 ADR-004），官方 tag 与 `CHANGELOG.md` 以 `package.json`/`.release-please-manifest.json` 为准（首次发布 `1.0.0`，当前 `1.1.0`）。此处保留里程碑记录仅作功能演进参考，**版本号口径以 release-please 为准**。

- **v1.0.0** - 初始版本，支持基本视频浏览和播放
- **v1.1.0** - 添加 IPTV 直播功能
- **v1.2.0** - 添加收藏和历史记录功能
- **v1.3.0** - 添加 TV 端适配
- **v1.4.0** - 优化播放器性能，支持多清晰度切换
- **v1.5.0** - 播放器 UI 优化（2026-07-10）：
  - 控制栏弹窗选中态高亮增强（显式白色 + 左侧指示条）
  - 更多设置弹窗左对齐、宽度优化
  - 播放按钮尺寸增大（3rem→6rem 流体缩放）
  - 截图功能错误提示完善（跨域、视频未就绪等）
  - 解码模式切换提示（硬解/软解）
  - 画中画比例修复（PiP 模式下移除自定义宽高比样式）
  - 播放页折叠面板文字加粗、选季面板移动端 3 列布局
  - Browse 页移除子元素冗余左右 padding
- **v1.6.0** - 移动端命令栏 (BrowseMobileBar) 样式细化（2026-07-30）：
  - 预设/推荐卡压缩（预设按钮 text-xs + space-xs padding；推荐卡 min-width 6rem、padding space-xs、gap space-xs）
  - 排序键移到模式切换右侧、筛选按钮新增漏斗 SVG 图标并加大右 padding（space-lg）
  - 删除「✨ 为你推荐」标题（bmb-rec-head）与 TMDB 趋势提示（bmb-cap）
  - 抽屉内 FilterBar 隐藏 footer（hideFooter）；面板底部与上方间距加大（margin-top space-xl、padding-top space-lg）
  - 移动端命令栏回归测试由 browse-mobile.spec.ts 并入 browse.spec.ts（BROWSE-070~074），原文件删除
- **v1.6.1** - 移动端整页卡片式包裹（2026-07-30）：
  - `isPhone`（含视口 < 768px）时 `.browse-page--mobile` 整页以卡片布局包裹：surface + 1px 边框 + radius-lg + shadow-sm + margin/padding space-sm
  - 内部 `.browse-card--results` 去壳，`.bmb` 底部加分隔线与结果区相连，与桌面端「双卡片相连」语义一致
  - 回归测试新增 BROWSE-075（断言整页卡片 radius/shadow/border 已加载）
- **v1.7.0** - 布局统一与工程清理（2026-07-31）：
  - 响应式卡片网格列数收敛为统一的 2/3/5（移动 / 平板 / 桌面及大屏），IPTV 骨架网格改为跟随 `--iptv-cols` 全局 token，不再走 `auto-fill`
  - TV 模式顶部导航栏新增 IPTV 直达入口（仅 `isTV` 时渲染，置于右侧导航项之前）
  - 工程清理：删除未挂载的 `PerformanceMonitor` 开发组件及其唯一依赖 `web-vitals`（npm uninstall 同步锁文件）；删除 9 个零引用自定义 hooks（`layout` / `useFetch` / `useFocusable` / `useGridLayout` / `useMinLoadingTime` / `usePointerType` / `usePreload` / `useThemeMode` / `useWebVitals`）并清理对应 barrel 死出口、CSS 死类/重复块与多处过时注释
  - 硬编码像素去化（Design Token 收口）：把散落在组件里的像素硬编码统一收口为 Design Token——`SearchBox`（下拉高度 `Math.min(…,448)` → 注入 `--dropdown-avail-h`、由 `--layout-dropdown-max-h` 驱动）、`Select`（下拉 `max-h-[320px]`/`px-[14px]` → `--layout-dropdown-max-h`/`--space-md`）、`IPTVOSDBar`（OSD 宽度 `OSD_MIN_WIDTH=360`/`OSD_MAX_WIDTH=1600` 的 JS 计算整段删除、纯 CSS `width: min(var(--layout-osd-max-width), 100%)`；TV 端 `--layout-osd-max-width` 由死值 `1600px` 改为标准 `clamp(100rem, 83.333vw, 200rem)`）、`Sidebar`（`isMobile ? 200 : 240` / 折叠 `:64` → `--sidebar-width-mobile`/`--sidebar-width`/`--sidebar-width-collapsed`）、`TabBar`（`text-[10px]` → `text-[var(--text-2xs)]`）、`ConfirmDialog`/`Modal`（内联 `<svg width="N">` 与 `w-[28px]` → `--icon-*`）；`variables.css` 的 `--layout-osd-max-width` 维持桌面原曲线 `clamp(320px, 20rem + 30vw, 1400px)`（旧 JS 的 360/1600 在最终 `min()` 中恒被 token 吞掉、对实际宽度零影响）；`UniversalPlayer` 移除仅为 OSD 宽度服务的 `containerWidth` state 与 `ResizeObserver`
- **v1.8.0** - 移动端设置页整改 + Browse 筛选区重设计（2026-08-10）：
  - 设置页移动端：入口菜单按 iOS 分组圆角卡组织（「通用」4 项 +「账户与信息」2 项，`.settings-menu-group*`，保留 `.settings-menu-item` 类名兼容 SET-090）；子页改用 `createPortal` 挂到 `document.body`（脱离 `.app-shell__scroll` 的 `contain:layout` 包含块），`position:fixed; inset:0` 覆盖全视口，顶栏（返回/居中标题/右占位）与全局导航栏同高（`--header-height-compact`）视觉替代导航栏；子页内 `.list-item` 双行卡卡片化（对齐桌面方案 F，卡片间距 `--space-lg`）；`.settings-page:has(.settings-subpage)` 移除 page-transition-enter 残留 transform；移动端子页 section 顶部 padding 为 0、左右 `--space-lg`
  - 个人设置 / 源管理（视频源/IPTV 源/EPG 源）在子页内恢复卡片化（`.settings-profile-card` / `.settings-personal-section .settings-card__body` / `.source-manager`），与桌面端一致
  - Browse 移动端筛选区（S3 定稿）：命令栏改两行布局——第一行 `智能检索/直链搜索` 模式段居中（`.bmb-mode-row`），第二行「筛选」小按钮（28px）+ 结果数两端对齐（`.bmb-bar-row` `space-between`）；**移除 `.bmb-presets` 预设横滚与面板内 `.bmb-rec` 推荐卡**（HTML 示例无此元素）；`.bmb-rail` 已选轨无左右 padding；移动端隐藏 `.browse-sort-bar`（排序入弹窗第 5 分组、结果数入命令栏）
  - 筛选面板改**完成制**：面板内 FilterBar 用 `draft` 草稿值（打开时从 `value` 快照），改条件零接口请求；点「完成」才 `onChange(draft)`；「重置」重置草稿；返回丢弃草稿。Drawer 新增 `fullscreen`/`onReset` prop（全屏覆盖 + 顶栏「返回/标题居中/重置」三栏，动画 `drawer-pg-in`）；FilterBar 不 hideFooter → 排序作为第 5 分组展示
  - SearchBox 全局修复：点击实时搜索建议不再直达详情页/人物页，改为填入关键词并跳转 `/browse?q=`（`handleSuggestionClick` 移到 `handleSearch` 之后解决 const 提升）
  - 弹窗按钮胶囊化：`Button` 组件若 className 含 `rounded-*` 则不附加默认 `rounded-md`（修复 ConfirmDialog/ProfileEditModal 胶囊被覆盖问题）；ConfirmDialog / ProfileEditModal 按钮高度降为 `min-h-[var(--comp-tab-height)]`（更修长），ProfileEditModal 按钮补横向宽度 `px-[var(--space-xl)]`
  - 新增测试：BROWSE-078/079/080（两行命令栏/全屏面板顶栏三栏+完成制/rail 无 padding）、SET-092/093（分组圆角卡/子页顶栏+双行卡）
  - `vite.config.ts` 新增 `server.warmup` 预热核心模块，缓解 dev 模式冷启动首次访问慢（首屏实测首次 ~400ms / 二次 ~176ms）

---

## 架构决策记录（ADR）

> 记录项目中有长远影响的架构选型与约定。新增决策请复制下方模板，编号顺延（`ADR-XXX`），并在「已记录决策」中补一条摘要。
> 何时写、写到哪、模板见 `CONTRIBUTING.md` 第 6 节。

### 模板

```markdown
### ADR-XXX: 标题

- 状态: 已采纳 / 候选 / 已废弃
- 日期: YYYY-MM-DD
- 提出人: xxx

**背景**
为什么需要这个决策？要解决什么问题？

**决策**
我们决定：……

**后果**
- 正面：……
- 负面 / 权衡：……

**替代方案**
- 方案 A：……（未采用原因）
- 方案 B：……（未采用原因）
```

### 已记录决策

- **ADR-001 卡片模块 UI 仅桌面端（≥1024px）生效**（2026-07-13）
  首页 HeroBanner / 分类 / 每行、侧边栏 / 顶栏、页面级 loading 的卡片化视觉（圆角 + surface 背景 + 1px border + shadow-sm）统一收进 `@media (width >= 1024px)`；移动端（<1024px，含平板 768–1023）保持原始全宽布局，不被卡片化波及。理由：卡片模块是桌面端视觉增强，小屏应保留信息密度。

- **ADR-002 Keep-Alive 路由模式**（早期）
  `AppLayout` 不卸载已访问页面，用 CSS `display` 切换可见性。理由：避免重复请求与状态丢失（如 IPTV 播放、表单输入）。后果：修改页面状态需考虑组件已挂载的「二次进入」场景（如搜索词从顶部导航带入 Browse）。

- **ADR-003 代理分层**（早期）
  CMS / EPG 请求走 Video Proxy（`/proxy?url=`）；IPTV 直播流走 IPTV Proxy（`/m3u8-proxy?url=`）；TS 分片走 TS Proxy（`/ts-proxy?url=`）；TMDB API 原生 CORS 直连。理由：不同源对重写 / 跨域的需求不同，分层后各自独立可维护。

- **ADR-004 版本号：SemVer + release-please 自动维护 + Capacitor 双端派生**（2026-07-30）
  版本号唯一可信源 = `package.json.version`；由 release-please 依据 Conventional Commits 自动算版并打 `vX.Y.Z` tag、维护 `CHANGELOG.md`。Capacitor Android 端 `android.versionCode` 由版本号派生（公式 `major*100000+minor*1000+patch*10+通道序`，release=3/rc=2/beta=1/alpha=0），在 `build:android` 时经 `scripts/sync-capacitor-version.mjs` 写入 `capacitor.config.ts`。理由：避免手工改版本导致 Web/Android 版本漂移、CHANGELOG 与 tag 不同步。后果：提交信息须遵循 Conventional Commits 才能正确算版；0.x 阶段破坏性变更升 MINOR，首个稳定版定为 `1.0.0`。

- **ADR-005 死代码与依赖收敛约定**（2026-07-31）
  全仓扫描发现大量零引用 hooks、未挂载组件、CSS 死类/重复 `@keyframes`、过时注释，长期累积增加维护负担与回归风险。
  我们决定：① 删除任何模块前先用 grep/子代理全仓核实引用（含动态 `import()`、barrel 导出、CSS class 拼接、测试脚本）；② 删除未挂载功能组件时，若其独占某 npm 依赖，一并 `npm uninstall` 并同步 lock 文件；③ 对「可能将来使用」的动画/工具类（如 `animate-*` 工具类、`spin`/`pulse` 同名重复 `@keyframes`）保留、不激进删除；④ 注释须与实际代码逐行对齐，删除死变量/死分支须同步清理引用与注释。
  后果：仓库更小、构建更干净；需防止将来误重新引入已删模块（见记忆库「死代码清理记录」）。

- **ADR-006 禁止源码硬编码像素尺寸，视觉尺寸一律走 Design Token（2026-07-31）**
  项目视觉尺寸曾散落大量「源码字面量像素」：下拉高度 `Math.min(…,448)`、OSD 宽度 `OSD_MIN_WIDTH=360`/`OSD_MAX_WIDTH=1600`、`Sidebar` 的 `isMobile ? 200 : 240`、图标 `<svg width="16">`、Tailwind 任意值 `text-[10px]`/`w-[28px]`/`px-[14px]` 等。这些字面量不随 `--text-*`/`--space-*`/`--layout-*` 的流体曲线缩放，在 2K/4K/TV 下比例失真，且 TV 端无法统一放大。
  我们决定：① 组件视觉尺寸一律走 Design Token——图标经 `Icon` 组件（`size` 为档名）或 `--icon-*`、布局/间距/字号经 `--space-*`/`--text-*`/`--layout-*`；② 去硬编码统一用 `scripts/css-px-to-token.mjs` 自动替换，再人工核对 token 语义边界（严禁把跨语义尺寸硬压进同一档，如把 32/36/40/48 全压 `icon-xl`）；③ 例外（允许保留字面量，因为它们是逻辑阈值而非视觉尺寸）：`useMediaQuery` 断点值、`IntersectionObserver` 的 `rootMargin`、`<img sizes>` 响应式提示、`BottomSheet` 的 `1px` sr-only hack、`window.innerWidth` 列数兜底。
  后果：所有视觉尺寸跟随同一条 vw 缩放曲线，任意视口比例恒定；TV 端改 `[data-device="tv"]` 覆盖 `--text-*` 后图标/布局自动跟随放大。权衡：需警惕「为 token 单独写独立 clamp/slope」会破坏与文字的比例锁定（图标 token 必须 `calc(var(--text-<档>) * 系数)` 派生，见记忆库「图标 token 派生自文字 token」）。

- **ADR-007 非 TV 零焦点框与交互元素视觉细节约定（2026-07-31）**
  今日在首页 / 侧边栏做了一批 UI 微调，部分属「坑」级约定，需固化以免回归：
  ① **非 TV 全局零焦点框**：在 `src/assets/styles/index.css` 新增 `:root:not([data-device="tv"]) :focus-visible { outline:none !important; box-shadow:none !important }`，覆盖桌面 / `mobile-web` / `app` 三种 `data-device`（TV 才设 `"tv"`），清掉浏览器默认 `:focus-visible` outline 与组件自带 box-shadow 焦点环；TV 焦点框由既有 `[data-device="tv"]` 规则独立提供，互不干扰。`.no-interaction-visual` 自身仍 `!important` 无框。
  ② **首页 TMDB 行箭头显隐**：桌面端默认 `opacity:0`，悬停 `.tmdb-movierow-wrapper` 或键盘 `:focus-within` 才 `opacity:1` 淡入（键盘可见性提示）；移动端箭头不渲染、TV 端 `display:none`。
  ③ **侧边栏留白与图标↔标题间距**：`.home-sidebar__item` 横向 `padding` 由 `--space-lg` 提到 `--space-xl`（元素不贴左），上下 `padding` + `gap` = `--space-lg`；**坑：`.home-sidebar__label` 是 `position:absolute`，不吃父级 flex `gap`，图标↔标题间距只能由其 `left: calc(--space-xl + --icon-md + --space-xl)` 控制**（改 item `gap` 对标题间距无效）。
  ④ **移动端分类快选间距**：`.category-quick-access__inner` 的 `gap` 由 `--space-2xl`（下限 24px，对 40px 圆形卡片偏松）改为 `--space-lg`（更紧凑协调）。
  后果：键盘导航下非 TV 设备视觉更干净、焦点可见性交由 hover/可见性承担；上述细节在 TV 下由各自规则独立处理、互不干扰。回归测试见 `scripts/home.spec.ts` 1.6 段（HOME-050~053）。

- **ADR-008 HeroBanner 缩略图覆盖式布局 + 滑动切换动画（2026-08-05 补录）**
  首页 Hero 横幅采用「左侧主背景图 + 右侧缩略图列（absolute 覆盖 banner 右缘）」布局；缩略图激活态 2px 主色边框 + 阴影，点击跳详情。**滑动切换**：activeIndex 切换统一走 slide-left/right（新图滑入），自动轮播（5s）也走 slide；滑动后 1000ms 冷却暂停轮播。桌面悬停缩略图显式清除 slideDir → 回退 crossfade。**关键坑**：slide 动画结束后不重置 slideDir（否则 `.is-active` 层回退默认 crossfade 规则因 animation-name 改变重播淡入 → "闪一下、短暂出现上一张图"）。**预加载**：轮播预加载下一张 w1280 + 缩略图窗口 ±2 张 w500。**bannerReady 仅 items 空→有时重置**，切换分类保持 true（否则缩略图「真实→骨架→真实」硬切换 = 闪一下）。无障碍：`prefers-reduced-motion` 禁用动画。详见 AGENTS.md「HeroBanner 组件」。

- **ADR-009 双卡片布局规范（Browse/IPTV/Person/Detail/Settings 统一）（2026-08-05 补录）**
  每个功能区块作为独立「卡片模块」：`--color-surface` 背景 + 1px `--color-border-light` 边框 + `--radius-lg` + `--shadow-sm`，模块间距 `--space-sm`，**所有设备启用**。应用：Browse 双卡片（搜索区 Card1 `flex-shrink:0` + 结果区 Card2 `flex:1`）、IPTV `.iptv-top-card`+`.iptv-grid-card`、Person `.person-hero`+`.person-grid-card`、Detail `.detail-hero`、Settings 桌面端单卡（section 去卡片化、border-top 分隔）。移动端 Browse 整页以「命令栏 Card1 + 结果区 Card2」gap:0 相连成一张大卡（镜像桌面端）。详见 AGENTS.md「卡片模块 (Card Module) UI 约定」。

- **ADR-010 RecordShell 桌面横向筛选栏 vs 移动 M6（2026-08-05 补录）**
  收藏页/历史页共用 RecordShell 外壳：**桌面（≥768px）**顶部横向 sticky 卡片（第 1 行 = 标题+影视/IPTV 分段+搜索框+批量工具栏，第 2 行 = 状态筛选芯片横向可换行），主区在下方；**移动（≤767px）**顶部 sticky 精简栏滚动时折叠筛选芯片行。实现：末尾追加 `@media (width >= 768px)` 覆盖块，原移动端规则逐字节未动（零影响）；桌面横向 flex 中 `width:100%` 元素须显式 `width:auto` 复位。详见 AGENTS.md「RecordShell」。

- **ADR-011 首页分类切换 deferredCategory 解耦 + 纯 opacity 过渡（2026-08-05 补录）**
  首页「类目切换」将 `activeCategory`（点击立即响应）与 `deferredCategory`（驱动数据/内容渲染）解耦，切换时整页 `.home-page__content` 重放 `.home-cat-fade`（opacity 0→1，0.28s，动画结束移除类、首挂载跳过）。**关键约束：过渡只用 opacity、绝不含 transform**——HeroBanner 的 GPU 合成缩略图层遇 transform 会重绘闪烁（"闪一下"）。详见 AGENTS.md「首页类目切换过渡」。

- **ADR-012 侧边栏折叠重构：瞬切 + 图标绝对居中 + label 淡出（2026-08-04）**
  侧边栏折叠从「宽度动画（0.24s transition）」改为**瞬切**：spacer 与 sidebar 同帧到位、无宽度动画（避免折叠时主内容区逐帧重排 reflow 卡顿）；图标收起态**绝对定位居中**（`left` 固定像素、可过渡平滑位移），label 淡出。实现细节：图标 absolute 化后不占 flex 流，item 显式 min-height 恢复行高；按钮 300ms 防抖。回归测试 `scripts/regression-detail.spec.ts` REG-013/014。

- **ADR-013 设置敏感字段「内存明文 + 持久化层加密」（H1 修复，2026-08-05）**
  旧 `setTMDBToken` 异步 `encryptText` 完成后 setState 密文覆盖内存 → 同一会话所有 TMDB 请求 401（`tmdbService.getAccessToken()` 同步读内存当 Bearer）。我们决定：**内存 state 恒为明文，AES-GCM 加密收敛到 persist 自定义异步 storage**——setItem 写 localStorage 前加密，rehydrate 读入时解密。setter 退化为纯 set，`getAccessToken()` 无需改动。`applyBackup` 导入对明文直接 setState（不再双重加密）。配套：`useSettingsStore.test.ts` 4 用例防回归；`docs/KNOWN-ISSUES.md` #1 登记。

- **ADR-015 Toast 全局系统整改 + 播放器交互修复（2026-08-05）**
  统一 toast 体系与播放器交互的批量整改：
  ① **toast 位置**：sonner `<Toaster>` 改 `top-center`；普通页面顶部居中、导航栏下方（CSS `top: calc(--header-height + space-lg)`）；播放器页（`/play`、`/iptv/play`）经 `UniversalPlayer` 挂载时 `document.body.dataset.playerToast='active'` → CSS 重定位中间靠上（top 42%）。宽度 `min(22rem, 视口-2rem)`，文本居中。② **类型图标**：`toastBus` 新增 `success/warning/error`（lucide CheckCircle2/AlertTriangle/AlertCircle + `--color-success/-warning/-error`，`.ts` 文件用 `createElement` 构建，不写 JSX）；`toast.show` 支持 `{ type }`。③ **统一 3s**：`TOAST_DURATION=3000`，全仓调用点移除显式 duration（Settings/Detail/播放器/截图）。④ **提示补全**：进度恢复（useProgressRestore → replace「已自动跳转到上次观看的位置」）、集数切换（useEpisodeSwitcher → replace「已切换到N集」，覆盖 ToastTrigger 线路名误报）、IPTV 切线路（handleSourceSwitch 默认「已切换到线路 X/Y」，C1 传专用文案）；ToastTrigger 首帧 src 守卫（null→值不算切换）。PlayerToast 改为转发 sonner（保留 context API）。⑤ **P0③**：PlayButton `disabled={isBuffering && !isPlaying}`（缓冲中可暂停）。⑥ **P1④**：ProgressBar `beginDrag` 加 `buffering` 守卫（缓冲中禁拖进度条）。⑦ **P1⑤**：中间播放图标条件加 `!isPlayerLoading`（切源失败不闪现播放图标）。⑧ **P2⑥**：`DuoIcon` 组件（两套相似 lucide 图标层叠 + CSS opacity/transform 过渡）应用于底栏按钮（Play↔PlayCircle、Pause↔PauseCircle、Skip↔Step、Maximize↔Maximize2、Volume 相邻级、PiP↔PictureInPicture、RefreshCw↔RefreshCcw、Gauge↔GaugeCircle、Subtitles↔Captions、Monitor↔MonitorPlay、Repeat↔Repeat1、MoreVertical↔MoreHorizontal），`.iptv-osd-bar` 同享。测试用例见 TEST-CASES.md TOAST-001~006 / PLAYER-016~01B。注意：`toastBus.ts` 为 `.ts` 文件不可写 JSX，图标一律 `createElement`；`.up-player-toast` 样式废弃但保留（PlayerToast 不再自绘）。

- **ADR-016 播放器操作提示独立右上角 + TV 端 IPTV 交互（2026-08-05）**
  PlayerToast 恢复**独立右上角渲染**（撤销 ADR-015 中「转发 sonner」）：播放器**操作类**提示（播放/暂停、音量、切线路、切频道、频道号输入等）显示于右上角 `.up-player-toast`，与全局 sonner toast（中间靠上，错误/成功/警告）**双轨并存**。`show(msg, duration, type)` 支持 success/warning/error 语义色图标，统一 3s；新增命令式 `playerToast()`（PlayerToast.tsx 导出）供组件顶层 hooks（ToastTrigger/useTVInput/useIPTVNavigation/useKeyboardShortcuts 在 ToastProvider 外）调用。IPTV 切线路提示由 `useIPTVNavigation` 改走 playerToast（右上角）。IPTV 播放页：① 非 TV 端放大图标从 header 移到**右下角**（`.iptv-player-page .up-header-fullscreen-btn` CSS fixed）；② **TV 端进入默认请求全屏**（IPTVPlayer 挂载时 requestFullscreen，浏览器无手势拦截时静默）且 `PlayerHeader showFullscreenButton={mode==='iptv' && platform!=='tv'}` 隐藏图标；③ TV 遥控器音量 → `showVolumePopup` 弹音量柱 + 右上角「音量 xx%」；④ TV 换频道/频道号输入 → 右上角「已切换到{频道名}」。CSS 微调：进度条两端 padding（space-sm）、倍速 hover 文本随图标缩放（`.up-speed-label` transition+scale）、更多弹窗文本间距（gap space-md + 垂直 padding space-md）、`up-time-display` 亮色主题适配（rgba 白字在亮底消失 → `--color-text-secondary`）。测试用例：TEST-CASES.md TOAST-007/008 + IPTVP-030~034。

- **ADR-017 预加载①②（点播首分片预取 + 剧集连播预加载，2026-08-05）**
  ① `HLSAdapter` LEVEL_LOADED 非直播分支置 `config.startFragPrefetch=true`：manifest 解析后立即拉首分片（不等 play），缩短点播首帧延迟；直播保持 false（按 live edge 拉取）。② `useNextEpisodePreload`（Player 页）：当前集 `playing` 后 300ms 预拉**下一集** manifest + 首分片（落浏览器 HTTP 缓存，切集秒起播）。约束：**仅 Wi-Fi**（`navigator.connection` effectiveType/type 命中 cellular/2g~5g 跳过，桌面无 API 默认允许）、非末集、串行单任务（AbortController，新任务 abort 旧）、只拉 1 个分片、失败静默、master 清单只预拉清单不拉分片（`extractFirstSegmentUrl` 无 `#EXTINF` 返回 null）。预加载默认开（不进设置页，用户定）。测试：`useNextEpisodePreload.test.ts` 8 用例（isWifiConnection 4 + extractFirstSegmentUrl 4）。调研结论：hls.js `startFragPrefetch`/`autoStartLoad` 为关键开关；Shaka `PreloadManager` 分阶段（playing 后）+ 串行；ExoPlayer PreloadManager 列表预加载；大厂只预拉前 3~5s。

- **ADR-018 播放链路接口兜底排查 + EPG 请求合并（2026-08-05）**
  排查"接口报错无限调用"：播放流链路均**有上限**——hls.js `errorCount<3` 重试、A3/C1/D1 每 URL 仅 1 次（`buildProxyUrl` 幂等：先 `unwrapProxy` 再包，重复调用 URL 不变）、CMS `fetchInitiatedRef`+AbortController 防重；真正的"无限调用"集中在 **EPG**——`handleOpenProgramGuide` 每次点击都阻塞 `await fetchAndParseEPG()`（缓存过期时全量拉取 20s），弹窗迟迟不弹、用户重复点击堆积并发请求。修复：① `fetchAndParseEPG` 加**请求合并**（模块级 `Map<customUrl, Promise>`，在途共享一次网络拉取，完成后清空）；② 节目单改为**缓存优先 + 非阻塞**（先 `setShowProgramGuide(true)` 弹窗，`getCachedEPGData` 缓存渲染，网络 `fetchAndParseEPG` 后台刷新，失败静默保留缓存）。另有：仅含音频（C1）/裸流（D1）分支主动 `setPlayerLoading(false)`，修复**中间 loading 动画一直转**（原 `isPlayerLoading` 仅 `canplay` 清除，纯音频可播但无视频帧 / 解码失败时 canplay 不触发 → spinner 永转）。

- **ADR-014 D1 裸流降级识别（fail-and-retry，2026-08-05）**
  裸流（无扩展名 / 裸 TS / FLV，`detectVideoSourceType` 误判为 m3u8）识别采用**「失败降级重试」而非「预先 Content-Type 嗅探」**：HLSAdapter 拆分 `manifestParsingError`（拿到内容但解析失败 → 上报 `code='BARE_STREAM'`）与 `manifestLoadError`（网络层失败 → 维持「频道源不可用」走 A3）。UniversalPlayer 收到 BARE_STREAM 后在 IPTV 模式用 `degradedType` state 临时覆盖播放器类型为 `flv`（URL 变化复位），重建 `MPEGTSAdapter` 重试**同一 URL**（每 URL 仅 1 次）。worker `m3u8-proxy` 对非 `#EXTM3U` 内容（`isM3U8Content`，兼容 UTF-8 BOM）直接透传源站二进制（不重写、不缓存）——代理 URL 无需改写即可被 mpegts.js 拉流。**零额外请求**（复用必然失败的 manifest 请求）。对比预先嗅探省掉 Range/abort/CORS 三个坑；缺点为首帧多一次解析失败延迟。测试：`HLSAdapter.test.ts` 2 用例（错误拆分）、`m3u8Proxy.test.ts` isM3U8Content 4 用例；配套 `worker/m3u8-proxy.d.ts` 同步 `isM3U8Content` 声明。

- **ADR-019 三源统一管理 + IPTV 检测按组隔离 + 构建告警收敛（2026-08-07）**
  1) **源管理收敛**：`useSourceManagerStore` 成为视频/IP/EPG 三源**单一来源**，`bootstrap()` 仅在持久化列表为空时注入默认源（保证设置页启用状态回显，避免每次覆盖用户配置）；`syncConsumers(scene)` 统一回写各 consumer（IPTV 的 `aggregatorUrls`/`sourceNames`、各 indices），删除页面侧重复的 aggregatorUrls 同步 effect；`setEnabled` 对 IPTV/EPG 加「**至少一个源**」兜底（停用最后一个被拒绝；`setAllEnabled` 已于 2026-08-12 删除，见 ADR-020）；缓存校验从 `sort()` 改为**严格顺序比较**（`JSON.stringify(sourceUrls)`），保证「顺序 = 启用顺序」。入口：`main.tsx` 启动时 `useSourceManagerStore.getState().bootstrap()`。
  2) **IPTV 检测按组隔离**：`channel.isAvailable`（全局共享，跨 tab 残留）改为 `useIPTVStore.availabilityResults: Record<groupId, Record<channelId, boolean>>`（key = `selectedGroup ?? '__all__'`），`checkAvailability`/`abortAvailabilityCheck` 只读写当前组，卡片显示改用 `availability` prop。`channel.isAvailable` 类型字段已删除。
  3) **按钮按压机制对齐**：全局按压走 CSS `scale` 属性（非 transform）+ `:has(> *)`，排除 `.settings-page *`/`.no-press`；proxy-setup 不在 settings-page 内故需手动对齐 `.settings-row`（框 `scale:none` + 内部内容 `scale:0.96`），避免图标/文本位移。ConfirmDialog 确认/取消按钮胶囊化（`rounded-full`）。删除确认框按钮与设置页导出按钮按压效果统一。
  4) **构建告警收敛**：4 个 non-functional warning 只处理 2 个——① `SourceChecker` 改直接导入 `useIPTVStore`（消除 reexport 循环）、④ `chunkSizeWarningLimit 800→900`（dash-vendor 804KB，lazy 加载不阻塞首屏）；② `state-vendor→react-vendor` 循环、③ `epgService` 动态/静态混用**刻意不动**（非 bug，改动手动 chunks 需全站回归、收益仅整洁）。完整分析见 `docs/warning-review.md`。
  5) **GroupPicker 折叠修复**：折叠测量原用 `child.offsetTop` 依赖 offsetParent（`.grouppicker__hot-tags` 未设 position → offsetTop 混入页面绝对位置 → twoRowHeight 巨大、折叠失效露出第 3 行）。改用 `getBoundingClientRect()` 相对容器顶部计算行位置与折叠高度，精确「超 2 行折叠成完整 2 行 + 展开按钮」。

- **ADR-020 IPTV 代理收敛 + 源管理拖拽 + 卡片占位/动画 + Android CI（2026-08-12）**
  1) **IPTV 源接口无条件走 IPTV 代理**：新增 `buildSourceProxyUrl(url, proxyUrl)`——源 M3U 拉取强制走 `/m3u8-proxy` 端点，**不经过 `shouldProxy` 的直连白名单/proxyPattern 判断**（与频道播放链接不同：播放链接才走代理规则逻辑）。`fetchAndParsePlaylist` 移除 `corsProxy` 参数、源拉取改用 `settings.proxyUrl`（`useIPTVStore` 调用处同步不再传 `useSettingsStore.getState().corsProxy` 并删除该 import）。`buildCorsProxyUrl`（iptvService）保留给其余视频/EPG 文本拉取场景。
  2) **台标不再走 file-proxy**：`channelLogo.ts` 的 `toSafeLogoUrl` 从「http 台标经 `{proxy}/file-proxy?url=` 转 https，无代理丢弃」改为「http/https 一律原样直连」——避免 IPTV 页数百张卡片每次刷新批量打 worker 消耗请求额度。`resolveChannelLogoCandidates` 的 `proxyUrl` 参数保留（`_proxyUrl`）仅为兼容历史调用点，已不再用于代理改写。http 台标在 https 部署若被混合内容拦截则自然失败进入下一候选/字母占位。
  3) **源管理删除「全部启用/停用」+ 拖拽排序**：`SourceManager` 工具栏删除「全部停用/全部启用」按钮与 `onSetAllEnabled` prop；`useSourceManagerStore` 删除 `setAllEnabled`，新增 `reorder(scene, fromIndex, toIndex)`（更新 order + 同步 consumer）。`source-manager__item` 改 `draggable`，左侧新增 `.source-manager__item-drag` 拖拽柄（GripVertical），拖拽中用 `.is-dragging`（半透明+虚线边框）/`.is-drop-target`（主色边框+顶部高亮线）指示。**注意**：原生 HTML5 DnD 在触摸设备不友好，移动端拖拽体验依赖浏览器支持；如需完整移动端拖拽后续可换 pointer 事件/DnD 库。`VideoTab`/`IptvTab` 同步删除 `setAllEnabled`/`onSetAllEnabled` 绑定。E2E `SET-052` 改为逐个停用验证「至少保留一个源」兜底。
  4) **LazyImage 失败占位两处修复**：① `fallbackSrc` 为空字符串（如 IPTV 卡传 `fallbackSrc=""` 强制不渲染品牌图）时，失败态**不再渲染 fallback img**——避免 `<img src="" alt={台名}>` 被浏览器显示 alt 文本（台名）+ 破损图标；此时由调用方独立的占位元素（如 `.iptv-card-cover__glyph` 的 Tv 图标）兜底。② 超时挂起路径（`setTimeout` 候选链用尽 `setError(true)`）**补调 `onError`**（与 `handleError` 一致），否则 IPTV 卡片等依赖 `onError` 切换占位（Tv 图标）的调用方在「请求挂起超时」时不会更新占位。
  5) **IPTV 卡片出场动画对齐收藏页视频 tab**：`animations.css` 新增 `.animate-fade-in-up`（`fadeInUp 0.4s --ease-out-expo`，淡入+上移 12px）；`IPTVChannelCard` 卡片 className 从弱弱的 `animate-card-enter`（cardFadeIn：opacity 0.4→1，0.18s）改为 `animate-fade-in-up`（明显淡入+上移）。`IPTV/index.tsx` 的 `.iptv-channel-grid` 加 `key`（`selectedGroup+selectedSource+debouncedKeyword`）+ `animate-fade-in`：切换分组/源/搜索时网格重挂载，容器淡入 + 卡片 fadeInUp 过场（与收藏页视频 tab 一致）；收藏/历史页 IPTV tab 本就靠 `key={activeTab}` 重挂载触发同款卡片动画。IPTV 卡片封面加载失败时（`imageError`）隐藏左上角 availability-badge，保证占位图干净。
  6) **Android CI 修复 APK 缺失**：`release-android.yml` 缺 Android SDK 安装——仅 `setup-java@v4` 装 JDK，`ANDROID_HOME` 为空导致 gradle 编译失败、`apksigner` 找不到、整个 workflow 失败 → Release assets 无 APK。修复：`setup-java` 后新增 `android-actions/setup-android@v3`（`api-level: 34`，匹配 `compileSdk=34`），安装 platform 34 + build-tools（含 apksigner）+ platform-tools 并设 `ANDROID_HOME`。`dist-bak-*` 备份目录加入 `.gitignore`。

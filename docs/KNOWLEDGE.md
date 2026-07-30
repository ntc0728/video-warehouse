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
│   ├── stores/                  # Zustand 状态管理
│   │   ├── useVideoStore.ts     # 视频数据状态
│   │   ├── usePlayerStore.ts    # 播放器状态
│   │   ├── useSettingsStore.ts  # 设置状态
│   │   ├── useIPTVStore.ts      # IPTV 状态
│   │   ├── useCollectionStore.ts# 收藏状态
│   │   ├── useHistoryStore.ts   # 历史记录状态
│   │   └── index.ts             # Store 导出
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
│  - 视频数据 (useVideoStore)             │
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

**响应式断点**：
| 断点 | 宽度 | 卡片列数 |
|------|------|----------|
| Mobile | < 768px | 3 列 |
| Tablet | 768px - 1023px | 5 列 |
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

视频源配置存储在 `public/data/video-sources.json`：

```json
[
  {
    "name": "量子资源",
    "api": "https://api.example.com/api.php/provide/vod/",
    "detail": "https://api.example.com/api.php/provide/vod/detail/"
  }
]
```

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

# E2E 测试
npx playwright test    # 运行所有测试
```

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
// ✅ 推荐
const videos = useVideoStore((s) => s.videos);

// ❌ 避免
const { videos } = useVideoStore();
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

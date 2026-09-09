# 项目架构详解

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

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
│   │   └── index.ts             # Store 统一导出（useSourceManagerStore / usePageSearchStore 按需直接导入，不在此 barrel）
│   │
│   │   # 注：useRatingStore 合并入 useUserStore；useRecommendStore 随 DailyPicks 删除移除；
│   │   #     useSubtitleStore 拆分合并；useKeepAliveStore 随方案 B 移除 keep-alive 机制一并删除；
│   │   #     useHomeCategoryStore 随首页分类入口重构（2026-08-29）删除；
│   │   #     useSourceManagerStore / usePageSearchStore 按需直接引用
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

**响应式断点（主网格 `--card-cols` 终版，2026-09-07 定稿，取代 v1.7.0 的 2/3/5 与 v1.10.0 的 v6）**：
| 断点 | 宽度 | 卡片列数 |
|------|------|----------|
| Mobile | < 768px | 3 列 |
| Tablet | 768px - 1023px | 4 列 |
| Desktop | 1024px - 1279px | 5 列 |
| Large | 1280px - 1439px | 6 列 |
| Wide | 1440px - 1919px | 7 列 |
| 2K/4K | ≥ 1920px | 8 列（2200 内容区封顶，列数冻结） |
| TV | 独立体系 | 恒 8 列（不随 `--ui-scale`） |

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


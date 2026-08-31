# KinoTV

一个现代化的影视聚合平台，支持多数据源视频浏览、IPTV 直播、收藏管理和智能搜索。基于 React 18 + TypeScript 构建，支持 Web、Android 和 TV 多端适配。

## 功能特性

### 核心功能
- **多数据源聚合** - 支持多个视频采集 API 源，自动聚合影视资源
- **智能搜索** - 实时搜索过滤，支持按名称快速查找
- **分类浏览** - 按电影、剧集、综艺、动漫、纪录片等分类筛选
- **详情页面** - 完整的影片信息展示，包含简介、评分、播放列表
- **视频播放** - 多源视频播放器（HLS / DASH / MP4），适配器模式架构，支持多清晰度/音轨切换

### IPTV 直播
- **多源管理** - 支持配置多个 IPTV 数据源
- **频道分组** - 自动按分组归类频道，支持分组筛选
- **可用性检测** - 批量检测频道可用性，标记可用/不可用状态
- **收藏功能** - 频道收藏管理，快速访问常用频道

### 用户体验
- **多主题支持** - 浅色/深色/跟随系统三种主题模式
- **响应式设计** - 完美适配手机、平板、桌面和 TV 大屏
- **TV 端适配** - 支持 WebOS、Tizen、Roku、Apple TV、PlayStation、Xbox、Google TV
- **播放历史** - 自动记录播放历史，支持快速继续观看
- **收藏管理** - 影片和 IPTV 频道收藏，云端同步

### 技术亮点
- **流体设计系统** - 基于 CSS 变量的 Design Token，375px-3840px 全覆盖
- **7 档响应式断点** - 从手机到 4K TV 的完整适配
- **智能代码分割** - 路由级懒加载（失败自动重试）+ 10 路 Vendor Chunk 优化
- **离线缓存** - IndexedDB 本地缓存（idb），提升二次加载速度
- **代理转发** - Cloudflare Worker 代理 M3U8/TS/DASH 流，解决跨域问题
- **网络质量感知** - 实时评估网络质量，自适应码率切换
- **统一响应式卡片布局** - 卡片网格列数全局收敛为 2/3/5，IPTV 骨架与真实网格对齐；TV 模式顶部导航直达 IPTV

## 技术栈

### 前端核心
- **React 18** - 并发特性 + Hooks
- **TypeScript** - 类型安全
- **Vite 6** - 极速构建
- **React Router 7** - 路由管理

### UI 框架
- **Tailwind CSS** - 原子化样式
- **Radix UI** - 无障碍组件库
- **Lucide React** - 图标库

### 状态管理
- **Zustand** - 轻量级状态管理 + Persist 中间件

### 媒体处理
- **HLS.js** - HLS 流媒体播放
- **DASH.js** - DASH 流媒体播放
- **Axios** - HTTP 请求

### 存储
- **IndexedDB (idb)** - 本地数据持久化

### 构建部署
- **Cloudflare Pages** - 静态站点托管
- **Cloudflare Workers** - 边缘计算代理
- **Capacitor 6** - 原生应用打包

### 代码质量
- **ESLint** - 代码规范检查
- **Stylelint** - CSS 规范检查
- **Vitest** - 单元测试 / 组件测试
- **Playwright** - E2E 测试

### Design Token 约定
本项目视觉尺寸**一律走 CSS 变量（Design Token）**，禁止在源码硬编码 `px` 字面量：
- 图标经 `Icon` 组件（`size` 为档名 xs/sm/md/lg/xl/2xl/3xl）或 `--icon-*` token，且 `--icon-*` 必须 `calc(var(--text-<档>) * 系数)` 派生自文字 token，与 `--text-*` 共享同一条 vw 缩放曲线（TV 端改 `[data-device="tv"]` 覆盖 `--text-*` 后图标/布局自动跟随放大）
- 布局 / 间距 / 字号经 `--space-*` / `--text-*` / `--layout-*` token
- **例外（允许保留字面量，属逻辑阈值而非视觉尺寸）**：媒体查询断点、`IntersectionObserver` 的 `rootMargin`、`<img sizes>` 响应式提示、`sr-only` 的 `1px` hack、`window.innerWidth` 列数兜底
- 去硬编码统一用 `scripts/css-px-to-token.mjs` 自动替换，再人工核对 token 语义边界（严禁把跨语义尺寸硬压进同一档）
- **焦点框与设备交互**：非 TV 设备（桌面 / 移动端 Web / App，`data-device` 非 `"tv"`）全局清零键盘焦点框（`:focus-visible { outline:none; box-shadow:none }`），焦点可见性交由 hover / 可见性提示；TV 端（`[data-device="tv"]`）保留显式焦点框供遥控器导航。交互元素（如 TMDB 行左右箭头）的显隐、留白、图标↔标题间距等视觉细节一律走对应 token，禁止硬编码。

## 项目结构

```
video-warehouse/
├── src/
│   ├── assets/styles/       # 全局样式 + Design Tokens
│   ├── components/          # 通用组件
│   │   ├── ui/              # 基础 UI 组件（Radix 封装）
│   │   ├── common/          # 业务通用组件
│   │   ├── Layout/          # 布局（Sidebar、TabBar、AppLayout）
│   │   ├── UniversalPlayer/ # 多源播放器（适配器模式：HLS/DASH/原生）
│   │   ├── HeroBanner/      # 首页轮播
│   │   ├── VideoCard/       # 视频卡片
│   │   └── ...              # 其他业务组件（20+ 目录）
│   ├── hooks/               # 自定义 Hooks
│   ├── pages/               # 页面组件
│   │   ├── Home/            # 首页
│   │   ├── Browse/          # 筛选页
│   │   ├── Detail/          # 详情页
│   │   ├── Player/          # 播放页
│   │   ├── IPTV/            # IPTV 直播
│   │   ├── Settings/        # 设置页
│   │   ├── Collections/     # 收藏页
│   │   └── History/         # 历史记录
│   ├── services/            # 服务层（API、数据库）
│   ├── stores/              # Zustand 状态管理（index.ts 导出 7 个 store；useSourceManagerStore/useHomeCategoryStore/usePageSearchStore 按需直接导入）
│   ├── types/               # TypeScript 类型定义
│   ├── test/                # 测试工具（setup + custom render）
│   └── lib/                 # 工具函数
├── worker/                  # Cloudflare Workers
│   ├── m3u8-proxy.js        # M3U8 流代理
│   ├── cors-proxy.js        # CORS 代理
│   ├── wrangler.toml
│   └── wrangler-cors.toml
├── docs/page-diagrams/      # 页面原理图 + 交互式流程图（真实数据）
├── scripts/                 # 构建脚本 + Playwright E2E 测试 + 数据获取脚本
├── public/                  # 静态资源
├── AGENTS.md                # AI Agent 综合指南（架构/代理/数据源/术语）
├── CLAUDE.md                # Claude Code 指南
├── CONTEXT.md               # 领域术语 + 架构概览
└── .cursorrules             # Cursor IDE 指南
```

## 文档与架构图

### 页面原理图

`docs/page-diagrams/` 目录包含 10 个页面的布局原理图，基于真实 API 数据渲染：

| 文件 | 页面 | 说明 |
|------|------|------|
| `index.html` | 索引 | 导航到所有原理图和流程图 |
| `flowchart.html` | 流程图 | 页面导航地图 + 数据流架构 + 核心播放流程（交互式，节点可点击跳转） |
| `home.html` | 首页 | HeroBanner + 分类入口 + TMDB 视频行 |
| `browse.html` | 浏览/搜索 | 双模式搜索 + FilterBar + 无限滚动 |
| `detail.html` | 详情 | TMDB 详情 + CMS 播放源 |
| `player.html` | 播放 | UniversalPlayer + 播放线路 + 适配器选择 |
| `iptv.html` | IPTV | 频道列表 + EPG + 代理播放 |
| `settings.html` | 设置 | TMDB 配置 + CMS 源管理 + 代理配置 |
| `collections.html` | 收藏 | 影视/IPTV 收藏 + 批量操作 |
| `history.html` | 历史 | 观看时间线 + 进度条 |
| `source-checker.html` | 源检测 | CMS 源可用性检测 |
| `person.html` | 人物 | 演员/导演详情 + 作品列表 |

### 数据获取脚本

```bash
# 获取 CMS + IPTV 真实数据（生成 diagram-data.json）
node scripts/fetch-diagram-data.mjs

# 同时获取 TMDB 数据（需配置 token）
TMDB_TOKEN=xxx node scripts/fetch-diagram-data.mjs
```

### 代理配置

| 代理 | URL | 用途 |
|------|-----|------|
| Video Proxy (CORS) | `https://your-video-proxy.example.com/proxy?url=` | CMS API、M3U 文件、EPG |
| IPTV Proxy (M3U8) | `https://your-iptv-proxy.example.com/m3u8-proxy?url=` | 直播流代理 |
| TS Proxy | `https://your-iptv-proxy.example.com/ts-proxy?url=` | TS 分片代理 |

### AI Agent 指南文件

| 文件 | 目标 AI Agent | 说明 |
|------|--------------|------|
| `AGENTS.md` | Cursor / Aider / Windsurf 等 | 综合指南（架构/代理/数据源/页面/术语） |
| `CLAUDE.md` | Claude Code | 项目快速参考 |
| `.cursorrules` | Cursor IDE | 项目上下文 |
| `.github/copilot-instructions.md` | GitHub Copilot | 代码补全上下文 |
| `CONTEXT.md` | 全部 | 领域术语 + 架构概览 |

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 http://127.0.0.1:3001

### 配置 TMDB
1. 前往 [TMDB](https://www.themoviedb.org/settings/api) 申请 API 密钥（免费）
2. 进入设置页面，填入 TMDB Access Token
3. 首页将自动加载热门影视数据

## 部署指南

### Cloudflare Pages 部署

#### 前置条件
1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 安装 Wrangler CLI：
```bash
npm install -g wrangler
```

3. 登录 Cloudflare：
```bash
npx wrangler login
```

#### 部署前端
```bash
# 一键构建并部署到 Cloudflare Pages
npm run deploy:pages
```

执行流程：
1. `npm run build` - 构建生产版本（TypeScript 编译 + Vite 构建）
2. `npx wrangler pages deploy dist --project-name video-warehouse` - 部署到 Pages

部署完成后，访问 `https://video-warehouse.pages.dev`

### Cloudflare Workers 部署

#### M3U8 流代理（用于 IPTV 直播）
```bash
# 部署 M3U8 代理 Worker
npm run deploy:worker
```

部署 `worker/m3u8-proxy.js` 到 Cloudflare Workers，用于：
- 代理 M3U8/TS 流地址
- 解决 IPTV 频道跨域播放问题
- URL 重写和转发

#### CORS 代理（用于视频源 API）
```bash
# 部署 CORS 代理 Worker（worker/cors-proxy.js + wrangler-cors.toml）
npm run deploy:cors
```

部署 `worker/cors-proxy.js`，用于：
- 代理视频采集 API 请求
- 解决浏览器跨域限制

#### Worker 配置
在设置页面配置 Worker URL：
- 流代理地址：`https://your-worker.workers.dev`
- CORS 代理地址：`https://your-cors-proxy.workers.dev`

### Android 打包

#### 前置条件
1. 安装 Android Studio
2. 配置 Android SDK
3. 配置 Java/JDK

#### 初始化 Android 项目
```bash
# 首次执行，创建 Android 项目结构
npx cap add android
```

#### 一键构建 APK
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

#### 其他 Android 命令
```bash
# 一键构建（CAPACITOR=true 构建 + 同步到 Android）
npm run build:android

# 在 Android Studio 中打开项目
npm run open:android

# 生成应用图标（需要 sharp）
npm run icons:android
```

## 开发命令

### 代码质量
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

### 测试
```bash
npm run test           # Vitest 单元测试（单次运行）
npm run test:watch     # Vitest 监听模式
npm run test:coverage  # Vitest + 覆盖率报告
npx playwright test    # Playwright E2E 测试
```

### 构建与预览
```bash
npm run build         # 构建生产版本
npm run preview       # 本地预览生产版本
```

## 设计系统

### Design Tokens
所有设计变量定义在 `src/assets/styles/variables.css`，采用流体 `clamp()` 实现 375px-3840px 全覆盖：

```css
/* 间距（375px 基准 → 768px 冻结，COEFF = (MAX-MIN)/393，PREF = MIN - COEFF·375） */
--space-3xs:    clamp(1px, 0.0029rem + 0.0025vw, 2px);    /* 1→2   */
--space-2xs:    clamp(1px, -0.0568rem + 0.0051vw, 3px);   /* 1→3   */
--space-xs:     clamp(3px, 0.0086rem + 0.0076vw, 6px);    /* 3→6   */
--space-xs-plus: clamp(4px, 0.0115rem + 0.0102vw, 8px);   /* 4→8   */
--space-sm:     clamp(6px, 0.0172rem + 0.0153vw, 12px);   /* 6→12  */
--space-md:     clamp(8px, -0.0964rem + 0.0254vw, 18px);  /* 8→18  */
--space-lg:     clamp(12px, -0.2042rem + 0.0407vw, 28px); /* 12→28 */
--space-lg-xl:  clamp(14px, -0.3181rem + 0.0509vw, 34px); /* 14→34 lg↔xl 过渡档（分类快选 gap 等） */
--space-xl:     clamp(16px, -0.4313rem + 0.0611vw, 40px); /* 16→40 */
--space-2xl:    clamp(24px, -0.4084rem + 0.0814vw, 56px); /* 24→56 */
--space-3xl:    clamp(32px, -0.8626rem + 0.1221vw, 80px); /* 32→80 */

/* 字号 */
--text-xs: 12px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 18px;

/* 圆角 */
--radius-sm: clamp(3px, 0.168rem + 0.043vw, 5px);
--radius-md: clamp(6px, 0.356rem + 0.087vw, 10px);
--radius-full: 9999px;  /* 胶囊专用 */
```

### 响应式断点
| 断点 | 宽度 | 设备 |
|------|------|------|
| sm | 640px | 大屏手机 |
| md | 768px | 平板 |
| lg | 1024px | 小桌面 |
| xl | 1280px | 桌面 |
| 2xl | 1920px | 大桌面/TV |
| 3xl | 2560px | 2K 显示器 |
| 4xl | 3840px | 4K TV |

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90
- WebOS / Tizen / Roku / Apple TV / PlayStation / Xbox / Google TV

## 许可证

MIT License

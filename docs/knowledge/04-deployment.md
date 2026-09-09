# 部署文档

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

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


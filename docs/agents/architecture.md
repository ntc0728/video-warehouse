# 架构 · 分层 · 代理 · 目录 · Android 原生

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

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




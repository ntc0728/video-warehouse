---
date: 2026-09-10 14:27
module: 播放器 / UniversalPlayer·HLSAdapter（点播 + IPTV 共用）
type: fix
build: 通过（npm run build）
files:
  - src/components/UniversalPlayer/adapters/HLSAdapter.ts
---

## HLS 加载路径改为 hls.js 优先，修复「原生分支 + zstd 响应」必然失败

### 问题（用户报障）

`https://play.ly166.com:65/videos/20260824/6a8c3a41eab8874c97ef6e7e/14bd3f/index.m3u8`
在本站播放失败，同一链接其他项目正常。DevTools 表现为 `index.m3u8` 请求 `(失败)`、
类型 **media**、0.0 kB、20ms；播放器落到「源不可用」覆盖层。

### 旧逻辑

```ts
// initHls() 第一步：canPlayType 非空即走原生，hls.js 完全不参与
if (canUseNativeHls()) {
  this.video.src = this.url;
  return;
}
```

`canUseNativeHls()` 判据是 `canPlayType('application/vnd.apple.mpegurl') !== ''`。
实测本机 Chrome 152（桌面，Windows）对该 MIME 返回 `'maybe'`，因此**所有 m3u8 都走原生分支**、
hls.js 被跳过。而该源经 Cloudflare 分发，浏览器发 `Accept-Encoding: ... zstd` 时响应带
`Content-Encoding: zstd`（body 首字节 `28 b5 2f fd` = Zstandard 魔数；声明 11721 B 为压缩后、
解压后 93308 B）。Chromium 的原生媒体加载管道解不了这个编码：

```
[reqfailed] media .../index.m3u8 :: net::ERR_CONTENT_DECODING_FAILED
video.error = { code: 4, message: "PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE" }
```

其他项目能播是因为它们用 hls.js（XHR 由网络栈解压），不受该短板影响。

### 新逻辑

- **iOS / iPadOS 保留原生优先**（`isIOSPlatform()`，含 iPadOS 13+ 桌面模式 UA 的
  `MacIntel + maxTouchPoints > 1` 判定）：Apple 系统实现完整、支持 AirPlay / 系统画中画，
  且不存在上述 Content-Encoding 短板 —— 该平台行为与改动前完全一致。
- **其余平台（桌面 Chrome/Edge、Android WebView）一律 hls.js 优先**：仅当
  `HlsJs.isSupported()` 为 false 时才回退原生（无 MSE 的旧环境），两者都不可用才报
  「当前浏览器不支持 HLS 播放」。`canUseNativeHls()` 降级为纯兜底探针，注释已标注。
- 原 `!isSupported() && !('ManagedMediaSource' in window)` 的兼容判断保留（MMS 存在但
  isSupported 报 false 时仍尝试 hls.js），只是在其前面插入原生兜底分支。

### 对 IPTV 的影响（点播与 IPTV 共用 HLSAdapter，`usePlayerCore.initAdapter` 同源）

改动方向对 IPTV 是**正向**的：改动前在 Chrome/Android 上 IPTV 同样走原生，`this.hls === null`，
于是电平缓冲收敛与低延迟参数、清晰度切换、音轨、时移（getSeekableStart/End、getLiveLatency）、
`resume()` 后台恢复、错误恢复（startLoad/recoverMediaError）、D1 裸流识别全部失效；
改动后这些路径全部恢复生效。

需要留意的差异与既有兜底：

| 项 | 说明 |
| --- | --- |
| CORS | hls.js 走 XHR，比原生 no-cors 严格。IPTV 的 `shouldProxy`（iptvService.ts:182）对域名型频道**默认走 IPTV 代理**，代理侧带 CORS 头，风险可控；形如 `IP:端口` 的频道直连（`isIpHostUrl` 早退），若源站无 CORS 头则会失败 |
| 直播兜底 | 直播类 `hasProxyInjection = true`（playerCapabilities），A3 逻辑「直连失败自动切代理」仍生效；点播无该兜底，依赖 CMS 多源故障转移 |
| 点播直链 | 点播源多为 CMS 采集站，普遍带 `Access-Control-Allow-Origin`（本次验证源为 `*`） |

### 验证

- 修复前复现（同一链接、完整播放链路）：`media` 类型请求失败 + 「源不可用」；
  对照实验：覆盖 `canPlayType` 强制 hls.js → `readyState=4`、`duration=4948s`、无错误覆盖层。
- 影响面界定：本地无压缩 HLS 流走原生分支**可正常播放** → 炸点是「原生管道 + Content-Encoding」组合，非原生一概不可用。
- 修复后回归：请求类型由 `media` 变为 `xhr`，`readyState=4`、`duration=4948.38`、`error=null`、无覆盖层。
- `npm run build` 通过；`vitest run` 32 文件 / 381 用例全过。
- E2E：`iptv-player` + `player-failover` + `player` 13/13 通过；`iptv` + `regression` 35 通过。
  `regression` 有 2 项失败（首页 Hero banner `.hero-banner__bg-layer.is-active[src]` 超时），
  已 `git stash` 比对确认**基线同样失败**，与本次改动无关。

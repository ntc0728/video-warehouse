# Video Warehouse - 播放器领域术语

## 语言

**vod_id**: CMS API 返回的视频条目唯一标识。电影为线路 ID，剧集为季条目 ID。
_Avoid_: videoId, entryId

**vod_play_url**: CMS API 返回的播放地址字符串。`$$$` 分隔播放线路，`#` 分隔集数，`$` 分隔标题和 URL。
_Avoid_: playUrl, playbackUrl

**vod_play_from**: CMS API 返回的源标识字段，不需要解析，没有特殊含义。
_Avoid_: sourceName, sourceFrom

**Episode（选集）**: 剧集/综艺/动漫中的单集。`Episode.url` 为播放链接（剧集的稳定标识），`Episode.vodId` 为唯一标识（电影为线路 vod_id，剧集暂为空）。
_Avoid_: chapter, segment

**Playback Source（播放线路）**: 同一部视频内的一条可播放 URL 路径，来自 `vod_play_url` 的 `$$$` 分隔。
_Avoid_: source, line

**Adapter（适配器）**: 封装 `<video>` 元素播放逻辑的类，根据媒体类型选择 HLS/Native/DASH。热切换复用实例，冷切换销毁重建。
_Avoid_: player, handler

**Hot Switch（热切换）**: 同类型 Adapter 实例复用，仅调 `switchSource()`，避免 destroy+recreate 导致的黑屏。
_Avoid_: softSwitch, reuse

**Cold Switch（冷切换）**: 类型不同时 destroy 旧 Adapter → create 新 Adapter，需要重新 attach video 元素。
_Avoid_: hardSwitch, recreate

**Decoder Mode**: HLS 解码模式，`native`（hls.js 默认）或 `wasm`（WebAssembly 解码，buffer 限制更小）。

**Bandwidth Estimator**: 三路带宽估算器，聚合 hls.js `bandwidthEstimate`、`PerformanceObserver`、`webkitVideoDecodedByteCount`。

**CMS Source（CMS 源）**: 后端采集站 API 端点，通过 `video-sources.json` 配置。`VideoSourceConfig.id` 为域名 key（如 "cj.lzcaiji.com"），用作唯一标识。

**episodeUrl**: 播放链接 URL，用于精确匹配历史记录中的选集。存入 `HistoryRecord.episodeUrl`。

**vodId**: 视频条目的 vod_id，用于匹配选季高亮和历史记录去重。存入 `HistoryRecord.vodId`。

**cmsSourceId**: CMS 源配置的域名 key，用于匹配历史记录中的 CMS 源。存入 `HistoryRecord.cmsSourceId`。

**RecordShell**: 收藏页/历史页共用布局外壳组件。桌面方案 C（左侧 sticky 筛选栏 + 右侧卡片主区），移动方案 M6（滚动折叠双态）。
_Avoid_: CollectionLayout, HistoryLayout

**Toast Queue**: 全局 toast 队列系统。`toast.show()` 入队排队，`toast.replace()` 清空队列立即显示。ToastProvider 仅渲染 `items[0]`。

**Initial Loading vs Load More**: 无限滚动中首屏加载（无数据，显示整页 loading）与加载更多（有数据，保持网格挂载）的区分。`initialLoading = isLoading && results.length === 0`。

---

## 架构概览

四层分层架构：页面组件 (React) → Zustand Store (状态管理) → Service 层 (API 封装) → 外部数据源。

### 代理配置

| 代理 | URL | 用途 |
|------|-----|------|
| Video Proxy (CORS) | `https://your-video-proxy.example.com/proxy?url={encoded}` | CMS API、M3U 文件、EPG XML |
| IPTV Proxy (M3U8) | `https://your-iptv-proxy.example.com/m3u8-proxy?url={encoded}` | 直播流代理 |
| TS Proxy | `https://your-iptv-proxy.example.com/ts-proxy?url={encoded}` | TS 分片代理 |

TMDB API 原生支持 CORS 直连。CMS 和 IPTV 请求必须通过 Video Proxy 代理。

### 数据源

- **TMDB API v3** — `api.tmdb.org/3`，Bearer Token 认证，`language=zh-CN`
- **CMS 采集站** — 28 个源，苹果 CMS V10 API 格式，`{api}?ac=videolist&wd={keyword}` 搜索
- **IPTV M3U** — 24 个源，`#EXTINF` 格式解析频道列表
- **EPG XMLTV** — 3 个源，`<programme>` 标签解析节目单
- **IndexedDB** — 收藏、历史、EPG 缓存（AES-GCM 加密敏感字段）

### 页面原理图与流程图

位置 `docs/page-diagrams/`，包含 10 个页面原理图 + 1 个交互式流程图（`flowchart.html`）。
流程图页面节点可点击跳转到对应原理图，原理图可跳回流程图（高亮当前节点）。
数据由 `scripts/fetch-diagram-data.mjs` 从真实 API 获取，输出 `diagram-data.json`。

### AI Agent 指南

详见 `AGENTS.md`（项目根目录）。领域术语见本文件上方。

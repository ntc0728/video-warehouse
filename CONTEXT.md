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

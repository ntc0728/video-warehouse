# 数据格式 · CMS 解析 · 领域术语

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

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



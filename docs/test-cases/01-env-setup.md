# 测试环境配置（必须）

> 由 `docs/TEST-CASES.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

## 测试环境配置（必须）

> 以下配置是运行测试用例的**前置条件**。未配置将导致大量用例无法执行。
> 配置入口：设置页 `/settings`

### 必填配置

| 配置项 | 位置 | 配置值 | 用途 | 影响范围 |
|--------|------|--------|------|---------|
| **TMDB Access Token** | 设置 → TMDB → 配置 | `your_tmdb_token_here` | TMDB API 鉴权 | 首页 trending/nowPlaying/popular 等 8 个数据行、详情页 TMDB 信息、人物页、推荐数据 |
| **视频采集 CORS 代理** | 设置 → 视频源 → 配置 | `https://your-video-proxy.example.com` | CMS API 跨域代理 | 浏览页 CMS 搜索、详情页播放列表、播放页 CMS 源加载、源检测页 |
| **IPTV 流代理服务器地址** | 设置 → IPTV → 配置 | `https://your-iptv-proxy.example.com` | IPTV M3U8/TSS 流代理 | IPTV 页频道播放、IPTV 播放页、历史页 IPTV 记录 |

### 可选配置

| 配置项 | 位置 | 默认值 | 用途 |
|--------|------|--------|------|
| 视频数据源（多选） | 设置 → 视频源 | 索引 0（爱奇艺资源） | CMS 采集站 API，最多选 6 个 |
| IPTV 数据源（多选） | 设置 → IPTV | 索引 0（IPTV） | M3U 播放列表，最多选 3 个 |
| EPG 节目单源（多选） | 设置 → IPTV → 节目单源 | `http://epg.51zmt.top:8000/e.xml` | 电子节目单，最多选 3 个 |
| EPG 更新间隔 | 设置 → IPTV | 6 小时 | 节目单自动刷新周期 |
| IPTV 自动刷新 | 设置 → IPTV | 开启 | 频道列表定期自动更新 |
| 刷新间隔 | 设置 → IPTV | 24 小时 | 频道列表刷新周期 |
| 主题模式 | 设置 → 外观 | light | 浅色/深色/跟随系统 |
| TMDB 语言 | 设置 → TMDB | zh-CN | 影片标题/简介显示语言 |
| 跳过片头 | 设置 → 播放 | 关闭 | 播放时自动跳过片头 |
| 跳过片尾 | 设置 → 播放 | 关闭 | 播放结尾自动跳到下一集 |
| 自动连播 | 设置 → 播放 | 开启 | 剧集播放结束后自动播下一集 |
| 音量记忆 | 设置 → 视频源 | 关闭 | 记住上次播放音量 |
| 自动翻译字幕 | 设置 → 视频源 | 开启 | 自动调用百度翻译 API |
| 百度翻译 API | 设置 → 视频源 | 未配置 | 字幕翻译（需 App ID + Secret Key） |
| 代理规则（正则） | 设置 → IPTV | 空（全部走代理） | 匹配的 URL 不走代理 |

### 配置等级与用例覆盖

不同测试场景需要不同的配置组合：

| 配置等级 | TMDB Token | CORS 代理 | IPTV 代理 | 适用用例 |
|---------|-----------|----------|----------|---------|
| **Level 0：无配置** | 空 | 空 | 空 | HOME-001/002、SET-016、IPTV-004/005、所有"未配置"状态用例 |
| **Level 1：仅 Token** | 有效 | 空 | 空 | 首页/详情页/人物页 TMDB 数据、浏览页智能检索 |
| **Level 2：Token + CORS** | 有效 | 有效 | 空 | 浏览页 CMS 搜索、详情页播放列表、播放页 CMS 源 |
| **Level 3：全配置** | 有效 | 有效 | 有效 | 所有用例（完整功能验证） |

### 配置检查清单

执行测试前，逐项确认：

```
[ ] TMDB Access Token 已配置：
    your_tmdb_token_here
    （可在设置页"测试连接"验证 → 应返回"TMDB 连接正常"）

[ ] 视频采集 CORS 代理已配置：
    https://your-video-proxy.example.com
    （可在设置页"测试连接"验证 → 应返回"CORS 代理连接正常"）

[ ] IPTV 流代理服务器地址已配置：
    https://your-iptv-proxy.example.com
    （可在设置页"测试连接"验证 → 应返回"代理连接正常"）

[ ] 视频数据源至少选中 1 个（默认索引 0：爱奇艺资源）
[ ] IPTV 数据源至少选中 1 个（默认索引 0：IPTV）
[ ] EPG 节目单源已选中（默认 http://epg.51zmt.top:8000/e.xml）
[ ] 浏览器为 Chrome / Edge / Safari 任意现代版本（不再依赖 viewTransition API，已移除）
[ ] 网络连接正常（可访问 TMDB API 和 CMS 源）
```

### 代理 URL 格式参考

| 代理类型 | 配置值（设置页填入） | 实际请求格式 | 示例 |
|---------|-------------------|-------------|------|
| CORS 代理（视频采集） | `https://your-video-proxy.example.com` | `{配置值}/proxy?url={encoded}` | `https://your-video-proxy.example.com/proxy?url=https%3A%2F%2Fapi.example.com%2Fvideo` |
| IPTV 流代理（M3U8） | `https://your-iptv-proxy.example.com` | `{配置值}/m3u8-proxy?url={encoded}` | `https://your-iptv-proxy.example.com/m3u8-proxy?url=http%3A%2F%2F101.35.240.114%3A88%2Flive.php%3Fid%3DCCTV1` |
| TS 分片代理 | （由 m3u8-proxy 内部自动处理） | `{配置值}/ts-proxy?url={encoded}` | `https://your-iptv-proxy.example.com/ts-proxy?url=http%3A%2F%2F...` |

> **注意**：CORS 代理和 IPTV 代理是两个独立的 Cloudflare Worker，部署在不同域名。代理不可用时，CMS 搜索和 IPTV 播放将失败，但 TMDB 数据（首页/详情/人物）不受影响。

---


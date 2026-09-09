# API 文档

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

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

视频源配置存储在 `public/data/video-sources.json`（**嵌套对象结构**，`api_site` 以域名/ID 为 key；`sourceService.getVideoSources()` 用 `Object.entries(data.api_site)` 展开为 `{ id, name, api, detail }` 数组）：

```json
{
  "cache_time": 7200,
  "api_site": {
    "iqiyizyapi.com": {
      "name": "爱奇艺资源",
      "api": "https://iqiyizyapi.com/api.php/provide/vod",
      "detail": "https://iqiyizyapi.com"
    },
    "dbzy.tv": {
      "name": "豆瓣资源",
      "api": "https://caiji.dbzy5.com/api.php/provide/vod",
      "detail": "https://dbzy.tv"
    }
  }
}
```

> 增删源：在 `api_site` 下增删键即可（key 即源 id，须唯一）。设置页「视频源」多选索引即按此对象展开后的数组下标。

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


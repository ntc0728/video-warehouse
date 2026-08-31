/**
 * fetch-diagram-data.mjs — 通用数据获取脚本
 *
 * 从真实 API 获取 TMDB / CMS / IPTV 数据，输出 JSON 供 docs/page-diagrams 页面使用。
 *
 * 用法：
 *   node scripts/fetch-diagram-data.mjs                      # 默认抓取 CMS + IPTV
 *   TMDB_TOKEN=xxx node scripts/fetch-diagram-data.mjs       # 同时抓取 TMDB
 *   node scripts/fetch-diagram-data.mjs --tmdb-token=xxx     # 同上
 *
 * 代理配置：
 *   VIDEO_PROXY  = https://your-video-proxy.example.com  (CORS 代理，用于 CMS API / M3U 文件获取)
 *   IPTV_PROXY   = https://your-iptv-proxy.example.com   (M3U8 流代理，用于播放链接)
 *
 * 输出：docs/page-diagrams/diagram-data.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// 加载项目根目录的 .env.local 文件
config({ path: resolve(ROOT, '.env.local') });

// ── 配置 ──────────────────────────────────────────
const VIDEO_PROXY = process.env.VIDEO_PROXY || 'https://your-video-proxy.example.com';
const IPTV_PROXY = process.env.IPTV_PROXY || 'https://your-iptv-proxy.example.com';
const TMDB_BASE = 'https://api.tmdb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// 从命令行或环境变量获取 TMDB token
const argToken = process.argv.find((a) => a.startsWith('--tmdb-token='))?.split('=')[1];
const TMDB_TOKEN = argToken || process.env.TMDB_TOKEN || process.env.VITE_TMDB_ACCESS_TOKEN || '';

const OUTPUT_PATH = resolve(ROOT, 'docs/page-diagrams/diagram-data.json');

// ── 工具函数 ──────────────────────────────────────

/** 通过 video CORS 代理获取 JSON */
async function fetchViaProxy(targetUrl, options = {}) {
  const proxyUrl = `${VIDEO_PROXY}/proxy?url=${encodeURIComponent(targetUrl)}`;
  try {
    const resp = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(options.timeout || 15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn(`  [proxy] 获取失败: ${targetUrl.slice(0, 80)}... → ${err.message}`);
    return null;
  }
}

/** 通过 video CORS 代理获取文本 */
async function fetchTextViaProxy(targetUrl, options = {}) {
  const proxyUrl = `${VIDEO_PROXY}/proxy?url=${encodeURIComponent(targetUrl)}`;
  try {
    const resp = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(options.timeout || 15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } catch (err) {
    console.warn(`  [proxy] 获取文本失败: ${targetUrl.slice(0, 80)}... → ${err.message}`);
    return null;
  }
}

/** 直接获取 JSON（不走代理，用于 TMDB — 它支持 CORS） */
async function fetchDirect(url, options = {}) {
  try {
    const resp = await fetch(url, {
      headers: options.headers || {},
      signal: AbortSignal.timeout(options.timeout || 10000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn(`  [direct] 获取失败: ${url.slice(0, 80)}... → ${err.message}`);
    return null;
  }
}

// ── TMDB 数据获取 ──────────────────────────────────

async function fetchTMDB(endpoint, params = {}) {
  if (!TMDB_TOKEN) return null;
  const searchParams = new URLSearchParams({ language: 'zh-CN', ...params });
  const url = `${TMDB_BASE}${endpoint}?${searchParams}`;
  return fetchDirect(url, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  });
}

function tmdbImage(path, size = 'w500') {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function fetchAllTMDBData() {
  if (!TMDB_TOKEN) {
    console.log('  [TMDB] 未配置 token，跳过 TMDB 数据获取');
    return null;
  }
  console.log('  [TMDB] 开始获取 TMDB 数据...');

  const data = {};

  // Trending
  const trending = await fetchTMDB('/trending/all/day', { page: 1 });
  data.trending = trending?.results?.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title || item.name,
    originalTitle: item.original_title || item.original_name,
    overview: item.overview,
    poster: tmdbImage(item.poster_path),
    backdrop: tmdbImage(item.backdrop_path, 'w1280'),
    rating: item.vote_average?.toFixed(1),
    year: (item.release_date || item.first_air_date || '').slice(0, 4),
    mediaType: item.media_type,
    genreIds: item.genre_ids,
  })) || [];

  // Now Playing
  const nowPlaying = await fetchTMDB('/movie/now_playing', { page: 1, region: 'CN' });
  data.nowPlaying = nowPlaying?.results?.slice(0, 6).map(mapTMDBMovie) || [];

  // Popular Movies
  const popularMovies = await fetchTMDB('/movie/popular', { page: 1, region: 'CN' });
  data.popularMovies = popularMovies?.results?.slice(0, 6).map(mapTMDBMovie) || [];

  // Top Rated Movies
  const topRatedMovies = await fetchTMDB('/movie/top_rated', { page: 1, region: 'CN' });
  data.topRatedMovies = topRatedMovies?.results?.slice(0, 6).map(mapTMDBMovie) || [];

  // Upcoming Movies
  const upcoming = await fetchTMDB('/movie/upcoming', { page: 1, region: 'CN' });
  data.upcomingMovies = upcoming?.results?.slice(0, 6).map(mapTMDBMovie) || [];

  // Popular TV
  const popularTv = await fetchTMDB('/tv/popular', { page: 1 });
  data.popularTv = popularTv?.results?.slice(0, 6).map(mapTMDBTV) || [];

  // Top Rated TV
  const topRatedTv = await fetchTMDB('/tv/top_rated', { page: 1 });
  data.topRatedTv = topRatedTv?.results?.slice(0, 6).map(mapTMDBTV) || [];

  // Airing Today TV
  const airingToday = await fetchTMDB('/tv/airing_today', { page: 1 });
  data.airingTodayTv = airingToday?.results?.slice(0, 6).map(mapTMDBTV) || [];

  // Genres
  const movieGenres = await fetchTMDB('/genre/movie/list');
  data.movieGenres = movieGenres?.genres || [];
  const tvGenres = await fetchTMDB('/genre/tv/list');
  data.tvGenres = tvGenres?.genres || [];

  // Discover sample (popular movies sorted by vote_average)
  const discover = await fetchTMDB('/discover/movie', {
    page: 1,
    sort_by: 'vote_average.desc',
    'vote_count.gte': '50',
  });
  data.discoverSample = discover?.results?.slice(0, 12).map(mapTMDBMovie) || [];

  // Search sample
  const searchResult = await fetchTMDB('/search/multi', { query: '奥本海默', page: 1 });
  data.searchSample = searchResult?.results?.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title || item.name,
    poster: tmdbImage(item.poster_path),
    rating: item.vote_average?.toFixed(1),
    year: (item.release_date || item.first_air_date || '').slice(0, 4),
    mediaType: item.media_type,
    overview: item.overview,
  })) || [];

  // Person sample (popular person)
  const personDetail = await fetchTMDB('/person/500', {});
  if (personDetail) {
    data.personSample = {
      id: personDetail.id,
      name: personDetail.name,
      biography: personDetail.biography,
      profile: tmdbImage(personDetail.profile_path, 'h632'),
      birthday: personDetail.birthday,
      placeOfBirth: personDetail.place_of_birth,
      knownFor: personDetail.known_for_department,
    };
    const personMovies = await fetchTMDB('/person/500/movie_credits');
    data.personSample.movies = personMovies?.cast?.slice(0, 10).map((m) => ({
      id: m.id,
      title: m.title,
      poster: tmdbImage(m.poster_path),
      rating: m.vote_average?.toFixed(1),
      year: (m.release_date || '').slice(0, 4),
      character: m.character,
    })) || [];
  }

  // Movie detail sample (for detail page)
  if (data.trending.length > 0) {
    const sampleId = data.trending[0].id;
    const detail = data.trending[0].mediaType === 'movie'
      ? await fetchTMDB(`/movie/${sampleId}`, { append_to_response: 'credits,images,videos,similar,recommendations' })
      : await fetchTMDB(`/tv/${sampleId}`, { append_to_response: 'credits,images,videos,similar,recommendations' });
    if (detail) {
      data.detailSample = {
        id: detail.id,
        title: detail.title || detail.name,
        overview: detail.overview,
        poster: tmdbImage(detail.poster_path),
        backdrop: tmdbImage(detail.backdrop_path, 'w1280'),
        rating: detail.vote_average?.toFixed(1),
        year: (detail.release_date || detail.first_air_date || '').slice(0, 4),
        genres: detail.genres?.map((g) => g.name) || [],
        runtime: detail.runtime || detail.episode_run_time?.[0],
        cast: detail.credits?.cast?.slice(0, 8).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile: tmdbImage(c.profile_path, 'w185'),
        })) || [],
        recommendations: detail.recommendations?.results?.slice(0, 6).map(mapTMDBMovie) || [],
        images: {
          backdrops: detail.images?.backdrops?.slice(0, 6).map((img) => tmdbImage(img.file_path, 'w780')) || [],
          posters: detail.images?.posters?.slice(0, 4).map((img) => tmdbImage(img.file_path, 'w500')) || [],
        },
      };
    }
  }

  console.log(`  [TMDB] 获取完成: trending=${data.trending.length}, nowPlaying=${data.nowPlaying.length}, ...`);
  return data;
}

function mapTMDBMovie(m) {
  return {
    id: m.id,
    title: m.title,
    overview: m.overview,
    poster: tmdbImage(m.poster_path),
    backdrop: tmdbImage(m.backdrop_path, 'w1280'),
    rating: m.vote_average?.toFixed(1),
    year: (m.release_date || '').slice(0, 4),
    genreIds: m.genre_ids,
  };
}

function mapTMDBTV(t) {
  return {
    id: t.id,
    title: t.name,
    overview: t.overview,
    poster: tmdbImage(t.poster_path),
    backdrop: tmdbImage(t.backdrop_path, 'w1280'),
    rating: t.vote_average?.toFixed(1),
    year: (t.first_air_date || '').slice(0, 4),
    genreIds: t.genre_ids,
    originCountry: t.origin_country,
  };
}

// ── CMS 数据获取 ──────────────────────────────────

async function fetchAllCMSData() {
  console.log('  [CMS] 开始获取 CMS 采集站数据...');

  // 读取源配置
  const sourcesPath = resolve(ROOT, 'public/data/video-sources.json');
  const sourcesRaw = readFileSync(sourcesPath, 'utf-8');
  const sourcesConfig = JSON.parse(sourcesRaw);
  const sources = Object.entries(sourcesConfig.api_site).map(([id, val]) => ({
    id,
    name: val.name,
    api: val.api,
    detail: val.detail,
  }));

  // 源列表（供 settings 和 source-checker 页面用）
  const sourceList = sources.map((s) => ({ id: s.id, name: s.name, api: s.api }));

  // 检测前 8 个源的可用性
  const checkPromises = sources.slice(0, 8).map(async (source) => {
    const result = await fetchViaProxy(source.api, { timeout: 8000 });
    if (result && (result.list || result.code !== undefined)) {
      return {
        id: source.id,
        name: source.name,
        api: source.api,
        status: 'available',
        videoCount: result.total || result.list?.length || 0,
      };
    }
    return {
      id: source.id,
      name: source.name,
      api: source.api,
      status: 'unavailable',
      videoCount: 0,
      error: '无响应或格式错误',
    };
  });
  const sourceStatus = await Promise.all(checkPromises);

  // 搜索 "奥本海默" 从前 3 个可用源
  const searchKeyword = '奥本海默';
  const availableSources = sourceStatus.filter((s) => s.status === 'available').slice(0, 3);
  const searchResults = await Promise.all(
    availableSources.map(async (source) => {
      const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(searchKeyword)}`;
      const result = await fetchViaProxy(searchUrl, { timeout: 10000 });
      const items = result?.list?.slice(0, 6).map((item) => ({
        vodId: item.vod_id,
        title: item.vod_name,
        poster: item.vod_pic,
        year: item.vod_year,
        type: item.vod_class,
        area: item.vod_area,
        actor: item.vod_actor?.slice(0, 50),
        director: item.vod_director?.slice(0, 50),
        content: item.vod_content?.slice(0, 200),
      })) || [];
      return {
        sourceId: source.id,
        sourceName: source.name,
        count: result?.total || items.length,
        items,
      };
    })
  );

  // 获取一个视频详情（用于 detail/player 页面）
  let videoDetail = null;
  if (searchResults.length > 0 && searchResults[0].items.length > 0) {
    const firstItem = searchResults[0].items[0];
    const source = sources.find((s) => s.id === searchResults[0].sourceId);
    if (source && firstItem.vodId) {
      const detailUrl = `${source.api}?ac=videolist&ids=${firstItem.vodId}`;
      const result = await fetchViaProxy(detailUrl, { timeout: 10000 });
      if (result?.list?.[0]) {
        const item = result.list[0];
        videoDetail = {
          vodId: item.vod_id,
          title: item.vod_name,
          poster: item.vod_pic,
          year: item.vod_year,
          type: item.vod_class,
          area: item.vod_area,
          actor: item.vod_actor,
          director: item.vod_director,
          content: item.vod_content,
          duration: item.vod_duration,
          playFrom: item.vod_play_from,
          // 解析播放线路
          playLines: parsePlayUrl(item.vod_play_url, item.vod_play_from),
        };
      }
    }
  }

  console.log(`  [CMS] 获取完成: 源=${sourceList.length}, 可用=${sourceStatus.filter(s=>s.status==='available').length}, 搜索结果=${searchResults.length}`);
  return {
    sourceList,
    sourceStatus,
    searchKeyword,
    searchResults,
    videoDetail,
  };
}

/** 解析 CMS vod_play_url */
function parsePlayUrl(vodPlayUrl, vodPlayFrom) {
  if (!vodPlayUrl) return [];
  const lines = vodPlayUrl.split('$$$');
  const fromNames = (vodPlayFrom || '').split('$$$');
  return lines.map((line, idx) => {
    const episodes = line.split('#').filter(Boolean).map((ep) => {
      const parts = ep.split('$');
      return {
        title: parts[0] || `第${idx + 1}集`,
        url: parts[1] || '',
      };
    });
    return {
      lineName: fromNames[idx] || `线路${idx + 1}`,
      episodes,
    };
  });
}

// ── IPTV 数据获取 ──────────────────────────────────

async function fetchAllIPTVData() {
  console.log('  [IPTV] 开始获取 IPTV 直播源数据...');

  const sourcesPath = resolve(ROOT, 'public/data/iptv-sources.json');
  const sourcesRaw = readFileSync(sourcesPath, 'utf-8');
  const iptvSources = JSON.parse(sourcesRaw);

  // 获取前 3 个源
  const sourcesToFetch = iptvSources.slice(0, 3);
  const allChannels = [];
  const sourceStatus = [];

  for (const source of sourcesToFetch) {
    console.log(`    获取: ${source.name}...`);
    const text = await fetchTextViaProxy(source.url, { timeout: 20000 });
    if (!text) {
      sourceStatus.push({ name: source.name, url: source.url, status: 'failed', channelCount: 0 });
      continue;
    }
    const channels = parseM3U(text, source.name);
    allChannels.push(...channels);
    sourceStatus.push({ name: source.name, url: source.url, status: 'ok', channelCount: channels.length });
  }

  // 按 group 去重，取前 60 个频道
  const seen = new Set();
  const uniqueChannels = [];
  for (const ch of allChannels) {
    const key = `${ch.name}-${ch.group || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // 构建代理播放 URL
    ch.proxiedUrl = `${IPTV_PROXY}/m3u8-proxy?url=${encodeURIComponent(ch.url)}`;
    uniqueChannels.push(ch);
    if (uniqueChannels.length >= 60) break;
  }

  // 按 group 分组
  const groups = {};
  for (const ch of uniqueChannels) {
    const g = ch.group || '未分组';
    if (!groups[g]) groups[g] = [];
    groups[g].push(ch);
  }

  // EPG 源
  const epgPath = resolve(ROOT, 'public/data/epg-sources.json');
  const epgSources = JSON.parse(readFileSync(epgPath, 'utf-8'));

  console.log(`  [IPTV] 获取完成: 频道=${uniqueChannels.length}, 分组=${Object.keys(groups).length}`);
  return {
    sourceStatus,
    channels: uniqueChannels,
    groups,
    epgSources,
  };
}

/** 解析 M3U 文件 */
function parseM3U(content, sourceName) {
  const channels = [];
  const lines = content.split('\n');
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const info = line.substring(8);
      // 提取属性
      const logoMatch = info.match(/tvg-logo="([^"]*)"/);
      const groupMatch = info.match(/group-title="([^"]*)"/);
      const tvgIdMatch = info.match(/tvg-id="([^"]*)"/);
      // 频道名 = 最后一个逗号后面的内容
      const commaIdx = info.lastIndexOf(',');
      const name = commaIdx >= 0 ? info.substring(commaIdx + 1).trim() : info.trim();

      current = {
        id: `${sourceName}-${channels.length}`,
        name,
        logo: logoMatch?.[1] || '',
        group: groupMatch?.[1] || '未分组',
        tvgId: tvgIdMatch?.[1] || '',
        sourceName,
        url: '',
      };
    } else if (line && !line.startsWith('#') && current) {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }
  return channels;
}

// ── 主函数 ──────────────────────────────────────────

async function main() {
  console.log('═══ Video Warehouse 页面原理图数据获取脚本 ═══');
  console.log(`  Video Proxy: ${VIDEO_PROXY}`);
  console.log(`  IPTV Proxy:  ${IPTV_PROXY}`);
  console.log(`  TMDB Token:  ${TMDB_TOKEN ? '已配置' : '未配置（TMDB 数据将跳过）'}`);
  console.log('');

  const result = {
    meta: {
      generatedAt: new Date().toISOString(),
      proxies: {
        videoProxy: VIDEO_PROXY,
        iptvProxy: IPTV_PROXY,
        corsProxyEndpoint: `${VIDEO_PROXY}/proxy?url=`,
        m3u8ProxyEndpoint: `${IPTV_PROXY}/m3u8-proxy?url=`,
        tsProxyEndpoint: `${IPTV_PROXY}/ts-proxy?url=`,
      },
      tmdb: {
        configured: !!TMDB_TOKEN,
        baseUrl: TMDB_BASE,
        imageBaseUrl: TMDB_IMAGE_BASE,
      },
    },
    tmdb: null,
    cms: null,
    iptv: null,
  };

  // 1. TMDB
  console.log('── 获取 TMDB 数据 ──');
  result.tmdb = await fetchAllTMDBData();

  // 2. CMS
  console.log('── 获取 CMS 采集站数据 ──');
  result.cms = await fetchAllCMSData();

  // 3. IPTV
  console.log('── 获取 IPTV 直播源数据 ──');
  result.iptv = await fetchAllIPTVData();

  // 写入文件
  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log('');
  console.log(`═══ 数据已保存到: ${OUTPUT_PATH} ═══`);
  console.log(`  文件大小: ${(JSON.stringify(result).length / 1024).toFixed(1)} KB`);
  console.log(`  TMDB:  ${result.tmdb ? '✓' : '✗ (未配置 token)'}`);
  console.log(`  CMS:   ${result.cms ? '✓ (' + result.cms.sourceList.length + ' 源)' : '✗'}`);
  console.log(`  IPTV:  ${result.iptv ? '✓ (' + result.iptv.channels.length + ' 频道)' : '✗'}`);
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});

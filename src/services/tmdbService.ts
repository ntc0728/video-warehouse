/**
 * TMDB API 服务层
 * 通过公共 httpClient（axios 实例）调用 TMDB API v3
 */
import type {
  TMDBPaginatedResponse,
  TMDBGenre,
  TMDBGenresResponse,
  TMDBConfigurationResponse,
  TMDBCountry,
  TMDBMovie,
  TMDBMovieDetail,
  TMDBTVShow,
  TMDBTVShowDetail,
  TMDBTrendingItem,
  TMDBMultiSearchResult,
  TMDBFilterOptions,
  TMDBImages,
  TMDBPerson,
  TMDBPersonDetail,
  TMDBPersonMovieCredits,
  TMDBPersonTVCredits,
} from '@/types/tmdb';
import { request, type RequestOptions } from './httpClient';
import { useSettingsStore } from '@/stores/useSettingsStore';
import axios from 'axios';

// ============================================================
// 配置
// ============================================================

const BASE_URL = 'https://api.tmdb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// ============================================================
// Token & 语言
// ============================================================

function getAccessToken(): string | null {
  const token = useSettingsStore.getState().tmdbAccessToken;
  if (token) return token;
  return import.meta.env.VITE_TMDB_ACCESS_TOKEN || null;
}

/** 获取用户设置的 TMDB 语言偏好，默认 zh-CN */
export function getLanguage(): string {
  return useSettingsStore.getState().tmdbLanguage || 'zh-CN';
}

// ============================================================
// 基础请求方法
// ============================================================

const TMDB_REQUEST_OPTIONS: RequestOptions = {
  timeout: 10000,
  retries: 1,
  retryDelay: 500,
};

/** 通用 TMDB API 请求方法，自动附加 Token 和语言参数 */
export async function fetchTMDB<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('TMDB Access Token 未配置，请在设置中配置');
  }

  // 自动附加 language
  const lang = getLanguage();
  const mergedParams: Record<string, string | number | undefined> = {
    language: lang,
    ...params,
  };

  const filteredParams: Record<string, string> = {};
  for (const [key, val] of Object.entries(mergedParams)) {
    if (val !== undefined && val !== null && val !== '') {
      filteredParams[key] = String(val);
    }
  }

  const qs = new URLSearchParams(filteredParams).toString();
  const url = `${BASE_URL}${endpoint}${qs ? `?${qs}` : ''}`;

  const response = await request<T>(url, {
    ...TMDB_REQUEST_OPTIONS,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal,
  });

  return response.data;
}

// ============================================================
// 配置
// ============================================================

let _imageConfig: TMDBConfigurationResponse | null = null;

/** 获取 TMDB 图片配置（带缓存），用于构建图片 URL */
export async function fetchConfiguration(): Promise<TMDBConfigurationResponse> {
  if (_imageConfig) return _imageConfig;
  _imageConfig = await fetchTMDB<TMDBConfigurationResponse>('/configuration');
  return _imageConfig;
}

// ============================================================
// 图片 URL
// ============================================================

/** 根据 TMDB 图片路径和尺寸构建完整图片 URL */
export function buildImageUrl(path: string | null, size: string = 'w500'): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

/**
 * 生成响应式图片 srcSet
 * 用途：避免浏览器在高 DPR 屏幕下加载 original 原始大图
 *
 * @param path TMDB 图片路径（如 /abc.jpg）
 * @param sizes 需要的尺寸数组，默认提供常用尺寸
 * @returns 正确格式的 srcSet 字符串，如 "url1 300w, url2 500w, ..."
 */
export function buildImageSrcSet(
  path: string | null,
  sizes: readonly string[] = ['w300', 'w500', 'w780', 'w1280', 'w1920'],
): string | null {
  if (!path) return null;
  return sizes
    .map(size => `${IMAGE_BASE_URL}/${size}${path} ${size.replace('w', '')}w`)
    .join(', ');
}

/**
 * 视频卡片海报（竖版 2:3）封面压缩预设。
 * 卡片显示宽度通常 ≤ 230px（桌面 12vw），2x DPR 下也只需 ~460px；
 * 用 w342 已足够清晰，文件体积约为 w500 的一半，可显著减少首页多行海报的
 * 下载/解码开销，缓解侧栏折叠/展开时图片仍在加载导致的卡顿。
 * 后续推广到所有 VideoCard 时统一引用此预设（替换各处写死的 w500）。
 */
export const POSTER_CARD_SIZES: readonly string[] = ['w185', 'w342'];

/**
 * HeroBanner 右侧缩略图（backdrop 横图）压缩尺寸。
 * 缩略图显示宽度约 180–220px，从 w500 降为 w300（backdrop 有效尺寸），
 * 体积更小、解码更快；Hero 主图保持 w1280 原画质不参与压缩。
 */
export const HERO_THUMB_SIZE = 'w300';

/** 构建原始尺寸的图片 URL */
export function buildOriginalImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/original${path}`;
}

// ============================================================
// 类型
// ============================================================

/** 获取电影类型列表 */
export async function fetchMovieGenres(language?: string): Promise<TMDBGenre[]> {
  const data = await fetchTMDB<TMDBGenresResponse>('/genre/movie/list', language ? { language } : {});
  return data.genres;
}

/** 获取电视剧类型列表 */
export async function fetchTVGenres(language?: string): Promise<TMDBGenre[]> {
  const data = await fetchTMDB<TMDBGenresResponse>('/genre/tv/list', language ? { language } : {});
  return data.genres;
}

// ============================================================
// 国家/地区
// ============================================================

/** 获取所有国家/地区列表 */
export async function fetchCountries(): Promise<TMDBCountry[]> {
  const data = await fetchTMDB<TMDBCountry[]>('/configuration/countries');
  return data;
}

// ============================================================
// 热门趋势
// ============================================================

/** 获取热门趋势内容列表 */
export async function fetchTrending(
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  timeWindow: 'day' | 'week' = 'day',
): Promise<TMDBPaginatedResponse<TMDBTrendingItem>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTrendingItem>>(`/trending/${mediaType}/${timeWindow}`);
}

// ============================================================
// 正在上映 / 热门 / 评分最高 / 即将上映
// ============================================================

/** 获取正在上映的电影列表 */
export async function fetchNowPlaying(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/now_playing', { region: 'CN' });
}

/** 获取热门电影列表 */
export async function fetchPopularMovies(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/popular', { region: 'CN' });
}

/** 获取评分最高电影列表 */
export async function fetchTopRatedMovies(page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/top_rated', { region: 'CN', page });
}

/** 获取即将上映电影列表 */
export async function fetchUpcomingMovies(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/upcoming', { region: 'CN' });
}

/** 获取热门电视剧列表 */
export async function fetchPopularTV(): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/popular');
}

/** 获取评分最高电视剧列表 */
export async function fetchTopRatedTV(page: number = 1): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/top_rated', { page });
}

/** 获取今日播出电视剧列表 */
export async function fetchAiringTodayTV(): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/airing_today');
}

// ============================================================
// 搜索
// ============================================================

/** 多类型联合搜索（电影、电视剧、人物等） */
export async function searchMulti(
  query: string,
  page: number = 1,
): Promise<TMDBPaginatedResponse<TMDBMultiSearchResult>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMultiSearchResult>>('/search/multi', {
    query,
    page,
    include_adult: 'false',
  });
}

// ============================================================
// 人物
// ============================================================

/** 搜索人物（演员、导演等） */
export async function searchPerson(
  query: string,
  page: number = 1,
): Promise<TMDBPaginatedResponse<TMDBPerson>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBPerson>>('/search/person', {
    query,
    page,
    include_adult: 'false',
  });
}

/** 获取人物详情 */
export async function fetchPersonDetail(
  personId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TMDBPersonDetail> {
  return fetchTMDB<TMDBPersonDetail>(`/person/${personId}`, {}, options);
}

/** 获取人物电影作品 */
export async function fetchPersonMovieCredits(
  personId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TMDBPersonMovieCredits> {
  return fetchTMDB<TMDBPersonMovieCredits>(`/person/${personId}/movie_credits`, {}, options);
}

/** 获取人物电视剧作品 */
export async function fetchPersonTVCredits(
  personId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TMDBPersonTVCredits> {
  return fetchTMDB<TMDBPersonTVCredits>(`/person/${personId}/tv_credits`, {}, options);
}

// ============================================================
// 发现/筛选
// ============================================================

/** 按筛选条件发现电影 */
export async function discoverMovie(
  filters: Partial<TMDBFilterOptions>,
  page: number = 1,
): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  const params: Record<string, string | number | undefined> = {
    page,
    sort_by: getSortByParam(filters.sortBy || 'popularity', filters.sortOrder || 'desc', 'movie'),
    'vote_count.gte': 50,
  };
  if (filters.genreIds?.length) params.with_genres = filters.genreIds.join(',');
  if (filters.minVoteAverage && filters.minVoteAverage > 0) params['vote_average.gte'] = filters.minVoteAverage;
  if (filters.releaseDateGte) params['primary_release_date.gte'] = filters.releaseDateGte;
  else if (filters.releaseYear) params.primary_release_year = filters.releaseYear;
  if (filters.releaseDateLte) params['primary_release_date.lte'] = filters.releaseDateLte;
  if (filters.originCountry) params.with_origin_country = filters.originCountry;
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/discover/movie', params);
}

/** 按筛选条件发现电视剧 */
export async function discoverTV(
  filters: Partial<TMDBFilterOptions>,
  page: number = 1,
): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  const params: Record<string, string | number | undefined> = {
    page,
    sort_by: getSortByParam(filters.sortBy || 'popularity', filters.sortOrder || 'desc', 'tv'),
    'vote_count.gte': 50,
  };
  if (filters.genreIds?.length) params.with_genres = filters.genreIds.join(',');
  if (filters.minVoteAverage && filters.minVoteAverage > 0) params['vote_average.gte'] = filters.minVoteAverage;
  if (filters.releaseDateGte) params['first_air_date.gte'] = filters.releaseDateGte;
  else if (filters.releaseYear) params.first_air_date_year = filters.releaseYear;
  if (filters.releaseDateLte) params['first_air_date.lte'] = filters.releaseDateLte;
  if (filters.originCountry) params.with_origin_country = filters.originCountry;
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/discover/tv', params);
}

function getSortByParam(sortBy: string, sortOrder: string, mediaType: 'movie' | 'tv'): string {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
  switch (sortBy) {
    case 'vote_average': return `vote_average.${order}`;
    case 'release_date': return `${dateField}.${order}`;
    case 'popularity':
    default: return `popularity.${order}`;
  }
}

// ============================================================
// 详情
// ============================================================

/** 获取电影详情（含演员、图片、视频等附加信息） */
export async function fetchMovieDetail(movieId: number, options: { signal?: AbortSignal } = {}): Promise<TMDBMovieDetail> {
  // 主详情只请求 credits/images/videos。
  // similar / recommendations 不放入 append_to_response —— TMDB 对 append_to_response 的
  // 组合响应有体积/超时限制，排在最末的子资源常被静默丢弃，导致详情页“相关推荐”栏目消失。
  // 改为独立并行请求，数据稳定返回（子请求失败也不影响主详情）。
  const [detail, similar, recommendations] = await Promise.all([
    fetchTMDB<TMDBMovieDetail>(`/movie/${movieId}`, {
      append_to_response: 'credits,images,videos',
    }, options),
    fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${movieId}/similar`, {}, options).catch(() => null),
    fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${movieId}/recommendations`, {}, options).catch(() => null),
  ]);
  return {
    ...detail,
    similar: similar ?? detail.similar,
    recommendations: recommendations ?? detail.recommendations,
  };
}

/** 获取电视剧详情（含演员、图片、视频等附加信息） */
export async function fetchTVDetail(tvId: number, options: { signal?: AbortSignal } = {}): Promise<TMDBTVShowDetail> {
  const [detail, similar, recommendations] = await Promise.all([
    fetchTMDB<TMDBTVShowDetail>(`/tv/${tvId}`, {
      append_to_response: 'credits,images,videos',
    }, options),
    fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>(`/tv/${tvId}/similar`, {}, options).catch(() => null),
    fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>(`/tv/${tvId}/recommendations`, {}, options).catch(() => null),
  ]);
  return {
    ...detail,
    similar: similar ?? detail.similar,
    recommendations: recommendations ?? detail.recommendations,
  };
}

/** 轻量级电影详情（仅基础字段，不含 credits/images/videos 等附加数据） */
export async function fetchMovieBasic(movieId: number, options: { signal?: AbortSignal } = {}): Promise<{ backdrop_path: string | null }> {
  return fetchTMDB<{ backdrop_path: string | null }>(`/movie/${movieId}`, {}, options);
}

/** 轻量级电视剧详情（仅基础字段，不含 credits/images/videos 等附加数据） */
export async function fetchTVBasic(tvId: number, options: { signal?: AbortSignal } = {}): Promise<{ backdrop_path: string | null }> {
  return fetchTMDB<{ backdrop_path: string | null }>(`/tv/${tvId}`, {}, options);
}

/** 获取电影推荐列表 */
export async function fetchMovieRecommendations(movieId: number): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${movieId}/recommendations`);
}

/** 获取电视剧推荐列表 */
export async function fetchTVRecommendations(tvId: number): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>(`/tv/${tvId}/recommendations`);
}

// ============================================================
// 图片
// ============================================================

/**
 * 获取影片剧照（backdrops）数据
 * 用途：HeroBanner 悬停时显示剧照轮播
 *
 * 404 兜底：部分条目没有 images 数据，axios 抛出 404 时返回空 TMDBImages，
 *          避免上游组件崩溃。
 */
export async function fetchMovieImages(
  movieId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TMDBImages> {
  try {
    return await fetchTMDB<TMDBImages>(`/movie/${movieId}/images`, {
      include_image_language: 'zh,en,null',
    }, options);
  } catch (err) {
    if (axios.isCancel(err)) throw err;
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { backdrops: [], logos: [], posters: [] };
    }
    throw err;
  }
}

/**
 * 获取剧集剧照（backdrops）数据
 * 用途：HeroBanner 悬停时显示剧照轮播
 *
 * 404 兜底：部分条目没有 images 数据，axios 抛出 404 时返回空 TMDBImages，
 *          避免上游组件崩溃。
 */
export async function fetchTVImages(
  tvId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TMDBImages> {
  try {
    return await fetchTMDB<TMDBImages>(`/tv/${tvId}/images`, {
      include_image_language: 'zh,en,null',
    }, options);
  } catch (err) {
    if (axios.isCancel(err)) throw err;
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { backdrops: [], logos: [], posters: [] };
    }
    throw err;
  }
}

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
} from '@/types/tmdb';
import { request, type RequestOptions } from './httpClient';
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
  try {
    const stored = localStorage.getItem('app-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.tmdbAccessToken || null;
    }
  } catch { /* ignore */ }
  return null;
}

export function getLanguage(): string {
  try {
    const stored = localStorage.getItem('app-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.tmdbLanguage || 'zh-CN';
    }
  } catch { /* ignore */ }
  return 'zh-CN';
}

// ============================================================
// 基础请求方法
// ============================================================

const TMDB_REQUEST_OPTIONS: RequestOptions = {
  timeout: 10000,
  retries: 1,
  retryDelay: 500,
};

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
// Configuration
// ============================================================

let _imageConfig: TMDBConfigurationResponse | null = null;

export async function fetchConfiguration(): Promise<TMDBConfigurationResponse> {
  if (_imageConfig) return _imageConfig;
  _imageConfig = await fetchTMDB<TMDBConfigurationResponse>('/configuration');
  return _imageConfig;
}

// ============================================================
// 图片 URL
// ============================================================

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
  sizes: string[] = ['w300', 'w500', 'w780', 'w1280', 'w1920'],
): string | null {
  if (!path) return null;
  return sizes
    .map(size => `${IMAGE_BASE_URL}/${size}${path} ${size.replace('w', '')}w`)
    .join(', ');
}

export function buildOriginalImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/original${path}`;
}

// ============================================================
// Genres
// ============================================================

export async function fetchMovieGenres(language?: string): Promise<TMDBGenre[]> {
  const data = await fetchTMDB<TMDBGenresResponse>('/genre/movie/list', language ? { language } : {});
  return data.genres;
}

export async function fetchTVGenres(language?: string): Promise<TMDBGenre[]> {
  const data = await fetchTMDB<TMDBGenresResponse>('/genre/tv/list', language ? { language } : {});
  return data.genres;
}

// ============================================================
// Countries
// ============================================================

export async function fetchCountries(): Promise<TMDBCountry[]> {
  const data = await fetchTMDB<TMDBCountry[]>('/configuration/countries');
  return data;
}

// ============================================================
// Trending
// ============================================================

export async function fetchTrending(
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  timeWindow: 'day' | 'week' = 'day',
): Promise<TMDBPaginatedResponse<TMDBTrendingItem>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTrendingItem>>(`/trending/${mediaType}/${timeWindow}`);
}

// ============================================================
// Now Playing / Popular / Top Rated / Upcoming
// ============================================================

export async function fetchNowPlaying(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/now_playing', { region: 'CN' });
}

export async function fetchPopularMovies(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/popular', { region: 'CN' });
}

export async function fetchTopRatedMovies(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/top_rated', { region: 'CN' });
}

export async function fetchUpcomingMovies(): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/movie/upcoming', { region: 'CN' });
}

export async function fetchPopularTV(): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/popular');
}

export async function fetchTopRatedTV(): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/top_rated');
}

export async function fetchAiringTodayTV(): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>('/tv/airing_today');
}

// ============================================================
// Search
// ============================================================

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
// Discover
// ============================================================

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
  if (filters.releaseYear) params.primary_release_year = filters.releaseYear;
  if (filters.originCountry) params.with_origin_country = filters.originCountry;
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('/discover/movie', params);
}

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
  if (filters.releaseYear) params.first_air_date_year = filters.releaseYear;
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
// Detail
// ============================================================

export async function fetchMovieDetail(movieId: number, options: { signal?: AbortSignal } = {}): Promise<TMDBMovieDetail> {
  return fetchTMDB<TMDBMovieDetail>(`/movie/${movieId}`, {
    append_to_response: 'credits,images,videos,similar,recommendations',
  }, options);
}

export async function fetchTVDetail(tvId: number, options: { signal?: AbortSignal } = {}): Promise<TMDBTVShowDetail> {
  return fetchTMDB<TMDBTVShowDetail>(`/tv/${tvId}`, {
    append_to_response: 'credits,images,videos,similar,recommendations',
  }, options);
}

export async function fetchMovieRecommendations(movieId: number): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${movieId}/recommendations`);
}

export async function fetchTVRecommendations(tvId: number): Promise<TMDBPaginatedResponse<TMDBTVShow>> {
  return fetchTMDB<TMDBPaginatedResponse<TMDBTVShow>>(`/tv/${tvId}/recommendations`);
}

// ============================================================
// Images
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

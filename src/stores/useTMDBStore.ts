/**
 * TMDB 数据 Zustand Store
 * 管理所有 TMDB API 数据：首页发现区块、搜索、Discover、Genre 缓存
 */
import { create } from 'zustand';
import type {
  TMDBMovie,
  TMDBTVShow,
  TMDBTrendingItem,
  TMDBMultiSearchResult,
  TMDBGenre,
  TMDBCountry,
  TMDBFilterOptions,
  TMDBVideoItem,
} from '@/types/tmdb';
import type { VideoType } from '@/types/video';
import {
  fetchTMDB,
  fetchTrending,
  fetchNowPlaying,
  fetchPopularMovies,
  fetchTopRatedMovies,
  fetchUpcomingMovies,
  fetchPopularTV,
  fetchTopRatedTV,
  fetchAiringTodayTV,
  searchMulti,
  discoverMovie,
  discoverTV,
  fetchMovieGenres,
  fetchTVGenres,
  fetchCountries,
  buildImageUrl,
  getLanguage,
} from '@/services/tmdbService';

// 为向后兼容重新导出
export type { TMDBVideoItem } from '@/types/tmdb';

// ============================================================
// Store 状态
// ============================================================

const DEFAULT_FILTER_OPTIONS: TMDBFilterOptions = {
  mediaType: 'all',
  genreIds: [],
  minVoteAverage: 0,
  sortBy: 'popularity',
  sortOrder: 'desc',
  releaseYear: null,
  releaseDateGte: null,
  releaseDateLte: null,
  originCountry: null,
};

interface TMDBStoreState {
  // ---- 首页数据 ----
  trending: TMDBVideoItem[];
  nowPlaying: TMDBVideoItem[];
  popularMovies: TMDBVideoItem[];
  topRatedMovies: TMDBVideoItem[];
  upcomingMovies: TMDBVideoItem[];
  popularTv: TMDBVideoItem[];
  topRatedTv: TMDBVideoItem[];
  airingTodayTv: TMDBVideoItem[];
  /** 最近一次 fetchAllHomeData 完成的时间戳（0 = 从未拉取）；TTL 过期后自动刷新 */
  homeFetchedAt: number;
  /** 启动时是否已从 localStorage 恢复首页数据（供「清除缓存」判定内存是否需要重置） */
  homeLSLoaded: boolean;

  // ---- 搜索 ----
  /** 最近一次搜索词（仅供 store 内部追踪，UI 同步应直接读 URL ?q=） */
  searchQuery: string;

  // ---- 发现 ----
  discoverResults: TMDBVideoItem[];
  discoverPagination: { page: number; totalPages: number; totalResults: number };
  /**
   * 最近一次 discover / search / top-rated 懒加载请求的最终状态
   * - null      : 从未发起过请求（初始态）
   * - 'pending' : 请求进行中（loading.discover === true 时通常为此态）
   * - 'success' : 最近一次请求已成功拿到数据
   * - 'error'   : 最近一次请求失败
   *
   * 用途：让骨架移除条件与"API 响应成功"对齐,避免快速响应(< 100ms)
   * 或请求失败时骨架闪烁。
   */
  discoverLastStatus: 'pending' | 'success' | 'error' | null;
  /**
   * 最近一次成功写入 discoverResults 的 filterOptions 快照（方案 B：无 Keep-Alive 下
   * Browse 重新挂载时据此判断「store 缓存是否对应当前筛选条件」，命中则直接回显、
   * 跳过重新请求）。搜索模式（search）成功时写入 null，表示当前结果非 discover 数据。
   */
  discoverFetchedFilter: TMDBFilterOptions | null;
  /** 最近一次成功写入 discoverResults 的时间戳（0 = 从未成功获取） */
  discoverFetchedAt: number;

  // ---- 筛选 ----
  filterOptions: TMDBFilterOptions;

  // ---- 分类与配置 ----
  movieGenres: TMDBGenre[];
  tvGenres: TMDBGenre[];
  countries: TMDBCountry[];
  genresLanguage: string | null;

  // ---- 加载状态 ----
  loading: {
    trending: boolean;
    nowPlaying: boolean;
    popularMovies: boolean;
    topRatedMovies: boolean;
    upcomingMovies: boolean;
    popularTv: boolean;
    topRatedTv: boolean;
    airingTodayTv: boolean;
    search: boolean;
    discover: boolean;
    genres: boolean;
  };

  // ---- 错误（每个区块独立错误，避免并行请求竞速覆盖） ----
  errors: {
    trending: string | null;
    nowPlaying: string | null;
    popularMovies: string | null;
    topRatedMovies: string | null;
    upcomingMovies: string | null;
    popularTv: string | null;
    topRatedTv: string | null;
    airingTodayTv: string | null;
    search: string | null;
    discover: string | null;
    genres: string | null;
    recommendation: string | null;
  };

  // ---- 操作 ----
  fetchTrending: (timeWindow?: 'day' | 'week') => Promise<void>;
  fetchNowPlaying: () => Promise<void>;
  fetchPopularMovies: () => Promise<void>;
  fetchTopRatedMovies: () => Promise<void>;
  fetchUpcomingMovies: () => Promise<void>;
  fetchPopularTv: () => Promise<void>;
  fetchTopRatedTv: () => Promise<void>;
  fetchAiringTodayTv: () => Promise<void>;
  fetchAllHomeData: () => Promise<void>;

  search: (query: string, page?: number, opts?: { reset?: boolean }) => Promise<void>;
  fetchDiscover: (page?: number, opts?: { reset?: boolean }) => Promise<void>;
  /** 排行榜专用：调 top_rated 端点合并 movie+tv，按 vote_average.desc 排序 */
  fetchTopRated: (page?: number, opts?: { reset?: boolean }) => Promise<void>;

  setFilter: (filter: Partial<TMDBFilterOptions>) => void;
  clearFilter: () => void;

  fetchGenresAndCountries: () => Promise<void>;
  checkToken: () => Promise<{ ok: boolean; error?: string }>;
  refreshAll: () => Promise<void>;
  /** 仅清空首页 8 区块（不触发重新请求），用于「清除全部缓存」 */
  clearHomeData: () => void;
}

// ============================================================
// 映射辅助函数
// ============================================================

/**
 * 按 `id` 去重（保留先出现的项）。
 * 解决：mediaType='all' 时并发请求 movie+tv 接口的合并；以及分页 append 时的竞态重复。
 */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function mapMovieToVideoItem(movie: TMDBMovie): TMDBVideoItem {
  return {
    tmdbId: movie.id,
    id: `tmdb-movie-${movie.id}`,
    title: movie.title,
    cover: buildImageUrl(movie.poster_path, 'w342') || '',
    type: 'movie' as VideoType,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
    tags: [],
    description: movie.overview,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    mediaType: 'movie',
    releaseDate: movie.release_date,
    backdropPath: movie.backdrop_path,
    posterPath: movie.poster_path,
    logoPath: null,
    popularity: movie.popularity,
    genreIds: movie.genre_ids,
    originCountry: undefined,
    originalLanguage: movie.original_language,
  };
}

function mapTVToVideoItem(tv: TMDBTVShow): TMDBVideoItem {
  return {
    tmdbId: tv.id,
    id: `tmdb-tv-${tv.id}`,
    title: tv.name,
    cover: buildImageUrl(tv.poster_path, 'w342') || '',
    type: 'tv' as VideoType,
    year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : undefined,
    tags: [],
    description: tv.overview,
    voteAverage: tv.vote_average,
    voteCount: tv.vote_count,
    mediaType: 'tv',
    releaseDate: tv.first_air_date,
    backdropPath: tv.backdrop_path,
    posterPath: tv.poster_path,
    logoPath: null,
    popularity: tv.popularity,
    genreIds: tv.genre_ids,
    originCountry: tv.origin_country,
    originalLanguage: tv.original_language,
  };
}

function mapTrendingToVideoItem(item: TMDBTrendingItem): TMDBVideoItem {
  const isMovie = item.media_type === 'movie';
  const mediaType = isMovie ? 'movie' as const : 'tv' as const;
  return {
    tmdbId: item.id,
    id: `tmdb-${mediaType}-${item.id}`,
    title: (isMovie ? item.title || '' : item.name || item.title || ''),
    cover: buildImageUrl(item.poster_path, 'w342') || '',
    type: mediaType,
    year: item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.first_air_date
        ? new Date(item.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: item.overview,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    mediaType,
    releaseDate: item.release_date || item.first_air_date,
    backdropPath: item.backdrop_path,
    posterPath: item.poster_path,
    logoPath: null,
    popularity: item.popularity,
    genreIds: item.genre_ids,
    originCountry: item.origin_country,
    originalLanguage: item.original_language,
  };
}

function mapSearchToVideoItem(item: TMDBMultiSearchResult): TMDBVideoItem {
  const isMovie = item.media_type === 'movie';
  const mediaType = isMovie ? 'movie' as const : 'tv' as const;
  return {
    tmdbId: item.id,
    id: `tmdb-${mediaType}-${item.id}`,
    title: isMovie ? (item.title || '') : (item.name || ''),
    cover: buildImageUrl(item.poster_path, 'w342') || '',
    type: mediaType,
    year: item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.first_air_date
        ? new Date(item.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: item.overview,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    mediaType,
    releaseDate: item.release_date || item.first_air_date,
    backdropPath: item.backdrop_path,
    posterPath: item.poster_path,
    logoPath: null,
    popularity: item.popularity,
    genreIds: item.genre_ids,
    originCountry: item.origin_country,
    originalLanguage: item.original_language,
  };
}

// ============================================================
// 筛选辅助函数
// ============================================================
// applyFilters 已废弃：search() 不再维护 searchResults / filteredResults，
// FilterBar 改动走 filterSig → fetchDiscover/TopRated 重新拉数据，store 内部
// 不再需要本地筛选。若以后需要在 search 结果上叠加客户端过滤再恢复。

// ============================================================
// Store 定义
// ============================================================

// 首页 8 区块内存缓存 TTL：60 分钟（数据全满时仍会过期静默刷新）
export const HOME_TTL_MS = 60 * 60 * 1000;

// ── 首页 8 区块 localStorage 持久化 ───────────────────────────
// 冷启动（刷新页面）时先读 LS 立即展示旧数据（stale-while-revalidate），
// 再按内存 TTL（60min）决定何时静默刷新。LS 本身带 24h 新鲜度校验，
// 超过 24h 的缓存视为失效直接丢弃（避免展示过旧数据）。
const HOME_LS_KEY = 'home-tmdb-data';
const HOME_LS_TTL = 24 * 60 * 60 * 1000;

interface HomeLSData {
  trending: TMDBVideoItem[];
  nowPlaying: TMDBVideoItem[];
  popularMovies: TMDBVideoItem[];
  topRatedMovies: TMDBVideoItem[];
  upcomingMovies: TMDBVideoItem[];
  popularTv: TMDBVideoItem[];
  topRatedTv: TMDBVideoItem[];
  airingTodayTv: TMDBVideoItem[];
}

function readHomeLS(): HomeLSData | null {
  try {
    const raw = localStorage.getItem(HOME_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeLSData & { savedAt: number };
    // 24h 过期校验：超期视为无缓存（内存 TTL 照常驱动刷新，避免展示过旧数据）
    if (!parsed.savedAt || Date.now() - parsed.savedAt > HOME_LS_TTL) {
      localStorage.removeItem(HOME_LS_KEY);
      return null;
    }
    return {
      trending: parsed.trending ?? [],
      nowPlaying: parsed.nowPlaying ?? [],
      popularMovies: parsed.popularMovies ?? [],
      topRatedMovies: parsed.topRatedMovies ?? [],
      upcomingMovies: parsed.upcomingMovies ?? [],
      popularTv: parsed.popularTv ?? [],
      topRatedTv: parsed.topRatedTv ?? [],
      airingTodayTv: parsed.airingTodayTv ?? [],
    };
  } catch { return null; }
}

function writeHomeLS(data: HomeLSData): void {
  try {
    localStorage.setItem(HOME_LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch { /* 存储满或不可用时忽略 */ }
}

function clearHomeLS(): void {
  try { localStorage.removeItem(HOME_LS_KEY); } catch { /* ignore */ }
}

/** 模块级初始缓存：store 创建时读取一次（供初始状态 spread 使用） */
const _homeLSData = readHomeLS();

// 首页数据批量获取的 AbortController：重复调用时自动取消上一轮
let _homeFetchAbort: AbortController | null = null;

// discover 流（search / fetchDiscover / fetchTopRated）的请求序号：
// 快速连续换词/换筛选时，仅「最新一次」请求允许写结果，过期响应（慢返回的旧请求）
// 直接丢弃——否则旧词/旧筛选的结果会覆盖新结果（搜索结果错乱的历史根因）。
let _discoverSeq = 0;

export const useTMDBStore = create<TMDBStoreState>()((set, get) => {
  return {
  // ---- 初始状态 ----
  // 冷启动：从 localStorage 恢复首页 8 区块（24h 内有效），秒开旧数据后再按 TTL 静默刷新。
  // homeFetchedAt 保持 0（LS 恢复不重置内存 TTL），保证页面挂载后仍会按 60min TTL 刷新。
  ...(_homeLSData ?? {
    trending: [],
    nowPlaying: [],
    popularMovies: [],
    topRatedMovies: [],
    upcomingMovies: [],
    popularTv: [],
    topRatedTv: [],
    airingTodayTv: [],
  }),
  homeFetchedAt: 0,
  /** 启动时是否已从 localStorage 恢复首页数据（供「清除缓存」判定内存是否需要重置） */
  homeLSLoaded: _homeLSData !== null,

  searchQuery: '',

  discoverResults: [],
  discoverPagination: { page: 1, totalPages: 0, totalResults: 0 },
  discoverLastStatus: null,
  discoverFetchedFilter: null,
  discoverFetchedAt: 0,

  filterOptions: { ...DEFAULT_FILTER_OPTIONS },

  movieGenres: [],
  tvGenres: [],
  countries: [],
  genresLanguage: null,

  loading: {
    trending: false,
    nowPlaying: false,
    popularMovies: false,
    topRatedMovies: false,
    upcomingMovies: false,
    popularTv: false,
    topRatedTv: false,
    airingTodayTv: false,
    search: false,
    discover: false,
    genres: false,
  },

  errors: {
    trending: null,
    nowPlaying: null,
    popularMovies: null,
    topRatedMovies: null,
    upcomingMovies: null,
    popularTv: null,
    topRatedTv: null,
    airingTodayTv: null,
    search: null,
    discover: null,
    genres: null,
    recommendation: null,
  },

  // ---- 操作 ----

  fetchTrending: async (timeWindow = 'day') => {
    set((s) => ({ loading: { ...s.loading, trending: true } }));
    try {
      const data = await fetchTrending('all', timeWindow);
      const items = data.results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map(mapTrendingToVideoItem);

      // 注：原先在此对前 5 个 trending 项预取 /images 端点以补全 logoPath，
      //    但 /images 端点对 backdrops 有数据意义；HeroBanner 已改为 hover 时
      //    按需懒加载该端点。预取会导致 5 次冗余请求，移除以避免接口滥用。
      //    logoPath 字段保留（TMDBVideoItem 类型不变），未补全时为 null，
      //    依赖它的组件（TMDBTrendingBanner）已用 fallback 标题展示。

      set((s) => ({
          trending: items,
          loading: { ...s.loading, trending: false },
          errors: { ...s.errors, trending: null },
        }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, trending: false },
        errors: { ...s.errors, trending: err instanceof Error ? err.message : '获取热门内容失败' },
      }));
    }
  },

  fetchNowPlaying: async () => {
    set((s) => ({ loading: { ...s.loading, nowPlaying: true } }));
    const items: TMDBVideoItem[] = [];
    let sectionError: string | null = null;
    let tvItems: TMDBVideoItem[] = [];

    // 电影和 TV 并行请求，互不影响
    const [movieResult, tvResult] = await Promise.allSettled([
      fetchNowPlaying(),
      fetchPopularTV(),
    ]);

    if (movieResult.status === 'fulfilled') {
      items.push(...movieResult.value.results.map(mapMovieToVideoItem));
    } else {
      sectionError = movieResult.reason instanceof Error ? movieResult.reason.message : '获取正在热映电影失败';
    }

    if (tvResult.status === 'fulfilled') {
      tvItems = tvResult.value.results.map(mapTVToVideoItem);
      items.push(...tvItems);
    } else {
      if (!sectionError) {
        sectionError = tvResult.reason instanceof Error ? tvResult.reason.message : '获取正在热播剧集失败';
      }
    }

    items.sort((a, b) => b.popularity - a.popularity);

    if (items.length > 0) {
      set((s) => ({
          nowPlaying: items,
          // 同时写入 popularTv，避免 tier2 重复请求 /tv/popular
          popularTv: s.popularTv.length === 0 && tvItems.length > 0 ? tvItems : s.popularTv,
          loading: { ...s.loading, nowPlaying: false },
          errors: { ...s.errors, nowPlaying: null },
      }));
    } else {
      set((s) => ({
        loading: { ...s.loading, nowPlaying: false },
        errors: { ...s.errors, nowPlaying: sectionError || '暂无正在热映的数据' },
      }));
    }
  },

  fetchPopularMovies: async () => {
    set((s) => ({ loading: { ...s.loading, popularMovies: true } }));
    try {
      const data = await fetchPopularMovies();
      set((s) => ({
          popularMovies: data.results.map(mapMovieToVideoItem),
          loading: { ...s.loading, popularMovies: false },
          errors: { ...s.errors, popularMovies: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, popularMovies: false },
        errors: { ...s.errors, popularMovies: err instanceof Error ? err.message : '获取热门电影失败' },
      }));
    }
  },

  fetchTopRatedMovies: async () => {
    set((s) => ({ loading: { ...s.loading, topRatedMovies: true } }));
    try {
      const data = await fetchTopRatedMovies();
      set((s) => ({
          topRatedMovies: data.results.map(mapMovieToVideoItem),
          loading: { ...s.loading, topRatedMovies: false },
          errors: { ...s.errors, topRatedMovies: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, topRatedMovies: false },
        errors: { ...s.errors, topRatedMovies: err instanceof Error ? err.message : '获取高分电影失败' },
      }));
    }
  },

  fetchUpcomingMovies: async () => {
    set((s) => ({ loading: { ...s.loading, upcomingMovies: true } }));
    try {
      const data = await fetchUpcomingMovies();
      set((s) => ({
          upcomingMovies: data.results.map(mapMovieToVideoItem),
          loading: { ...s.loading, upcomingMovies: false },
          errors: { ...s.errors, upcomingMovies: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, upcomingMovies: false },
        errors: { ...s.errors, upcomingMovies: err instanceof Error ? err.message : '获取即将上映电影失败' },
      }));
    }
  },

  fetchPopularTv: async () => {
    set((s) => ({ loading: { ...s.loading, popularTv: true } }));
    try {
      const data = await fetchPopularTV();
      set((s) => ({
          popularTv: data.results.map(mapTVToVideoItem),
          loading: { ...s.loading, popularTv: false },
          errors: { ...s.errors, popularTv: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, popularTv: false },
        errors: { ...s.errors, popularTv: err instanceof Error ? err.message : '获取热门剧集失败' },
      }));
    }
  },

  fetchTopRatedTv: async () => {
    set((s) => ({ loading: { ...s.loading, topRatedTv: true } }));
    try {
      const data = await fetchTopRatedTV();
      set((s) => ({
          topRatedTv: data.results.map(mapTVToVideoItem),
          loading: { ...s.loading, topRatedTv: false },
          errors: { ...s.errors, topRatedTv: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, topRatedTv: false },
        errors: { ...s.errors, topRatedTv: err instanceof Error ? err.message : '获取高分剧集失败' },
      }));
    }
  },

  fetchAiringTodayTv: async () => {
    set((s) => ({ loading: { ...s.loading, airingTodayTv: true } }));
    try {
      const data = await fetchAiringTodayTV();
      set((s) => ({
          airingTodayTv: data.results.map(mapTVToVideoItem),
          loading: { ...s.loading, airingTodayTv: false },
          errors: { ...s.errors, airingTodayTv: null },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, airingTodayTv: false },
        errors: { ...s.errors, airingTodayTv: err instanceof Error ? err.message : '获取今日播出剧集失败' },
      }));
    }
  },

  /** 预检 Token 有效性（调用轻量 /configuration 端点，透传具体错误） */
  checkToken: async () => {
    try {
      await fetchTMDB('/configuration');
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      return { ok: false, error: msg };
    }
  },

  /** 强制刷新所有数据（清空现有数据后重新获取） */
  refreshAll: async () => {
    get().clearHomeData();
    await get().fetchAllHomeData();
  },

  /** 仅清空首页 8 区块（保留 genres/countries 分类配置），不触发重新请求 */
  clearHomeData: () => {
    clearHomeLS();
    set(() => ({
      trending: [],
      nowPlaying: [],
      popularMovies: [],
      topRatedMovies: [],
      upcomingMovies: [],
      popularTv: [],
      topRatedTv: [],
      airingTodayTv: [],
      homeFetchedAt: 0,
      homeLSLoaded: false,
    }));
  },

  fetchAllHomeData: async () => {
    const state = get();

    // 取消上一轮未完成的批量获取，避免重复请求叠加
    _homeFetchAbort?.abort();
    const ctrl = new AbortController();
    _homeFetchAbort = ctrl;

    // TTL 过期：距离上次 fetchAllHomeData 完成超过 60min（homeFetchedAt=0 视为从未拉取，不属于过期）
    const ttlExpired = state.homeFetchedAt > 0 && Date.now() - state.homeFetchedAt > HOME_TTL_MS;
    // 判断每个区块是否需要刷新（数据为空 或 全局 TTL 过期）
    const shouldFetch = (arr: unknown[]): boolean => arr.length === 0 || ttlExpired;
    // loading 置位仅针对空区块：TTL 过期时区块已有数据，保持旧数据展示（静默刷新），避免整页闪骨架
    const isEmpty = (arr: unknown[]): boolean => arr.length === 0;

    // 清除上一轮遗留的错误状态，避免首页同时展示旧错误 + 新 loading。
    // 同时提前为待拉取区块置位 loading —— checkToken() 是一次完整网络往返，
    // 若等它返回后才置位，这段窗口内所有区块「无数据且不在加载中」，
    // TMDBMovieRow 会整体 return null（下方行不渲染）且首页骨架不出现。
    // 注意：仅「空区块」置位 loading；TTL 过期刷新（数据已满）不清 loading，
    // 否则 TMDBMovieRow 会因 isLoading 切到 SkeletonCards，导致旧数据闪没。
    set((s) => ({
      loading: {
        ...s.loading,
        trending: isEmpty(state.trending) || s.loading.trending,
        nowPlaying: isEmpty(state.nowPlaying) || s.loading.nowPlaying,
        popularMovies: isEmpty(state.popularMovies) || s.loading.popularMovies,
        topRatedMovies: isEmpty(state.topRatedMovies) || s.loading.topRatedMovies,
        upcomingMovies: isEmpty(state.upcomingMovies) || s.loading.upcomingMovies,
        popularTv: isEmpty(state.popularTv) || s.loading.popularTv,
        topRatedTv: isEmpty(state.topRatedTv) || s.loading.topRatedTv,
        airingTodayTv: isEmpty(state.airingTodayTv) || s.loading.airingTodayTv,
      },
      errors: {
        ...s.errors,
        trending: null,
        nowPlaying: null,
        popularMovies: null,
        topRatedMovies: null,
        upcomingMovies: null,
        popularTv: null,
        topRatedTv: null,
        airingTodayTv: null,
        genres: null,
      },
    }));

    // Token 预检：无效则设置全局错误并跳过所有请求（透传具体原因）
    const tokenCheck = await get().checkToken();
    if (!tokenCheck.ok || ctrl.signal.aborted) {
      const tokenError = tokenCheck.error || 'TMDB Token 无效或 API 不可达';
      set((s) => ({
        loading: {
          ...s.loading,
          trending: false,
          nowPlaying: false,
          popularMovies: false,
          topRatedMovies: false,
          upcomingMovies: false,
          popularTv: false,
          topRatedTv: false,
          airingTodayTv: false,
          genres: false,
        },
        errors: {
          ...s.errors,
          trending: tokenError,
          nowPlaying: tokenError,
          popularMovies: tokenError,
          topRatedMovies: tokenError,
          upcomingMovies: tokenError,
          popularTv: tokenError,
          topRatedTv: tokenError,
          airingTodayTv: tokenError,
          genres: tokenError,
        },
      }));
      return;
    }

    // ---- 所有区块并发请求 ----
    // 注意：fetchNowPlaying 内部已并行拉取 /tv/popular 并写入 popularTv（见其实现），
    // 故此处不再单独 fetchPopularTv，避免「两区块同时空」时 /tv/popular 被请求两次。
    // 触发条件改为「nowPlaying 或 popularTv 任一为空」：保证 nowPlaying 已满但
    // popularTv 单独为空（如单独失败过）时，popularTv 仍能通过 fetchNowPlaying 补齐
    // （其内部有 s.popularTv.length === 0 写入保护，不会覆盖已有数据）。
    const fetches = [
      shouldFetch(state.trending) ? state.fetchTrending() : null,
      (shouldFetch(state.nowPlaying) || shouldFetch(state.popularTv)) ? state.fetchNowPlaying() : null,
      shouldFetch(state.popularMovies) ? state.fetchPopularMovies() : null,
      shouldFetch(state.topRatedMovies) ? state.fetchTopRatedMovies() : null,
      shouldFetch(state.upcomingMovies) ? state.fetchUpcomingMovies() : null,
      shouldFetch(state.topRatedTv) ? state.fetchTopRatedTv() : null,
      shouldFetch(state.airingTodayTv) ? state.fetchAiringTodayTv() : null,
    ];
    await Promise.all(fetches.filter((p): p is Promise<void> => p !== null));
    // 记录本次批量拉取的完成时间：TTL 刷新窗口从此刻重新计时
    const next = get();
    set({ homeFetchedAt: Date.now() });
    // 持久化到 localStorage（24h 新鲜度校验）：冷启动可秒开旧数据
    writeHomeLS({
      trending: next.trending,
      nowPlaying: next.nowPlaying,
      popularMovies: next.popularMovies,
      topRatedMovies: next.topRatedMovies,
      upcomingMovies: next.upcomingMovies,
      popularTv: next.popularTv,
      topRatedTv: next.topRatedTv,
      airingTodayTv: next.airingTodayTv,
    });
  },

  /**
   * 文本搜索：调 /search/multi 端点，结果写入 discoverResults + discoverPagination
   * 使 BrowseGrid 可直接消费（与 fetchDiscover / fetchTopRated 走同一渲染路径）。
   * 同时 loading.discover / errors.discover 共享（UI 骨架与错误显示复用）。
   *
   * 客户端过滤：根据当前 filterOptions（category/mediaType/genreIds/originCountry/minVoteAverage）
   * 对搜索结果进行过滤，确保从首页带过来的分类参数在搜索时生效。
   *
   * 懒加载判断：如果 API 未到最后一页，即使过滤后数据不足也允许继续懒加载。
   */
  search: async (query: string, page = 1, opts?: { reset?: boolean }) => {
    const seq = ++_discoverSeq; // 竞态保护：仅最新一次搜索可写结果
    const forceReset = opts?.reset === true;
    const { filterOptions } = get();

    /** 客户端过滤单批结果 */
    const applyFilter = (raw: TMDBVideoItem[]): TMDBVideoItem[] => {
      let result = raw;
      if (filterOptions.mediaType && filterOptions.mediaType !== 'all') {
        result = result.filter((item) => item.mediaType === filterOptions.mediaType);
      }
      if (filterOptions.genreIds && filterOptions.genreIds.length > 0) {
        result = result.filter((item) => {
          if (!item.genreIds || item.genreIds.length === 0) return false;
          return filterOptions.genreIds.some((id) => item.genreIds!.includes(id));
        });
      }
      if (filterOptions.originCountry) {
        result = result.filter((item) => {
          if (!item.originCountry) return false;
          if (Array.isArray(item.originCountry)) {
            return item.originCountry.includes(filterOptions.originCountry!);
          }
          return item.originCountry === filterOptions.originCountry;
        });
      }
      if (filterOptions.minVoteAverage && filterOptions.minVoteAverage > 0) {
        result = result.filter((item) => (item.voteAverage ?? 0) >= filterOptions.minVoteAverage!);
      }
      return result;
    };

    set((s) => ({
      searchQuery: query,
      loading: { ...s.loading, discover: true },
      errors: { ...s.errors, discover: null },
      discoverLastStatus: 'pending',
      ...(forceReset ? {
        discoverResults: [],
        discoverPagination: { page: 0, totalPages: 0, totalResults: 0 },
      } : {}),
    }));

    try {
      const data = await searchMulti(query, page);
      if (seq !== _discoverSeq) return; // 过期响应（更新的搜索已发起）丢弃
      let items = data.results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map(mapSearchToVideoItem);

      // 客户端过滤
      items = applyFilter(items);

      // hasMore 判断：API 未到最后一页就允许懒加载
      const hasMore = page < data.total_pages;

      set((s) => {
        const mergedResults = page > 1 && !forceReset
          ? dedupeById([...s.discoverResults, ...items])
          : items;

        return {
          discoverResults: mergedResults,
          discoverPagination: {
            page: data.page,
            totalPages: hasMore ? data.total_pages : data.page,
            totalResults: mergedResults.length,
          },
          loading: { ...s.loading, discover: false },
          discoverLastStatus: 'success',
          // 搜索模式：结果非 discover 数据，缓存回显判断据此跳过
          discoverFetchedFilter: null,
          discoverFetchedAt: Date.now(),
        };
      });
    } catch (err) {
      if (seq !== _discoverSeq) return; // 过期失败不写错误态
      set((s) => ({
        loading: { ...s.loading, discover: false },
        errors: { ...s.errors, discover: err instanceof Error ? err.message : '搜索失败' },
        discoverLastStatus: 'error',
      }));
    }
  },

  fetchDiscover: async (page = 1, opts?: { reset?: boolean }) => {
    // 排行榜（top）分类请使用 fetchTopRated（专用 top_rated 端点）
    const seq = ++_discoverSeq; // 竞态保护：仅最新一次 discover 可写结果
    const { filterOptions } = get();
    const forceReset = opts?.reset === true;
    set((s) => ({
      loading: { ...s.loading, discover: true },
      errors: { ...s.errors, discover: null },
      discoverLastStatus: 'pending',
      // reset 时立即清空旧结果，让 UI 能显示 loading
      ...(forceReset ? {
        discoverResults: [],
        discoverPagination: { page: 0, totalPages: 0, totalResults: 0 },
      } : {}),
    }));
    try {
      let results: TMDBVideoItem[] = [];
      let totalPages = 0;

      if (filterOptions.mediaType === 'all') {
        const [movieData, tvData] = await Promise.all([
          discoverMovie(filterOptions, page),
          discoverTV(filterOptions, page),
        ]);
        results = dedupeById([
          ...movieData.results.map(mapMovieToVideoItem),
          ...tvData.results.map(mapTVToVideoItem),
        ]);
        // 合并 movie + tv 后需按用户选择的排序方式重新排序（API 各端点已排序但合并后需重排）
        const sortBy = filterOptions.sortBy || 'popularity';
        const sortOrder = filterOptions.sortOrder || 'desc';
        const dir = sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
          if (sortBy === 'vote_average') {
            // 评分相同时按投票数降序兜底
            if (b.voteAverage !== a.voteAverage) return (a.voteAverage - b.voteAverage) * dir;
            return b.voteCount - a.voteCount;
          }
          if (sortBy === 'release_date') {
            const da = a.releaseDate ?? '';
            const db = b.releaseDate ?? '';
            return da.localeCompare(db) * dir;
          }
          // popularity（默认）
          return (a.popularity - b.popularity) * dir;
        });
        // mediaType=all 时合并 movie+tv，去重后实际数量可能少于两者之和
        // totalPages 取两者较大值，但若去重后本页不足 2×PAGE_SIZE 则可能已到最后一页
        const TMDB_PAGE_SIZE = 20;
        totalPages = Math.max(movieData.total_pages, tvData.total_pages);
        // 去重后如果本页结果少于预期（2×PAGE_SIZE），说明可能已到最后一页
        if (results.length < TMDB_PAGE_SIZE * 2 && page >= totalPages) {
          totalPages = page;
        }
      } else if (filterOptions.mediaType === 'tv') {
        const data = await discoverTV(filterOptions, page);
        results = data.results.map(mapTVToVideoItem);
        totalPages = data.total_pages;
      } else {
        const data = await discoverMovie(filterOptions, page);
        results = data.results.map(mapMovieToVideoItem);
        totalPages = data.total_pages;
      }

      if (seq !== _discoverSeq) return; // 过期响应（更新的筛选/搜索已发起）丢弃
      set((s) => {
        // 合并结果并去重
        const mergedResults = page > 1 && !forceReset
          ? dedupeById([...s.discoverResults, ...results])
          : results;

        return {
          discoverResults: mergedResults,
          discoverPagination: {
            page,
            totalPages,
            // 使用合并后的实际数据量
            totalResults: mergedResults.length,
          },
          loading: { ...s.loading, discover: false },
          discoverLastStatus: 'success',
          // 记录本次结果的筛选条件快照：Browse 重新挂载时命中则直接回显
          discoverFetchedFilter: filterOptions,
          discoverFetchedAt: Date.now(),
        };
      });
    } catch (err) {
      if (seq !== _discoverSeq) return; // 过期失败不写错误态
      set((s) => ({
        loading: { ...s.loading, discover: false },
        errors: { ...s.errors, discover: err instanceof Error ? err.message : '发现失败' },
        discoverLastStatus: 'error',
      }));
    }
  },

  /** 排行榜分类：直接调 top_rated 端点，合并 movie + tv，按 vote_average.desc 排序 */
  fetchTopRated: async (page = 1, opts?: { reset?: boolean }) => {
    const seq = ++_discoverSeq; // 竞态保护：仅最新一次排行可写结果
    const forceReset = opts?.reset === true;
    const { filterOptions } = get();
    set((s) => ({
      loading: { ...s.loading, discover: true },
      errors: { ...s.errors, discover: null },
      discoverLastStatus: 'pending',
      // reset 时立即清空旧结果，让 UI 能显示 loading
      ...(forceReset ? {
        discoverResults: [],
        discoverPagination: { page: 0, totalPages: 0, totalResults: 0 },
      } : {}),
    }));
    try {
      const [movieData, tvData] = await Promise.all([
        fetchTopRatedMovies(page),
        fetchTopRatedTV(page),
      ]);
      const results = dedupeById([
        ...movieData.results.map(mapMovieToVideoItem),
        ...tvData.results.map(mapTVToVideoItem),
      ]).sort((a, b) => {
        // 主排序：vote_average desc；次排序：vote_count desc（防止 0 评价占位）
        if (b.voteAverage !== a.voteAverage) return b.voteAverage - a.voteAverage;
        return b.voteCount - a.voteCount;
      });
      if (seq !== _discoverSeq) return; // 过期响应（更新的请求已发起）丢弃
      set((s) => ({
        discoverResults:
          page > 1 && !forceReset
            ? dedupeById([...s.discoverResults, ...results])
            : results,
        discoverPagination: {
          page,
          totalPages: Math.max(movieData.total_pages, tvData.total_pages),
          totalResults: movieData.total_results + tvData.total_results,
        },
        loading: { ...s.loading, discover: false },
        discoverLastStatus: 'success',
        // 记录本次结果的筛选条件快照：Browse 重新挂载时命中则直接回显
        discoverFetchedFilter: filterOptions,
        discoverFetchedAt: Date.now(),
      }));
    } catch (err) {
      if (seq !== _discoverSeq) return; // 过期失败不写错误态
      set((s) => ({
        loading: { ...s.loading, discover: false },
        errors: { ...s.errors, discover: err instanceof Error ? err.message : '排行榜获取失败' },
        discoverLastStatus: 'error',
      }));
    }
  },

  setFilter: (filter) => {
    // 仅更新 filterOptions；filterSig 变化会触发 fetchDiscover/TopRated 重拉数据。
    // 不再维护 searchResults / filteredResults（搜索结果已重定向到 discoverResults）。
    set((s) => {
      const newFilters = { ...s.filterOptions, ...filter };
      return { filterOptions: newFilters };
    });
  },

  clearFilter: () => {
    // 重置 filterOptions；filterSig 变化由调用方 effect 触发 fetchDiscover。
    set(() => ({
      filterOptions: { ...DEFAULT_FILTER_OPTIONS },
    }));
  },

  fetchGenresAndCountries: async () => {
    const { movieGenres, genresLanguage } = get();
    const currentLang = getLanguage();
    if (movieGenres.length > 0 && genresLanguage === currentLang) return;

    set((s) => ({ loading: { ...s.loading, genres: true } }));
    try {
      const [mGenres, tGenres, ctries] = await Promise.all([
        fetchMovieGenres(currentLang),
        fetchTVGenres(currentLang),
        fetchCountries(),
      ]);
      set((s) => ({
          movieGenres: mGenres,
          tvGenres: tGenres,
          countries: ctries,
          genresLanguage: currentLang,
          loading: { ...s.loading, genres: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, genres: false },
        errors: { ...s.errors, genres: err instanceof Error ? err.message : '获取分类失败' },
      }));
    }
  },
  };
});

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
    cover: buildImageUrl(movie.poster_path, 'w500') || '',
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
    cover: buildImageUrl(tv.poster_path, 'w500') || '',
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
    cover: buildImageUrl(item.poster_path, 'w500') || '',
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
    cover: buildImageUrl(item.poster_path, 'w500') || '',
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

export const useTMDBStore = create<TMDBStoreState>()((set, get) => {
  return {
  // ---- 初始状态 ----
  trending: [],
  nowPlaying: [],
  popularMovies: [],
  topRatedMovies: [],
  upcomingMovies: [],
  popularTv: [],
  topRatedTv: [],
  airingTodayTv: [],

  searchQuery: '',

  discoverResults: [],
  discoverPagination: { page: 1, totalPages: 0, totalResults: 0 },
  discoverLastStatus: null,

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

    // 电影和 TV 独立请求，互不影响
    try {
      const movieData = await fetchNowPlaying();
      items.push(...movieData.results.map(mapMovieToVideoItem));
    } catch (e) {
      sectionError = e instanceof Error ? e.message : '获取正在热映电影失败';
    }

    try {
      const tvData = await fetchPopularTV();
      items.push(...tvData.results.map(mapTVToVideoItem));
    } catch (e) {
      if (!sectionError) {
        sectionError = e instanceof Error ? e.message : '获取正在热播剧集失败';
      }
    }

    items.sort((a, b) => b.popularity - a.popularity);

    if (items.length > 0) {
      set((s) => ({
          nowPlaying: items,
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
    set(() => ({
      trending: [],
      nowPlaying: [],
      popularMovies: [],
      topRatedMovies: [],
      upcomingMovies: [],
      popularTv: [],
      topRatedTv: [],
      airingTodayTv: [],
      movieGenres: [],
      tvGenres: [],
      countries: [],
      genresLanguage: null,
    }));
    await get().fetchAllHomeData();
  },

  fetchAllHomeData: async () => {
    const state = get();

    // 清除上一轮遗留的错误状态，避免首页同时展示旧错误 + 新 loading
    set((s) => ({
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
    if (!tokenCheck.ok) {
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

    // 判断每个区块是否需要刷新（数据为空时获取）
    const shouldFetch = (arr: unknown[]): boolean => arr.length === 0;

    // ---- 第一层：首屏可见内容（trending + nowPlaying + genres） ----
    const tier1 = [
      shouldFetch(state.trending) ? state.fetchTrending() : Promise.resolve(),
      shouldFetch(state.nowPlaying) ? state.fetchNowPlaying() : Promise.resolve(),
      shouldFetch(state.movieGenres) ? state.fetchGenresAndCountries() : Promise.resolve(),
    ];
    await Promise.all(tier1);

    // ---- 第二层：下方滚动内容 — 改用 requestIdleCallback 调度,避免阻塞主线程 ----
    // 旧实现 setTimeout 200ms 在移动端/弱网客户端累计要等很久;requestIdleCallback
    // 让浏览器在空闲时再发起请求,既保证首屏渲染不被延迟,也不阻塞交互。
    const idle =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? (cb: () => void) => window.requestIdleCallback(cb)
        : (cb: () => void) => setTimeout(cb, 0);
    await new Promise<void>((r) => idle(() => r()));
    const tier2 = [
      shouldFetch(state.popularMovies) ? state.fetchPopularMovies() : Promise.resolve(),
      shouldFetch(state.topRatedMovies) ? state.fetchTopRatedMovies() : Promise.resolve(),
      shouldFetch(state.upcomingMovies) ? state.fetchUpcomingMovies() : Promise.resolve(),
      shouldFetch(state.popularTv) ? state.fetchPopularTv() : Promise.resolve(),
      shouldFetch(state.topRatedTv) ? state.fetchTopRatedTv() : Promise.resolve(),
      shouldFetch(state.airingTodayTv) ? state.fetchAiringTodayTv() : Promise.resolve(),
    ];
    await Promise.all(tier2);
  },

  /**
   * 文本搜索：调 /search/multi 端点，结果写入 discoverResults + discoverPagination
   * 使 BrowseGrid 可直接消费（与 fetchDiscover / fetchTopRated 走同一渲染路径）。
   * 同时 loading.discover / errors.discover 共享（UI 骨架与错误显示复用）。
   */
  search: async (query: string, page = 1, opts?: { reset?: boolean }) => {
    const forceReset = opts?.reset === true;
    set((s) => ({
      searchQuery: query,
      loading: { ...s.loading, discover: true },
      errors: { ...s.errors, discover: null },
      // 进入 pending:UI 侧用此位阻止在 API 响应前移除骨架
      discoverLastStatus: 'pending',
      // reset 时立即清空旧结果，让 UI 能显示 loading（而非停留在旧数据上）
      ...(forceReset ? {
        discoverResults: [],
        discoverPagination: { page: 0, totalPages: 0, totalResults: 0 },
      } : {}),
    }));
    try {
      const data = await searchMulti(query, page);
      const items = data.results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map(mapSearchToVideoItem);

      set((s) => ({
        // page > 1 且未要求重置 → 追加并去重；其他情况（page=1 或 reset=true）→ 整体覆盖
        discoverResults:
          page > 1 && !forceReset
            ? dedupeById([...s.discoverResults, ...items])
            : items,
        discoverPagination: {
          page: data.page,
          totalPages: data.total_pages,
          totalResults: data.total_results,
        },
        loading: { ...s.loading, discover: false },
        discoverLastStatus: 'success',
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, discover: false },
        errors: { ...s.errors, discover: err instanceof Error ? err.message : '搜索失败' },
        discoverLastStatus: 'error',
      }));
    }
  },

  fetchDiscover: async (page = 1, opts?: { reset?: boolean }) => {
    // 排行榜（top）分类请使用 fetchTopRated（专用 top_rated 端点）
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
      let totalResults = 0;

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
        totalPages = Math.max(movieData.total_pages, tvData.total_pages);
        totalResults = movieData.total_results + tvData.total_results;
      } else if (filterOptions.mediaType === 'tv') {
        const data = await discoverTV(filterOptions, page);
        results = data.results.map(mapTVToVideoItem);
        totalPages = data.total_pages;
        totalResults = data.total_results;
      } else {
        const data = await discoverMovie(filterOptions, page);
        results = data.results.map(mapMovieToVideoItem);
        totalPages = data.total_pages;
        totalResults = data.total_results;
      }

      set((s) => ({
        // page > 1 且未要求重置 → 追加并去重；其他情况（page=1 或 reset=true）→ 整体覆盖
        discoverResults:
          page > 1 && !forceReset
            ? dedupeById([...s.discoverResults, ...results])
            : results,
        discoverPagination: { page, totalPages, totalResults },
        loading: { ...s.loading, discover: false },
        discoverLastStatus: 'success',
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, discover: false },
        errors: { ...s.errors, discover: err instanceof Error ? err.message : '发现失败' },
        discoverLastStatus: 'error',
      }));
    }
  },

  /** 排行榜分类：直接调 top_rated 端点，合并 movie + tv，按 vote_average.desc 排序 */
  fetchTopRated: async (page = 1, opts?: { reset?: boolean }) => {
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
      }));
    } catch (err) {
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

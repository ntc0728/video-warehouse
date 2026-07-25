/**
 * categoryConfig — 首页侧边栏内容类目配置
 *
 * 每个内容类目（电影/电视剧/综艺/动漫/纪录片/排行榜）定义：
 * - hero：轮播图数据源（一组 TMDBVideoItem）
 * - rows：7 行横滚数据，每行含标题 + 数据获取函数
 *
 * 数据全部来自真实 TMDB 接口：
 * - 电影/剧集榜单：/movie|tv 的 now_playing / popular / top_rated / upcoming / airing_today
 * - 类型/地区/排序筛选：/discover/movie|tv?with_genres / with_origin_country / sort_by
 *   综艺=真人秀(10764)/脱口秀(10767)，动漫=动画(16)，纪录片=纪录片(99)
 *
 * 这层与 UI 解耦，Home 页面与 Sidebar 共用 HomeCategoryKey 类型。
 */
import type {
  TMDBVideoItem,
  TMDBMovie,
  TMDBTVShow,
  TMDBTrendingItem,
  TMDBFilterOptions,
} from '@/types/tmdb';
import {
  fetchNowPlaying,
  fetchPopularMovies,
  fetchTopRatedMovies,
  fetchUpcomingMovies,
  fetchPopularTV,
  fetchTopRatedTV,
  fetchAiringTodayTV,
  fetchTrending,
  discoverMovie,
  discoverTV,
  buildImageUrl,
} from '@/services/tmdbService';

/** 首页内容类目 key（'home' = 默认发现页，由 useTMDBStore 提供数据） */
export type HomeCategoryKey = 'home' | 'movie' | 'tv' | 'variety' | 'anime' | 'documentary' | 'top';

// ── TMDB 响应 → TMDBVideoItem 映射（与 useTMDBStore 内映射保持一致，此处隔离） ──

function mapMovie(m: TMDBMovie): TMDBVideoItem {
  return {
    tmdbId: m.id,
    id: `tmdb-movie-${m.id}`,
    title: m.title,
    cover: buildImageUrl(m.poster_path, 'w500') || '',
    type: 'movie',
    year: m.release_date ? new Date(m.release_date).getFullYear() : undefined,
    tags: [],
    description: m.overview,
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
    mediaType: 'movie',
    releaseDate: m.release_date,
    backdropPath: m.backdrop_path,
    posterPath: m.poster_path,
    logoPath: null,
    popularity: m.popularity,
    genreIds: m.genre_ids,
    originCountry: undefined,
    originalLanguage: m.original_language,
  };
}

function mapTV(t: TMDBTVShow): TMDBVideoItem {
  return {
    tmdbId: t.id,
    id: `tmdb-tv-${t.id}`,
    title: t.name,
    cover: buildImageUrl(t.poster_path, 'w500') || '',
    type: 'tv',
    year: t.first_air_date ? new Date(t.first_air_date).getFullYear() : undefined,
    tags: [],
    description: t.overview,
    voteAverage: t.vote_average,
    voteCount: t.vote_count,
    mediaType: 'tv',
    releaseDate: t.first_air_date,
    backdropPath: t.backdrop_path,
    posterPath: t.poster_path,
    logoPath: null,
    popularity: t.popularity,
    genreIds: t.genre_ids,
    originCountry: t.origin_country,
    originalLanguage: t.original_language,
  };
}

function mapTrending(i: TMDBTrendingItem): TMDBVideoItem {
  const isMovie = i.media_type === 'movie';
  const mediaType = isMovie ? 'movie' : 'tv';
  return {
    tmdbId: i.id,
    id: `tmdb-${mediaType}-${i.id}`,
    title: isMovie ? (i.title || '') : (i.name || i.title || ''),
    cover: buildImageUrl(i.poster_path, 'w500') || '',
    type: mediaType,
    year: i.release_date
      ? new Date(i.release_date).getFullYear()
      : i.first_air_date
        ? new Date(i.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: i.overview,
    voteAverage: i.vote_average,
    voteCount: i.vote_count,
    mediaType,
    releaseDate: i.release_date || i.first_air_date,
    backdropPath: i.backdrop_path,
    posterPath: i.poster_path,
    logoPath: null,
    popularity: i.popularity,
    genreIds: i.genre_ids,
    originCountry: i.origin_country,
    originalLanguage: i.original_language,
  };
}

/** 按 id 去重（保留先出现项） */
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

/** movie + tv 合并并按热度排序（综艺/动漫/纪录片/排行榜跨类型类目用） */
async function discoverBoth(
  filters: Partial<TMDBFilterOptions>,
  page = 1,
): Promise<TMDBVideoItem[]> {
  const [m, t] = await Promise.all([discoverMovie(filters, page), discoverTV(filters, page)]);
  return dedupeById([
    ...m.results.map(mapMovie),
    ...t.results.map(mapTV),
  ]).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/** 电影 + 剧集 top_rated 合并按评分排序（排行榜 hero 用） */
const YEAR = new Date().getFullYear();

export interface CategoryRowDef {
  title: string;
  fetch: () => Promise<TMDBVideoItem[]>;
}

export interface HomeCategoryDef {
  key: Exclude<HomeCategoryKey, 'home'>;
  label: string;
  hero: () => Promise<TMDBVideoItem[]>;
  rows: CategoryRowDef[];
}

// ── 共享 fetch 函数（hero 与首行复用同一引用，dedupFetch 通过函数引用去重） ──
const popularMoviesMapped = async () => (await fetchPopularMovies()).results.map(mapMovie);
const popularTVMapped = async () => (await fetchPopularTV()).results.map(mapTV);
const topRatedMoviesMapped = async () => (await fetchTopRatedMovies()).results.map(mapMovie);
const topRatedTVMapped = async () => (await fetchTopRatedTV()).results.map(mapTV);

// 综艺：hero 与"热门综艺"共享
const varietyPopular = async () => (await discoverTV({ genreIds: [10764, 10767], sortBy: 'popularity' })).results.map(mapTV);
// 动漫：hero 与"热门动漫"共享
const animePopular = async () => discoverBoth({ genreIds: [16], sortBy: 'popularity' });
// 纪录片：hero 与"热门纪录片"共享
const documentaryPopular = async () => discoverBoth({ genreIds: [99], sortBy: 'popularity' });

/** 内容类目配置（不含 'home'，home 由 useTMDBStore 提供） */
export const CATEGORY_CONFIG: Record<Exclude<HomeCategoryKey, 'home'>, HomeCategoryDef> = {
  movie: {
    key: 'movie',
    label: '电影',
    hero: popularMoviesMapped,
    rows: [
      { title: '正在热映', fetch: async () => (await fetchNowPlaying()).results.map(mapMovie) },
      { title: '热门电影', fetch: popularMoviesMapped },
      { title: '高分电影', fetch: async () => (await fetchTopRatedMovies()).results.map(mapMovie) },
      { title: '即将上映', fetch: async () => (await fetchUpcomingMovies()).results.map(mapMovie) },
      { title: '动作大片', fetch: async () => (await discoverMovie({ genreIds: [28] })).results.map(mapMovie) },
      { title: '喜剧电影', fetch: async () => (await discoverMovie({ genreIds: [35] })).results.map(mapMovie) },
      { title: '华语佳作', fetch: async () => (await discoverMovie({ originCountry: 'CN' })).results.map(mapMovie) },
    ],
  },

  tv: {
    key: 'tv',
    label: '电视剧',
    hero: popularTVMapped,
    rows: [
      { title: '热门剧集', fetch: popularTVMapped },
      { title: '高分剧集', fetch: async () => (await fetchTopRatedTV()).results.map(mapTV) },
      { title: '今日播出', fetch: async () => (await fetchAiringTodayTV()).results.map(mapTV) },
      { title: '美剧推荐', fetch: async () => (await discoverTV({ originCountry: 'US' })).results.map(mapTV) },
      { title: '韩剧推荐', fetch: async () => (await discoverTV({ originCountry: 'KR' })).results.map(mapTV) },
      { title: '国产剧', fetch: async () => (await discoverTV({ originCountry: 'CN' })).results.map(mapTV) },
      { title: '犯罪悬疑', fetch: async () => (await discoverTV({ genreIds: [80] })).results.map(mapTV) },
    ],
  },

  variety: {
    key: 'variety',
    label: '综艺',
    hero: varietyPopular,
    rows: [
      { title: '热门综艺', fetch: varietyPopular },
      { title: '高分综艺', fetch: async () => (await discoverTV({ genreIds: [10764, 10767], sortBy: 'vote_average' })).results.map(mapTV) },
      { title: '脱口秀', fetch: async () => (await discoverTV({ genreIds: [10767] })).results.map(mapTV) },
      { title: '真人秀', fetch: async () => (await discoverTV({ genreIds: [10764] })).results.map(mapTV) },
      { title: '国内综艺', fetch: async () => (await discoverTV({ genreIds: [10764, 10767], originCountry: 'CN' })).results.map(mapTV) },
      { title: '欧美综艺', fetch: async () => (await discoverTV({ genreIds: [10764, 10767], originCountry: 'US' })).results.map(mapTV) },
      { title: '最新综艺', fetch: async () => (await discoverTV({ genreIds: [10764, 10767], sortBy: 'release_date' })).results.map(mapTV) },
    ],
  },

  anime: {
    key: 'anime',
    label: '动漫',
    hero: animePopular,
    rows: [
      { title: '热门动漫', fetch: animePopular },
      { title: '高分动漫', fetch: async () => discoverBoth({ genreIds: [16], sortBy: 'vote_average' }) },
      { title: '日本动漫', fetch: async () => discoverBoth({ genreIds: [16], originCountry: 'JP' }) },
      { title: '国产动漫', fetch: async () => discoverBoth({ genreIds: [16], originCountry: 'CN' }) },
      { title: '欧美动漫', fetch: async () => discoverBoth({ genreIds: [16], originCountry: 'US' }) },
      { title: '最新动漫', fetch: async () => discoverBoth({ genreIds: [16], sortBy: 'release_date' }) },
    ],
  },

  documentary: {
    key: 'documentary',
    label: '纪录片',
    hero: documentaryPopular,
    rows: [
      { title: '热门纪录片', fetch: documentaryPopular },
      { title: '高分纪录片', fetch: async () => discoverBoth({ genreIds: [99], sortBy: 'vote_average' }) },
      { title: '国产纪录片', fetch: async () => discoverBoth({ genreIds: [99], originCountry: 'CN' }) },
      { title: '欧美纪录片', fetch: async () => discoverBoth({ genreIds: [99], originCountry: 'US' }) },
      { title: '日本纪录片', fetch: async () => discoverBoth({ genreIds: [99], originCountry: 'JP' }) },
      { title: '自然地理', fetch: async () => discoverBoth({ genreIds: [99], sortBy: 'vote_average', originCountry: 'US' }) },
      { title: '最新纪录片', fetch: async () => discoverBoth({ genreIds: [99], sortBy: 'release_date' }) },
    ],
  },

  top: {
    key: 'top',
    label: '排行榜',
    hero: async () => {
      // 复用共享函数，dedupFetch 会自动去重
      const [movies, tv] = await Promise.all([topRatedMoviesMapped(), topRatedTVMapped()]);
      return dedupeById([...movies, ...tv]).sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0));
    },
    rows: [
      { title: '电影口碑榜', fetch: topRatedMoviesMapped },
      { title: '剧集口碑榜', fetch: topRatedTVMapped },
      { title: '本周最热', fetch: async () => (await fetchTrending('all', 'week')).results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map(mapTrending) },
      { title: '热门电影榜', fetch: popularMoviesMapped },
      { title: '热门剧集榜', fetch: popularTVMapped },
      { title: '华语高分榜', fetch: async () => discoverBoth({ originCountry: 'CN', sortBy: 'vote_average' }) },
      { title: '年度必看', fetch: async () => discoverBoth({ sortBy: 'vote_average', releaseYear: YEAR }) },
    ],
  },
};

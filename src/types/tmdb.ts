/**
 * TMDB (The Movie Database) API 类型定义
 * 基于 TMDB API v3 响应结构
 *
 * [批次2修复] TMDBVideoItem.type 使用 VideoType 而非字面量类型 'movie' | 'tv'
 * 原因：与 useTMDBStore 中的 VideoType 赋值保持兼容
 * 依赖：import type { VideoType } from '@/types/video'
 */
import type { VideoType } from './video';

// ============================================================
// 基础类型
// ============================================================

export type TMDBMediaType = 'movie' | 'tv' | 'person';

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ============================================================
// 类型
// ============================================================

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBGenresResponse {
  genres: TMDBGenre[];
}

// ============================================================
// 配置（图片基础 URL）
// ============================================================

export interface TMDBImageConfig {
  base_url: string;
  secure_base_url: string;
  backdrop_sizes: string[];
  logo_sizes: string[];
  poster_sizes: string[];
  profile_sizes: string[];
  still_sizes: string[];
}

export interface TMDBConfigurationResponse {
  images: TMDBImageConfig;
  change_keys: string[];
}

// ============================================================
// 国家
// ============================================================

export interface TMDBCountry {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}

// ============================================================
// 电影
// ============================================================

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: 'movie';
  adult: boolean;
  original_language: string;
  genre_ids: number[];
  popularity: number;
  release_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface TMDBMovieDetail extends TMDBMovie {
  genres: TMDBGenre[];
  budget: number;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  homepage: string;
  imdb_id: string;
  production_companies: TMDBProductionCompany[];
  production_countries: TMDBProductionCountry[];
  spoken_languages: TMDBSpokenLanguage[];
  credits?: TMDBCredits;
  images?: TMDBImages;
  videos?: TMDBVideosResponse;
  similar?: TMDBPaginatedResponse<TMDBMovie>;
  recommendations?: TMDBPaginatedResponse<TMDBMovie>;
}

// ============================================================
// 电视剧
// ============================================================

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: 'tv';
  adult: boolean;
  original_language: string;
  genre_ids: number[];
  popularity: number;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  origin_country: string[];
}

export interface TMDBTVShowDetail extends TMDBTVShow {
  genres: TMDBGenre[];
  created_by: TMDBCreator[];
  episode_run_time: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  tagline: string;
  homepage: string;
  in_production: boolean;
  last_air_date: string;
  seasons: TMDBSeason[];
  production_companies: TMDBProductionCompany[];
  production_countries: TMDBProductionCountry[];
  spoken_languages: TMDBSpokenLanguage[];
  credits?: TMDBCredits;
  images?: TMDBImages;
  videos?: TMDBVideosResponse;
  similar?: TMDBPaginatedResponse<TMDBTVShow>;
  recommendations?: TMDBPaginatedResponse<TMDBTVShow>;
}

// ============================================================
// 热门（统一的 movie + tv 混合结果）
// ============================================================

/** Trending 统一结果（movie + tv 混合） */
export interface TMDBTrendingItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: 'movie' | 'tv';
  adult: boolean;
  original_language: string;
  genre_ids: number[];
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  video?: boolean;
  vote_average: number;
  vote_count: number;
  origin_country?: string[];
}

// ============================================================
// 搜索（/search/multi 返回）
// ============================================================

export interface TMDBMultiSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: TMDBMediaType;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  original_language: string;
  adult: boolean;
  video?: boolean;
  origin_country?: string[];
  original_title?: string;
  original_name?: string;
  // 人物字段（未使用）
  known_for_department?: string;
  known_for?: unknown[];
  profile_path?: string | null;
}

// ============================================================
// 演职员
// ============================================================

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

// ============================================================
// 人物
// ============================================================

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for?: TMDBVideoItem[];
}

export interface TMDBPersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  also_known_as: string[];
  homepage: string | null;
  imdb_id: string | null;
}

export interface TMDBPersonMovieCredits {
  cast: (TMDBMovie & { character: string; order: number })[];
  crew: (TMDBMovie & { job: string; department: string })[];
}

export interface TMDBPersonTVCredits {
  cast: (TMDBTVShow & { character: string; order: number; episode_count: number })[];
  crew: (TMDBTVShow & { job: string; department: string })[];
}

// ============================================================
// 图片
// ============================================================

export interface TMDBImage {
  aspect_ratio: number;
  file_path: string;
  height: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  width: number;
}

export interface TMDBImages {
  backdrops: TMDBImage[];
  logos: TMDBImage[];
  posters: TMDBImage[];
}

// ============================================================
// 视频
// ============================================================

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
}

export interface TMDBVideosResponse {
  results: TMDBVideo[];
}

// ============================================================
// 辅助类型
// ============================================================

export interface TMDBProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TMDBProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TMDBSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TMDBCreator {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface TMDBSeason {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

// ============================================================
// 筛选条件
// ============================================================

export type TMDBMediaTypeFilter = 'all' | 'movie' | 'tv';

export type TMDBSortBy =
  | 'popularity.desc'
  | 'popularity.asc'
  | 'vote_average.desc'
  | 'vote_average.asc'
  | 'primary_release_date.desc'
  | 'primary_release_date.asc'
  | 'first_air_date.desc'
  | 'first_air_date.asc';

export type TMDBSortOption = 'popularity' | 'vote_average' | 'release_date';

export interface TMDBFilterOptions {
  mediaType: TMDBMediaTypeFilter;
  genreIds: number[];
  minVoteAverage: number;
  sortBy: TMDBSortOption;
  sortOrder: 'desc' | 'asc';
  releaseYear: number | null;
  /** 日期范围查询：用于「其他」（pre-2015）等场景，优先级高于 releaseYear */
  releaseDateGte: string | null;
  releaseDateLte: string | null;
  originCountry: string | null;
}

export interface TMDBAvailableFilters {
  genres: TMDBGenre[];
  countries: TMDBCountry[];
  years: number[];
}

// ============================================================
// 映射后的视频数据（兼容 VideoCard 渲染）
// ============================================================

export interface TMDBVideoItem {
  tmdbId: number;
  id: string;             // "tmdb-movie-12345" 或 "tmdb-tv-12345"
  title: string;
  cover: string;
  type: VideoType;
  year?: number;
  tags: string[];
  description?: string;
  voteAverage: number;
  voteCount: number;
  mediaType: 'movie' | 'tv';
  releaseDate?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  logoPath?: string | null;
  popularity: number;
  genreIds: number[];
  originCountry?: string[];
  originalLanguage?: string;
}

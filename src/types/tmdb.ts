/**
 * TMDB (The Movie Database) API 类型定义
 * 基于 TMDB API v3 响应结构
 */

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
// Genre
// ============================================================

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBGenresResponse {
  genres: TMDBGenre[];
}

// ============================================================
// Configuration（图片基础 URL）
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
// Countries
// ============================================================

export interface TMDBCountry {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}

// ============================================================
// Movie
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
// TV Show
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
// Trending（统一的 movie + tv 混合结果）
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
// Search（/search/multi 返回）
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
  // Person fields (not used)
  known_for_department?: string;
  known_for?: unknown[];
  profile_path?: string | null;
}

// ============================================================
// Credits
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
// Images
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
// Videos
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
  originCountry: string | null;
}

export interface TMDBAvailableFilters {
  genres: TMDBGenre[];
  countries: TMDBCountry[];
  years: number[];
}

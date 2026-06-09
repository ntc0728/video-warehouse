/**
 * 筛选页共享常量
 *
 * 集中维护分类 / 媒体类型 / 排序等元信息，
 * 避免在 urlState / useBrowseData / BrowsePage 中重复定义导致漂移。
 */
import type { CategoryKey } from '@/components/CategoryQuickAccess';

// ── 分类显示标签 ────────────────────────────────────────
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: '全部',
  movie: '电影',
  tv: '剧集',
  variety: '综艺',
  anime: '动漫',
  top: '排行榜',
  documentary: '纪录片',
};

// ── 分类默认筛选配置 ────────────────────────────────────
export interface CategoryConfig {
  mediaType: 'all' | 'movie' | 'tv';
  /** 进入该分类时自动注入的 genreIds（仍参与 API 调用） */
  defaultGenreIds: number[];
  /** 切换类型 chip 时使用哪个语种 list */
  genresSource: 'movie' | 'tv' | 'both';
}

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  all:         { mediaType: 'all',   defaultGenreIds: [],      genresSource: 'both' },
  movie:       { mediaType: 'movie', defaultGenreIds: [],      genresSource: 'movie' },
  tv:          { mediaType: 'tv',    defaultGenreIds: [],      genresSource: 'tv' },
  variety:     { mediaType: 'tv',    defaultGenreIds: [10764], genresSource: 'tv' },
  anime:       { mediaType: 'tv',    defaultGenreIds: [16],    genresSource: 'tv' },
  top:         { mediaType: 'all',   defaultGenreIds: [],      genresSource: 'movie' },
  documentary: { mediaType: 'movie', defaultGenreIds: [99],    genresSource: 'movie' },
};

// ── 分类 → 进入筛选页时默认的 mediaType ────────────────
export const MEDIA_TYPE_OPTIONS: Record<CategoryKey, 'all' | 'movie' | 'tv'> = {
  all: 'all',
  movie: 'movie',
  tv: 'tv',
  variety: 'tv',
  anime: 'tv',
  top: 'all',
  documentary: 'movie',
};

// ── 排序（与 FilterBar SORT_OPTIONS 保持一致）────────
export const SORT_OPTIONS: { label: string; sortBy: 'popularity' | 'vote_average' | 'release_date'; order: 'desc' | 'asc' }[] = [
  { label: '最热', sortBy: 'popularity', order: 'desc' },
  { label: '最新', sortBy: 'release_date', order: 'desc' },
  { label: '最高分', sortBy: 'vote_average', order: 'desc' },
];

// ── 列表分页配置 ────────────────────────────────────────
/** 防抖：用户点击 chip 后等待多久发起 API 请求 */
export const FILTER_DEBOUNCE_MS = 300;

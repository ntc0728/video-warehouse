/**
 * 筛选页共享常量
 *
 * 集中维护分类 / 媒体类型 / 排序等元信息，
 * 避免在 urlState / useBrowseData / BrowsePage 中重复定义导致漂移。
 */
import type { CategoryKey } from '@/components/CategoryQuickAccess';

// ── 分类显示标签 ────────────────────────────────────────
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: '分类',
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

// ── 慢取页反馈（2026-09-14 用户拍板 A′）──────────────────
/**
 * 「旧内容顶住」的取页（翻页 / 下拉刷新 / 列数跨档）超过本时长才显示反馈。
 * 低于本时长的取页视为瞬时完成、静默直接换图（内存页缓存与浏览器 HTTP 缓存
 * 命中时 T 可能只有几十毫秒，立刻挂反馈只会闪 1~2 帧）。
 * 消费方：index.tsx 的 `showLateFeedback`（useDelayedFlag）。
 */
export const PENDING_FEEDBACK_DELAY_MS = 400;

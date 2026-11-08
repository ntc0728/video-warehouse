/**
 * 筛选页共享常量
 *
 * 集中维护分类 / 媒体类型 / 排序等元信息，
 * 避免在 urlState / useBrowseData / BrowsePage 中重复定义导致漂移。
 */
import type { CategoryKey } from '@/types/category';

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

// ── 分类默认筛选配置（单真源：类型行点击 → URL → store → TMDB 接口）────────
/**
 * 类型行只暴露 电影 / 剧集 / 排行榜 / 纪录片 四档（见 VISIBLE_CATEGORY_KEYS）。
 * variety / anime 作为 CategoryKey 仍保留在 Record 里（Chart 页 tab、CMS 类型、VideoType
 * 等别处在用），但不经 Browse 激活 —— parseFromUrl 会把 category=variety/anime 改写成 tv。
 */
export interface CategoryConfig {
  mediaType: 'all' | 'movie' | 'tv';
  /** 进入该分类时自动注入的 genreIds（仍参与 API 调用，逗号 = AND） */
  defaultGenreIds: number[];
  /** 左栏「分类」行用哪个语种 genre list */
  genresSource: 'movie' | 'tv' | 'both';
}

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  all:         { mediaType: 'all',   defaultGenreIds: [],   genresSource: 'both' },
  movie:       { mediaType: 'movie', defaultGenreIds: [],   genresSource: 'movie' },
  tv:          { mediaType: 'tv',    defaultGenreIds: [],   genresSource: 'tv' },
  variety:     { mediaType: 'tv',    defaultGenreIds: [],   genresSource: 'tv' },
  anime:       { mediaType: 'tv',    defaultGenreIds: [],   genresSource: 'tv' },
  top:         { mediaType: 'all',   defaultGenreIds: [],   genresSource: 'both' },
  documentary: { mediaType: 'movie', defaultGenreIds: [99], genresSource: 'movie' },
};

// ── 结果区头部「类型」行可见分类 ──────────────────────────────
/**
 * ：「全部」下线（movie+tv 合并页两路 total_pages 不同、page>500 直接 400，
 * 页数/入参无法稳定对齐），默认选中「电影」（单路）。
 * ：再删「综艺」「动漫」两个入口——二者本质都属于剧集(tv)，
 * 各自靠 genre/keyword 从 /discover/tv 里切子集，却与剧集共用同一套 TV genre 全表，
 * 导致左栏挂着「新闻/真人秀/肥皂剧/脱口秀/War & Politics」等与子集互斥的二级项、
 * 点进去空结果；留着它们只会不断制造分类歧义。删掉后类型行只保留 4 档：
 * 电影(movie) / 剧集(tv) / 排行榜(top) / 纪录片(documentary)。
 * 注意：variety / anime 作为 CategoryKey / VideoType / Chart 页 tab / 首页快选 / CMS 类型
 * 仍保留（别处合法在用），只是 Browse 类型行不再暴露这两个入口。
 * 页面层与首屏 chrome 骨架都以本表为真源，避免占位数量漂移。
 */
export const VISIBLE_CATEGORY_KEYS: CategoryKey[] = [
  'movie', 'tv', 'top', 'documentary',
];

export interface BrowseCategoryOption {
  key: CategoryKey;
  label: string;
  mediaType: 'all' | 'movie' | 'tv';
  genreIds: number[];
}

export const VISIBLE_CATEGORY_OPTIONS: BrowseCategoryOption[] = VISIBLE_CATEGORY_KEYS.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
  mediaType: CATEGORY_CONFIG[key].mediaType,
  genreIds: CATEGORY_CONFIG[key].defaultGenreIds,
}));

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

// ── 慢取页反馈──────────────────
/**
 * 「旧内容顶住」的取页（翻页 / 下拉刷新 / 列数跨档）超过本时长才显示反馈。
 * 低于本时长的取页视为瞬时完成、静默直接换图（内存页缓存与浏览器 HTTP 缓存
 * 命中时 T 可能只有几十毫秒，立刻挂反馈只会闪 1~2 帧）。
 * 消费方：index.tsx 的 `showLateFeedback`（useDelayedFlag）。
 */
export const PENDING_FEEDBACK_DELAY_MS = 400;

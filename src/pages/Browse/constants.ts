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

// ── 分类默认筛选配置（单真源：类型行点击 → URL → store → TMDB 接口）────────
/**
 * 2026-11-07 按 TMDB 真实语义修正（用户拍板）：
 *  - 动漫：TMDB 无 "Anime" genre。16=Animation（含欧美动画）不是日漫，且把它塞进
 *          defaultGenreIds 会与用户二级筛选在同一个 with_genres 里 AND，点任何二级项都变
 *          「动画 AND X」→ 空结果。故动漫**只用 with_keywords=anime 关键词**界定集合，
 *          defaultGenreIds 置空，把 with_genres 维度完整留给二级筛选。
 *  - 综艺：10764=真人秀 / 10767=脱口秀，是「分类基线」的 OR 组（with_genres 用 |）。
 *  - 纪录片：99=纪录片 是 AND 基线（99 AND 用户 genre = 纪录片里的该类型，语义正确）。
 *  - 排行榜：fetchTopRated(movie+tv 合并)，genresSource=both 与混合结果对齐。
 *  - 电影 / 剧集：各自单路 + 对应 genre 表。
 *
 * ⚠️ 关于 genresSource：剧集/综艺/动漫共用 tvGenres（TMDB /genre/tv/list 全表），
 *    这是 TMDB 官方 TV 分类体系（10759 本就叫 Action & Adventure、还有肥皂剧/新闻等），
 *    左栏显示的是接口原名，未做本地合并/重命名。这是「共用 tv 接口」的真实结果。
 */
export interface CategoryConfig {
  mediaType: 'all' | 'movie' | 'tv';
  /** 进入该分类时自动注入的 genreIds（仍参与 API 调用，逗号 = AND） */
  defaultGenreIds: number[];
  /** 多个 genre 之间 OR 时用 '|' 连接后交给 with_genres；默认逗号 AND */
  genreMatch?: 'and' | 'or';
  /** 自动注入的 TMDB keywordIds（with_keywords，逗号 AND / 竖线 OR） */
  keywordIds?: number[];
  /** 左栏「分类」行用哪个语种 genre list */
  genresSource: 'movie' | 'tv' | 'both';
}

/**
 * 动漫分类的 anime 关键词 id（TMDB /keyword 体系）。
 * ⚠️ 210024 为用户指定的候选值，本项目无真实 token 未能联网核实；
 *    如与实际不符，只改这一个常量即可（单点），无需动 4 层链路。
 *    兜底：若 TMDB 返回空结果，可把该值清空、改用下方 ANIME_ORIGIN_COUNTRY='JP' 国家码方案。
 */
export const ANIME_KEYWORD_ID = 210024;
/** 兜底方案：改用国家码过滤日漫时启用（与 keyword 二选一，默认不走） */
export const ANIME_ORIGIN_COUNTRY: string | null = null;

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  all:         { mediaType: 'all',   defaultGenreIds: [],          genresSource: 'both' },
  movie:       { mediaType: 'movie', defaultGenreIds: [],          genresSource: 'movie' },
  tv:          { mediaType: 'tv',    defaultGenreIds: [],          genresSource: 'tv' },
  variety:     { mediaType: 'tv',    defaultGenreIds: [10764, 10767], genreMatch: 'or', genresSource: 'tv' },
  anime:       { mediaType: 'tv',    defaultGenreIds: [],   keywordIds: [ANIME_KEYWORD_ID], genresSource: 'tv' },
  top:         { mediaType: 'all',   defaultGenreIds: [],          genresSource: 'both' },
  documentary: { mediaType: 'movie', defaultGenreIds: [99],        genresSource: 'movie' },
};

// ── 结果区头部「类型」行可见分类（2026-11-05：「全部」下线）──
/**
 * 「全部」是 movie + tv 合并页：两路 total_pages 不同、page>500 直接 400，
 * 页数/入参天然无法稳定对齐。用户拍板删除该入口，默认选中「电影」（单路）。
 * 只保留这 6 档；页面层与首屏 chrome 骨架都以本表为真源，避免占位数量漂移。
 */
export const VISIBLE_CATEGORY_KEYS: CategoryKey[] = [
  'movie', 'tv', 'variety', 'anime', 'top', 'documentary',
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

// ── 慢取页反馈（2026-09-14 用户拍板 A′）──────────────────
/**
 * 「旧内容顶住」的取页（翻页 / 下拉刷新 / 列数跨档）超过本时长才显示反馈。
 * 低于本时长的取页视为瞬时完成、静默直接换图（内存页缓存与浏览器 HTTP 缓存
 * 命中时 T 可能只有几十毫秒，立刻挂反馈只会闪 1~2 帧）。
 * 消费方：index.tsx 的 `showLateFeedback`（useDelayedFlag）。
 */
export const PENDING_FEEDBACK_DELAY_MS = 400;

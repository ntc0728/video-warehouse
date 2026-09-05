/**
 * CategoryQuickAccess 宽屏面板数据模块（2026-09-06 方案 A2）
 *
 * 职责：>1280 桌面「频道导航 + 热门分类面板」的分类定义、子分类表、
 * 桶聚合（分类热度榜）与面板数据获取（模块级缓存 + in-flight 去重）。
 * 设计文档：changelogs/design-docs/2026-09-06-category-quick-access-a2-实施方案.md
 *
 * 数据口径（用户拍板）：
 *   · 热度 = TMDB popularity 原始值；
 *   · 一部作品同时命中多分类 → 各分类重复计入；
 *   · 综艺/动漫/纪录片子分类 = 主 genre × 相关 genre 的真实交叉组合（with_genres AND，
 *     组合均经真实 API 验证有数据）。
 */
import type { CategoryKey } from './CategoryQuickAccess';
import type { TMDBVideoItem } from '@/types/tmdb';
import {
  discoverCategory,
  fetchMovieGenres,
  fetchTVGenres,
  fetchTrending,
} from '@/services/tmdbService';
import {
  mapMovieToVideoItem,
  mapTVToVideoItem,
  mapTrendingToVideoItem,
} from '@/stores/useTMDBStore';

/** 宽屏导航分类 key（home = 默认「分类热度榜」面板） */
export type WideCategoryKey = 'home' | CategoryKey;

/** 面板子分类：genreIds 为 discover AND 组合；trending 为排行榜窗口 */
export interface WideSubCategory {
  id: string | number;
  label: string;
  genreIds?: number[];
  trending?: { mediaType: 'all' | 'movie' | 'tv'; timeWindow: 'day' | 'week' };
}

export interface WideCategory {
  key: WideCategoryKey;
  label: string;
  /** 主媒体类型（电影/剧集面板 + 桶聚合） */
  type: 'movie' | 'tv' | null;
  /** 综艺/动漫/纪录片主 genre id（桶聚合 + 默认子分类） */
  mainGenreId?: number;
  /** 静态子分类表（综艺/动漫/纪录片/排行榜）；电影/剧集为懒加载全量 genre */
  subgenres?: WideSubCategory[];
  /** 电影/剧集：子分类来自全量 genre list */
  genreListType?: 'movie' | 'tv';
}

export const WIDE_CATEGORIES: WideCategory[] = [
  { key: 'home', label: '首页', type: null },
  { key: 'movie', label: '电影', type: 'movie', genreListType: 'movie' },
  { key: 'tv', label: '剧集', type: 'tv', genreListType: 'tv' },
  {
    key: 'variety', label: '综艺', type: 'tv', mainGenreId: 10764,
    subgenres: [
      { id: 0, label: '全部', genreIds: [10764] },
      { id: 10751, label: '家庭亲子', genreIds: [10764, 10751] },
      { id: 10767, label: '谈话', genreIds: [10764, 10767] },
      { id: 10763, label: '新闻', genreIds: [10764, 10763] },
    ],
  },
  {
    key: 'anime', label: '动漫', type: 'tv', mainGenreId: 16,
    subgenres: [
      { id: 0, label: '全部', genreIds: [16] },
      { id: 10759, label: '动作冒险', genreIds: [16, 10759] },
      { id: 35, label: '喜剧', genreIds: [16, 35] },
      { id: 10765, label: '科幻&奇幻', genreIds: [16, 10765] },
      { id: 10762, label: '儿童', genreIds: [16, 10762] },
    ],
  },
  {
    key: 'documentary', label: '纪录片', type: 'movie', mainGenreId: 99,
    subgenres: [
      { id: 0, label: '全部', genreIds: [99] },
      { id: 36, label: '历史', genreIds: [99, 36] },
      { id: 80, label: '犯罪', genreIds: [99, 80] },
      { id: 10402, label: '音乐', genreIds: [99, 10402] },
      { id: 10752, label: '战争', genreIds: [99, 10752] },
    ],
  },
  {
    key: 'top', label: '排行榜', type: null,
    subgenres: [
      { id: 'day', label: '日榜', trending: { mediaType: 'all', timeWindow: 'day' } },
      { id: 'week', label: '周榜', trending: { mediaType: 'all', timeWindow: 'week' } },
      { id: 'movie-week', label: '电影榜', trending: { mediaType: 'movie', timeWindow: 'week' } },
      { id: 'tv-week', label: '剧集榜', trending: { mediaType: 'tv', timeWindow: 'week' } },
    ],
  },
];

/** 桶聚合结果：分类热度榜（默认面板）单行 */
export interface CategoryHeatBucket {
  key: CategoryKey;
  count: number;
  heat: number;
  top3: TMDBVideoItem[];
}

/** 桶规则（拍板：多分类命中重复计入） */
const BUCKET_RULES: Array<{ key: CategoryKey; match: (item: TMDBVideoItem) => boolean }> = [
  { key: 'movie', match: (it) => it.mediaType === 'movie' },
  { key: 'tv', match: (it) => it.mediaType === 'tv' },
  { key: 'variety', match: (it) => it.mediaType === 'tv' && it.genreIds.includes(10764) },
  { key: 'anime', match: (it) => it.mediaType === 'tv' && it.genreIds.includes(16) },
  { key: 'documentary', match: (it) => it.mediaType === 'movie' && it.genreIds.includes(99) },
];

/** /trending/all/day 结果按分类桶聚合（热度徽标 + 默认面板共用） */
export function aggregateCategoryHeat(items: TMDBVideoItem[]): CategoryHeatBucket[] {
  const buckets = BUCKET_RULES.map(({ key, match }) => ({ key, match, items: [] as TMDBVideoItem[] }));
  for (const item of items) {
    for (const b of buckets) {
      if (b.match(item)) b.items.push(item);
    }
  }
  return buckets
    .map(({ key, items: list }) => ({
      key,
      count: list.length,
      heat: list.reduce((sum, it) => sum + (it.popularity || 0), 0),
      top3: [...list].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 3),
    }))
    .sort((a, b) => b.heat - a.heat);
}

// ── 缓存（面板数据 + genre list；Keep-Alive 下二次展开零请求）─────────
const panelCache = new Map<string, TMDBVideoItem[]>();
const panelInflight = new Map<string, Promise<TMDBVideoItem[]>>();
let genreListCache: Partial<Record<'movie' | 'tv', WideSubCategory[]>> = {};

/** 电影/剧集子分类 = 全量 genre list（首 chip「全部」= 当日 trending） */
export async function getGenreSubcategories(type: 'movie' | 'tv'): Promise<WideSubCategory[]> {
  const cached = genreListCache[type];
  if (cached) return cached;
  const genres = type === 'movie' ? await fetchMovieGenres() : await fetchTVGenres();
  const list: WideSubCategory[] = [
    { id: 0, label: '全部' },
    ...genres.map((g) => ({ id: g.id, label: g.name })),
  ];
  genreListCache[type] = list;
  return list;
}

/** 面板缓存 key */
function panelCacheKey(cat: WideCategory, subId: string | number): string {
  return `${cat.key}:${subId}`;
}

/**
 * 拉取某分类某子分类的热门内容（≤9 条，popularity 降序）。
 * - 电影/剧集「全部」→ /trending/{type}/day；指定 genre → /discover（gte 放宽到 10）
 * - 综艺/动漫/纪录片 → /discover with_genres 主genre[,副genre]（AND）
 * - 排行榜 → /trending/{all,movie,tv}/{day,week}
 */
export async function fetchCategoryPanel(
  cat: WideCategory,
  subId: string | number,
  signal?: AbortSignal,
): Promise<TMDBVideoItem[]> {
  const key = panelCacheKey(cat, subId);
  const cached = panelCache.get(key);
  if (cached) return cached;
  const inflight = panelInflight.get(key);
  if (inflight) return inflight;

  const task = (async (): Promise<TMDBVideoItem[]> => {
    let items: TMDBVideoItem[];
    if (cat.key === 'top') {
      const sub = cat.subgenres?.find((s) => s.id === subId) ?? cat.subgenres![0];
      const t = sub.trending!;
      items = (await fetchTrending(t.mediaType, t.timeWindow, { signal })).results
        .map(mapTrendingToVideoItem);
    } else if (cat.mainGenreId != null) {
      const sub = cat.subgenres?.find((s) => s.id === subId) ?? cat.subgenres![0];
      const resp = await discoverCategory(cat.type!, sub.genreIds!, { signal });
      items = resp.results.map((r) =>
        cat.type === 'movie' ? mapMovieToVideoItem(r as never) : mapTVToVideoItem(r as never),
      );
    } else if (subId && subId !== 0 && cat.type) {
      // 电影/剧集指定 genre
      const resp = await discoverCategory(cat.type, [Number(subId)], { signal });
      items = resp.results.map((r) =>
        cat.type === 'movie' ? mapMovieToVideoItem(r as never) : mapTVToVideoItem(r as never),
      );
    } else {
      // 电影/剧集「全部」→ 当日 trending
      items = (await fetchTrending(cat.type as 'movie' | 'tv', 'day', { signal }))
        .results.map(mapTrendingToVideoItem);
    }
    // 统一按热度倒序后截取（2026-09-06 用户反馈）：/trending 返回的是「趋势序」
    // 而非 popularity 降序，直接展示会出现热度数字忽高忽低像随机排列
    const sorted = [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const top = sorted.slice(0, 9);
    panelCache.set(key, top);
    return top;
  })();

  panelInflight.set(key, task);
  try {
    return await task;
  } finally {
    panelInflight.delete(key);
  }
}

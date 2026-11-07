/**
 * 筛选页 URL ↔ FilterBarValue 双向转换
 *
 * URL 形态：
 *   /browse?category=movie&mediaType=movie&genre=28,12&region=US&minRating=7&sort=vote_average.desc&page=1
 *
 * - category     : CategoryKey（必填；缺省回退为 'all'）
 * - mediaType    : 'all' | 'movie' | 'tv'
 * - genre        : 多选用逗号分隔（'28,12'），空 = 全部
 * - region       : 地区 code；空 = 全部
 * - minRating    : 0 / 6 / 7 / 8
 * - sort         : 'popularity.desc' | 'release_date.desc' | 'vote_average.desc'
 * - page         : 数字（懒加载进度；非必填）
 */
import type { FilterBarValue } from '@/components/FilterBar';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { SORT_OPTIONS, MEDIA_TYPE_OPTIONS, VISIBLE_CATEGORY_KEYS } from './constants';

const VALID_CATEGORIES = new Set<CategoryKey>([
  'all', 'movie', 'tv', 'variety', 'anime', 'top', 'documentary',
]);

function isCategoryKey(v: string): v is CategoryKey {
  return VALID_CATEGORIES.has(v as CategoryKey);
}

/** sortBy.order → URL 字符串 */
function sortToUrl(sortIdx: number): string {
  const s = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];
  return `${s.sortBy}.${s.order}`;
}

/** URL 字符串 → sortIdx（找不到回退 0） */
function sortToIdx(value: string | null): number {
  if (!value) return 0;
  const idx = SORT_OPTIONS.findIndex((s) => `${s.sortBy}.${s.order}` === value);
  return idx >= 0 ? idx : 0;
}

function parseGenreIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** 默认 FilterBarValue（进入筛选页无 URL 时的兜底）——2026-11-05 起默认「电影」单路 */
export function getDefaultFilterValue(): FilterBarValue {
  return {
    category: 'movie',
    mediaType: 'movie',
    genreIds: [],
    region: null,
    minRating: 0,
    sortIdx: 0,
    year: null,
    olderThan2015: false,
  };
}

/** URL 解析 → FilterBarValue（非法值全部回退默认） */
export function parseFromUrl(params: URLSearchParams): FilterBarValue {
  const def = getDefaultFilterValue();

  const categoryRaw = params.get('category') ?? def.category;
  // 类型行可见档位 = VISIBLE_CATEGORY_KEYS 白名单，旧/非法 category 一律兜底：
  //   · category=all → 默认「电影」；
  //   · category=variety / anime → 剧集 'tv'（二者本质属剧集，避免落到
  //     「类型行不显示、配置却还在」的孤立状态）；
  //   · 其它非法值 → 默认「电影」。
  const legacyTv = categoryRaw === 'variety' || categoryRaw === 'anime';
  const category: CategoryKey =
    legacyTv ? 'tv'
    : isCategoryKey(categoryRaw) && categoryRaw !== 'all' && (VISIBLE_CATEGORY_KEYS as string[]).includes(categoryRaw)
      ? categoryRaw
      : def.category;

  // mediaType 一律由 category 决定，**不再信任 URL 里的 mediaType**。
  // 旧链接常见的 category=all&mediaType=all 会被上面的 category 兜底改写成 movie，
  // 若仍读 URL 的 all 就会重新进入 tv+movie 合并页（页数/入参无法稳定对齐）。
  // 「排行榜」的内部标记 all 由 MEDIA_TYPE_OPTIONS.top 保留，不经过 URL。
  const mediaType: 'all' | 'movie' | 'tv' = MEDIA_TYPE_OPTIONS[category] ?? def.mediaType;

  const regionRaw = params.get('region');
  const region = regionRaw && regionRaw !== 'null' ? regionRaw : null;

  const minRatingRaw = Number.parseInt(params.get('minRating') ?? '0', 10);
  const minRating = [0, 6, 7, 8].includes(minRatingRaw) ? minRatingRaw : 0;

  return {
    category,
    mediaType,
    genreIds: parseGenreIds(params.get('genre')),
    region,
    minRating,
    sortIdx: sortToIdx(params.get('sort')),
    year: Number.parseInt(params.get('year') ?? '0', 10) || null,
    olderThan2015: params.get('older') === '1',
  };
}

/** FilterBarValue → URLSearchParams（不写入空值，保持 URL 简洁） */
export function serializeToUrl(value: FilterBarValue): URLSearchParams {
  const params = new URLSearchParams();

  params.set('category', value.category);
  params.set('mediaType', value.mediaType);

  if (value.genreIds.length > 0) {
    params.set('genre', value.genreIds.slice().sort((a, b) => a - b).join(','));
  }
  if (value.region) params.set('region', value.region);
  if (value.minRating > 0) params.set('minRating', String(value.minRating));
  if (value.year) params.set('year', String(value.year));
  if (value.olderThan2015) params.set('older', '1');
  if (value.sortIdx !== 0) params.set('sort', sortToUrl(value.sortIdx));

  return params;
}

/** 仅生成进入筛选页时由分类名构造的初始 URL（含默认 genreIds） */
export function buildBrowseUrl(
  category: CategoryKey,
  defaultGenreIds: number[] = [],
): string {
  // 「全部」下线（→电影）、综艺/动漫入口删除（→剧集，二者本质属 tv）：
  // 旧调用点即使仍传这些 key，也不会生成类型行已不存在的 category。
  const safeCategory: CategoryKey =
    category === 'all' ? 'movie'
    : category === 'variety' || category === 'anime' ? 'tv'
    : category;
  const params = new URLSearchParams();
  params.set('category', safeCategory);
  params.set('mediaType', MEDIA_TYPE_OPTIONS[safeCategory] ?? 'movie');
  if (defaultGenreIds.length > 0) {
    params.set('genre', defaultGenreIds.slice().sort((a, b) => a - b).join(','));
  }
  return `/browse?${params.toString()}`;
}

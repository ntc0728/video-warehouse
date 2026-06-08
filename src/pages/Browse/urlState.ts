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
import { SORT_OPTIONS, MEDIA_TYPE_OPTIONS } from './constants';

const VALID_CATEGORIES = new Set<CategoryKey>([
  'all', 'movie', 'tv', 'variety', 'anime', 'top', 'documentary',
]);

function isCategoryKey(v: string): v is CategoryKey {
  return VALID_CATEGORIES.has(v as CategoryKey);
}

function isMediaType(v: string): v is 'all' | 'movie' | 'tv' {
  return v === 'all' || v === 'movie' || v === 'tv';
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

/** 默认 FilterBarValue（进入筛选页无 URL 时的兜底） */
export function getDefaultFilterValue(): FilterBarValue {
  return {
    category: 'all',
    mediaType: 'all',
    genreIds: [],
    region: null,
    minRating: 0,
    sortIdx: 0,
  };
}

/** URL 解析 → FilterBarValue（非法值全部回退默认） */
export function parseFromUrl(params: URLSearchParams): FilterBarValue {
  const def = getDefaultFilterValue();

  const categoryRaw = params.get('category') ?? def.category;
  const category: CategoryKey = isCategoryKey(categoryRaw) ? categoryRaw : def.category;

  const mediaTypeRaw = params.get('mediaType') ?? MEDIA_TYPE_OPTIONS[category] ?? def.mediaType;
  const mediaType: 'all' | 'movie' | 'tv' = isMediaType(mediaTypeRaw) ? mediaTypeRaw : def.mediaType;

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
  if (value.sortIdx !== 0) params.set('sort', sortToUrl(value.sortIdx));

  return params;
}

/** 仅生成进入筛选页时由分类名构造的初始 URL（含默认 genreIds） */
export function buildBrowseUrl(
  category: CategoryKey,
  defaultGenreIds: number[] = [],
): string {
  const params = new URLSearchParams();
  params.set('category', category);
  params.set('mediaType', MEDIA_TYPE_OPTIONS[category] ?? 'all');
  if (defaultGenreIds.length > 0) {
    params.set('genre', defaultGenreIds.slice().sort((a, b) => a - b).join(','));
  }
  return `/browse?${params.toString()}`;
}

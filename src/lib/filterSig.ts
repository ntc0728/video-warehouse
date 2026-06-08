/**
 * FilterBar 签名工具
 *
 * 用于判断 FilterBarValue 是否发生有效变化，避免重复触发 API 请求。
 * 字段顺序、归一化策略保持稳定（相同输入 → 相同输出）。
 */
import type { FilterBarValue } from '@/components/FilterBar';

/**
 * 计算筛选签名的去抖/去重键。
 * 字段变更将被签名捕获，从而触发搜索。
 */
export function buildFilterSig(v: FilterBarValue): string {
  return [
    v.category,
    v.mediaType,
    v.genreIds.slice().sort((a, b) => a - b).join(','),
    v.region ?? 'none',
    v.minRating,
    v.sortIdx,
  ].join('|');
}

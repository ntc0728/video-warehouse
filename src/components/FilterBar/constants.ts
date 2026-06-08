/**
 * FilterBar 常量与类型定义
 * 单独拆分以满足 react-refresh/only-export-components 约束
 */
import type { CategoryKey } from '@/components/CategoryQuickAccess';

// ── 类型选项（仅在 category=all 时显示）────────────

export const MEDIA_OPTIONS: { label: string; value: 'all' | 'movie' | 'tv' }[] = [
  { label: '全部', value: 'all' },
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
];

// ── 地区选项 ────────────────────────────────────────
// 「全部」已迁移到可点击的 label 上，chip 区不再包含 null 选项

export const REGION_OPTIONS: { label: string; code: string | null }[] = [
  { label: '内地', code: 'CN' },
  { label: '中国香港', code: 'HK' },
  { label: '中国台湾', code: 'TW' },
  { label: '美国', code: 'US' },
  { label: '韩国', code: 'KR' },
  { label: '日本', code: 'JP' },
  { label: '欧洲', code: 'EU' },
  { label: '印度', code: 'IN' },
  { label: '泰国', code: 'TH' },
  { label: '丹麦', code: 'DK' },
  { label: '英国', code: 'GB' },
  { label: '其他', code: 'OTHER' },
];

// ── 排序选项 ────────────────────────────────────────

export const SORT_OPTIONS: { label: string; sortBy: 'popularity' | 'vote_average' | 'release_date'; order: 'desc' | 'asc' }[] = [
  { label: '最热', sortBy: 'popularity', order: 'desc' },
  { label: '最新', sortBy: 'release_date', order: 'desc' },
  { label: '最高分', sortBy: 'vote_average', order: 'desc' },
];

// ── 类型 ────────────────────────────────────────────

export interface FilterBarValue {
  category: CategoryKey;
  mediaType: 'all' | 'movie' | 'tv';
  genreIds: number[];
  region: string | null;
  minRating: number;
  sortIdx: number;
}

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

// ── 年份选项 ────────────────────────────────────────

export const YEAR_OPTIONS: { label: string; value: number }[] = [
  { label: '2026', value: 2026 },
  { label: '2025', value: 2025 },
  { label: '2024', value: 2024 },
  { label: '2023', value: 2023 },
  { label: '2022', value: 2022 },
  { label: '2021', value: 2021 },
  { label: '2020', value: 2020 },
  { label: '2019', value: 2019 },
  { label: '2018', value: 2018 },
  { label: '2017', value: 2017 },
  { label: '2016', value: 2016 },
  { label: '2015', value: 2015 },
];

export const YEAR_OLDER_LABEL = '其他';

// ── 类型 ────────────────────────────────────────────

export interface FilterBarValue {
  category: CategoryKey;
  mediaType: 'all' | 'movie' | 'tv';
  genreIds: number[];
  region: string | null;
  minRating: number;
  sortIdx: number;
  year: number | null;
  /** 选中「其他」时为 true，查询 2015 年之前的内容 */
  olderThan2015: boolean;
}

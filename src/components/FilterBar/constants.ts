/**
 * FilterBar 常量与类型定义
 * 单独拆分以满足 react-refresh/only-export-components 约束
 */
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import type { TMDBCountry } from '@/types/tmdb';

// ── 类型选项（仅在 category=all 时显示）────────────

export const MEDIA_OPTIONS: { label: string; value: 'all' | 'movie' | 'tv' }[] = [
  { label: '全部', value: 'all' },
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
];

// ── 地区选项（2026-11-07 改为从 TMDB 真实国家列表生成）──────
// 「全部」已迁移到可点击的 label 上，chip 区不再包含 null 选项
//
// 设计：`REGION_PRIORITY` 是「希望展示的国家/地区」候选表（含中文名），
// `buildRegionOptions(countries)` 用 TMDB `/configuration/countries` 的真实返回做**校验**：
// 只有 TMDB 确实支持（存在该 iso_3166_1）的项才会出现在左栏 → 从根上杜绝
// 「选了没有数据的地区」（如历史上的 EU / OTHER，二者都不是 ISO 3166-1 国家码）。
// ⚠️ tag 顺序即展示顺序（常用在前），未列入 PRIORITY 的国家不展示（TMDB 全量 200+ 项塞不进左栏）。

/**
 * 地区选项。`code` 既是 URL 值、也是两种后端的分发键：
 *  - 智能检索（TMDB）：`with_origin_country` **只接受 ISO 3166-1 二字母国家代码**；
 *  - 直链搜索（CMS）：`vod_area` 自由文本，用 `index.tsx CMS_REGION_ALIASES` 别名匹配。
 *
 * 2026-11-07：改为由 `buildRegionOptions(store.countries)` 动态生成，
 * 候选表经 TMDB `/configuration/countries` 校验后才出现 → 不再可能选到无效地区。
 * 唯一例外是「欧洲」聚合项：它本身不是国家，用 `tmdbCodes` 展开成多国 OR。
 */
export interface RegionOption {
  label: string;
  /** URL / 分发键。聚合项使用虚拟键（如 EU），其余为 ISO 3166-1 二字母码 */
  code: string | null;
  /** TMDB 侧实际下发的国家码（多值 = OR）；缺省时直接用 code */
  tmdbCodes?: string[];
}

/** 候选国家/地区（展示顺序 = 本表顺序）。全部须经 TMDB countries 校验后才生效。 */
const REGION_CANDIDATES: { code: string; label: string }[] = [
  { code: 'CN', label: '内地' },
  { code: 'HK', label: '中国香港' },
  { code: 'TW', label: '中国台湾' },
  { code: 'US', label: '美国' },
  { code: 'KR', label: '韩国' },
  { code: 'JP', label: '日本' },
  { code: 'IN', label: '印度' },
  { code: 'TH', label: '泰国' },
  { code: 'GB', label: '英国' },
  { code: 'DK', label: '丹麦' },
  { code: 'FR', label: '法国' },
  { code: 'DE', label: '德国' },
  { code: 'ES', label: '西班牙' },
  { code: 'IT', label: '意大利' },
  { code: 'RU', label: '俄罗斯' },
  { code: 'CA', label: '加拿大' },
  { code: 'AU', label: '澳大利亚' },
  { code: 'BR', label: '巴西' },
  { code: 'MX', label: '墨西哥' },
  { code: 'SE', label: '瑞典' },
  { code: 'NO', label: '挪威' },
  { code: 'NL', label: '荷兰' },
  { code: 'PL', label: '波兰' },
  { code: 'TR', label: '土耳其' },
];

/**
 * 「欧洲」聚合项：code 是虚拟键（非 ISO 国家码），TMDB 侧按 tmdbCodes 展开成多国 OR。
 * 不参与 countries 校验（它本来就不是单一国家）。
 */
export const EUROPE_AGGREGATE: RegionOption = {
  label: '欧洲',
  code: 'EU',
  // 已单列的 GB / DK 不重复计入，避免同片在两个 chip 下都命中
  tmdbCodes: [
    'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO',
    'PL', 'IE', 'AT', 'CH', 'PT', 'GR', 'FI', 'CZ', 'HU', 'RO',
  ],
};
const EUROPE_INSERT_AFTER = 'JP';

/**
 * 用 TMDB `/configuration/countries` 的真实返回**校验**候选表，生成左栏地区选项。
 *
 * - 只有 TMDB 确实支持（`iso_3166_1` 存在）的 code 才会出现 → 从根上杜绝「选了没数据的地区」；
 * - countries 尚未拉取（首屏 / 未配置 Token）时回退为空候选 + 仅聚合项，
 *   由调用方决定是否渲染（FilterBar 此时只剩「全部」）。
 */
export function buildRegionOptions(countries: TMDBCountry[]): RegionOption[] {
  if (!countries.length) return [];
  const valid = new Set(countries.map((c) => c.iso_3166_1));
  const out: RegionOption[] = [];
  for (const cand of REGION_CANDIDATES) {
    if (!valid.has(cand.code)) continue;
    out.push({ code: cand.code, label: cand.label });
    if (cand.code === EUROPE_INSERT_AFTER) out.push(EUROPE_AGGREGATE);
  }
  return out;
}



// ── 排序选项 ────────────────────────────────────────

export const SORT_OPTIONS: { label: string; sortBy: 'popularity' | 'vote_average' | 'release_date'; order: 'desc' | 'asc' }[] = [
  { label: '最热', sortBy: 'popularity', order: 'desc' },
  { label: '最新', sortBy: 'release_date', order: 'desc' },
  { label: '最高分', sortBy: 'vote_average', order: 'desc' },
];

// ── 年份选项（2026-11-07 改为按当前年份滚动）────────────
/**
 * 年份下限固定 2015：与「其他」（`olderThan2015`）的语义绑定 ——
 * 该选项查的是 2015 年**之前**的内容，若下限跟着滚动会与「其他」重叠。
 * 上限取当前年份（TMDB 无「年份列表」接口，业界惯例即「当前年往前推」）。
 */
export const YEAR_MIN = 2015;
const YEAR_MAX = new Date().getFullYear();

export const YEAR_OPTIONS: { label: string; value: number }[] = Array.from(
  { length: Math.max(1, YEAR_MAX - YEAR_MIN + 1) },
  (_, i) => {
    const y = YEAR_MAX - i;
    return { label: String(y), value: y };
  },
);

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

/**
 * 分类级「类型」选项（2026-09-07）：调用方传入后，类型行由 3 档 mediaType
 * 升级为全部分类（全部/电影/剧集/综艺/动漫/纪录片/排行榜）。
 * 点击 = 切换 category 并按调用方（Browse CATEGORY_CONFIG）注入
 * mediaType + 默认 genreIds；不传则回落旧 3 档 mediaType 行（其他调用方零回归）。
 */
export interface FilterBarCategoryOption {
  key: CategoryKey;
  label: string;
  mediaType: 'all' | 'movie' | 'tv';
  genreIds: number[];
}

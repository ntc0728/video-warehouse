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
// 设计：`REGION_CANDIDATES` 是「希望展示的国家/地区」候选表（含中文名），
// `buildRegionOptions(countries)` 用 TMDB `/configuration/countries` 的真实返回做**校验**：
// 只有 TMDB 确实支持（存在该 iso_3166_1）的项才会出现在左栏 → 从根上杜绝「选了没有数据的地区」。
// ⚠️ 表内顺序即展示顺序（常用在前）；未列入候选表的国家不展示（TMDB 全量 200+ 项塞不进左栏）。

/**
 * 地区选项。`code` 既是 URL 值、也是两种后端的分发键：
 *  - 智能检索（TMDB）：`with_origin_country` **只接受 ISO 3166-1 二字母国家代码**，
 *    但支持**逗号分隔多值（OR 语义）**；
 *  - 直链搜索（CMS）：`vod_area` 自由文本，用别名表匹配（见 `index.tsx CMS_REGION_ALIASES`）。
 *
 * 2026-11-07 定稿：
 *  - 候选表 `REGION_CANDIDATES` 经 TMDB `/configuration/countries` 校验后逐个出现；
 *  - **不设「欧洲」聚合**：欧洲主要国家（法/德/意/西/俄/荷/瑞典/挪威/波兰）已单列；
 *  - **不设「其他」**：TMDB 侧只能枚举剩余 ~216 国做 OR（URL 长、语义绕），
 *    CMS 侧 `vod_area` 自由文本下小国几乎不出现，投入产出比低；
 *  - 智能检索与直链搜索共用同一份选项（同 `buildRegionOptions`）。
 */
export interface RegionOption {
  label: string;
  /** URL / 分发键：ISO 3166-1 二字母码 */
  code: string | null;
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
 * 用 TMDB `/configuration/countries` 的真实返回**校验**候选表，生成左栏地区选项。
 *
 * - 只有 TMDB 确实支持（`iso_3166_1` 存在）的 code 才会出现 → 杜绝「选了没数据的地区」；
 * - countries 尚未拉取（首屏 / 未配 Token）时返回空数组 → 地区组只剩「全部」，
 *   不会闪出无效项。
 *
 * 2026-11-07：**不设「其他」**（用户拍板删除）。原因：
 *   · TMDB 侧要表达「其他」只能枚举剩余 ~216 个国家做 OR，语义绕且 URL 长；
 *   · CMS 侧 `vod_area` 是自由文本，小国根本不会出现，「其他」覆盖面极窄；
 *   · 24 个主流国家已覆盖绝大多数影视内容，「其他」的筛选价值低于维护成本。
 */
export function buildRegionOptions(countries: TMDBCountry[]): RegionOption[] {
  if (!countries.length) return [];
  const valid = new Set(countries.map((c) => c.iso_3166_1));
  const out: RegionOption[] = [];
  for (const cand of REGION_CANDIDATES) {
    if (!valid.has(cand.code)) continue;
    out.push({ code: cand.code, label: cand.label });
  }
  return out;
}



/**
 * 组内折叠的默认展示上限（2026-11-07 用户拍板，仅 Browse ≥2560 单列启用）。
 *
 * ⚠️ **分类不折叠**（用户：「分类是最重要的，默认全部展示」）——
 *    它是主筛选维度，再多也要一屏看全，故不在本表内（不设上限即全量）。
 *    地区 / 年份只需常见几项，各留 6。
 *
 * 预算（1440 高视口，左栏可用 ≈1274px、每项 ≈25.4px）：
 *   分类 20（全量）+ 地区 7（6+展开）+ 年份 9（6+其他+展开）= 36 项 ≈ 914px
 *   + 3 组标题 ≈ 72px + 底部留白 → ≈1020px，仍在一屏内。
 *   ⚠️ 排行榜分类有 34 项时会超出一屏（≈1370px）→ 该分类下允许滚动，属预期。
 */
export const FILTER_COLLAPSE_LIMIT = { region: 6, year: 6 } as const;

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

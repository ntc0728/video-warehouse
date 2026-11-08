/**
 * FilterBar — 公共筛选组件
 * 分类 · 类型 · 地区 · 排序 — 横向 chip 筛选，支持 TMDB discover 参数
 * 主题感知：Light/Dark 自动适配
 * 点击任意 chip 即触发搜索（无「应用筛选」按钮）
 * 分类行：多行 wrap 展示；单选（点击其他自动替换，不可经 chip 取消）
 * 类型行：仅在 category=all 时显示（全部/电影/剧集）
 * 地区/分类 label 可点击：点击 = 回到该行「全部」状态，默认即高亮
 * 排序 label 不可选（纯文本）
 *
 * 所有筛选 tab 均全展开（不限行、无折叠 / 「更多」按钮）
 */
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { TMDBGenre } from '@/types/tmdb';
import { MEDIA_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL, FILTER_COLLAPSE_LIMIT, type FilterBarValue, type FilterBarCategoryOption, type RegionOption } from './constants';
import './FilterBar.css';

export type { FilterBarValue } from './constants';

// ── chip 类名与字宽变量 ──────────────────────────────────────────────
// CJK 记 1 字宽、ASCII 记 0.5。labelWidth 以 CSSProperties 变量 --chip-label-w
// 注入到每个 chip，供 Browse ≥2560 单列时按「(字宽 − 2) × 字宽」动态补偿左缘，
// 使任意长度（三字 / 四字 / 五字…）文字左缘都对齐两字 chip（见 Browse.css）。
// 纯数字变量在 <2560 / 其它调用方无任何规则消费 → 零副作用。
const labelWidth = (label: string): number =>
  [...label].reduce((w, ch) => w + (/[\u2E80-\u9FFF\uF900-\uFFFD]/.test(ch) ? 1 : 0.5), 0);

const chipCls = (active: boolean): string =>
  `filter-bar__chip${active ? ' filter-bar__chip--active' : ''}`;

/** --chip-label-w：无单位字宽数字；CSS 侧 calc 消费，缺省兜底 2（不补偿）。 */
const chipLabelStyle = (label: string): CSSProperties =>
  ({ '--chip-label-w': labelWidth(label) }) as CSSProperties;

// ── FilterBar Props ───────────────────────────────────

export interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
  /** 当前分类下可选的类型列表（来自 store） */
  genres?: TMDBGenre[];
  /** 是否隐藏地区行（预留） */
  hideRegion?: boolean;
  /** 需要从显示中排除的 genreIds（这些 id 仍参与 filterValue.genreIds / API 调用） */
  excludedGenreIds?: number[];
  /** 地区选项（由调用方用 buildRegionOptions(store.countries) 生成；缺省回退内置常量） */
  regionOptions?: RegionOption[];
  /**
 * 组内折叠（仅 Browse ≥2560 单列启用）。
 * 单列时三组共 59 项 → 左栏需 1590px、1440 高视口仅 1274px 可用，必然滚动。
 * 开启后每组默认只露前 N 项（分类 16 / 地区 6 / 年份 6）+「展开」按钮，
 * 默认总高 ≈980px，一屏放下、不产生滚动条。
 */
  collapsible?: boolean;
  /** 结果总数 */
  totalResults?: number;
  /** 当前分类显示名称（替换默认的"分类"label） */
  categoryLabel?: string;
  /** 隐藏排序+结果数 footer（用于将 footer 移到父组件其他位置） */
  hideFooter?: boolean;
  /** 分类级类型选项（全部/电影/剧集/综艺/动漫/纪录片/排行榜）。
 传入后类型行恒显示并驱动 category；不传回落旧 3 档 mediaType 行。 */
  categoryOptions?: FilterBarCategoryOption[];
  /** 隐藏类型行（桌面侧栏面板不放类型，
 类型移至结果区头部 browse-sort-bar；默认 false 零回归） */
  hideType?: boolean;
  /** genres 尚未拉取时仍渲染「分类」行壳（仅 label + 全部），
 避免首次进入 Browse 左栏整行后到。
 chips 仍等 visibleGenres 落地后逐个出现。 */
  showGenreRowShell?: boolean;
}

// ── 组件 ────────────────────────────────────────────

export default function FilterBar({
  value,
  onChange,
  genres = [],
  hideRegion = false,
  excludedGenreIds = [],
  regionOptions = [],
  collapsible = false,
  totalResults = 0,
  categoryLabel,
  hideFooter = false,
  categoryOptions,
  hideType = false,
  showGenreRowShell = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();

  // ── 组内折叠（collapsible）──────────────────────────────────────────
  // 每组的默认展示上限。按 1440 高视口预算：16+6+6 = 28 项 ≈ 711px + 3 组标题 ≈ 72px
  // → 默认总高 ≈ 980px（含展开按钮），低于可用 1274px，不产生滚动条。
  // 分类是最主要的筛选维度，给最多；地区/年份只需常见几项。
  const COLLAPSE_LIMIT = FILTER_COLLAPSE_LIMIT;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  /** 折叠时只取前 limit 项；展开或未启用折叠时全量 */
  const sliceGroup = <T,>(list: T[], key: keyof typeof COLLAPSE_LIMIT): T[] =>
    collapsible && !openGroups[key] ? list.slice(0, COLLAPSE_LIMIT[key]) : list;
  const toggleGroup = (key: string) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
  /**
 * 折叠态的「展开 N 项 / 收起」按钮。
 * ⚠️ **不能复用 `filter-bar__chip` 类**：
 * 它和数据项长得一模一样、又排在组末尾 → 看起来像「最后一条数据被选中」。
 * 故用独立类 `filter-bar__more`：主色纯文字（无边框/无背景/无箭头，与布局设计稿 一致），
 * 明确是「操作」而非「选项」。
 */
  const MoreButton = ({ total, shown, groupKey }: { total: number; shown: number; groupKey: string }) => {
    if (!collapsible || total <= shown) return null;
    const opened = !!openGroups[groupKey];
    return (
      <button
        type="button"
        className="filter-bar__more"
        onClick={() => toggleGroup(groupKey)}
        aria-expanded={opened}
      >
        {opened ? '收起' : `+${total - shown} 展开`}
      </button>
    );
  };

  // 过滤掉分类自身默认的 genre（仍在 value.genreIds 中参与 API）
  const visibleGenres = useMemo(
    () => genres.filter((g) => !excludedGenreIds.includes(g.id)),
    [genres, excludedGenreIds],
  );

  const update = useCallback(
    (patch: Partial<FilterBarValue>) => {
      onChange({ ...value, ...patch });
    },
    [value, onChange],
  );

  // 单选 genre：点击其他自动替换；点击同一项 no-op（必须经 label 清空）
  const selectGenre = useCallback(
    (genreId: number) => {
      if (value.genreIds.includes(genreId)) return;
      // 保留 excludedGenreIds 中被隐藏的分类基线（如纪录片 99），与用户选择的二级 genre 做 AND
      onChange({ ...value, genreIds: [...excludedGenreIds, genreId] });
    },
    [value, onChange, excludedGenreIds],
  );

  // 类型切换：清空可见分类的选择（不同类型的 genre id 不通用）
  const selectMediaType = useCallback(
    (v: 'all' | 'movie' | 'tv') => {
      onChange({ ...value, mediaType: v, genreIds: [...excludedGenreIds] });
    },
    [value, onChange, excludedGenreIds],
  );

  // ── 「全部」状态计算 ────────────────────────────────────
  // 分类：可见 genre 中无任何被勾选
  const isAllGenres = !value.genreIds.some((id) => !excludedGenreIds.includes(id));
  // 地区：null
  const isAllRegion = value.region === null;
  // 年份：null
  const isAllYear = value.year === null;

  // ── label 点击 = 回到「全部」───────────────────────────
  const selectAllGenres = useCallback(
    () => onChange({ ...value, genreIds: [...excludedGenreIds] }),
    [value, onChange, excludedGenreIds],
  );
  const selectAllRegion = useCallback(
    () => onChange({ ...value, region: null }),
    [value, onChange],
  );
  const selectAllYear = useCallback(
    () => onChange({ ...value, year: null, olderThan2015: false }),
    [value, onChange],
  );

  return (
    <div className={`filter-bar${isMobile ? ' filter-bar--mobile' : ''}`}>
      {/* 类型 — hideType 时整行不渲染（类型已移至结果区头部）；
 传入 categoryOptions 时按调用方给的分类数渲染（Browse 现为 4 档，驱动 category，
 切换即注入该分类的 mediaType + 默认 genreIds）；
 都不传回落旧 3 档 mediaType 行（仅「全部」category 显示） */}
      {!hideType && (categoryOptions ? (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">类型</span>
          <div className="filter-bar__chips-scroll">
            {categoryOptions.map((o) => (
              <button
                key={o.key}
                className={chipCls(value.category === o.key)}
                style={chipLabelStyle(o.label)}
                onClick={() => onChange({ ...value, category: o.key, mediaType: o.mediaType, genreIds: o.genreIds })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : value.category === 'all' && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">类型</span>
          <div className="filter-bar__chips-scroll">
            {MEDIA_OPTIONS.map((m) => (
              <button
                key={m.value}
                className={chipCls(value.mediaType === m.value)}
                style={chipLabelStyle(m.label)}
                onClick={() => selectMediaType(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 分类（细分类型）— 多行 wrap 全展开；
 showGenreRowShell：genres 未返回时先渲染行壳（label+全部），消除首进左栏“过一会才出现”的空洞 */}
      {(visibleGenres.length > 0 || showGenreRowShell) && (
        <div className="filter-bar__row filter-bar__row--wrap">
          <span className="filter-bar__label filter-bar__chip filter-bar__label--as-chip">
            {categoryLabel || '分类'}
          </span>
          <div className="filter-bar__chips-wrap">
            <button
              type="button"
              className={`filter-bar__chip${isAllGenres ? ' filter-bar__chip--active' : ''}`}
              onClick={selectAllGenres}
            >
              全部
            </button>
            {/* 分类不折叠（用户：主筛选维度，默认全部展示） */}
            {visibleGenres.map((g) => (
              <button
                key={g.id}
                className={chipCls(value.genreIds.includes(g.id))}
                style={chipLabelStyle(g.name)}
                onClick={() => selectGenre(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 地区 */}
      {!hideRegion && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">
            地区
          </span>
          <div className="filter-bar__chips-scroll">
            <button
              type="button"
              className={`filter-bar__chip${isAllRegion ? ' filter-bar__chip--active' : ''}`}
              onClick={selectAllRegion}
            >
              全部
            </button>
            {sliceGroup(regionOptions, 'region').map((r) => (
              <button
                key={r.code ?? 'all'}
                className={chipCls(value.region === r.code)}
                style={chipLabelStyle(r.label)}
                onClick={() => update({ region: r.code })}
              >
                {r.label}
              </button>
            ))}
            <MoreButton
              total={regionOptions.length}
              shown={sliceGroup(regionOptions, 'region').length}
              groupKey="region"
            />
          </div>
        </div>
      )}

      {/* 年份 — 全展开（无折叠） */}
      <div className="filter-bar__row filter-bar__row--scroll">
        <span className="filter-bar__label">
          年份
        </span>
        <div className="filter-bar__chips-scroll">
          <button
            type="button"
            className={`filter-bar__chip${isAllYear ? ' filter-bar__chip--active' : ''}`}
            onClick={selectAllYear}
          >
            全部
          </button>
          {sliceGroup(YEAR_OPTIONS, 'year').map((y) => (
            <button
              key={y.value}
              className={chipCls(value.year === y.value && !value.olderThan2015)}
                style={chipLabelStyle(y.label)}
              onClick={() => update({ year: y.value, olderThan2015: false })}
            >
              {y.label}
            </button>
          ))}
          {/* 「其他」（2015 前）语义独立，折叠时也始终可见 */}
          <button
            type="button"
            className={chipCls(value.olderThan2015)}
              style={chipLabelStyle(YEAR_OLDER_LABEL)}
            onClick={() => update({ year: null, olderThan2015: true })}
          >
            {YEAR_OLDER_LABEL}
          </button>
          <MoreButton
            total={YEAR_OPTIONS.length}
            shown={sliceGroup(YEAR_OPTIONS, 'year').length}
            groupKey="year"
          />
        </div>
      </div>

      {/* 排序 + 结果数 */}
      {!hideFooter && (
        <div className="filter-bar__footer">
          <div className="filter-bar__sort">
            {SORT_OPTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`filter-bar__sort-btn${value.sortIdx === i ? ' filter-bar__sort-btn--active' : ''}`}
                onClick={() => update({ sortIdx: i })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="filter-bar__count" aria-live="polite">
            共 {totalResults.toLocaleString('zh-CN')} 条
          </span>
        </div>
      )}
    </div>
  );
}

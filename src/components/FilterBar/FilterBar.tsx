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
import { useCallback, useMemo } from 'react';
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery';
import type { TMDBGenre } from '@/types/tmdb';
import { MEDIA_OPTIONS, REGION_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL, type FilterBarValue, type FilterBarCategoryOption } from './constants';
import './FilterBar.css';

export type { FilterBarValue } from './constants';

// ── 长文本 chip 分类（2026-11-07 用户定稿）─────────────────────────────
//    CJK 记 1 字宽、ASCII 记 0.5。两个字宽维度独立：
//      · --wide：字宽 >= 4 一律「单独处理」→ 文字左缘与「居中两字 chip」对齐
//                （CSS 用 margin-left 补回两字 chip 的居中缩进 X，见 Browse.css）
//      · --full：独占整行（grid-column:1/-1）。触发 = 字宽 > 4（所有视口）
//                或 字宽 == 4 且视口 < 1980（列宽不足才需独占）；
//                字宽 == 4 且视口 >= 1980 仅带 --wide、回归两列（1980 列宽≈82px > 四字色块 66px）。
//      · 字宽 < 4：普通两列 chip，居中显示。
//    ⚠️ --wide / --full 的 CSS 只在 ≥1024 桌面侧栏档生效；本判定对所有档都跑，
//       但移动/弹窗档不渲染两列 grid，多打类无视觉副作用。
const labelWidth = (s: string): number =>
  [...s].reduce((w, ch) => w + (/[\u2E80-\u9FFF\uF900-\uFFFD]/.test(ch) ? 1 : 0.5), 0);

/** @param wideViewport 视口 >= 1980（四字列宽足够，不独占整行） */
const chipCls = (label: string, active: boolean, wideViewport: boolean): string => {
  const w = labelWidth(label);
  const wide = w >= 4;
  const full = w > 4 || (wide && !wideViewport);
  return `filter-bar__chip${active ? ' filter-bar__chip--active' : ''}${wide ? ' filter-bar__chip--wide' : ''}${full ? ' filter-bar__chip--full' : ''}`;
};

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
  /** 分类基线是 OR 组（如综艺 10764|10767）时，用户选二级 genre 应替换基线而非叠加。
      true：selectGenre 用 [genreId]；false（默认）：沿用 [...excludedGenreIds, genreId] 做 AND。 */
  replaceBaselineOnSelect?: boolean;
  /** 结果总数 */
  totalResults?: number;
  /** 当前分类显示名称（替换默认的"分类"label） */
  categoryLabel?: string;
  /** 隐藏排序+结果数 footer（用于将 footer 移到父组件其他位置） */
  hideFooter?: boolean;
  /** 分类级类型选项（全部/电影/剧集/综艺/动漫/纪录片/排行榜）。
      传入后类型行恒显示并驱动 category；不传回落旧 3 档 mediaType 行。 */
  categoryOptions?: FilterBarCategoryOption[];
  /** 隐藏类型行（2026-09-07 用户拍板：桌面侧栏面板不放类型，
      类型移至结果区头部 browse-sort-bar；默认 false 零回归） */
  hideType?: boolean;
  /** genres 尚未拉取时仍渲染「分类」行壳（仅 label + 全部），
      避免首次进入 Browse 左栏整行后到（2026-09-23 用户反馈）。
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
  replaceBaselineOnSelect = false,
  totalResults = 0,
  categoryLabel,
  hideFooter = false,
  categoryOptions,
  hideType = false,
  showGenreRowShell = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  // ≥1980 视口：4 字标签列宽足够，不独占整行（仍带 --wide 做文字左缘对齐）
  const wideViewport = useMediaQuery('(min-width: 1980px)');

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
      // OR 基线分类（综艺）：用户选具体类型 = 收窄，替换基线，不能把 10764|10767 与 X 再 OR；
      // AND 基线分类（纪录片 99）：保留基线做 99 AND X，语义正确。
      onChange({ ...value, genreIds: replaceBaselineOnSelect ? [genreId] : [...excludedGenreIds, genreId] });
    },
    [value, onChange, excludedGenreIds, replaceBaselineOnSelect],
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
          否则传入 categoryOptions 时为分类级 7 档（驱动 category，
          切换即注入该分类的 mediaType + 默认 genreIds）；
          都不传回落旧 3 档 mediaType 行（仅「全部」category 显示） */}
      {!hideType && (categoryOptions ? (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">类型</span>
          <div className="filter-bar__chips-scroll">
            {categoryOptions.map((o) => (
              <button
                key={o.key}
                className={chipCls(o.label, value.category === o.key, wideViewport)}
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
                className={chipCls(m.label, value.mediaType === m.value, wideViewport)}
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
            {visibleGenres.map((g) => (
              <button
                key={g.id}
                className={chipCls(g.name, value.genreIds.includes(g.id), wideViewport)}
                onClick={() => selectGenre(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 地区 — 全展开（桌面/移动均 wrap 多行，无折叠） */}
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
            {REGION_OPTIONS.map((r) => (
              <button
                key={r.code ?? 'all'}
                className={chipCls(r.label, value.region === r.code, wideViewport)}
                onClick={() => update({ region: r.code })}
              >
                {r.label}
              </button>
            ))}
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
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y.value}
              className={chipCls(y.label, value.year === y.value && !value.olderThan2015, wideViewport)}
              onClick={() => update({ year: y.value, olderThan2015: false })}
            >
              {y.label}
            </button>
          ))}
          <button
            type="button"
            className={chipCls(YEAR_OLDER_LABEL, value.olderThan2015, wideViewport)}
            onClick={() => update({ year: null, olderThan2015: true })}
          >
            {YEAR_OLDER_LABEL}
          </button>
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

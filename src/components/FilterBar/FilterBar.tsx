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
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { TMDBGenre } from '@/types/tmdb';
import { MEDIA_OPTIONS, REGION_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL, type FilterBarValue } from './constants';
import './FilterBar.css';

export type { FilterBarValue } from './constants';

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
  /** 结果总数 */
  totalResults?: number;
  /** 当前分类显示名称（替换默认的"分类"label） */
  categoryLabel?: string;
  /** 隐藏排序+结果数 footer（用于将 footer 移到父组件其他位置） */
  hideFooter?: boolean;
}

// ── 组件 ────────────────────────────────────────────

export default function FilterBar({
  value,
  onChange,
  genres = [],
  hideRegion = false,
  excludedGenreIds = [],
  totalResults = 0,
  categoryLabel,
  hideFooter = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();

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
      // 保留 excludedGenreIds 中被隐藏的默认项（API 仍需要）
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
      {/* 类型 — 仅「全部」category 显示（全部/电影/剧集），只有 3 个选项，全展开 */}
      {value.category === 'all' && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">类型</span>
          <div className="filter-bar__chips-scroll">
            {MEDIA_OPTIONS.map((m) => (
              <button
                key={m.value}
                className={`filter-bar__chip${value.mediaType === m.value ? ' filter-bar__chip--active' : ''}`}
                onClick={() => selectMediaType(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 分类（细分类型）— 多行 wrap 全展开 */}
      {visibleGenres.length > 0 && (
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
                className={`filter-bar__chip${value.genreIds.includes(g.id) ? ' filter-bar__chip--active' : ''}`}
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
                className={`filter-bar__chip${value.region === r.code ? ' filter-bar__chip--active' : ''}`}
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
              className={`filter-bar__chip${value.year === y.value && !value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
              onClick={() => update({ year: y.value, olderThan2015: false })}
            >
              {y.label}
            </button>
          ))}
          <button
            type="button"
            className={`filter-bar__chip${value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
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

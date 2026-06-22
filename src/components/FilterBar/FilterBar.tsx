/**
 * FilterBar — 公共筛选组件
 * 分类 · 类型 · 地区 · 评分 · 排序 — 横向 chip 筛选，支持 TMDB discover 参数
 * 主题感知：Light/Dark 自动适配
 * 点击任意 chip 即触发搜索（无「应用筛选」按钮）
 * 分类行：多行 wrap 展示；单选（点击其他自动替换，不可经 chip 取消）
 * 类型行：仅在 category=all 时显示（全部/电影/剧集）
 * 地区/评分/分类 label 可点击：点击 = 回到该行「全部」状态，默认即高亮
 * 排序 label 不可选（纯文本）
 *
 * 折叠：默认仅展示分类 + 类型 + 折叠按钮；地区/评分/排序 默认折叠，
 *      点击「更多筛选 ▾」展开 300ms 过渡。
 *      折叠状态可由 useNavStore('filterBarCollapsed') 跨会话恢复。
 */
import { useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { TMDBGenre } from '@/types/tmdb';
import { MEDIA_OPTIONS, REGION_OPTIONS, SORT_OPTIONS, type FilterBarValue } from './constants';
import './FilterBar.css';

interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
  /** 当前分类下可选的类型列表（来自 store） */
  genres?: TMDBGenre[];
  /** 是否隐藏地区行（预留） */
  hideRegion?: boolean;
  /** 需要从显示中排除的 genreIds（这些 id 仍参与 filterValue.genreIds / API 调用） */
  excludedGenreIds?: number[];
  /** 父组件在 debounce / fetch 期间置 true：右上角显示 "更新中…" spinner */
  isUpdating?: boolean;
  /** 外部控制折叠状态 */
  collapsed?: boolean;
  /** 外部控制折叠切换 */
  onToggleCollapse?: () => void;
  /** 结果总数 */
  totalResults?: number;
  /** 当前分类显示名称（替换默认的"分类"label） */
  categoryLabel?: string;
}

// ── 组件 ────────────────────────────────────────────

export default function FilterBar({
  value,
  onChange,
  genres = [],
  hideRegion = false,
  excludedGenreIds = [],
  isUpdating = false,
  collapsed = true,
  onToggleCollapse,
  totalResults = 0,
  categoryLabel,
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
  // 类型：all
  const isAllMediaType = value.mediaType === 'all';
  // 地区：null
  const isAllRegion = value.region === null;
  // 评分：0
  const isAllRating = value.minRating === 0;

  // ── label 点击 = 回到「全部」───────────────────────────
  const selectAllGenres = useCallback(
    () => onChange({ ...value, genreIds: [...excludedGenreIds] }),
    [value, onChange, excludedGenreIds],
  );
  const selectAllMediaType = useCallback(
    () => selectMediaType('all'),
    [selectMediaType],
  );
  const selectAllRegion = useCallback(
    () => onChange({ ...value, region: null }),
    [value, onChange],
  );
  const selectAllRating = useCallback(
    () => onChange({ ...value, minRating: 0 }),
    [value, onChange],
  );

  return (
    <div className={`filter-bar${isMobile ? ' filter-bar--mobile' : ''}`}>
      {/* 父组件控制的全局更新指示器（debounce / fetch 期间） */}
      {isUpdating && (
        <div className="filter-bar__updating" role="status" aria-live="polite">
          <span className="filter-bar__spinner" aria-hidden="true" />
          <span className="filter-bar__updating-text">更新中…</span>
        </div>
      )}

      {/* 分类（细分类型）— 首行，多行 wrap，单选 */}
      {visibleGenres.length > 0 && (
        <div className="filter-bar__row filter-bar__row--wrap">
          <button
            type="button"
            className={`filter-bar__label filter-bar__label--clickable${isAllGenres ? ' filter-bar__label--active' : ''}`}
            onClick={selectAllGenres}
            aria-pressed={isAllGenres}
          >
            {categoryLabel || '分类'}
          </button>
          <div className="filter-bar__chips-wrap">
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

      {/* 类型 — 仅「全部」category 显示（全部/电影/剧集） */}
      {value.category === 'all' && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <button
            type="button"
            className={`filter-bar__label filter-bar__label--clickable${isAllMediaType ? ' filter-bar__label--active' : ''}`}
            onClick={selectAllMediaType}
            aria-pressed={isAllMediaType}
          >
            类型
          </button>
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

      {/* 折叠区域：地区 / 评分 / 排序 */}
      <div
        id="filter-bar-collapse-body"
        className={`filter-bar__collapse-body${!collapsed ? ' filter-bar__collapse-body--expanded' : ''}`}
        aria-hidden={collapsed}
      >

      {/* 地区 — 水平滚动（无「全部」chip，由 label 表达），默认折叠 */}
      {!hideRegion && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <button
            type="button"
            className={`filter-bar__label filter-bar__label--clickable${isAllRegion ? ' filter-bar__label--active' : ''}`}
            onClick={selectAllRegion}
            aria-pressed={isAllRegion}
          >
            地区
          </button>
          <div className="filter-bar__chips-scroll">
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

      {/* 评分 — 删除了「不限」chip，label 可点击 = 不限，默认折叠 */}
      <div className="filter-bar__row">
        <button
          type="button"
          className={`filter-bar__label filter-bar__label--clickable${isAllRating ? ' filter-bar__label--active' : ''}`}
          onClick={selectAllRating}
          aria-pressed={isAllRating}
        >
          评分
        </button>
        {[6, 7, 8].map((r) => (
          <button
            key={r}
            className={`filter-bar__chip${value.minRating === r ? ' filter-bar__chip--active' : ''}`}
            onClick={() => update({ minRating: r })}
          >
            ≥ {r}.0
          </button>
        ))}
      </div>

      {/* 排序 — label 不可选（纯文本），默认折叠 */}
      <div className="filter-bar__row">
        <span className="filter-bar__label">排序</span>
        {SORT_OPTIONS.map((s, i) => (
          <button
            key={i}
            className={`filter-bar__chip${value.sortIdx === i ? ' filter-bar__chip--active' : ''}`}
            onClick={() => update({ sortIdx: i })}
          >
            {s.label}
          </button>
        ))}
      </div>
      </div>

      {/* 折叠按钮 + 结果数：居中显示按钮，结果数在最右 */}
      <div className="filter-bar__footer">
        <span aria-hidden="true" />
        <button
          type="button"
          className={`filter-bar__toggle${!collapsed ? ' filter-bar__toggle--expanded' : ''}`}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-controls="filter-bar-collapse-body"
        >
          <span>{collapsed ? '更多筛选' : '收起筛选'}</span>
          <span className="filter-bar__toggle-icon" aria-hidden="true">
            <ChevronDown size={14} />
          </span>
        </button>
        <span className="filter-bar__count" aria-live="polite">
          共 {totalResults.toLocaleString('zh-CN')} 条
        </span>
      </div>
    </div>
  );
}

/**
 * AdvancedFilterPanel — 高级筛选面板
 * 多端形态：Mobile 底部抽屉 / Desktop 右侧抽屉
 * 焦点陷阱 + ARIA dialog + 筛选状态机
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { CustomScrollbar } from '@/components/common';
import './AdvancedFilterPanel.css';

// ── Types ────────────────────────────────────────────

export type MediaType = 'all' | 'movie' | 'tv';

export interface FilterState {
  mediaType: MediaType;
  genreIds: number[];
  minRating: number;
  sortIdx: number;
  country: string | null;
}

interface GenreItem {
  id: number;
  name: string;
}

interface CountryItem {
  iso_3166_1: string;
  native_name?: string;
  english_name: string;
}

interface AdvancedFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  genres: GenreItem[];
  countries: CountryItem[];
}

// ── Constants ────────────────────────────────────────

const RATING_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '≥ 6.0', value: 6 },
  { label: '≥ 7.0', value: 7 },
  { label: '≥ 8.0', value: 8 },
];

const SORT_OPTIONS = [
  { label: '最热', sortBy: 'popularity', order: 'desc' as const },
  { label: '最新', sortBy: 'release_date', order: 'desc' as const },
  { label: '最高分', sortBy: 'vote_average', order: 'desc' as const },
];

const MEDIA_OPTIONS: { label: string; value: MediaType }[] = [
  { label: '全部', value: 'all' },
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
];

// ── Component ────────────────────────────────────────

export default function AdvancedFilterPanel({
  open,
  onClose,
  filters,
  onChange,
  onApply,
  onReset,
  genres,
  countries,
}: AdvancedFilterPanelProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const theme = useThemeMode();
  const panelRef = useRef<HTMLDivElement>(null);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [closing, setClosing] = useState(false);

  // Sync external filters
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, input, select, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    first?.focus();

    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock scroll container when open
  const scrollContainerRef = useScrollContainer();
  useEffect(() => {
    if (!open) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const prev = container.style.overflow;
    container.style.overflow = 'hidden';
    return () => { container.style.overflow = prev; };
  }, [open, scrollContainerRef]);

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...localFilters, ...patch };
      setLocalFilters(next);
      onChange(next);
    },
    [localFilters, onChange],
  );

  const toggleGenre = useCallback(
    (gid: number) => {
      const next = localFilters.genreIds.includes(gid)
        ? localFilters.genreIds.filter((g) => g !== gid)
        : [...localFilters.genreIds, gid];
      update({ genreIds: next });
    },
    [localFilters.genreIds, update],
  );

  const handleApply = useCallback(() => {
    onApply();
  }, [onApply]);

  const handleReset = useCallback(() => {
    onReset();
  }, [onReset]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  if (!open && !closing) return null;

  const isSidePanel = !isMobile || isTV;
  const sideClass = isSidePanel ? 'filter-panel--side' : 'filter-panel--bottom';

  return (
    <div className={`filter-panel-overlay${closing ? ' filter-panel-overlay--closing' : ''}`} onClick={handleClose} data-theme={theme}>
      <div
        ref={panelRef}
        className={`filter-panel ${sideClass}${isTV ? ' filter-panel--tv' : ''}${closing ? ' filter-panel--closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        data-theme={theme}
      >
        {/* Header */}
        <div className="filter-panel__header">
          <h2 id="filter-title" className="filter-panel__title">高级筛选</h2>
          <button className="filter-panel__close" onClick={handleClose} aria-label="关闭筛选面板">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <CustomScrollbar className="filter-panel__body" direction="vertical" autoHideDelay={600}>
          {/* Media Type */}
          <div className="filter-panel__section">
            <span className="filter-panel__label">类型</span>
            <div className="filter-panel__chips">
              {MEDIA_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`filter-panel__chip${localFilters.mediaType === opt.value ? ' filter-panel__chip--active' : ''}`}
                  onClick={() => update({ mediaType: opt.value, genreIds: [] })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="filter-panel__section">
            <span className="filter-panel__label">评分</span>
            <div className="filter-panel__chips">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`filter-panel__chip${localFilters.minRating === opt.value ? ' filter-panel__chip--active' : ''}`}
                  onClick={() => update({ minRating: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="filter-panel__section">
            <span className="filter-panel__label">排序</span>
            <div className="filter-panel__chips">
              {SORT_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  className={`filter-panel__chip${localFilters.sortIdx === i ? ' filter-panel__chip--active' : ''}`}
                  onClick={() => update({ sortIdx: i })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div className="filter-panel__section">
              <span className="filter-panel__label">分类</span>
              <div className="filter-panel__chips filter-panel__chips--wrap">
                {genres.slice(0, 20).map((g) => (
                  <button
                    key={g.id}
                    className={`filter-panel__chip${localFilters.genreIds.includes(g.id) ? ' filter-panel__chip--active' : ''}`}
                    onClick={() => toggleGenre(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Countries */}
          {countries.length > 0 && (
            <div className="filter-panel__section">
              <span className="filter-panel__label">地区</span>
              <div className="filter-panel__chips filter-panel__chips--wrap">
                <button
                  className={`filter-panel__chip${!localFilters.country ? ' filter-panel__chip--active' : ''}`}
                  onClick={() => update({ country: null })}
                >
                  全部
                </button>
                {countries.slice(0, 15).map((c) => (
                  <button
                    key={c.iso_3166_1}
                    className={`filter-panel__chip${localFilters.country === c.iso_3166_1 ? ' filter-panel__chip--active' : ''}`}
                    onClick={() =>
                      update({
                        country: localFilters.country === c.iso_3166_1 ? null : c.iso_3166_1,
                      })
                    }
                  >
                    {c.native_name || c.english_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CustomScrollbar>

        {/* Footer */}
        <div className="filter-panel__footer">
          <button className="filter-panel__btn filter-panel__btn--reset" onClick={handleReset}>
            <RotateCcw size={16} />
            重置
          </button>
          <button className="filter-panel__btn filter-panel__btn--apply" onClick={handleApply}>
            应用筛选
          </button>
        </div>
      </div>
    </div>
  );
}

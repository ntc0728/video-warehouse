/**
 * RecordFilterPanel — 「更多筛选」折叠面板（收藏页 / 历史页共用）
 *
 * 与历史页原「更多筛选」面板一致：观看状态 chips（仅影视项）+ 排序 chips。
 * 排序恒显示 chips，不再提供下拉框；空间不足时排序行（标签 + chips）随
 * 面板 flex-wrap 另起一行，chips 自身亦可换行。
 * 状态圆点颜色由 statusOptions 的 color 传入（inline --chip-dot-color），
 * 不传默认 var(--color-text)（黑），is-active 时反色。
 */
import type { CSSProperties } from 'react';
import './RecordFilterPanel.css';

export interface RecordFilterStatusOption {
  key: string;
  label: string;
  /** 圆点颜色（CSS 色值）；不传默认 var(--color-text) */
  color?: string;
}

export interface RecordFilterSortOption {
  value: string;
  label: string;
}

interface RecordFilterPanelProps {
  /** 状态行标签，默认「观看状态」 */
  statusLabel?: string;
  statusOptions: RecordFilterStatusOption[];
  statusFilter: string;
  onStatusChange: (key: string) => void;
  /** 排序行标签，默认「排序」 */
  sortLabel?: string;
  sortOptions: RecordFilterSortOption[];
  sortBy: string;
  onSortChange: (value: string) => void;
  className?: string;
}

export default function RecordFilterPanel({
  statusLabel = '观看状态',
  statusOptions,
  statusFilter,
  onStatusChange,
  sortLabel = '排序',
  sortOptions,
  sortBy,
  onSortChange,
  className,
}: RecordFilterPanelProps) {
  return (
    <div className={`record-filter-panel animate-fade-in${className ? ` ${className}` : ''}`}>
      <div className="record-filter-row">
        <span className="record-filter-label">{statusLabel}</span>
        <div className="record-filter-chips">
          {statusOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              data-status={opt.key}
              className={`record-filter-chip record-filter-chip--status${statusFilter === opt.key ? ' is-active' : ''}`}
              style={opt.color ? ({ '--chip-dot-color': opt.color } as CSSProperties) : undefined}
              onClick={() => onStatusChange(opt.key)}
            >
              <span className="record-filter-chip__dot" aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="record-filter-row record-filter-row--sort">
        <span className="record-filter-label">{sortLabel}</span>
        <div className="record-filter-chips record-filter-chips--sort">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`record-filter-chip${sortBy === opt.value ? ' is-active' : ''}`}
              onClick={() => onSortChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

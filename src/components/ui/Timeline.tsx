/**
 * 通用时间轴组件
 * 支持竖向（默认）/ 横向两种布局，每个节点可点击并显示计数徽标
 *
 * 节点布局：[label]  ●  [count]
 *   - 圆点（dot）居中
 *   - 左侧：分组标题
 *   - 右侧：card 数量
 *   - 圆点同时承载"已激活"视觉（填充 + 光晕）
 */
import { memo, useCallback } from 'react';
import './Timeline.css';

export type TimelineVariant = 'vertical' | 'horizontal';

export interface TimelineItem {
  /** 唯一 key，用于回调 */
  key: string;
  /** 节点标签文字（显示在圆点左侧） */
  label: string;
  /** 节点右侧计数；0 或 undefined 不显示 */
  count?: number;
  /** 是否处于激活态 */
  active?: boolean;
  /** 可选：节点图标（ReactNode），紧跟 label 右侧、dot 左侧 */
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  /** 点击节点回调 */
  onItemClick?: (key: string) => void;
  /** 布局方向，默认 vertical */
  variant?: TimelineVariant;
  /** 容器额外 className */
  className?: string;
  /** a11y：整体 aria-label */
  ariaLabel?: string;
}

const Timeline = memo(function Timeline({
  items,
  onItemClick,
  variant = 'vertical',
  className = '',
  ariaLabel,
}: TimelineProps) {
  const handleClick = useCallback(
    (key: string) => () => onItemClick?.(key),
    [onItemClick],
  );

  const handleKeyDown = useCallback(
    (key: string) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onItemClick?.(key);
      }
    },
    [onItemClick],
  );

  if (!items || items.length === 0) return null;

  return (
    <div
      className={`timeline timeline--${variant} ${className}`.trim()}
      role="list"
      aria-label={ariaLabel || '时间轴导航'}
    >
      {/* 贯穿线：竖向垂直、横向水平 */}
      <span className="timeline-rail" aria-hidden="true" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div
            key={item.key}
            className={`timeline-node ${item.active ? 'timeline-node--active' : ''} ${isLast ? 'timeline-node--last' : ''}`.trim()}
            role="listitem"
          >
            {/* 圆点：绝对定位,与轴线对齐 */}
            <span className="timeline-node-dot" aria-hidden="true" />
            <button
              type="button"
              className="timeline-node-btn"
              onClick={handleClick(item.key)}
              onKeyDown={handleKeyDown(item.key)}
              aria-current={item.active ? 'true' : undefined}
              aria-label={`${item.label}${item.count !== undefined ? `, ${item.count} 项` : ''}`}
            >
              {/* 左侧：分组标题 */}
              <span className="timeline-node-label">{item.label}</span>
              {item.icon && <span className="timeline-node-icon">{item.icon}</span>}
              {/* 右侧：card 数量 */}
              {item.count !== undefined && item.count > 0 && (
                <span className="timeline-node-count">{item.count}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default Timeline;

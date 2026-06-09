/**
 * 视频卡片骨架屏组件
 * 在视频数据加载期间展示占位骨架，提升用户感知加载速度
 *
 * v4 改造:
 *  - 新增 `variant: 'default' | 'iptv'` prop,适配不同场景的视觉需求:
 *    - default (VideoCard 风格): 16:10 封面 + 标题 + 年份骨架
 *    - iptv (IPTVChannelCard 风格): 4:3 封面,无标题/年份
 *  - 不再有"懒加载骨架容器"概念,本组件直接作为 Grid 兄弟节点使用
 */
import './SkeletonCard.css';

interface SkeletonCardProps {
  /** 变体:default = 视频卡片(16:10 + 标题/年份), iptv = IPTV 频道(4:3,无标题) */
  variant?: 'default' | 'iptv';
}

export default function SkeletonCard({ variant = 'default' }: SkeletonCardProps) {
  const className = `skeleton-card${variant === 'iptv' ? ' skeleton-card--iptv' : ''}`;
  return (
    <div className={className}>
      <div className="skeleton-card-cover">
        <div className="skeleton-shimmer" />
      </div>
      {variant !== 'iptv' && (
        <div className="skeleton-card-info">
          <div className="skeleton-shimmer skeleton-title" />
          <div className="skeleton-shimmer skeleton-year" />
        </div>
      )}
    </div>
  );
}

/** 骨架屏网格，批量渲染指定数量的骨架卡片 */
export function SkeletonGrid({ count = 12, variant }: { count?: number; variant?: 'default' | 'iptv' }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}

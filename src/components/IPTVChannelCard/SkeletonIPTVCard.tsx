/**
 * IPTV 频道骨架屏组件
 * 在频道数据加载期间展示占位骨架，提升用户感知加载速度
 */
import './SkeletonIPTVCard.css';

export default function SkeletonIPTVCard() {
  return (
    <div className="skeleton-iptv-card">
      <div className="skeleton-logo">
        <div className="skeleton-shimmer" />
      </div>
      <div className="skeleton-info">
        <div className="skeleton-shimmer skeleton-name" />
        <div className="skeleton-shimmer skeleton-group" />
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-shimmer skeleton-btn" />
        <div className="skeleton-shimmer skeleton-btn" />
      </div>
    </div>
  );
}

/** 骨架屏网格，批量渲染指定数量的骨架卡片 */
export function SkeletonIPTVGrid({ count = 20 }: { count?: number }) {
  return (
    <div className="skeleton-iptv-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonIPTVCard key={i} />
      ))}
    </div>
  );
}

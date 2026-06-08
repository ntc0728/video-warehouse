/**
 * 视频卡片骨架屏组件
 * 在视频数据加载期间展示占位骨架，提升用户感知加载速度
 */
import './SkeletonCard.css';

export default function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-cover">
        <div className="skeleton-shimmer" />
      </div>
      <div className="skeleton-card-info">
        <div className="skeleton-shimmer skeleton-title" />
        <div className="skeleton-shimmer skeleton-year" />
      </div>
    </div>
  );
}

/** 骨架屏网格，批量渲染指定数量的骨架卡片 */
export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

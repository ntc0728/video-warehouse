/**
 * 详情页专属骨架 — 与真实页面逐层同构（.detail-top 两栏排列）：
 *  - ≥1024（非 App/TV）：左 hero banner（16:9，max-height 同 .detail-hero）
 *    + 右侧信息卡（类型 chips + 基础信息网格，对应 .detail-hero-side）；
 *  - <1024 / App / TV：hero 堆叠，信息卡隐藏（信息在真实页随 hero 下方渲染）；
 *  - 下方：简介段落行（对应 .detail-section-title / .detail-overview）。
 *
 * 视口差异化走 CSS 断点（width >= 1024px + html[data-device] 门控，
 * 与 Detail.css 同口径），不用 JS。
 */
import Skeleton from '@/components/common/Skeleton';
import './DetailSkeleton.css';

export default function DetailSkeleton() {
  return (
    <div className="detail-skeleton" role="status" aria-label="加载中">
      <div className="detail-skeleton__top">
        <div className="detail-skeleton__hero">
          <Skeleton className="detail-skeleton__hero-bg" />
          <div className="detail-skeleton__hero-content">
            <Skeleton className="detail-skeleton__title" />
            <Skeleton className="detail-skeleton__meta" />
            <Skeleton className="detail-skeleton__meta detail-skeleton__meta--short" />
          </div>
        </div>
        <aside className="detail-skeleton__side">
          <div className="detail-skeleton__chips">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="detail-skeleton__chip" />
            ))}
          </div>
          <div className="detail-skeleton__info-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="detail-skeleton__info-card" />
            ))}
          </div>
          <Skeleton className="detail-skeleton__side-line" />
          <Skeleton className="detail-skeleton__side-line detail-skeleton__side-line--short" />
        </aside>
      </div>
      <div className="detail-skeleton__body">
        <Skeleton className="detail-skeleton__section-title" />
        <Skeleton className="detail-skeleton__overview" />
        <Skeleton className="detail-skeleton__overview" />
        <Skeleton className="detail-skeleton__overview detail-skeleton__overview--short" />
      </div>
    </div>
  );
}

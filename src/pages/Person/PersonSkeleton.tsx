/**
 * 人物页专属骨架 — 与真实页面逐层同构：
 * hero（返回签 + 头像 + 姓名/履历行）+ 作品卡（tab 行 + 作品网格，
 * 对应 .person-hero / .person-grid-card / .person-work-grid）。
 *
 * 视口差异化（与 Person.css 同断点）：
 *  - 桌面：头像 2:3 绝对定位右上（clamp 144–176px），信息行右对齐；
 *  - ≤767 / App 端：头像 6rem 居中静态，信息行居中，作品网格恒 3 列。
 */
import Skeleton from '@/components/common/Skeleton';
import './PersonSkeleton.css';

const WORK_COUNT = 14;

export default function PersonSkeleton() {
  return (
    <div className="person-skeleton" role="status" aria-label="加载中">
      <section className="person-skeleton__hero">
        <Skeleton className="person-skeleton__back" />
        <div className="person-skeleton__hero-content">
          <Skeleton className="person-skeleton__avatar" />
          <div className="person-skeleton__info">
            <Skeleton className="person-skeleton__name" />
            <Skeleton className="person-skeleton__meta" />
            <Skeleton className="person-skeleton__meta person-skeleton__meta--short" />
            <Skeleton className="person-skeleton__bio" />
          </div>
        </div>
      </section>
      <div className="person-skeleton__card">
        <div className="person-skeleton__tabs">
          <Skeleton className="person-skeleton__tab" />
          <Skeleton className="person-skeleton__tab" />
        </div>
        <div className="person-skeleton__work-grid">
          {Array.from({ length: WORK_COUNT }, (_, i) => (
            <div key={i} className="person-skeleton__work">
              <Skeleton className="person-skeleton__work-cover" />
              <Skeleton className="person-skeleton__work-title" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

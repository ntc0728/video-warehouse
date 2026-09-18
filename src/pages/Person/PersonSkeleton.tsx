/**
 * 人物页专属骨架 — 与真实页面逐层同构：
 * hero（返回签 + 头像 + 姓名/履历行）+ 作品卡（tab 行 + 作品网格，
 * 对应 .person-hero / .person-grid-card / .person-work-grid）。
 *
 * 视口差异化（与 Person.css 同断点）：
 *  - 桌面：头像 2:3 绝对定位右上（clamp 144–176px），信息行右对齐；
 *  - ≤767 / App 端：头像 6rem 居中静态，信息行居中，作品网格恒 3 列。
 *
 * 作品网格张数 = 列数 × 行数；列数运行时读 --person-work-cols（useGridCols），
 * 行数由 useFillRows 按滚动容器可视高度实测推导（2026-09-18：不再固定 3 行 ——
 * 视口能放几行就渲染几行，末行完整，数据到达时页面高度不跳）。
 *
 * 列数真源（2026-09-18 修复 P0）：此前本骨架按 --card-cols 取列数，而 Person.css 在
 * 768–1023 把真实网格锁 5 列（跳过 --card-cols 的 4）→ 该档骨架 4 列 vs 真实 5 列，
 * 交接时整行错位。现改为双方同读 :root 的 --person-work-cols（index.css 的例外档在内），
 * 骨架与真实网格列数在**所有档位**都一致，页面无需改列数。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import './PersonSkeleton.css';

export default function PersonSkeleton() {
  const cols = useGridCols('--person-work-cols', 7);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 2, reserve: 48 });

  return (
    <div className="person-skeleton skeleton-scope" role="status" aria-label="加载中">
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
        <div ref={gridRef} className="person-skeleton__work-grid">
          {Array.from({ length: cols * rows }, (_, i) => (
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

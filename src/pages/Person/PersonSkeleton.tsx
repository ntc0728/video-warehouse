/**
 * 人物页专属骨架 — 与真实页面逐层同构：
 * hero（返回签 + 头像 + 姓名/履历行）+ 作品卡（tab 行 + 作品网格，
 * 对应 .person-hero / .person-grid-card / .person-work-grid）。
 *
 * 视口差异化（与 Person.css 同断点）：
 *  - 桌面：头像 2:3 绝对定位右上（clamp 144–176px），信息行右对齐；
 *  - ≤767 / App 端：头像 6rem 居中静态，信息行居中，作品网格恒 3 列。
 *
 * 作品网格张数 = 列数 × ROWS（列数运行时读 --card-cols，见 useGridCols），不写死。
 * 已知遗留：Person.css 在 768–1023 把真实网格锁 5 列（跳过 --card-cols 的 4），
 * 骨架无法在「不改真实页面列数」的前提下同源，故该档骨架仍按 --card-cols 取 4 列。
 */
import Skeleton from '@/components/common/Skeleton';
import { useGridCols } from '@/hooks/useGridCols';
import './PersonSkeleton.css';

/** 作品网格渲染几行占位（行数是策略，张数由列数 × 本值派生） */
const ROWS = 3;

export default function PersonSkeleton() {
  const cols = useGridCols('--card-cols', 7);

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
        <div className="person-skeleton__work-grid">
          {Array.from({ length: cols * ROWS }, (_, i) => (
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

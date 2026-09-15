/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构：
 * 首行「类型 tabs + 排序 tabs + 计数」+ 竖版卡片网格（对应
 * .browse-sort-bar + .video-card-grid browse-card-grid 的真实结构）。
 *
 * 视口差异化：列数直接消费与真实网格同源的 --card-cols 等分变量
 * （variables.css：3/4/5/6/7/8 列随视口分档），骨架与真实卡片
 * 同帧同宽，不引入第二套断点真源。
 * 张数 = 列数 × ROWS（列数运行时读 token，见 useGridCols），不写死。
 */
import Skeleton from '@/components/common/Skeleton';
import { useGridCols } from '@/hooks/useGridCols';
import './BrowseSkeleton.css';

/** 网格渲染几行占位（行数是策略，张数由列数 × 本值派生） */
const ROWS = 3;

export default function BrowseSkeleton() {
  const cols = useGridCols('--card-cols', 6);

  return (
    <div className="browse-skeleton skeleton-scope" role="status" aria-label="搜索中">
      <div className="browse-skeleton__bar">
        <div className="browse-skeleton__types">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="browse-skeleton__type" />
          ))}
        </div>
        <div className="browse-skeleton__sorts">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="browse-skeleton__sort" />
          ))}
          <Skeleton className="browse-skeleton__count" />
        </div>
      </div>
      <div className="browse-skeleton__grid">
        {Array.from({ length: cols * ROWS }, (_, i) => (
          <div key={i} className="browse-skeleton__card">
            <Skeleton className="browse-skeleton__cover" />
            <Skeleton className="browse-skeleton__title" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构：
 * 首行「类型 tabs + 排序 tabs + 计数」+ 竖版卡片网格（对应
 * .browse-sort-bar + .video-card-grid browse-card-grid 的真实结构）。
 *
 * 视口差异化：列数直接消费与真实网格同源的 --card-cols 等分变量
 * （variables.css：3/4/5/6/7/8 列随视口分档），骨架与真实卡片
 * 同帧同宽，不引入第二套断点真源。
 */
import Skeleton from '@/components/common/Skeleton';
import './BrowseSkeleton.css';

/** 桌面 8 列 ×2 行 = 16 张起底；窄屏列数变少时由网格自然截断多余行 */
const CARD_COUNT = 16;

export default function BrowseSkeleton() {
  return (
    <div className="browse-skeleton" role="status" aria-label="搜索中">
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
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <div key={i} className="browse-skeleton__card">
            <Skeleton className="browse-skeleton__cover" />
            <Skeleton className="browse-skeleton__title" />
          </div>
        ))}
      </div>
    </div>
  );
}

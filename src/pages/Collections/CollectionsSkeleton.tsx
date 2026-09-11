/**
 * 收藏页专属骨架 — 与真实内容区逐层同构：
 * 「影视」分区头 + 竖版卡片网格 →「IPTV」分区头 + 频道网格
 * （对应 .collection-section / .video-card-grid / .iptv-channel-grid）。
 *
 * 视口差异化：影视网格列数消费与真实网格同源的 --card-cols，
 * IPTV 网格消费 --iptv-cols，随视口自动分档，不引入第二套断点。
 */
import Skeleton from '@/components/common/Skeleton';
import './CollectionsSkeleton.css';

const VIDEO_COUNT = 8;
const IPTV_COUNT = 6;

export default function CollectionsSkeleton() {
  return (
    <div className="collections-skeleton" role="status" aria-label="加载中">
      <section className="collections-skeleton__section">
        <div className="collections-skeleton__head">
          <Skeleton className="collections-skeleton__head-title" />
          <Skeleton className="collections-skeleton__head-count" />
        </div>
        <div className="collections-skeleton__video-grid">
          {Array.from({ length: VIDEO_COUNT }, (_, i) => (
            <div key={i} className="collections-skeleton__card">
              <Skeleton className="collections-skeleton__video-cover" />
              <Skeleton className="collections-skeleton__line" />
            </div>
          ))}
        </div>
      </section>
      <section className="collections-skeleton__section">
        <div className="collections-skeleton__head">
          <Skeleton className="collections-skeleton__head-title" />
          <Skeleton className="collections-skeleton__head-count" />
        </div>
        <div className="collections-skeleton__iptv-grid">
          {Array.from({ length: IPTV_COUNT }, (_, i) => (
            <div key={i} className="collections-skeleton__card">
              <Skeleton className="collections-skeleton__iptv-cover" />
              <Skeleton className="collections-skeleton__line" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

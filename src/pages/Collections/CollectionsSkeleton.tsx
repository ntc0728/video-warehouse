/**
 * 收藏页专属骨架 — 与真实内容区逐层同构：
 * 「影视」分区头 + 竖版卡片网格 →「IPTV」分区头 + 频道网格
 * （对应 .collection-section / .video-card-grid / .iptv-channel-grid）。
 *
 * 视口差异化：影视网格列数消费与真实网格同源的 --card-cols，
 * IPTV 网格消费 --iptv-cols，随视口自动分档，不引入第二套断点。
 * 张数 = 列数 × ROWS（列数运行时读 token，见 useGridCols）—— 不写死张数，
 * 保证视口内始终填满且末行完整，且永远随列数分档同步。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import './CollectionsSkeleton.css';

/** 每个网格渲染几行占位（行数是策略，张数由列数 × 本值派生；不足首屏由 useFillRows 续行） */
const ROWS = 3;

export default function CollectionsSkeleton() {
  const videoCols = useGridCols('--card-cols', 6);
  const iptvCols = useGridCols('--iptv-cols', 2);
  const rootRef = useRef<HTMLDivElement>(null);
  const extraRows = useFillRows(rootRef, videoCols);
  const videoRows = ROWS + extraRows;

  return (
    <div ref={rootRef} className="collections-skeleton skeleton-scope" role="status" aria-label="加载中">
      <section className="collections-skeleton__section">
        <div className="collections-skeleton__head">
          <Skeleton className="collections-skeleton__head-title" />
          <Skeleton className="collections-skeleton__head-count" />
        </div>
        <div className="collections-skeleton__video-grid">
          {Array.from({ length: videoCols * videoRows }, (_, i) => (
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
          {Array.from({ length: iptvCols * ROWS }, (_, i) => (
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

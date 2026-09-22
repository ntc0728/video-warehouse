/**
 * 收藏页专属骨架 — 与真实内容区逐层同构，且**分区数跟随当前 tab**。
 *
 * 真实内容区（Collections/index.tsx:446-497）：
 *   .collection-content
 *     [mainTab ≠ 'iptv']  section.collection-section → .collection-section-head（影视 / 共 N 条）
 *                                                     + 竖版卡网格（--card-cols）
 *     [showChannels]      section.collection-section → .collection-section-head（直播 / 共 N 个频道）
 *                                                     + 频道网格（--iptv-cols）
 *
 * 「已知常量不当未知」（2026-09-18 用户要求）：**分区数量不是固定的 2**，而是由
 * 真实页同一个判定量决定 —— `mainTab !== 'iptv'`（影视区）与 `showChannels`
 * （直播区，= mainTab==='iptv' || (mainTab==='all' && statusFilter==='all')）→ 由页面
 * 以 props 传入。切到「视频」tab 时骨架只剩 1 个分区，与真实内容一致；不再恒渲染 2 个
 * 分区导致交接时凭空少掉一整块（旧实现的问题）。
 *
 * 行数（非固定）：影视网格按滚动容器可视高度实测填充（useFillRows）；
 * 直播网格位于首屏之下，按 2–3 行渲染（其真实高度由收藏数据决定，骨架不虚构）。
 *
 * 网格容器用本文件的类（不用 .video-card-grid / .iptv-channel-grid —— 那两个类带
 * 入场动画），但列数 token / 间距与真实网格同值。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import './CollectionsSkeleton.css';

export interface CollectionsSkeletonProps {
  /** 渲染「影视」分区（真实条件：mainTab !== 'iptv'） */
  showVideo?: boolean;
  /** 渲染「直播」分区（真实条件：showChannels） */
  showChannels?: boolean;
}

export default function CollectionsSkeleton({
  showVideo = true,
  showChannels = true,
}: CollectionsSkeletonProps) {
  const videoCols = useGridCols('--card-cols', 6);
  const iptvCols = useGridCols('--iptv-cols', 2);
  const videoGridRef = useRef<HTMLDivElement>(null);
  const iptvGridRef = useRef<HTMLDivElement>(null);
  // 影视区在首屏：填满可视高度；直播区在首屏之下：2–3 行即可
  const videoRows = useFillRows(videoGridRef, videoCols, { minRows: 2, reserve: 48 });
  const iptvRows = useFillRows(iptvGridRef, iptvCols, { minRows: 2, maxRows: 3, reserve: 48 });

  return (
    <div className="collection-content collections-skeleton skeleton-scope" role="status" aria-label="加载中">
      {showVideo && (
        <section className="collection-section">
          {/* 分区头复用真实类：标题为静态常量 → 直接渲染真实文字（2026-09-22 方向 A），
              计数为动态数据 → 保持灰条 */}
          <div className="collection-section-head">
            <span className="collection-section-head__title">影视</span>
            <Skeleton className="collections-skeleton__head-count" />
          </div>
          <div ref={videoGridRef} className="collections-skeleton__video-grid">
            {Array.from({ length: videoCols * videoRows }, (_, i) => (
              <div key={i} className="collections-skeleton__card">
                <Skeleton className="collections-skeleton__video-cover" />
                <Skeleton className="collections-skeleton__line" />
              </div>
            ))}
          </div>
        </section>
      )}

      {showChannels && (
        <section className="collection-section">
          <div className="collection-section-head">
            <span className="collection-section-head__title">直播</span>
            <Skeleton className="collections-skeleton__head-count" />
          </div>
          <div ref={iptvGridRef} className="collections-skeleton__iptv-grid">
            {Array.from({ length: iptvCols * iptvRows }, (_, i) => (
              <div key={i} className="collections-skeleton__card">
                <Skeleton className="collections-skeleton__iptv-cover" />
                <Skeleton className="collections-skeleton__line" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

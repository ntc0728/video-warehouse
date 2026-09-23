/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构。
 *
 * 结构镜像（对应 Browse/index.tsx 结果区与 VideoCard）：
 *   卡片网格 → 每格 = a.video-card（.video-card-cover 2:3 + 四角标 + .video-card-info > 标题行）
 *
 * ⚠️ 排序条/左栏筛选的**首屏 chrome 骨架**由 BrowseChromeSkeleton 单独负责
 *   （2026-09-23：首次进入、接口未响应前，真实 sort-bar / FilterBar 不渲染）。
 *   本组件仍只覆盖数据网格；首屏 chrome 骨架与网格骨架同帧并存（不同 grid-area），
 *   不会叠现 —— chrome 骨架终态后真实 sort-bar 接管，网格骨架由 showSkeleton 独占。
 *
 * 行数（非固定）：由 useFillRows 按 AppLayout 滚动容器可视高度实测推导 ——
 * 视口能放几行就渲染几行，末行完整，数据到达时页面高度不跳。
 *
 * 卡片几何复用真实类（.video-card / .video-card-cover / .video-card-info /
 * .video-card-title-wrap）：边框、圆角、封面比例、标题区 padding 全部由
 * VideoCard.css 唯一决定，骨架只往里填灰块 —— 于是「骨架卡与真实卡等高」天然成立。
 * 骨架不写自己的 .video-card 几何副本（那是第二套真源，必然漂移）。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import './BrowseSkeleton.css';

export default function BrowseSkeleton() {
  const cols = useGridCols('--card-cols', 6);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 2, reserve: 48 });

  return (
    <div className="browse-skeleton skeleton-scope" role="status" aria-label="搜索中">
      <div ref={gridRef} className="browse-skeleton__grid">
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} className="video-card browse-skeleton__card">
            <div className="video-card-cover">
              <Skeleton className="browse-skeleton__cover" />
              {/* 四角标：镜像真实 VideoCard — 左上评分 / 右上收藏 / 左下年份 / 右下类型 */}
              <span className="browse-skeleton__badge browse-skeleton__badge--tl" />
              <span className="browse-skeleton__badge browse-skeleton__badge--tr" />
              <span className="browse-skeleton__badge browse-skeleton__badge--bl" />
              <span className="browse-skeleton__badge browse-skeleton__badge--br" />
            </div>
            <div className="video-card-info">
              <div className="video-card-title-wrap">
                <Skeleton className="browse-skeleton__title" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

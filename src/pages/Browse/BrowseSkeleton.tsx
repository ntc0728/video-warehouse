/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构。
 *
 * 结构镜像（对应 Browse/index.tsx 结果区与 VideoCard）：
 *   卡片网格 → 每格 = a.video-card（.video-card-cover 2:3 + 四角标 + .video-card-info > 标题行）
 *
 * ⚠️ 排序条（类型 pills / 排序 tabs / 结果数）不由骨架镜像（2026-09-22 全站静态标签
 *   统一方向 A 审计发现）：真实 .browse-sort-bar 在 smart 模式**加载期恒在渲染**
 *   （Browse/index.tsx 结果卡顶部，计数位自带「搜索中…」态），旧骨架再镜像一条灰条
 *   = 加载期上下两条排序条叠现。静态 chrome 由真实页自己渲染，骨架只覆盖数据区（网格）。
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

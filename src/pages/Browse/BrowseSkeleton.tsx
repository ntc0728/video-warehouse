/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构。
 *
 * 结构镜像（对应 Browse/index.tsx 结果区与 VideoCard，2026-11-08 方案B 定稿）：
 *   卡片网格 → 每格 = a.video-card（.video-card-cover 2:3 + 三角标镜像
 *   TL评分/BL年份/BR类型（形状尺寸校准真实胶囊）+ info 区标题行；
 *   TR 收藏钮静态态不可见，骨架永不画）
 *
 * ⚠️ 排序条/左栏筛选的**首屏 chrome 骨架**由 BrowseChromeSkeleton 单独负责
 *   （2026-09-23：首次进入、接口未响应前，真实 sort-bar / FilterBar 不渲染）。
 *   本组件仍只覆盖数据网格；首屏 chrome 骨架与网格骨架同帧并存（不同 grid-area），
 *   不会叠现 —— chrome 骨架终态后真实 sort-bar 接管，网格骨架由 showSkeleton 独占。
 *
 * 行数（非固定）：由 useFillRows 按 AppLayout 滚动容器可视高度实测推导 ——
 * 视口能放几行就渲染几行，末行完整，数据到达时页面高度不跳。
 *
 * 卡片几何复用真实类（.video-card / .video-card-cover / .video-card-portrait__bottom /
 * __title-wrap / __meta）：边框、圆角、封面比例、底部渐变与内边距全部由
 * VideoCard.css 唯一决定，骨架只往里填灰块 —— 于是「骨架卡与真实卡等高」天然成立。
 * 骨架不写自己的 .video-card 几何副本（那是第二套真源，必然漂移）。
 */
import { useRef } from 'react';
import { Star } from 'lucide-react';
import Skeleton from '@/components/common/Skeleton';
import { Icon } from '@/components/ui/Icon';
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
              {/* 方案B（2026-11-08 用户拍板「3角标骨架要与真实元素尺寸保持一致」）：
                  角标直接复用真实类 + 真实内容（评分8.5/年份2024/类型电影），
                  盒尺寸与真实元素**像素级一致**（TV 档 padding/字号也随真实类自动缩放）；
                  皮肤层只换底色为骨架灰、内容透明。TR 收藏钮 hover 才显形 → 不画 */}
              <span className="video-card-rating browse-skeleton__skin" aria-hidden="true">
                <Icon icon={Star} size="xs" fill="currentColor" />
                8.5
              </span>
              <span className="video-card-year-badge browse-skeleton__skin" aria-hidden="true">2024</span>
              <span className="video-card-type browse-skeleton__skin" aria-hidden="true">电影</span>
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

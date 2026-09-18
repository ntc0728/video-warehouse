/**
 * Browse 结果区专属骨架 — 与真实结果区逐层同构。
 *
 * 结构镜像（对应 Browse/index.tsx:704-750 与 VideoCard）：
 *   .browse-sort-bar
 *     __types  → 真实 = CATEGORY_OPTIONS（= Object.keys(CATEGORY_CONFIG)，7 个）
 *     __divider
 *     __tabs   → 真实 = SORT_OPTIONS（3 个）
 *     __count
 *   卡片网格 → 每格 = a.video-card（.video-card-cover 2:3 + 四角标 + .video-card-info > 标题行）
 *
 * 「已知常量不当未知」（2026-09-18 用户要求）：pill 数量直接取真实页同一份常量
 * （CATEGORY_CONFIG / SORT_OPTIONS），不再手写 5 / 3 —— 真实页加一个分类，
 * 骨架自动跟随，不会出现「骨架 5 个 pill、真实 7 个」这种结构错位。
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
import { SORT_OPTIONS } from '@/components/FilterBar/constants';
import { CATEGORY_CONFIG } from './constants';
import './BrowseSkeleton.css';

/** 结果区类型 pill 数 = 真实 CATEGORY_OPTIONS 长度（全部/电影/剧集/综艺/动漫/纪录片/排行榜 = 7） */
const TYPE_COUNT = Object.keys(CATEGORY_CONFIG).length;
/** 排序 pill 数 = 真实 SORT_OPTIONS 长度（最热/最新/最高分 = 3） */
const SORT_COUNT = SORT_OPTIONS.length;

export default function BrowseSkeleton() {
  const cols = useGridCols('--card-cols', 6);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 2, reserve: 48 });

  return (
    <div className="browse-skeleton skeleton-scope" role="status" aria-label="搜索中">
      <div className="browse-skeleton__bar">
        <div className="browse-skeleton__types">
          {Array.from({ length: TYPE_COUNT }, (_, i) => (
            <Skeleton key={i} className="browse-skeleton__type" />
          ))}
        </div>
        <span className="browse-skeleton__divider" aria-hidden="true" />
        <div className="browse-skeleton__sorts">
          {Array.from({ length: SORT_COUNT }, (_, i) => (
            <Skeleton key={i} className="browse-skeleton__sort" />
          ))}
          <Skeleton className="browse-skeleton__count" />
        </div>
      </div>

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

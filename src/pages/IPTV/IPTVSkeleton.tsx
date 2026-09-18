/**
 * IPTV 频道页专属骨架 — 与真实页面逐层同构（两套分支同构）。
 *
 * rail 模式（桌面，isDesktopRail）：
 *   .iptv-rail-layout
 *     aside.iptv-rail          两段标题 + 分类列表（IPTV_CATEGORIES）+ .iptv-rail__sep
 *                              + 「更多台」列表（每项带 .iptv-rail__box 勾选框）
 *     .iptv-rail-content > .iptv-grid-card > .iptv-content
 *         .iptv-content-bar    计数 + 2 个源刷新时刻 + spacer + 源下拉 + note + 刷新按钮
 *         section.iptv-sec     .iptv-sec__head（h3 + n + line，sticky）+ .iptv-channel-grid
 * 移动/App/TV 模式：.iptv-top-card（源过滤 tags + 操作行）+ .iptv-grid-card > .iptv-content
 *
 * 「已知常量不当未知」（2026-09-18 用户要求）：
 *  - 左栏分类行数 = IPTV_CATEGORIES.length（含「我的收藏」，常量真源），由页面传入；
 *  - 「更多台」行数 = 已启用 IPTV 源数（store 的 aggregatorUrls.length，页面传入），
 *    不再写死 9 行；
 *  - 内容条是否出现「源下拉」= aggregatorUrls.length > 1（页面传入）。
 * 左栏骨架此前固定 9 行、且没有 __sep / 第二段标题 / __box，与真实 rail 差得很远。
 *
 * 行数（非固定）：频道网格由 useFillRows 按滚动容器可视高度推导 —— 首节在首屏
 * 自然填满，其后各节落在视口外（avail ≤ 0）自动停在 minRows，不会虚构长度。
 *
 * 视口差异化：网格列数消费与真实网格同源的 --iptv-page-cols（.iptv-page
 * .iptv-channel-grid，2026-09-08 起 IPTV 页专用；此前骨架误用全局 --iptv-cols，
 * 桌面档多一列），随视口自动分档。
 */
import { useRef } from 'react';
import Skeleton from '@/components/common/Skeleton';
import { useGridCols, useFillRows } from '@/hooks';
import { IPTV_CATEGORIES } from './categories';
import './IPTVSkeleton.css';

/** 左栏分类行数的默认值 = 真实 IPTV_CATEGORIES 长度（页面可传「其他」非空时的 +1） */
const DEFAULT_CATEGORY_COUNT = IPTV_CATEGORIES.length;
/** 首屏分节数：真实为「非空分类」数（≤9）；骨架只镜像首屏可见的 2 节 */
const SECTION_COUNT = 2;

/** 单节频道网格：首节按视口填充，后续节在视口外自动停在 minRows */
function ChannelGridSkeleton() {
  const cols = useGridCols('--iptv-page-cols', 2);
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useFillRows(gridRef, cols, { minRows: 2, reserve: 48 });

  return (
    <div ref={gridRef} className="iptv-skeleton__channel-grid">
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} className="iptv-skeleton__channel">
          <div className="iptv-skeleton__channel-cover">
            {/* 左上 LIVE 角标（真实 .iptv-card-cover__badges 常驻） */}
            <span className="iptv-skeleton__channel-live" />
          </div>
          <Skeleton className="iptv-skeleton__channel-title" />
          <Skeleton className="iptv-skeleton__channel-sub" />
        </div>
      ))}
    </div>
  );
}

/** 网格内局部骨架：已有数据后的刷新占位（对应 .iptv-content-loading 场景） */
export function IPTVChannelGridSkeleton() {
  return <ChannelGridSkeleton />;
}

export interface IPTVSkeletonProps {
  /** 桌面左栏布局（真实 isDesktopRail = !isMobileLayout && !isTV） */
  rail: boolean;
  /** 左栏「频道分类」行数（真实 = IPTV_CATEGORIES.length + 「其他」非空 ? 1 : 0） */
  categoryCount?: number;
  /** 左栏「更多台」行数（真实 = aggregatorUrls.length） */
  extraSourceCount?: number;
  /** 内容条是否显示「按源过滤」下拉（真实条件 aggregatorUrls.length > 1） */
  sourceFilter?: boolean;
}

export default function IPTVSkeleton({
  rail,
  categoryCount = DEFAULT_CATEGORY_COUNT,
  extraSourceCount = 0,
  sourceFilter = false,
}: IPTVSkeletonProps) {
  if (!rail) {
    return (
      <div className="iptv-skeleton skeleton-scope" role="status" aria-label="加载频道列表">
        {/* .iptv-top-card 同构：源过滤 tags + 操作行 */}
        <div className="iptv-top-card iptv-skeleton__top-card">
          <div className="iptv-source-filter">
            {Array.from({ length: 1 + Math.min(extraSourceCount, 6) }, (_, i) => (
              <Skeleton key={i} className="iptv-skeleton__filter-tag" />
            ))}
          </div>
          <div className="iptv-actions-row">
            <Skeleton className="iptv-skeleton__bar-btn" />
          </div>
        </div>
        <div className="iptv-grid-card">
          <div className="iptv-content">
            <ChannelGridSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iptv-rail-layout iptv-skeleton--rail skeleton-scope" role="status" aria-label="加载频道列表">
      <aside className="iptv-rail">
        <div className="iptv-rail__title">频道分类</div>
        <div className="iptv-rail__list">
          {Array.from({ length: categoryCount }, (_, i) => (
            <div key={i} className="iptv-rail__item iptv-skeleton__rail-item">
              <span className="iptv-rail__lbl">
                <Skeleton className="iptv-skeleton__rail-lbl" />
              </span>
              <span className="iptv-rail__cnt">
                <Skeleton className="iptv-skeleton__rail-cnt" />
              </span>
            </div>
          ))}
        </div>

        {/* 第二段「更多台」：真实为 .iptv-rail__sep + 标题 + 带勾选框的列表，
            仅在已启用 IPTV 源（extraSourceCount > 0）时出现 */}
        {extraSourceCount > 0 && (
          <>
            <div className="iptv-rail__sep" />
            <div className="iptv-rail__title">更多台</div>
            <div className="iptv-rail__list">
              {Array.from({ length: extraSourceCount }, (_, i) => (
                <div key={i} className="iptv-rail__item iptv-skeleton__rail-item">
                  <span className="iptv-rail__box" />
                  <span className="iptv-rail__lbl">
                    <Skeleton className="iptv-skeleton__rail-lbl" />
                  </span>
                  <span className="iptv-rail__cnt">
                    <Skeleton className="iptv-skeleton__rail-cnt" />
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="iptv-rail-content">
        <div className="iptv-grid-card">
          <div className="iptv-content">
            {/* 内容条：计数 + 源/节目单刷新时刻 + spacer + 源下拉 + note + 刷新按钮 */}
            <div className="iptv-content-bar">
              <Skeleton className="iptv-skeleton__bar-count" />
              <Skeleton className="iptv-skeleton__bar-meta" />
              <Skeleton className="iptv-skeleton__bar-meta" />
              <span className="iptv-content-bar__spacer" />
              {sourceFilter && (
                <>
                  <Skeleton className="iptv-skeleton__bar-select" />
                  <Skeleton className="iptv-skeleton__bar-note" />
                </>
              )}
              <Skeleton className="iptv-skeleton__bar-btn" />
            </div>

            {Array.from({ length: SECTION_COUNT }, (_, s) => (
              <section key={s} className="iptv-sec">
                <div className="iptv-sec__head">
                  <Skeleton className="iptv-skeleton__sec-title" />
                  <Skeleton className="iptv-skeleton__sec-n" />
                  <span className="iptv-sec__line" />
                </div>
                <ChannelGridSkeleton />
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

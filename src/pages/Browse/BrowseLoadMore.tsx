/**
 * 筛选页懒加载触发器（3 态文案 + 双保险触发 + 骨架占位）
 *
 * 三种文字态：
 *  1. 加载中（isLoading && hasMore）→ 追加 2 行 SkeletonGrid 占位 + spinner + "加载更多中…"
 *  2. 还有更多（!isLoading && hasMore）→ 静态 "下滑加载更多"（呼吸动画）
 *  3. 已加载全部（!hasMore && hasItems）→ "— 已加载全部 —"
 *
 * 初始无数据（!hasItems）→ 隐藏整个组件
 *
 * 触发：useInfiniteScroll 同时使用 IntersectionObserver + scroll 事件兜底，
 * 快速滚动/wheel 惯性到距底部 < 200px 时一定触发加载。
 * pageLoadingRef + isLoadingRef 双重去重，防止 IO 与 scroll 同时触发重复请求。
 */
import { useMemo } from 'react';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { SkeletonGrid } from '@/components/VideoCard/SkeletonCard';
import './Browse.css';

interface BrowseLoadMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  hasItems: boolean;
}

export default function BrowseLoadMore({
  hasMore,
  isLoading,
  onLoadMore,
  hasItems,
}: BrowseLoadMoreProps) {
  const scrollContainerRef = useScrollContainer();

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore,
    rootMargin: '200px',
    scrollContainerRef,
  });

  // 加载中骨架卡片数量：根据 --card-cols 动态计算（默认 12 = 6 列 × 2 行）
  // SSR / 早期渲染时无 window，使用 fallback 12
  // --card-cols 在 resize/breakpoint 变化时由 CSS 重新计算，因此只在 isLoading
  // 切换时读取（首次进入 loading 态时确定一次即可）
  const skeletonCount = useMemo(() => {
    if (typeof window === 'undefined') return 12;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--card-cols');
    const cols = parseInt(raw, 10);
    return Math.max((Number.isFinite(cols) && cols > 0 ? cols : 6) * 2, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // 没有任何数据 → 不显示
  if (!hasItems) return null;

  // ── 3 态分支 ──
  const isLoadingMore = isLoading && hasMore;
  const isAllLoaded = !hasMore && hasItems;
  const canShowMore = hasMore && !isLoading && hasItems;

  return (
    <div className="browse-loadmore">
      {/* 加载中：追加 2 行骨架卡片（与 grid 列宽一致），保证视觉连续 */}
      {isLoadingMore && (
        <div className="browse-loadmore-skeleton" aria-hidden="true">
          <SkeletonGrid count={skeletonCount} />
        </div>
      )}

      {/* 文字态：3 选 1 */}
      {isLoadingMore ? (
        <div className="browse-loadmore-loading" role="status" aria-live="polite">
          <span className="browse-loadmore-spinner" aria-hidden="true" />
          <span>加载更多中…</span>
        </div>
      ) : isAllLoaded ? (
        <div className="browse-loadmore-end">— 已加载全部 —</div>
      ) : canShowMore ? (
        <div className="browse-loadmore-hint" aria-hidden="true">
          下滑加载更多
        </div>
      ) : null}

      <div ref={sentinelRef} className="browse-loadmore-sentinel" aria-hidden="true" />
    </div>
  );
}

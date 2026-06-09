/**
 * 筛选页懒加载文字态（3 态文案）
 *
 * 三种文字态：
 *  1. 加载中（isLoading && hasMore）→ spinner + "加载更多中…"
 *  2. 还有更多（!isLoading && hasMore）→ 静态 "下滑加载更多"（呼吸动画）
 *  3. 已加载全部（!hasMore && hasItems）→ "— 已加载全部 —"
 *
 * 初始无数据（!hasItems）→ 隐藏整个组件
 *
 * 哨兵由父级 Browse 页面以独立 `<div ref={sentinelRef} />` 形式渲染,
 * 本组件仅负责文字态,与 IPTV 风格完全一致。
 *
 * 加载语义:
 *  - isLoading && hasMore → spinner + "加载中…"
 *  - 加载成功:isLoading 翻 false → spinner 同帧消失
 *  - 加载失败:isLoading 翻 false → spinner 同帧消失,卡片数量保持不变
 */
import './Browse.css';

interface BrowseLoadMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  hasItems: boolean;
}

export default function BrowseLoadMore({ hasMore, isLoading, hasItems }: BrowseLoadMoreProps) {
  // 没有任何数据 → 不显示
  if (!hasItems) return null;

  // ── 3 态分支 ──
  const isLoadingMore = isLoading && hasMore;
  const isAllLoaded = !hasMore && hasItems;
  const canShowMore = hasMore && !isLoading && hasItems;

  return (
    <div className="browse-loadmore">
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
    </div>
  );
}

/**
 * 筛选页懒加载文字态（2 态文案）
 *
 * 两种文字态：
 *  1. 加载中（isLoading && hasMore）→ spinner + "加载更多中…"
 *  2. 还有更多（!isLoading && hasMore）→ 静态 "下滑加载更多"（呼吸动画）
 *
 * 初始无数据（!hasItems）或刷新中（isRefreshing）→ 隐藏整个组件
 * 已加载全部（!hasMore）→ 隐藏整个组件
 */
import './Browse.css';

interface BrowseLoadMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  hasItems: boolean;
  isRefreshing?: boolean;
}

export default function BrowseLoadMore({ hasMore, isLoading, hasItems, isRefreshing }: BrowseLoadMoreProps) {
  const isLoadingMore = isLoading && hasMore;
  const canShowMore = hasMore && !isLoading && hasItems;

  if (!hasItems || isRefreshing || !hasMore) return null;

  return (
    <div className="browse-loadmore">
      {isLoadingMore ? (
        <div className="browse-loadmore-loading" role="status" aria-live="polite">
          <span className="browse-loadmore-spinner" aria-hidden="true" />
          <span>加载更多中…</span>
        </div>
      ) : canShowMore ? (
        <div className="browse-loadmore-hint" aria-hidden="true">
          下滑加载更多
        </div>
      ) : null}
    </div>
  );
}

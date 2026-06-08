/**
 * 通用无限滚动 Hook（双保险：IntersectionObserver + scroll 兜底）
 *
 * 用法：
 *   const { sentinelRef } = useInfiniteScroll({
 *     hasMore,           // 是否还有更多数据
 *     isLoading,         // 当前是否正在加载（防止重复触发）
 *     onLoadMore,        // 触发加载的回调
 *     rootMargin,        // 提前多少像素触发，默认 200px
 *     scrollContainerRef,// 可选：自定义滚动容器（默认 window）
 *     canLoadMore,       // 可选：业务级开关（默认 true）
 *     disabled,          // 可选：外部完全禁用（默认 false）
 *   });
 *
 *   return (
 *     <>
 *       <List />
 *       <div ref={sentinelRef} aria-hidden="true" />
 *     </>
 *   );
 *
 * 设计要点：
 * - 双保险：IO + scroll 事件兜底（快速滚动到距底部 < 200px 时一定触发）
 * - 去重：isLoadingRef（最新 isLoading 同步）+ pageLoadingRef（本次 page 加载中）
 *   防止 IO 与 scroll 同时触发导致重复加载
 * - 业务开关：canLoadMore 业务前置未达成时跳过触发
 *
 * 替代旧版本：旧 Hook 混入 mobileCount / pageSize / isMobile 切片逻辑，
 * 现已上移到业务层（useBrowseData）。本 Hook 仅负责「哨兵可见/接近底部 → 触发回调」。
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface UseInfiniteScrollOptions {
  /** 是否还有更多数据可加载 */
  hasMore: boolean;
  /** 当前是否正在加载（true 时不再触发） */
  isLoading: boolean;
  /** 哨兵可见/接近底部时触发的回调 */
  onLoadMore: () => void;
  /** 提前多少像素触发（默认 200px） */
  rootMargin?: string;
  /** 自定义滚动容器（不传则用 viewport） */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** 业务级开关：业务前置条件未达成时跳过触发（默认 true） */
  canLoadMore?: boolean;
  /** 外部完全禁用（默认 false） */
  disabled?: boolean;
}

const FALLBACK_THRESHOLD_PX = 200;

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
  scrollContainerRef,
  canLoadMore = true,
  disabled = false,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── Refs: 同步最新状态，避免 effect 频繁重建 ──
  const isLoadingRef = useRef(isLoading);
  const pageLoadingRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // 同步 isLoading → isLoadingRef，并在加载结束时重置 pageLoadingRef
  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading) {
      pageLoadingRef.current = false;
    }
  }, [isLoading]);

  /** 核心触发逻辑：所有去重开关都集中在这里 */
  const triggerLoad = useCallback(() => {
    if (disabled || !hasMore || !canLoadMore) return;
    if (isLoadingRef.current || pageLoadingRef.current) return;
    pageLoadingRef.current = true;
    onLoadMoreRef.current();
  }, [disabled, hasMore, canLoadMore]);

  // ── 1) IntersectionObserver 监听 ──
  useEffect(() => {
    if (disabled || !hasMore || isLoading) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current?.disconnect();

    const root = scrollContainerRef?.current || null;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerLoad();
        }
      },
      { root, rootMargin, threshold: 0.01 },
    );
    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [disabled, hasMore, isLoading, rootMargin, scrollContainerRef, triggerLoad]);

  // ── 2) scroll 事件兜底 ──
  // 快速滚动/wheel 惯性下 IO 可能来不及触发；额外监听 scroll，
  // 当"距底部距离 < FALLBACK_THRESHOLD_PX"时强制触发一次。
  useEffect(() => {
    if (disabled || !hasMore) return;

    const el = scrollContainerRef?.current ?? null;
    const target: HTMLElement | Window = el ?? window;

    const onScroll = () => {
      if (!hasMore || !canLoadMore) return;
      const dist = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (dist < FALLBACK_THRESHOLD_PX) {
        triggerLoad();
      }
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    // 初始检查（首次进入时若内容不足一屏也要触发）
    onScroll();

    return () => {
      target.removeEventListener('scroll', onScroll);
    };
  }, [disabled, hasMore, canLoadMore, scrollContainerRef, triggerLoad]);

  return { sentinelRef };
}

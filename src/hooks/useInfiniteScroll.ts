/**
 * 通用无限滚动 Hook（双保险：IntersectionObserver + scroll 兜底）
 *
 * 用法：
 *   const { sentinelRef, resetLoading } = useInfiniteScroll({
 *     hasMore,           // 是否还有更多数据
 *     isLoading,         // 当前是否正在加载（防止重复触发）
 *     onLoadMore,        // 触发加载的回调
 *     rootMargin,        // 提前多少像素触发（默认 200px）
 *     scrollContainerRef,// 可选：自定义滚动容器（默认 window）
 *     canLoadMore,       // 可选：业务级开关（默认 true）
 *     disabled,          // 可选：外部完全禁用（默认 false）
 *   });
 *
 *   return (
 *     <>
 *       <List />
 *       <div ref={sentinelRef} aria-hidden="true" />
 *       <div className="load-more-hint">...</div>
 *     </>
 *   );
 *
 *   分批渲染 / 同步切片场景下，onLoadMore 内调用 resetLoading() 释放锁，让哨兵再次触发。
 *   异步加载场景无需调用（hook 内部 useEffect 会随 isLoading 翻转自动重置）。
 *
 * 设计要点：
 * - 双保险：IO + scroll 事件兜底（快速滚动/wheel 惯性到距底部 < 200px 时一定触发）
 * - 去重：isLoadingRef（最新 isLoading 同步）+ pageLoadingRef（本次 page 加载中）
 *   防止 IO 与 scroll 同时触发导致重复加载
 * - 业务开关：canLoadMore 业务前置未达成时跳过触发
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
  const hasMoreRef = useRef(hasMore);
  const triggerLoadRef = useRef<() => void>(() => {});
  /** 边沿触发记忆：上一次 scroll 时是否已在底部阈值内，避免停在底部时每帧连发 */
  const wasNearBottomRef = useRef(false);
  onLoadMoreRef.current = onLoadMore;
  hasMoreRef.current = hasMore;

  /** 核心触发逻辑：所有去重开关都集中在这里 */
  const triggerLoad = useCallback(() => {
    if (disabled || !hasMore || !canLoadMore) return;
    if (isLoadingRef.current || pageLoadingRef.current) return;
    pageLoadingRef.current = true;
    onLoadMoreRef.current();
  }, [disabled, hasMore, canLoadMore]);
  triggerLoadRef.current = triggerLoad;

  /** 业务层显式释放 pageLoadingRef 锁（同步切片 / 分批渲染场景下 onLoadMore 后调用） */
  const resetLoading = useCallback(() => {
    pageLoadingRef.current = false;
  }, []);

  // 同步 isLoading → isLoadingRef，并在加载结束时重置 pageLoadingRef。
  // 关键点：isLoading 翻 false 瞬间，强制让 IO 重新评估哨兵位置（disconnect + reobserve）。
  // - 哨兵仍在视口内 → IO 会主动 callback（isIntersecting=true）→ triggerLoad → 加载下一页
  // - 哨兵已不在视口（用户已向上滚离底部）→ IO 不会 callback → 不触发
  // 这样既保留"翻 false 后用户若还在底部就继续加载"的体验,又避免"用户已滚离但
  // 翻 false 仍强制加载"的过度触发。
  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading) {
      pageLoadingRef.current = false;
      const observer = observerRef.current;
      const sentinel = sentinelRef.current;
      if (observer && sentinel) {
        observer.disconnect();
        observer.observe(sentinel);
      }
    }
  }, [isLoading]);

  // ── 1) IntersectionObserver 监听 ──
  // 注意: hasMore 不作为依赖——由 triggerLoadRef 在回调中读取最新值来判断。
  // 旧实现把 hasMore 放进 deps 导致 IO 频繁 disconnect/reconnect，re-observe 后
  // 若哨兵仍在视口会立刻 callback，形成"hasMore 变→IO 重建→callback→loadMore→
  // visibleCount 变→hasMore 变"的渲染循环。现在 IO 仅在 mount / disabled /
  // rootMargin / scrollContainerRef 变化时创建一次，callback 内通过 ref 读最新
  // hasMore 值来决定是否触发。
  useEffect(() => {
    if (disabled) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const root = scrollContainerRef?.current || null;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerLoadRef.current();
        }
      },
      { root, rootMargin, threshold: 0.01 },
    );
    observerRef.current.observe(sentinel);

    // sentinel 已在视口内时立即触发（observer 首次 observe 不会 callback）
    requestAnimationFrame(() => {
      if (!sentinel.isConnected) return;
      // 隐藏期守卫：容器不可见（clientHeight===0）时 sentinel 的 rect 全 0 无意义，跳过
      if (root && root.clientHeight === 0) return;
      const rect = sentinel.getBoundingClientRect();
      const rootEl = root || document.documentElement;
      const rootBottom = rootEl === document.documentElement
        ? window.innerHeight
        : rootEl.clientHeight;
      const margin = parseInt(rootMargin, 10) || 0;
      if (rect.top < rootBottom + margin) {
        triggerLoadRef.current();
      }
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [disabled, hasMore, rootMargin, scrollContainerRef]);

  // ── 2) scroll 事件兜底 ──
  // 快速滚动/wheel 惯性下 IO 可能来不及触发；额外监听 scroll，
  // 当"距底部距离 < FALLBACK_THRESHOLD_PX"时强制触发一次。
  // hasMore / triggerLoad 不作为依赖：通过 ref 读最新值，避免依赖变化时
  // 重新 addEventListener + 立即 onScroll() 形成触发循环。
  useEffect(() => {
    if (disabled) return;

    const el = scrollContainerRef?.current ?? null;
    const target: HTMLElement | Window = el ?? window;

    const onScroll = () => {
      if (!hasMoreRef.current || !canLoadMore) return;
      // 隐藏期守卫：Keep-Alive 隐藏态（display:none）容器 clientHeight===0，
      // 此时 dist 恒为 0 < 阈值会无限连发把 visibleCount 推满，直接跳过。
      if (el && el.clientHeight === 0) return;
      const dist = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      // 边沿触发：仅当 dist 从 ≥阈值 穿越到 <阈值 的瞬间触发一次，
      // 避免用户停在底部时 scroll 事件每帧都触发、把列表一次性连发到全量
      // （IPTV 同步切片 + resetLoading 立即释放锁时尤为致命）。
      const near = dist < FALLBACK_THRESHOLD_PX;
      if (near && !wasNearBottomRef.current) {
        triggerLoadRef.current();
      }
      wasNearBottomRef.current = near;
    };

    // requestAnimationFrame 节流：滚动帧高频触发时只在每帧执行一次
    let ticking = false;
    const throttledScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    };

    target.addEventListener('scroll', throttledScroll, { passive: true });
    // 初始检查（首次进入时若内容不足一屏也要触发）
    onScroll();

    return () => {
      target.removeEventListener('scroll', throttledScroll);
    };
  }, [disabled, canLoadMore, scrollContainerRef]);

  return { sentinelRef, resetLoading };
}

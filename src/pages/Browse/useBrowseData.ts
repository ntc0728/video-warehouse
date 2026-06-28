/**
 * 筛选页数据流 Hook
 *
 * 职责：
 * 1. URL ↔ FilterBarValue 双向同步
 * 2. 筛选条件变化触发 fetch（debounced）
 * 3. 懒加载（loadMore）
 * 4. 维护 isUpdating 状态（debounce 期间为 true，UI 可显示 spinner）
 *
 * 设计：
 * - 单一来源：URL 是筛选状态的真相（refresh / 分享 / 前进后退 全部恢复）
 * - store 仅作为内存缓存层：discoverResults / discoverPagination 由 store 持有
 * - 重置语义：filterSig 变化 → fetchDiscover(1, { reset: true }) 强制覆盖旧数据
 *
 * v5:移除 skeletonBatches 计数与相关 effect（v3+v4 引入的内联骨架占位图已废弃）。
 *   懒加载 loading 态由 `isLoadingMore` 布尔直接驱动 UI spinner,
 *   不再有 "在飞批次数" 概念,加载成功/失败都同帧结束(spinner 消失)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterBarValue } from '@/components/FilterBar';
import { useTMDBStore } from '@/stores';
import { buildFilterSig } from '@/lib/filterSig';
import { SORT_OPTIONS } from './constants';
import { FILTER_DEBOUNCE_MS } from './constants';
import { parseFromUrl, serializeToUrl } from './urlState';

/** 把 FilterBarValue 转成 store 需要的 TMDBFilterOptions */
function toStoreFilter(value: FilterBarValue) {
  const sort = SORT_OPTIONS[value.sortIdx] ?? SORT_OPTIONS[0];
  return {
    mediaType: value.mediaType,
    genreIds: value.genreIds,
    minVoteAverage: value.minRating,
    sortBy: sort.sortBy,
    sortOrder: sort.order,
    releaseYear: value.olderThan2015 ? null : value.year,
    releaseDateGte: null as string | null,
    releaseDateLte: value.olderThan2015 ? '2014-12-31' : null,
    originCountry: value.region,
  };
}

export function useBrowseData() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── 1. URL → FilterBarValue ─────────────────────────
  const filterValue = useMemo<FilterBarValue>(
    () => parseFromUrl(searchParams),
    [searchParams],
  );
  const filterSig = useMemo(() => buildFilterSig(filterValue), [filterValue]);

  // ── 1b. URL ?q= 搜索词（独立于 FilterBar） ───────────
  // TMDB discover 端点不支持 query 文本搜索；q 不为空时调 /search/multi，
  // 走 store.search() 把结果写入 discoverResults。
  const urlQ = searchParams.get('q')?.trim() ?? '';

  // ── 2. store 状态 ───────────────────────────────────
  const {
    discoverResults,
    discoverPagination,
    discoverLastStatus,
    loading,
    errors,
    setFilter,
    fetchDiscover,
    fetchTopRated,
  } = useTMDBStore();

  // ── 3. debounce + 重置 fetch ────────────────────────
  const lastSigRef = useRef<string>(filterSig);
  // 首次 mount 查询守卫：React 18 StrictMode 双调用下避免重复请求
  const initialFetchDoneRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 记录切换筛选条件前是否有旧数据（用于 loading 遮罩显示判断）
  const hadOldDataRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 首次 mount：立即发起一次查询，让"从首页进入"也能直接看到数据
  // （不依赖筛选条件变化；与下方 filterSig 变化的 effect 完全独立）
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    // 同步 store 中的 filterOptions（确保与 URL 一致）
    setFilter(toStoreFilter(filterValue));

    // 首次进入页面，无论有无旧数据都显示 loading
    setIsRefreshing(true);
    hadOldDataRef.current = false;

    // 立即发起 page=1 查询（无 debounce）
    const fetchPromise = (() => {
      if (urlQ) {
        return useTMDBStore.getState().search(urlQ, 1, { reset: true });
      } else if (filterValue.category === 'top') {
        return fetchTopRated(1, { reset: true });
      } else {
        return fetchDiscover(1, { reset: true });
      }
    })();

    void fetchPromise.then(() => {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3b. 搜索词变化（独立 effect） ──────────────────
  // q 变化 → 调 search()。debounce 防止快速输入。
  // 注意：q 清空（undefined → ''）时，filterSig effect 也会被触发（因为 setFilter
  // 也在 filterSig 链路上），所以此处 q 清空不主动 fetchDiscover，让 filterSig 接管。
  useEffect(() => {
    if (!initialFetchDoneRef.current) return;
    if (!urlQ) return; // q 为空：不主动 discover，由 filterSig effect 接管
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsUpdating(true);
    debounceTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsUpdating(false);
      void useTMDBStore.getState().search(urlQ, 1, { reset: true });
    }, FILTER_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [urlQ]);

  // 筛选签名变化：debounce → 强制重置 fetch（首次 mount 由上方独立 effect 处理）
  // 有搜索词时（urlQ 不为空）跳过本 effect，由 3b 的 q effect 接管（避免重复请求）。
  useEffect(() => {
    if (!initialFetchDoneRef.current) return;
    if (urlQ) return; // 有 q：走 /search/multi 端点，不走 discover
    if (filterSig === lastSigRef.current) return;
    lastSigRef.current = filterSig;

    // 记录切换前是否有旧数据（loading 遮罩需要知道）
    hadOldDataRef.current = discoverResults.length > 0;
    setIsUpdating(true);
    setIsRefreshing(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setIsUpdating(false);

      // 先同步 store 的 filterOptions，再发起第一页请求
      setFilter(toStoreFilter(filterValue));

      try {
        if (filterValue.category === 'top') {
          // 排行榜：topUserFilterRef 已在 useBrowseData 内合并为 filterSig 变化即可重置
          await fetchTopRated(1, { reset: true });
        } else {
          await fetchDiscover(1, { reset: true });
        }
      } finally {
        if (isMountedRef.current) {
          // 等待新内容渲染完成后再隐藏 loading（至少 150ms 避免闪烁）
          await new Promise<void>((r) => setTimeout(r, 150));
          if (isMountedRef.current) {
            setIsRefreshing(false);
            hadOldDataRef.current = false;
          }
        }
      }
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [filterSig, urlQ, filterValue, setFilter, fetchDiscover, fetchTopRated, discoverResults.length]);

  // ── 4. 写回 URL（由调用方触发）─────────────────────
  const updateFilter = useCallback(
    (next: FilterBarValue) => {
      const params = serializeToUrl(next);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  // ── 5. 懒加载 ──────────────────────────────────────
  const hasMore = discoverPagination.page < discoverPagination.totalPages;
  /**
   * "正在加载更多"的判定(v5):
   * - loading.discover && discoverResults.length > 0  → 仍处于请求飞行中
   * - discoverLastStatus === 'success'               → 最近一次请求已成功,spinner 该走
   * - discoverLastStatus === 'error'                 → 已失败,spinner 立即消失(无缓冲)
   *
   * 区别于 v4:不再有"占位骨架"概念,spinner 直接由 isLoadingMore 驱动
   *   - 成功:isLoadingMore 翻 false 同一帧 spinner 消失(无 300ms 兜底)
   *   - 失败:同 success,spinner 立即消失,卡片数量保持不变
   */
  const isLoadingMore =
    loading.discover && discoverResults.length > 0 && discoverLastStatus !== 'success';

  const loadMore = useCallback(() => {
    if (loading.discover) return;
    if (!hasMore) return;

    const nextPage = discoverPagination.page + 1;
    if (urlQ) {
      // 有搜索词：调 /search/multi nextPage
      useTMDBStore.getState().search(urlQ, nextPage);
    } else if (filterValue.category === 'top') {
      fetchTopRated(nextPage);
    } else {
      fetchDiscover(nextPage);
    }
  }, [loading.discover, hasMore, discoverPagination.page, urlQ, filterValue.category, fetchDiscover, fetchTopRated]);

  /**
   * 重试当前筛选条件下的首次加载（清空错误、强制 reset 拉 page=1）
   * 用于错误页"重试"按钮。无副作用,可在任意时刻调用,内部走 store 异步流程。
   */
  const retry = useCallback(() => {
    if (loading.discover) return;
    setFilter(toStoreFilter(filterValue));
    if (urlQ) {
      void useTMDBStore.getState().search(urlQ, 1, { reset: true });
    } else if (filterValue.category === 'top') {
      void fetchTopRated(1, { reset: true });
    } else {
      void fetchDiscover(1, { reset: true });
    }
  }, [loading.discover, filterValue, urlQ, setFilter, fetchDiscover, fetchTopRated]);

  return {
    filterValue,
    updateFilter,
    isUpdating,
    isRefreshing,
    hadOldData: hadOldDataRef.current,
    loadMore,
    retry,
    hasMore,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading: loading.discover,
    error: errors.discover,
  };
}

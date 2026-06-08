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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterBarValue } from '@/components/FilterBar';
import { useTMDBStore } from '@/stores';
import { buildFilterSig } from '@/lib/filterSig';
import { SORT_OPTIONS } from './constants';
import { FILTER_DEBOUNCE_MS, LOAD_MORE_THROTTLE_MS } from './constants';
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
    releaseYear: null as number | null,
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

    // 立即发起 page=1 查询（无 debounce）
    if (urlQ) {
      // 有搜索词：走 /search/multi
      void useTMDBStore.getState().search(urlQ, 1, { reset: true });
    } else if (filterValue.category === 'top') {
      void fetchTopRated(1, { reset: true });
    } else {
      void fetchDiscover(1, { reset: true });
    }
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

    setIsUpdating(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setIsUpdating(false);

      // 先同步 store 的 filterOptions，再发起第一页请求
      setFilter(toStoreFilter(filterValue));

      setIsRefreshing(true);
      try {
        if (filterValue.category === 'top') {
          // 排行榜：topUserFilterRef 已在 useBrowseData 内合并为 filterSig 变化即可重置
          await fetchTopRated(1, { reset: true });
        } else {
          await fetchDiscover(1, { reset: true });
        }
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [filterSig, urlQ, filterValue, setFilter, fetchDiscover, fetchTopRated]);

  // ── 4. 写回 URL（由调用方触发）─────────────────────
  const updateFilter = useCallback(
    (next: FilterBarValue) => {
      const params = serializeToUrl(next);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  // ── 5. 懒加载 ──────────────────────────────────────
  const loadMoreRef = useRef<number>(0);  // 上次触发时间戳
  const hasMore = discoverPagination.page < discoverPagination.totalPages;
  const isLoadingMore = loading.discover && discoverResults.length > 0;

  const loadMore = useCallback(() => {
    if (loading.discover) return;
    if (!hasMore) return;
    const now = Date.now();
    if (now - loadMoreRef.current < LOAD_MORE_THROTTLE_MS) return;
    loadMoreRef.current = now;

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

  return {
    filterValue,
    updateFilter,
    isUpdating,
    isRefreshing,
    loadMore,
    hasMore,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading: loading.discover,
    error: errors.discover,
  };
}

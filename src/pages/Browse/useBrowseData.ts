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
export function toStoreFilter(value: FilterBarValue) {
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

export function useBrowseData(query?: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── 1. URL → FilterBarValue ─────────────────────────
  const filterValue = useMemo<FilterBarValue>(
    () => parseFromUrl(searchParams),
    [searchParams],
  );
  const filterSig = useMemo(() => buildFilterSig(filterValue), [filterValue]);

  // ── 1b. 搜索词（从参数传入，不再从 URL 读取） ───────────
  // TMDB discover 端点不支持 query 文本搜索；q 不为空时调 /search/multi，
  // 走 store.search() 把结果写入 discoverResults。
  const urlQ = query?.trim() ?? '';

  // ── 2. store 状态（精确选择器，避免首页轮播更新触发无关重渲染） ──
  const discoverResults = useTMDBStore(s => s.discoverResults);
  const discoverPagination = useTMDBStore(s => s.discoverPagination);
  const discoverLastStatus = useTMDBStore(s => s.discoverLastStatus);
  const loading = useTMDBStore(s => s.loading);
  const errors = useTMDBStore(s => s.errors);
  const setFilter = useTMDBStore(s => s.setFilter);
  const fetchDiscover = useTMDBStore(s => s.fetchDiscover);
  const fetchTopRated = useTMDBStore(s => s.fetchTopRated);

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
  // 搜索模式（urlQ 非空）由父组件 Browse/index.tsx 统一触发 search()，
  // 此处仅处理 discover / top-rated 场景。
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    // 同步 store 中的 filterOptions（确保与 URL 一致）
    setFilter(toStoreFilter(filterValue));

    // 有搜索词时跳过：由父组件 search() 处理
    if (urlQ) return;

    // 首次进入页面，无论有无旧数据都显示 loading
    setIsRefreshing(true);
    hadOldDataRef.current = false;

    // 立即发起 page=1 查询（无 debounce）
    const fetchPromise = (() => {
      if (filterValue.category === 'top') {
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

  // ── 3b. 搜索词变化 ──────────────────────────────
  // q 变化时由父组件 Browse/index.tsx 的 useEffect 统一调用 search()，
  // 此处不再重复调用（避免两处独立 search 互相覆盖导致数据丢失）。
  // q 清空（undefined → ''）时由 filterSig effect 接管 discover。




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
  // 注意：discoverResults.length 不作为依赖——防止加载更多后 length 变化
  // 导致 effect 重跑、触发 reset 重拉第一页覆盖已有数据。
  // hadOldDataRef.current 通过下方 guard 前读取最新值即可。
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadMore = useCallback((searchQuery?: string) => {
    if (loading.discover) return;
    if (!hasMore) return;

    const nextPage = discoverPagination.page + 1;
    if (searchQuery) {
      useTMDBStore.getState().search(searchQuery, nextPage);
    } else if (filterValue.category === 'top') {
      fetchTopRated(nextPage);
    } else {
      fetchDiscover(nextPage);
    }
  }, [loading.discover, hasMore, discoverPagination.page, filterValue.category, fetchDiscover, fetchTopRated]);

  /**
   * 重试当前筛选条件下的首次加载（清空错误、强制 reset 拉 page=1）
   * 用于错误页"重试"按钮。无副作用,可在任意时刻调用,内部走 store 异步流程。
   */
  const retry = useCallback((searchQuery?: string) => {
    if (loading.discover) return;
    setFilter(toStoreFilter(filterValue));
    if (searchQuery) {
      void useTMDBStore.getState().search(searchQuery, 1, { reset: true });
    } else if (filterValue.category === 'top') {
      void fetchTopRated(1, { reset: true });
    } else {
      void fetchDiscover(1, { reset: true });
    }
  }, [loading.discover, filterValue, setFilter, fetchDiscover, fetchTopRated]);

  /**
   * 分类导航进入（Home CategoryQuickAccess → /browse?category=...）时的立即刷新。
   *
   * 背景：Keep-Alive 下 Browse 常驻挂载，URL 的 filterSig 变化本应走 filterSig
   * effect 的 300ms debounce —— 但 debounce 期间旧分类数据仍可见（「显示上一次数据
   * + 闪烁」）；且若残留搜索词，urlQ 非空会让 filterSig effect 直接 return、永不
   * 重新拉取（残留词导致数据定格）。
   *
   * refreshNow()：
   * - 同步 lastSigRef = 当前 filterSig → 清空 query 后 filterSig effect 重跑时命中
   *   `filterSig === lastSigRef` 直接 return，不会与本次刷新重复请求；
   * - setIsRefreshing(true) → UI 的 showResultsLoading 立即显示 loading 遮罩，
   *   旧数据被遮挡（无「旧数据闪现」）；
   * - 立即 fetchDiscover/TopRated(reset)（store 的 reset 同步清空 results + 置
   *   loading，paint 前即生效）。
   */
  const refreshNow = useCallback(() => {
    if (loading.discover) return; // 已有请求在飞，避免叠加
    lastSigRef.current = filterSig;
    hadOldDataRef.current = false;
    setIsRefreshing(true);
    setFilter(toStoreFilter(filterValue));
    const p = filterValue.category === 'top'
      ? fetchTopRated(1, { reset: true })
      : fetchDiscover(1, { reset: true });
    void (async () => {
      try {
        await p;
      } finally {
        if (isMountedRef.current) {
          // 与 filterSig effect 一致：等待新内容渲染完成后再隐藏 loading（150ms 防闪）
          await new Promise<void>((r) => setTimeout(r, 150));
          if (isMountedRef.current) {
            setIsRefreshing(false);
            hadOldDataRef.current = false;
          }
        }
      }
    })();
  }, [loading.discover, filterSig, filterValue, setFilter, fetchDiscover, fetchTopRated]);

  return {
    filterValue,
    updateFilter,
    isUpdating,
    isRefreshing,
    hadOldData: hadOldDataRef.current,
    loadMore,
    retry,
    refreshNow,
    hasMore,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading: loading.discover,
    error: errors.discover,
  };
}

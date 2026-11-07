/**
 * 筛选页数据流 Hook
 *
 * 职责：
 * 1. URL ↔ FilterBarValue 双向同步
 * 2. 筛选条件变化的 debounce 处理（只「对齐」store.filterOptions + 置 loading）
 * 3. 维护 loading 语义（isRefreshing / isUpdating）
 *
 * 设计：
 * - 单一来源：URL 是筛选状态的真相（refresh / 分享 / 前进后退 全部恢复）
 * - store 仅作为内存缓存层：discoverResults / discoverPagination 由 store 持有
 * - **取页唯一出口 = 逻辑分页层**（`useLogicalPage.goto` → `Browse/index.tsx` 的
 *   `fetchTmdbPage`）。本 hook 一律不直接发起 discover / top_rated / search 请求：
 *   本 hook 一拍、逻辑分页层又一拍，会让同一页被请求 2~3 次（重复请求的根因）。
 *   filterSig 变化时本 hook 只把新筛选「延迟写进」store.filterOptions，
 *   逻辑分页层的第一段等待（轮询 filterOptions 对齐）自然形成防抖。
 *
 * v6(2026-09-14)：移除本 hook 内的全部取页逻辑（mount 立即拉取 / filterSig 重置拉取 /
 *   refreshNow 立即拉取 / goToPage / loadMore / retry），收拢到逻辑分页层。
 * v5：移除骨架批次计数相关 effect（v3+v4 的内联骨架占位图已废弃）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterBarValue } from '@/components/FilterBar';
import { useTMDBStore } from '@/stores';
import { buildFilterSig } from '@/lib/filterSig';
import { SORT_OPTIONS } from './constants';
import { FILTER_DEBOUNCE_MS } from './constants';
import { parseFromUrl, serializeToUrl } from './urlState';

/**
 * discover 缓存回显 TTL（方案 B：无 Keep-Alive）
 * Browse 重新挂载时，若 store 已有「当前筛选条件」的成功结果且未超 TTL，直接回显、
 * 跳过重新请求；超过 TTL 则重新拉取（数据保鲜）。
 * 判定函数在 Browse/index.tsx 的 fetchTmdbPage 内共用（回显决策归取页方）。
 */
export const DISCOVER_CACHE_TTL_MS = 10 * 60 * 1000;

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

export function useBrowseData() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── 1. URL → FilterBarValue ─────────────────────────
  const filterValue = useMemo<FilterBarValue>(
    () => parseFromUrl(searchParams),
    [searchParams],
  );
  const filterSig = useMemo(() => buildFilterSig(filterValue), [filterValue]);

  // ── 2. store 状态（精确选择器，避免首页轮播更新触发无关重渲染） ──
  const discoverResults = useTMDBStore(s => s.discoverResults);
  const discoverPagination = useTMDBStore(s => s.discoverPagination);
  const discoverLastStatus = useTMDBStore(s => s.discoverLastStatus);
  const loading = useTMDBStore(s => s.loading);
  const errors = useTMDBStore(s => s.errors);
  const setFilter = useTMDBStore(s => s.setFilter);

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

  // 首次 mount：只做「filterOptions 对齐 + loading 置位」，**不再自行取页** ——
  // 取页唯一出口是逻辑分页层的 fetchTmdbPage（useLogicalPage.goto(1)）。
  // 这里若也发一次请求，会与 goto(1) 撞成「同一页 2 次请求」。
  // 方案 B（无 Keep-Alive）：重新挂载时若 store 已有「当前筛选条件」的成功结果
  // 且未超 TTL，首帧直接回显不置 loading（避免切回 Browse 时骨架闪一下）。
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    // 同步 store 中的 filterOptions（确保与 URL 一致）
    // ⚠️ 必须同步写：fetchTmdbPage 第一段在轮询 filterOptions 对齐，首屏若不对齐会空等。
    setFilter(toStoreFilter(filterValue));

    // 缓存回显判断：store 结果对应当前筛选条件且未过期 → 不置 loading，首帧直接回显
    const st = useTMDBStore.getState();
    const cachedFilter = st.discoverFetchedFilter;
    const cacheHit =
      st.discoverResults.length > 0 &&
      cachedFilter != null &&
      st.discoverFetchedAt > 0 &&
      Date.now() - st.discoverFetchedAt < DISCOVER_CACHE_TTL_MS &&
      JSON.stringify(cachedFilter) === JSON.stringify(toStoreFilter(filterValue));
    if (cacheHit) {
      hadOldDataRef.current = true;
      return;
    }

    // 无可用缓存：置 loading，等逻辑分页层取回第 1 页后由 endRefresh 收尾
    setIsRefreshing(true);
    hadOldDataRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选签名变化：debounce 后只把新筛选写进 store.filterOptions，**不发请求**。
  // 取页由逻辑分页层统一负责：contextKey 变化 → goto(1) → fetchTmdbPage 第一段
  // 轮询 filterOptions 对齐后才发请求 —— 这里「延迟对齐」等价于「延迟取页」，
  // 连点筛选只会有最后一次对齐生效，请求自然只发一次。
  // 搜索模式（关键词非空）同样走本分支：/search/multi 也由逻辑分页层发起。
  useEffect(() => {
    if (!initialFetchDoneRef.current) return;
    if (filterSig === lastSigRef.current) return;
    lastSigRef.current = filterSig;

    // 记录切换前是否有旧数据（loading 遮罩需要知道）
    hadOldDataRef.current = discoverResults.length > 0;
    setIsUpdating(true);
    setIsRefreshing(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsUpdating(false);
      // 对齐筛选参数：逻辑分页层此刻正卡在第一段轮询上等这一步。
      // loading 收尾不在本 hook —— 逻辑分页层装载完成后调 endRefresh()。
      setFilter(toStoreFilter(filterValue));
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  // 注意：discoverResults.length 不作为依赖——防止加载更多后 length 变化
  // 导致 effect 重跑、触发 reset 重拉第一页覆盖已有数据。
  // hadOldDataRef.current 通过下方 guard 前读取最新值即可。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig, filterValue, setFilter]);

  // ── 4. 写回 URL（由调用方触发）─────────────────────
  const updateFilter = useCallback(
    (next: FilterBarValue) => {
      const params = serializeToUrl(next);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  // ── 5. 取页状态 ────────────────────────────────────
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

  /**
   * 取页收尾：逻辑分页层装载完成（或本次取页被更晚的 goto 取代）后调用，关闭 loading 遮罩。
   *
   * ⚠️ 不做 150ms 缓冲（v6 变更）：原缓冲是为了等「fetch resolve → React 渲染新内容」
   * 两拍对齐；现在收尾紧跟在逻辑分页层的 setItems 之后（同一批状态更新、同帧渲染），
   * 缓冲只会白白多留一段「无骨架又无卡片」的空窗。
   */
  const endRefresh = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsRefreshing(false);
    hadOldDataRef.current = false;
  }, []);

  /**
   * 显式刷新（下拉刷新 / 从首页分类导航进入 → /browse?category=...）。
   *
   * 只做三件事，**不发请求**（请求由调用方紧接的 `goto(1, { force: true })` 发出）：
   * - 同步 lastSigRef = 当前 filterSig：避免 filterSig effect 再走一遍防抖分支；
   * - 立即对齐 filterOptions（调用方的 goto 会跳过防抖路径，这里同步写保证第一段等待
   *   立刻通过，无需再等 300ms）；
   * - setIsRefreshing(true) → UI 的 showResultsLoading 立即生效，旧数据被遮挡（无闪现）。
   */
  const refreshNow = useCallback(() => {
    lastSigRef.current = filterSig;
    hadOldDataRef.current = false;
    setIsRefreshing(true);
    setFilter(toStoreFilter(filterValue));
  }, [filterSig, filterValue, setFilter]);

  return {
    filterValue,
    updateFilter,
    isUpdating,
    isRefreshing,
    hadOldData: hadOldDataRef.current,
    refreshNow,
    endRefresh,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading: loading.discover,
    error: errors.discover,
  };
}

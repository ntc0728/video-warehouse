/**
 * 搜索中心 — 独立路由
 *
 * 双模式搜索：
 *  - 智能检索（TMDB searchMulti）
 *  - 直链搜索（CMS 源接口批量搜索）
 *
 * 数据流：URL ↔ useBrowseData（TMDB）/ useCMSSearch（CMS）
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import FilterBar, { type FilterBarValue } from '@/components/FilterBar';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { SourceStatusIndicator } from '@/components/SourceStatusIndicator';
import { SORT_OPTIONS } from '@/components/FilterBar/constants';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTMDBStore, useSettingsStore } from '@/stores';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getVideoSources } from '@/services/sourceService';
import type { VideoSourceConfig } from '@/types/source';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG, CATEGORY_LABELS } from './constants';
import { useBrowseData, toStoreFilter } from './useBrowseData';
import { useCMSSearch } from './useCMSSearch';
import BrowseGrid from './BrowseGrid';
import BrowseLoadMore from './BrowseLoadMore';
import BrowseMobileBar from './BrowseMobileBar';
import './Browse.css';
import { Icon } from "@/components/ui/Icon";

type SearchMode = 'smart' | 'cms';

export default function BrowsePage() {
  const isPhone = useIsMobileLayout();
  const isTV = useIsTV();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  /** POP 导航（刷新/直接访问/后退）：清空搜索词，避免 history.state 残留 */
  const isPop = navigationType === 'POP';
  const scrollContainerRef = useScrollContainer();
  const [searchMode, setSearchMode] = useState<SearchMode>('smart');

  useScrollRestore('browse');

  // ── 搜索词（优先从 location.state 读取，兜底兼容 ?q= 查询参数）──
  // createBrowserRouter 下 window.history.state 在刷新后被浏览器保留，
  // 导致 location.state.q 残留 → 顶部 SearchBox 显示上次的搜索词。
  // 仅在 PUSH 导航（从顶部 SearchBox 搜索进入）时读取搜索词；POP 时直接清空。
  const stateQ = (location.state as { q?: string } | null)?.q?.trim() ?? '';
  const urlQ = searchParams.get('q')?.trim() ?? '';
  // 从首页分类导航进入（Home CategoryQuickAccess → /browse?category=...）：
  // 顶部搜索框应清空（query state 常驻，若不处理会残留旧搜索词）
  const fromCategory = (location.state as { fromCategory?: boolean } | null)?.fromCategory === true;
  const [query, setQuery] = useState(() => {
    if (isPop) return '';
    return stateQ || urlQ || '';
  });

  // 从顶部导航搜索进入时，location.state 变化（组件可能已挂载），需主动同步搜索词
  useEffect(() => {
    // POP 导航（刷新/后退）不从 location.state / ?q= 恢复搜索词
    if (isPop) return;
    const q = stateQ || urlQ;
    if (q) {
      setQuery(q);
    }
  }, [stateQ, urlQ, isPop]);

  // ── 浏览器标签标题：挂载即写（无 Keep-Alive，页面卸载后标题由新页接管） ──
  useEffect(() => {
    document.title =
      searchMode === 'cms' && query ? `${query} - 搜索 - kinoTV` : '搜索 - kinoTV';
  }, [searchMode, query]);

  // ── TMDB 数据（智能检索）─────────────────────────
  const {
    filterValue,
    updateFilter,
    isRefreshing,
    refreshNow,
    loadMore: loadMoreTMDB,
    hasMore,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading,
    error,
  } = useBrowseData(query);

  // ── CMS 数据（直链搜索）─────────────────────────
  const {
    results: cmsResults,
    loading: cmsLoading,
    error: cmsError,
    hasMore: cmsHasMore,
    totalSources,
    completedSources,
    succeededSources,
    failedSources,
    search: searchCMS,
    loadMore: loadMoreCMS,
    reset: resetCMS,
  } = useCMSSearch();

  // ── 搜索触发 ────────────────────────────────────
  const lastCmsSearchedRef = useRef('');
  const lastSmartSearchedRef = useRef('');
  const filterSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSearch = useCallback((q: string, mode: SearchMode) => {
    if (!q) return;
    if (mode === 'cms') {
      // 搜索词未变化时不重复调用 CMS 查询接口（如切换"直链搜索"tab）
      if (lastCmsSearchedRef.current === q) return;
      lastCmsSearchedRef.current = q;
      searchCMS(q);
    } else {
      lastSmartSearchedRef.current = q;
      void useTMDBStore.getState().search(q, 1, { reset: true });
    }
  }, [searchCMS]);

  // ── 搜索模式切换 ────────────────────────────────
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (mode === 'cms') {
      if (query) {
        triggerSearch(query, 'cms');
      } else {
        // 搜索词已清空时切到「直链搜索」：无关键词可搜，清空残留的 CMS 结果
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
    } else if (query) {
      triggerSearch(query, 'smart');
    }
  }, [query, triggerSearch, resetCMS]);

  // ── 筛选条件变更：保留搜索词，重新触发搜索 ──────────
  const handleFilterChange = useCallback((next: FilterBarValue) => {
    updateFilter(next);
    // 同步更新 store 的 filterOptions，确保搜索结果按新筛选条件过滤
    useTMDBStore.getState().setFilter(toStoreFilter(next));
    // 有搜索词时防抖触发搜索，快速切换筛选时避免请求抖动
    if (query) {
      if (filterSearchTimerRef.current) clearTimeout(filterSearchTimerRef.current);
      filterSearchTimerRef.current = setTimeout(() => {
        triggerSearch(query, searchMode);
      }, 300);
    }
  }, [query, updateFilter, triggerSearch, searchMode]);

  // ── 注册顶部导航栏搜索回调 ──────────────────────
  const handlePageSearch = useCallback((q: string) => {
    setQuery(q);
    if (q) {
      triggerSearch(q, searchMode);
    } else {
      if (searchMode === 'smart') {
        lastSmartSearchedRef.current = '';
        if (filterValue.category === 'top') {
          void useTMDBStore.getState().fetchTopRated(1, { reset: true });
        } else {
          void useTMDBStore.getState().fetchDiscover(1, { reset: true });
        }
      } else {
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
    }
  }, [searchMode, triggerSearch, filterValue.category, resetCMS]);

  // [2026-08-13] 惰性 bootstrap video 场景：浏览页需要 video-sources.json（CMS 采集站配置）。
  // 不再由 main.tsx 全局拉取，改为场景级幂等触发（bootstrapScene 每场景仅执行一次）。
  useEffect(() => {
    void useSourceManagerStore.getState().bootstrapScene('video');
  }, []);

  useEffect(() => {
    if (location.pathname !== '/browse') return;
    const store = usePageSearchStore.getState();
    // 分类导航进入时写入空搜索词（不写残留 query），保证顶部搜索框为空
    store.setPageSearch(fromCategory ? '' : query, handlePageSearch, '搜索影片、剧集…');
    return () => { store.clearPageSearch(); };
  }, [query, handlePageSearch, location.pathname, fromCategory]);

  // 从顶部导航搜索进入：用 location.state 或 ?q= 中的最新搜索词触发搜索
  // 注意：必须读 stateQ/urlQ（同步变量）而非 query（异步 state）——
  // location.key 变化时 setQuery 尚未生效，query 仍是上一次的旧值。
  useEffect(() => {
    // POP 导航（刷新/后退）不触发搜索
    if (isPop) return;
    const q = stateQ || urlQ;
    if (q) {
      if (searchMode === 'smart') {
        void useTMDBStore.getState().search(q, 1, { reset: true });
        lastSmartSearchedRef.current = q;
      } else {
        searchCMS(q);
        lastCmsSearchedRef.current = q;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, isPop]);

  // ── 分类导航进入：清空残留搜索词 + 立即刷新（跳过 filterSig 300ms debounce）──
  // useLayoutEffect 保证绘制前完成：清空 query 后顶部搜索框首帧即为空、
  // refreshNow 同步清空 store 旧结果并置 loading，首帧即显示 loading 遮罩，
  // 不再出现「显示上一次数据 → 闪烁 → 才加载」。
  // handledRef 只消费「本次导航首次进入」：从 browse 进详情再返回时
  // location.state.fromCategory 随 history 恢复为 true，但不应再次触发刷新。
  const fromCategoryHandledRef = useRef(false);
  useLayoutEffect(() => {
    if (location.pathname !== '/browse') return;
    const fc = (location.state as { fromCategory?: boolean } | null)?.fromCategory === true;
    if (!fc || fromCategoryHandledRef.current) return;
    fromCategoryHandledRef.current = true;
    setQuery('');
    lastSmartSearchedRef.current = '';
    resetCMS();
    refreshNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.pathname]);

  // ── 懒加载触发 ──────────────────────────────────
  const loadMore = useCallback(() => {
    if (searchMode === 'cms') {
      loadMoreCMS(query);
    } else {
      loadMoreTMDB(query || undefined);
    }
  }, [searchMode, query, loadMoreCMS, loadMoreTMDB]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: searchMode === 'cms' ? cmsHasMore : hasMore,
    isLoading: searchMode === 'cms' ? cmsLoading : isLoadingMore,
    onLoadMore: loadMore,
    rootMargin: '100px',
    scrollContainerRef,
  });

  // ── genres & countries 兜底拉取（精确选择器） ──────────
  const movieGenres = useTMDBStore(s => s.movieGenres);
  const tvGenres = useTMDBStore(s => s.tvGenres);
  const fetchGenresAndCountries = useTMDBStore(s => s.fetchGenresAndCountries);
  useEffect(() => {
    if (movieGenres.length === 0 && tvGenres.length === 0) {
      fetchGenresAndCountries();
    }
  }, [movieGenres.length, tvGenres.length, fetchGenresAndCountries]);

  // ── 当前分类下的可选类型 ────────────────────────
  const currentGenres = useMemo<TMDBGenre[]>(() => {
    const cfg = CATEGORY_CONFIG[filterValue.category];
    if (cfg.genresSource === 'movie') return movieGenres;
    if (cfg.genresSource === 'tv') return tvGenres;
    const seen = new Set<string>();
    const merged: TMDBGenre[] = [];
    for (const g of [...movieGenres, ...tvGenres]) {
      const key = g.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push(g); }
    }
    return merged;
  }, [filterValue.category, movieGenres, tvGenres]);

  // ── 渲染分支 ────────────────────────────────────
  const excludedGenreIds = CATEGORY_CONFIG[filterValue.category]?.defaultGenreIds ?? [];
  const isSmartLoading = isRefreshing || isLoading;
  const isCmsLoading = cmsLoading;

  // 结果区局部 loading：搜索中且无数据时（有数据时不覆盖网格）
  // 切换筛选/排序 tab 时，store 的 reset 会同步清空 discoverResults，
  // 于是 isLoading=true 且 smartHasData=false → 直接显示「搜索中…」loading（无需额外遮罩）
  // isRefreshing 纳入判定：filterSig 变更（切分类/筛选）到新数据就绪期间立即显示
  // loading 遮罩，避免「旧数据闪现 300ms」（fetch 完成后 150ms 内复位）。
  const smartHasData = discoverResults.length > 0;
  const cmsHasData = cmsResults.length > 0;
  const showResultsLoading = searchMode === 'smart'
    ? (isRefreshing || (isLoading && !smartHasData))
    : (isCmsLoading && !cmsHasData);

  const isEmpty = !(searchMode === 'smart' ? isSmartLoading : isCmsLoading) && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0);
  const currentError = searchMode === 'smart' ? error : cmsError;

  // 逐源列表：供源状态弹层展示（与详情页源检测弹窗一致的逐源网格）
  const { videoSourceIds } = useSettingsStore();
  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>([]);
  useEffect(() => {
    let alive = true;
    getVideoSources().then((list) => {
      if (alive) setVideoSources(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  const cmsSourceList = useMemo(() => {
    const ids = videoSourceIds && videoSourceIds.length > 0 ? videoSourceIds : [];
    const nameMap = new Map(videoSources.map((s) => [s.id, s.name]));
    return ids
      .map((id) => nameMap.get(id) ?? `源${id}`)
      .map((name) => ({ name, available: !failedSources.includes(name) }));
  }, [videoSourceIds, videoSources, failedSources]);

  return (
    <div
      className={[
        'page-padding',
        'browse-page',
        'page-transition-enter--stagger',
        isPhone ? 'browse-page--mobile' : '',
        isTV ? 'browse-page--tv' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* 移动端命令栏（方案②）：仅真实手机 web / App 端，含模式切换段 */}
      {isPhone && (
        <BrowseMobileBar
          searchMode={searchMode}
          onModeChange={handleModeChange}
          filterBarProps={{
            value: filterValue,
            onChange: handleFilterChange,
            genres: currentGenres,
            excludedGenreIds,
            totalResults: discoverPagination.totalResults,
            categoryLabel: CATEGORY_LABELS[filterValue.category],
            hideFooter: true,
          }}
          allGenres={[...movieGenres, ...tvGenres]}
        />
      )}

      {/* Card 1：搜索区域（桌面端；移动端由命令栏接管） */}
      {!isPhone && (
        <div className="browse-card--search">
          {/* Tab 切换 */}
          <div className="browse-search-tabs">
            <button
              className={`browse-search-tab ${searchMode === 'smart' ? 'active' : ''}`}
              onClick={() => handleModeChange('smart')}
            >
              <Icon icon={Search} size="xs" />
              <span>智能检索</span>
            </button>
            <button
              className={`browse-search-tab ${searchMode === 'cms' ? 'active' : ''}`}
              onClick={() => handleModeChange('cms')}
            >
              <span>直链搜索</span>
            </button>
          </div>
          {/* 智能检索模式：FilterBar（footer 移到 Card 2） */}
          {searchMode === 'smart' && (
            <FilterBar
              value={filterValue}
              onChange={handleFilterChange}
              genres={currentGenres}
              excludedGenreIds={excludedGenreIds}
              totalResults={discoverPagination.totalResults}
              categoryLabel={CATEGORY_LABELS[filterValue.category]}
              hideFooter
            />
          )}
        </div>
      )}

      {/* Card 2：结果区域 */}
      <div className="browse-card--results">
        {/* 智能检索模式：排序 + 结果数 */}
        {searchMode === 'smart' && (
          <div className="browse-sort-bar">
            <div className="browse-sort-bar__tabs">
              {SORT_OPTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`browse-sort-bar__tab${filterValue.sortIdx === i ? ' browse-sort-bar__tab--active' : ''}`}
                  onClick={() => handleFilterChange({ ...filterValue, sortIdx: i })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="browse-sort-bar__count">
              共 {discoverPagination.totalResults.toLocaleString('zh-CN')} 条
            </span>
          </div>
        )}

        {/* 源状态指示器（仅直链搜索）：左侧结果数 + 右侧源状态 badge */}
        {searchMode === 'cms' && (
          <div className="browse-source-status-row">
            <span className="browse-results-count">
              结果数 <b>{cmsResults.length}</b>
            </span>
            <SourceStatusIndicator
              totalSources={totalSources}
              totalCompleted={completedSources}
              totalAvailable={succeededSources}
              error={cmsError}
              sources={cmsSourceList}
            />
          </div>
        )}

        {/* 结果主体：loading / 空状态 / 网格 / 懒加载 */}
        <div className="browse-results-body">
          {showResultsLoading && (
            <AppLoading tip="搜索中…" showTip />
          )}

          {!showResultsLoading && currentError && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0) && (
            <Empty title="暂无结果" description="尝试换个关键词搜索" />
          )}

          {!showResultsLoading && isEmpty && !currentError && (
            <Empty
              title="暂无结果"
              description={query ? '尝试换个关键词搜索' : '请输入关键词搜索'}
            />
          )}

          {!showResultsLoading && (searchMode === 'smart' ? (
            discoverResults.length > 0 ? (
              <BrowseGrid items={discoverResults} query={query} mode="smart" />
            ) : null
          ) : (
            cmsResults.length > 0 ? (
              <BrowseGrid cmsItems={cmsResults} query={query} mode="cms" />
            ) : null
          ))}

          {!showResultsLoading && (searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0) && (
            <BrowseLoadMore
              hasMore={searchMode === 'smart' ? hasMore : cmsHasMore}
              isLoading={searchMode === 'smart' ? isLoadingMore : cmsLoading}
              hasItems={searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0}
              isRefreshing={isRefreshing}
            />
          )}

          <div ref={sentinelRef} aria-hidden="true" />
        </div>
      </div>

      <BackToTopButton />
    </div>
  );
}

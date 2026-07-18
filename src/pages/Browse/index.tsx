/**
 * 搜索中心 — 独立路由
 *
 * 双模式搜索：
 *  - 智能检索（TMDB searchMulti）
 *  - 直链搜索（CMS 源接口批量搜索）
 *
 * 数据流：URL ↔ useBrowseData（TMDB）/ useCMSSearch（CMS）
 */
import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { Search } from 'lucide-react';
import FilterBar, { type FilterBarValue } from '@/components/FilterBar';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { SourceStatusIndicator } from '@/components/SourceStatusIndicator';
import { SORT_OPTIONS } from '@/components/FilterBar/constants';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDocumentTitle } from '@/hooks';
import { useTMDBStore } from '@/stores';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG, CATEGORY_LABELS } from './constants';
import { useBrowseData } from './useBrowseData';
import { useCMSSearch } from './useCMSSearch';
import BrowseGrid from './BrowseGrid';
import BrowseLoadMore from './BrowseLoadMore';
import './Browse.css';

type SearchMode = 'smart' | 'cms';

export default function BrowsePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const location = useLocation();
  const navigationType = useNavigationType();
  /** POP 导航（刷新/直接访问/后退）：清空搜索词，避免 history.state 残留 */
  const isPop = navigationType === 'POP';
  const scrollContainerRef = useScrollContainer();
  const [searchMode, setSearchMode] = useState<SearchMode>('smart');

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('browse');

  // ── 搜索词（从 location state 读取）──
  // createBrowserRouter 下 window.history.state 在刷新后被浏览器保留，
  // 导致 location.state.q 残留 → 顶部 SearchBox 显示上次的搜索词。
  // 仅在 PUSH 导航（从顶部 SearchBox 搜索进入）时读取搜索词；POP 时直接清空。
  const [query, setQuery] = useState(() => {
    if (isPop) return '';
    const state = location.state as { q?: string } | null;
    return state?.q?.trim() ?? '';
  });

  // Keep-Alive 下二次从顶部导航搜索进入时，location.state 变化但组件未重挂载，
  // 需主动同步搜索词到 query → 进而带入 Browse 页搜索框（defaultValue）
  const stateQ = (location.state as { q?: string } | null)?.q?.trim() ?? '';
  useEffect(() => {
    // POP 导航（刷新/后退）不从 location.state 恢复搜索词
    if (isPop) return;
    if (stateQ) {
      setQuery(stateQ);
    }
  }, [stateQ, isPop]);

  // ── 浏览器标签标题 ────────────────────────────────
  useDocumentTitle(searchMode === 'smart' && query ? null : undefined);
  useEffect(() => {
    if (searchMode === 'cms' && query) {
      document.title = `${query} - 搜索 - kinoTV`;
    }
  }, [searchMode, query]);

  // ── TMDB 数据（智能检索）─────────────────────────
  const {
    filterValue,
    updateFilter,
    isRefreshing,
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
    failedSources,
    totalSources,
    completedSources,
    succeededSources,
    sourcesDone,
    search: searchCMS,
    loadMore: loadMoreCMS,
    reset: resetCMS,
  } = useCMSSearch();

  // ── 搜索触发 ────────────────────────────────────
  const lastCmsSearchedRef = useRef('');
  const lastSmartSearchedRef = useRef('');

  const triggerSearch = useCallback((q: string, mode: SearchMode) => {
    if (!q) return;
    if (mode === 'cms') {
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
    if (query) {
      triggerSearch(query, mode);
    }
  }, [query, triggerSearch]);

  // ── 筛选条件变更：若当前有搜索词，先清空搜索词再更新筛选 ──────────
  // useBrowseData 的 filterSig effect 在有 urlQ 时会跳过 fetch，
  // 所以切换筛选/排序时必须清空 query，让 discover 接管。
  const handleFilterChange = useCallback((next: FilterBarValue) => {
    if (query) {
      setQuery('');
      lastSmartSearchedRef.current = '';
    }
    updateFilter(next);
  }, [query, updateFilter]);

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

  useEffect(() => {
    if (location.pathname !== '/browse') return;
    const store = usePageSearchStore.getState();
    store.setPageSearch(query, handlePageSearch, '搜索影片、剧集…');
    return () => { store.clearPageSearch(); };
  }, [query, handlePageSearch, location.pathname]);

  // 从顶部导航搜索进入 / Keep-Alive 二次进入：用 location.state 中的最新搜索词触发搜索
  // 注意：必须读 stateQ（同步变量）而非 query（异步 state）——
  // location.key 变化时 setQuery 尚未生效，query 仍是上一次的旧值。
  useEffect(() => {
    // POP 导航（刷新/后退）不触发搜索
    if (isPop) return;
    const q = stateQ;
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

  // ── genres & countries 兜底拉取 ──────────────────
  const { movieGenres, tvGenres, fetchGenresAndCountries } = useTMDBStore();
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
  const smartHasData = discoverResults.length > 0;
  const cmsHasData = cmsResults.length > 0;
  const showResultsLoading = searchMode === 'smart'
    ? (isLoading && !smartHasData)
    : (isCmsLoading && !cmsHasData);

  const isEmpty = !(searchMode === 'smart' ? isSmartLoading : isCmsLoading) && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0);
  const currentError = searchMode === 'smart' ? error : cmsError;

  return (
    <div
      className={[
        'page-padding',
        'browse-page',
        isMobile ? 'browse-page--mobile' : '',
        isTV ? 'browse-page--tv' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Card 1：搜索区域 */}
      <div className="browse-card--search">
        {/* Tab 切换 */}
        <div className="browse-search-tabs">
          <button
            className={`browse-search-tab ${searchMode === 'smart' ? 'active' : ''}`}
            onClick={() => handleModeChange('smart')}
          >
            <Search size={14} />
            智能检索
          </button>
          <button
            className={`browse-search-tab ${searchMode === 'cms' ? 'active' : ''}`}
            onClick={() => handleModeChange('cms')}
          >
            直链搜索
          </button>
        </div>
        {/* 智能检索模式：FilterBar（仅筛选行，footer 移到 Card 2） */}
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

        {/* 源状态指示器（仅直链搜索） */}
        {searchMode === 'cms' && (
          <SourceStatusIndicator
            totalSources={totalSources}
            completedSources={completedSources}
            succeededSources={succeededSources}
            failedSources={failedSources.length}
            totalResults={cmsResults.length}
            isLoading={!sourcesDone}
          />
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

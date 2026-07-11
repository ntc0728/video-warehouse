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
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import SearchBox from '@/components/SearchBox';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';
import { SourceStatusIndicator } from '@/components/SourceStatusIndicator';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDocumentTitle } from '@/hooks';
import { useTMDBStore } from '@/stores';
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
  const scrollContainerRef = useScrollContainer();
  const [searchMode, setSearchMode] = useState<SearchMode>('smart');

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('browse');

  // ── 搜索词（从 location state 读取）──
  const [query, setQuery] = useState(() => {
    const state = location.state as { q?: string } | null;
    return state?.q?.trim() ?? '';
  });

  // Keep-Alive 下二次从顶部导航搜索进入时，location.state 变化但组件未重挂载，
  // 需主动同步搜索词到 query → 进而带入 Browse 页搜索框（defaultValue）
  const stateQ = (location.state as { q?: string } | null)?.q?.trim() ?? '';
  useEffect(() => {
    if (stateQ) {
      setQuery(stateQ);
    }
  }, [stateQ]);

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

  // ── 搜索模式切换 ────────────────────────────────
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    // 切换模式时，若该模式尚未搜过当前 query 则触发搜索
    if (query) {
      if (mode === 'smart' && query !== lastSmartSearchedRef.current) {
        lastSmartSearchedRef.current = query;
        void useTMDBStore.getState().search(query, 1, { reset: true });
      } else if (mode === 'cms' && query !== lastCmsSearchedRef.current) {
        lastCmsSearchedRef.current = query;
        searchCMS(query);
      }
    }
  }, [query, searchCMS]);

  // ── 搜索触发 ────────────────────────────────────
  const lastCmsSearchedRef = useRef('');
  const lastSmartSearchedRef = useRef('');

  // 首次进入：根据初始 query 触发搜索
  const initialDoneRef = useRef(false);
  useEffect(() => {
    if (initialDoneRef.current) return;
    initialDoneRef.current = true;
    if (query) {
      if (searchMode === 'smart') {
        void useTMDBStore.getState().search(query, 1, { reset: true });
      } else {
        searchCMS(query);
      }
    }
  }, [query, searchMode, searchCMS]);

  // query 变化时触发搜索
  useEffect(() => {
    if (!initialDoneRef.current) return;
    if (!query) return;
    if (searchMode === 'cms') {
      if (query !== lastCmsSearchedRef.current) {
        lastCmsSearchedRef.current = query;
        searchCMS(query);
      }
    } else {
      if (query !== lastSmartSearchedRef.current) {
        lastSmartSearchedRef.current = query;
        void useTMDBStore.getState().search(query, 1, { reset: true });
      }
    }
  }, [query, searchMode, searchCMS]);

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

  // 「首屏/刷新」loading：仅在无数据可展示时才用整页 loading 覆盖内容。
  // 懒加载更多（已有数据在列）不再走整页 loading —— 否则网格会被卸载、内容高度骤减、
  // 滚动位置被浏览器夹回顶部，视觉上像是"新数据覆盖了旧数据/回到开头"。
  const smartInitialLoading = isRefreshing || (isLoading && discoverResults.length === 0);
  const cmsInitialLoading = isCmsLoading && cmsResults.length === 0;
  const showFullLoading = searchMode === 'smart' ? smartInitialLoading : cmsInitialLoading;

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
      {/* 搜索区域 */}
      <div className="browse-search-area">
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
        {/* 搜索框 */}
        <div className="browse-search-input-wrap">
          <SearchBox
            variant="browse"
            defaultValue={query}
            onSearch={(q) => {
              setQuery(q);
              if (!q) {
                if (searchMode === 'smart') {
                  if (filterValue.category === 'top') {
                    void useTMDBStore.getState().fetchTopRated(1, { reset: true });
                  } else {
                    void useTMDBStore.getState().fetchDiscover(1, { reset: true });
                  }
                } else {
                  resetCMS();
                }
              }
            }}
          />
        </div>
      </div>

      {/* 智能检索模式：FilterBar */}
      {searchMode === 'smart' && (
        <FilterBar
          value={filterValue}
          onChange={updateFilter}
          genres={currentGenres}
          excludedGenreIds={excludedGenreIds}
          totalResults={discoverPagination.totalResults}
          categoryLabel={CATEGORY_LABELS[filterValue.category]}
        />
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

      {/* 搜索加载中（仅首屏/刷新且无数据时；懒加载更多不覆盖已有网格） */}
      {showFullLoading && (
        <div className="browse-page__loading">
          <AppLoading tip="搜索中…" showTip />
        </div>
      )}

      {/* 错误 + 无数据 */}
      {currentError && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0) && (
        <Empty title="暂无结果" description="尝试换个关键词搜索" />
      )}

      {/* 完全无结果 */}
      {isEmpty && !currentError && (
        <Empty
          title="暂无结果"
          description={query ? '尝试换个关键词搜索' : '请输入关键词搜索'}
        />
      )}

      {/* 视频网格（懒加载更多时保持挂载，新数据追加到末尾，滚动位置不跳变） */}
      {searchMode === 'smart' ? (
        discoverResults.length > 0 && !smartInitialLoading ? (
          <BrowseGrid items={discoverResults} query={query} mode="smart" />
        ) : null
      ) : (
        cmsResults.length > 0 && (
          <BrowseGrid cmsItems={cmsResults} query={query} mode="cms" />
        )
      )}

      {/* 懒加载状态文案 */}
      {!(searchMode === 'smart' ? smartInitialLoading : false) && (searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0) && (
        <BrowseLoadMore
          hasMore={searchMode === 'smart' ? hasMore : cmsHasMore}
          isLoading={searchMode === 'smart' ? isLoadingMore : cmsLoading}
          hasItems={searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0}
          isRefreshing={isRefreshing}
        />
      )}

      {/* 懒加载哨兵：两种模式共用同一节点，置于内容末尾 —— 避免随模式切换卸载/重建
          导致 IntersectionObserver 观察到失效节点，同时让 CMS 直链搜索也走 IO 懒加载 */}
      <div ref={sentinelRef} aria-hidden="true" />

      <BackToTopButton />
    </div>
  );
}

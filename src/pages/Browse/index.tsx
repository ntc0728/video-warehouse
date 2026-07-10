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
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollContainerRef = useScrollContainer();
  const [searchMode, setSearchMode] = useState<SearchMode>('smart');

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('browse');

  // ── URL 搜索词 ────────────────────────────────────
  const urlQ = searchParams.get('q')?.trim() ?? '';

  // ── 浏览器标签标题 ────────────────────────────────
  // 智能检索模式使用 useDocumentTitle，直链搜索模式手动设置
  useDocumentTitle(searchMode === 'smart' && urlQ ? null : undefined);
  useEffect(() => {
    if (searchMode === 'cms' && urlQ) {
      document.title = `${urlQ} - 搜索 - kinoTV`;
    }
  }, [searchMode, urlQ]);

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
  } = useBrowseData();

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
  } = useCMSSearch();

  // ── 搜索模式切换 ────────────────────────────────
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    // 搜索触发由下方 useEffect 根据 lastCmsSearchedRef 统一管理
  }, []);

  // ── 搜索触发 ────────────────────────────────────
  // CMS 模式：搜索词变化时触发搜索，切换模式时搜索词不变不重复调用
  const lastCmsSearchedRef = useRef('');
  useEffect(() => {
    if (searchMode === 'cms' && urlQ) {
      if (urlQ !== lastCmsSearchedRef.current) {
        lastCmsSearchedRef.current = urlQ;
        searchCMS(urlQ);
      }
    }
  }, [urlQ, searchMode, searchCMS]);

  // ── 懒加载触发 ──────────────────────────────────
  const loadMore = useCallback(() => {
    if (searchMode === 'cms') {
      loadMoreCMS(urlQ);
    } else {
      loadMoreTMDB();
    }
  }, [searchMode, urlQ, loadMoreCMS, loadMoreTMDB]);

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
  const isSearchLoading = searchMode === 'smart' ? (isLoading || isRefreshing) : cmsLoading;

  const isEmpty = !isSearchLoading && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0);
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
            onSearch={(q) => {
              if (searchMode === 'cms') {
                searchCMS(q);
              } else {
                setSearchParams({ q }, { replace: true });
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

      {/* 搜索加载中 */}
      {isSearchLoading && (
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
          description={urlQ ? '尝试换个关键词搜索' : '请输入关键词搜索'}
        />
      )}

      {/* 视频网格 */}
      {searchMode === 'smart' ? (
        isRefreshing ? (
          <div className="browse-page__refreshing" aria-busy="true">
            <AppLoading tip="加载中…" showTip />
          </div>
        ) : discoverResults.length > 0 ? (
          <BrowseGrid items={discoverResults} query={urlQ} mode="smart" />
        ) : null
      ) : (
        cmsResults.length > 0 && (
          <BrowseGrid cmsItems={cmsResults} query={urlQ} mode="cms" />
        )
      )}

      {/* 懒加载 */}
      {!isRefreshing && <div ref={sentinelRef} aria-hidden="true" />}
      {!isRefreshing && (searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0) && (
        <BrowseLoadMore
          hasMore={searchMode === 'smart' ? hasMore : cmsHasMore}
          isLoading={searchMode === 'smart' ? isLoadingMore : cmsLoading}
          hasItems={searchMode === 'smart' ? discoverResults.length > 0 : cmsResults.length > 0}
          isRefreshing={isRefreshing}
        />
      )}

      <BackToTopButton />
    </div>
  );
}

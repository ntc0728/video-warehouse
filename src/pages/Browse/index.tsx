/**
 * 筛选页 — 独立路由
 *
 * 数据流：URL ↔ useBrowseData ↔ TMDBStore ↔ 后端
 *
 * 渲染层级：
 *   FilterBar           筛选条
 *   BrowseGrid          视频网格
 *   哨兵 + 文字态       独立 div,与 IPTV 风格一致
 *
 * 懒加载:哨兵 `<div ref={sentinelRef} />` + 文字态 `<BrowseLoadMore>`,
 *  与 IPTV 一样由本页 useInfiniteScroll 管理。rootMargin 100px。
 *
 * 多端适配：
 *  - 移动端：紧凑 padding / 较小字号
 *  - TV：放大字号
 *  - 所有客户端：筛选 chip 全部 wrap，不被截断
 */
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { Empty, BackToTopButton, AppLoading } from '@/components/common';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTMDBStore } from '@/stores';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG, CATEGORY_LABELS } from './constants';
import { useBrowseData } from './useBrowseData';
import BrowseGrid from './BrowseGrid';
import BrowseLoadMore from './BrowseLoadMore';
import './Browse.css';

export default function BrowsePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const [searchParams] = useSearchParams();
  const scrollContainerRef = useScrollContainer();

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('browse');

  // ── URL 搜索词 ────────────────────────────────────
  const urlQ = searchParams.get('q')?.trim() ?? '';

  // ── 数据 ─────────────────────────────────────────
  const {
    filterValue,
    updateFilter,
    isRefreshing,
    loadMore,
    retry,
    hasMore,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading,
    error,
  } = useBrowseData();

  // ── 懒加载触发（双保险:IO + scroll 兜底）────────────
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
    rootMargin: '100px',
    scrollContainerRef,
  });

  // genres & countries 兜底拉取（保证 FilterBar 渲染时有列表）
  const { movieGenres, tvGenres, fetchGenresAndCountries } = useTMDBStore();
  useEffect(() => {
    if (movieGenres.length === 0 && tvGenres.length === 0) {
      fetchGenresAndCountries();
    }
  }, [movieGenres.length, tvGenres.length, fetchGenresAndCountries]);

  // ── 当前分类下的可选类型（合并去重）───────────────
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
  const isFirstLoad = isLoading && discoverResults.length === 0;
  const isEmpty = !isLoading && !isRefreshing && discoverResults.length === 0;

  return (
    <div
      className={[
        'browse-page',
        isMobile ? 'browse-page--mobile' : '',
        isTV ? 'browse-page--tv' : '',
      ].filter(Boolean).join(' ')}
    >
      <FilterBar
        value={filterValue}
        onChange={updateFilter}
        genres={currentGenres}
        excludedGenreIds={excludedGenreIds}
        totalResults={discoverPagination.totalResults}
        categoryLabel={CATEGORY_LABELS[filterValue.category]}
      />

      {/* 首次加载：自定义loading */}
      {isFirstLoad && !isRefreshing && (
        <div className="browse-page__loading">
          <AppLoading tip="加载中…" showTip />
        </div>
      )}

      {/* 错误 + 无数据 */}
      {error && discoverResults.length === 0 && (
        <div className="browse-page__error">
          <AlertCircle size={32} className="browse-page__error-icon" />
          <p className="browse-page__error-text">{error}</p>
          <button
            type="button"
            className="browse-page__error-retry"
            onClick={retry}
          >
            重试
          </button>
        </div>
      )}

      {/* 完全无结果 */}
      {isEmpty && !error && (
        <Empty
          title="暂无结果"
          description="尝试调整筛选条件或更换分类"
        />
      )}

      {/* 切换筛选条件:用自定义loading替换 grid,新数据到达后再渲染 */}
      {isRefreshing ? (
        <div className="browse-page__refreshing" aria-busy="true">
          <AppLoading tip="加载中…" showTip />
        </div>
      ) : discoverResults.length > 0 ? (
        <BrowseGrid items={discoverResults} query={urlQ} />
      ) : null}

      {/* 懒加载:哨兵 always 挂载 + LoadMore 文字态(与 IPTV 风格一致) */}
      {!isRefreshing && <div ref={sentinelRef} aria-hidden="true" />}
      {!isRefreshing && discoverResults.length > 0 && (
        <BrowseLoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          hasItems={discoverResults.length > 0}
          isRefreshing={isRefreshing}
        />
      )}

      {/* 返回顶部按钮（主题感知：light/dark 阴影/边框自动切换） */}
      <BackToTopButton />
    </div>
  );
}

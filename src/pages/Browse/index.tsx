/**
 * 筛选页 — 独立路由
 *
 * 数据流：URL ↔ useBrowseData ↔ TMDBStore ↔ 后端
 *
 * 渲染层级：
 *   BrowseHeader        顶部（返回 + 分类标题 + 结果数）
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
import { AlertCircle } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { AppLoading, Empty, BackToTopButton } from '@/components/common';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTMDBStore } from '@/stores';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG } from './constants';
import { useBrowseData } from './useBrowseData';
import BrowseHeader from './BrowseHeader';
import BrowseGrid from './BrowseGrid';
import BrowseLoadMore from './BrowseLoadMore';
import './Browse.css';

export default function BrowsePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const scrollContainerRef = useScrollContainer();

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('browse');

  // ── 数据 ─────────────────────────────────────────
  const {
    filterValue,
    updateFilter,
    isRefreshing,
    hadOldData,
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
  // 哨兵由本页 useInfiniteScroll 自带的 sentinelRef 持有,在 JSX 中以
  //  `<div ref={sentinelRef} aria-hidden="true" />` 形式渲染,位于
  //  .browse-grid 外部,与 IPTV 风格完全一致。
  //  rootMargin 与 IPTV 保持一致:'100px'。
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
  const isEmpty = !isLoading && !isFirstLoad && discoverResults.length === 0;

  return (
    <div
      className={[
        'browse-page',
        isMobile ? 'browse-page--mobile' : '',
        isTV ? 'browse-page--tv' : '',
      ].filter(Boolean).join(' ')}
    >
      <BrowseHeader
        category={filterValue.category}
        totalResults={discoverPagination.totalResults}
        isLoading={isLoading && discoverResults.length === 0}
      />

      <FilterBar
        value={filterValue}
        onChange={updateFilter}
        genres={currentGenres}
        excludedGenreIds={excludedGenreIds}
      />

      {/* 首次加载：品牌 Loading */}
      {isFirstLoad && (
        <div className="browse-page__loading">
          <AppLoading tip="正在加载影片…" />
        </div>
      )}

      {/* 错误 + 无数据 */}
      {error && discoverResults.length === 0 && !isFirstLoad && (
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

      {/* 切换筛选条件:用 loading 替换 grid,新数据到达后再渲染 */}
      {isRefreshing && hadOldData ? (
        <div className="browse-page__refreshing" aria-busy="true">
          <AppLoading tip="正在应用筛选条件…" />
        </div>
      ) : discoverResults.length > 0 ? (
        <BrowseGrid items={discoverResults} />
      ) : null}

      {/* 懒加载:哨兵 always 挂载 + LoadMore 文字态(与 IPTV 风格一致)
          哨兵不再被 discoverResults.length > 0 门控：
          - 旧实现下"加载失败导致 discoverResults 为空"时哨兵永不挂载,错误恢复后
            也无法继续懒加载,用户体感"懒加载失效"。
          - 现在哨兵 always 在 DOM 中,IO 持续 observe;LoadMore 文字态在无数据时
            隐藏(避免显示"下滑加载更多"误导用户)。 */}
      <div ref={sentinelRef} aria-hidden="true" />
      {discoverResults.length > 0 && (
        <BrowseLoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          hasItems={discoverResults.length > 0}
        />
      )}

      {/* 返回顶部按钮（主题感知：light/dark 阴影/边框自动切换） */}
      <BackToTopButton />
    </div>
  );
}

/**
 * 首页 — HeroBanner + CategoryQuickAccess + 8 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 *
 * 7 客户端 · 3 主题感知
 */
import { useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useTMDBStore, useSettingsStore, useUserStore } from '@/stores';
import { BackToTopButton } from '@/components/common';
import TMDBMovieRow from '@/components/TMDBMovieRow';
import HeroBanner from '@/components/HeroBanner';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import CategoryQuickAccess from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useDocumentTitle } from '@/hooks';
import { useShallow } from 'zustand/react/shallow';
import './Home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('home');
  useDocumentTitle();

  useHeaderContent({ immersive: true });

  // 从设置 store 获取 TMDB Access Token
  const tmdbAccessToken = useSettingsStore((s) => s.tmdbAccessToken);

  // 使用 useShallow 一次性选多个字段,避免逐字段订阅模板代码膨胀;
  // 同时保证只在所选字段引用变化时才重渲染,降低主线程压力。
  // 注:故意不订阅 fetchAllHomeData —— 数据拉取由 App 启动时的 usePrefetch 统一负责,
  // 避免 HomePage mount 时无条件再跑一遍 checkToken() + 8 个 TMDB 请求。
  const {
    trending, nowPlaying, popularMovies, topRatedMovies,
    upcomingMovies, popularTv, topRatedTv, airingTodayTv,
    loading, errors,
  } = useTMDBStore(
    useShallow((s) => ({
      trending: s.trending,
      nowPlaying: s.nowPlaying,
      popularMovies: s.popularMovies,
      topRatedMovies: s.topRatedMovies,
      upcomingMovies: s.upcomingMovies,
      popularTv: s.popularTv,
      topRatedTv: s.topRatedTv,
      airingTodayTv: s.airingTodayTv,
      loading: s.loading,
      errors: s.errors,
    })),
  );

  // 历史记录：用于 Banner 中显示"继续播放"
  const history = useUserStore((s) => s.history);
  const historyMap = useMemo(() => {
    const map = new Map<string, (typeof history)[0]>();
    for (const h of history) {
      if (h.progress > 0) map.set(String(h.videoId), h);
    }
    return map;
  }, [history]);

  // ── 分类点击 → 跳到独立筛选页 ──────────────────────
  const handleCategorySelect = useCallback((cat: CategoryKey) => {
    const cfg = CATEGORY_CONFIG[cat];
    navigate(buildBrowseUrl(cat, cfg.defaultGenreIds), { viewTransition: true });
  }, [navigate]);

  // ── Banner 项点击 → 跳到详情页 ──────────────────────
  const handleBannerItemClick = useCallback((item: { id: string | number }) => {
    navigate(`/detail/${item.id}`, {
      state: { from: location.pathname + location.search },
      viewTransition: true,
    });
  }, [navigate, location.pathname, location.search]);

  // ── Banner 继续播放 → 直接跳到播放页 ──────────────────
  const handleContinuePlay = useCallback((item: { id: string | number }) => {
    navigate(`/play/${item.id}`, {
      state: { from: location.pathname + location.search },
      viewTransition: true,
    });
  }, [navigate, location.pathname, location.search]);

  // ── 状态 ──────────────────────────────────────────
  const hasToken = tmdbAccessToken.trim().length > 0;

  const hasAnyData =
    trending.length > 0 || nowPlaying.length > 0 || popularMovies.length > 0 ||
    topRatedMovies.length > 0 || upcomingMovies.length > 0 ||
    popularTv.length > 0 || topRatedTv.length > 0 || airingTodayTv.length > 0;

  const isInitialLoading =
    (loading.trending || loading.nowPlaying) &&
    !hasAnyData;

  // 所有请求都失败 + 无缓存数据
  const allFailed = (() => {
    if (hasAnyData) return null;
    const allLoading = loading.trending || loading.nowPlaying || loading.popularMovies ||
      loading.topRatedMovies || loading.upcomingMovies ||
      loading.popularTv || loading.topRatedTv || loading.airingTodayTv;
    if (allLoading) return null;
    const msgs = [
      errors.trending, errors.nowPlaying, errors.popularMovies,
      errors.topRatedMovies, errors.upcomingMovies,
      errors.popularTv, errors.topRatedTv, errors.airingTodayTv,
    ].filter(Boolean);
    return msgs.length > 0 ? [...new Set(msgs)][0] : null;
  })();

  if (!hasToken) {
    return (
      <div className="page-padding home-page">
        <div className="home-token-required">
          <AlertCircle size={48} className="home-token-required-icon" />
          <p className="home-token-required-text">
            TMDB Access Token 未配置，请在设置中
            <button
              className="home-token-required-link"
              onClick={() => navigate('/settings', { viewTransition: true })}
            >
              配置
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="page-padding home-page home-skeleton">
        <div className="home-skeleton-hero" />
        <div className="home-skeleton-categories">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="home-skeleton-category" />
          ))}
        </div>
        <div className="home-skeleton-rows">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="home-skeleton-row">
              <div className="home-skeleton-row-title" />
              <div className="home-skeleton-row-cards">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="home-skeleton-card">
                    <div className="home-skeleton-card-img" />
                    <div className="home-skeleton-card-title" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
      {!hasAnyData && allFailed && (
        <div className="home-empty" role="alert">
          <AlertCircle size={32} className="home-empty-icon" />
          <p className="home-empty-text">{allFailed}</p>
        </div>
      )}

      {/*
        trending 为空时 HeroBanner 仍渲染，内部用 EmptyState 占位。
      */}
      <HeroBanner
        items={trending}
        onItemClick={handleBannerItemClick}
        onContinuePlay={handleContinuePlay}
        historyMap={historyMap}
      />
      <CategoryQuickAccess onCategorySelect={handleCategorySelect} />
      <div className="home-rows page-padding">
        <TMDBMovieRow title="正在热映" items={nowPlaying} isLoading={loading.nowPlaying} error={errors.nowPlaying} />
        <TMDBMovieRow title="热门电影" items={popularMovies} isLoading={loading.popularMovies} error={errors.popularMovies} />
        <TMDBMovieRow title="高分电影" items={topRatedMovies} isLoading={loading.topRatedMovies} error={errors.topRatedMovies} />
        <TMDBMovieRow title="即将上映" items={upcomingMovies} isLoading={loading.upcomingMovies} error={errors.upcomingMovies} />
        <TMDBMovieRow title="热门剧集" items={popularTv} isLoading={loading.popularTv} error={errors.popularTv} />
        <TMDBMovieRow title="高分剧集" items={topRatedTv} isLoading={loading.topRatedTv} error={errors.topRatedTv} />
        <TMDBMovieRow title="今日播出" items={airingTodayTv} isLoading={loading.airingTodayTv} error={errors.airingTodayTv} />
      </div>

      <BackToTopButton />
    </div>
  );
}

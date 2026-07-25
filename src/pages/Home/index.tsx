/**
 * 首页 — HeroBanner + CategoryQuickAccess + 8 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 *
 * 7 客户端 · 3 主题感知
 */
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useTMDBStore, useSettingsStore, useUserStore } from '@/stores';
import { useHomeCategoryStore } from '@/stores/useHomeCategoryStore';
import { BackToTopButton, AppLoading } from '@/components/common';
import TMDBMovieRow from '@/components/TMDBMovieRow';
import HeroBanner from '@/components/HeroBanner';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import CategoryQuickAccess from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG as BROWSE_CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { CATEGORY_CONFIG, type HomeCategoryKey } from './categoryConfig';
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

  // ── 首页内容类目（侧边栏驱动，不跳页） ──────────────────
  const activeCategory = useHomeCategoryStore((s) => s.activeCategory);
  const loadCategory = useHomeCategoryStore((s) => s.loadCategory);
  const categoryData = useHomeCategoryStore((s) => s.data[activeCategory]);
  const isCategoryView = activeCategory !== 'home';

  // 进入类目视图时按需拉取数据（store 内带 10 分钟缓存）
  useEffect(() => {
    if (isCategoryView) loadCategory(activeCategory);
  }, [isCategoryView, activeCategory, loadCategory]);

  // Keep-Alive 切回时检查缓存是否过期，过期则重新加载
  // 覆盖场景：切换浏览器 Tab 返回时（visibilitychange）
  useEffect(() => {
    if (!isCategoryView) return;
    const CACHE_TTL = 10 * 60 * 1000;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const data = useHomeCategoryStore.getState().data[activeCategory];
        if (data?.fetchedAt && Date.now() - data.fetchedAt > CACHE_TTL) {
          loadCategory(activeCategory);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isCategoryView, activeCategory, loadCategory]);

  // 文档标题随类目变化（home 用默认标题）
  useDocumentTitle(
    isCategoryView
      ? CATEGORY_CONFIG[activeCategory as Exclude<HomeCategoryKey, 'home'>].label
      : undefined,
  );

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
    const cfg = BROWSE_CATEGORY_CONFIG[cat];
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

  // ── 首页自定义整页 loading（显示在骨架图之前） ──────────────
  // 目的：避免只靠骨架图占位——因数据常来自缓存/预取而瞬间就绪，骨架往往一闪而过甚至不出现。
  // 行为：首次进入首页时固定显示 MIN_MS 后放行——数据已就绪则直接显示内容，
  //       未就绪则交给后续可滚动的骨架屏分支接管。
  // 注意：不能等待接口返回才放行——无缓存时整页会被 AppLoading 阻塞
  //       （内容矮、无滚动条、下方行不渲染），详见问题修复记录。
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const MIN_MS = 500;
    const timer = window.setTimeout(() => setPageLoading(false), MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

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

  // 首页自定义 loading：内联居中于 home-page 容器内，显示在骨架图「之前」。
  // pageLoading 进入 '/' 即触发（含 keep-alive 切回），且至少停留 MIN_MS，
  // 故不会因缓存/预取秒回而只闪一次或不出现。
  if (pageLoading) {
    return (
      <div className="page-padding home-page home-page--loading">
        <AppLoading tip="精彩内容加载中…" />
      </div>
    );
  }

  // 首屏骨架（home 初始加载 或 类目首次加载共用，结构一致）
  const homeSkeleton = (
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

  if (isInitialLoading && !isCategoryView) return homeSkeleton;
  if (isCategoryView && !categoryData) return homeSkeleton;

  // ── 根据 activeCategory 计算 Hero + 7 行（结构固定，内容切换） ──
  const heroItems = isCategoryView ? (categoryData!.hero ?? []) : trending;

  const rowDefs = isCategoryView
    ? CATEGORY_CONFIG[activeCategory as Exclude<HomeCategoryKey, 'home'>].rows.map((r, i) => ({
        title: r.title,
        items: categoryData!.rows[i]?.items ?? [],
        isLoading: categoryData!.rows[i]?.loading ?? true,
        error: categoryData!.rows[i]?.error ?? null,
      }))
    : [
        { title: '正在热映', items: nowPlaying, isLoading: loading.nowPlaying, error: errors.nowPlaying },
        { title: '热门电影', items: popularMovies, isLoading: loading.popularMovies, error: errors.popularMovies },
        { title: '高分电影', items: topRatedMovies, isLoading: loading.topRatedMovies, error: errors.topRatedMovies },
        { title: '即将上映', items: upcomingMovies, isLoading: loading.upcomingMovies, error: errors.upcomingMovies },
        { title: '热门剧集', items: popularTv, isLoading: loading.popularTv, error: errors.popularTv },
        { title: '高分剧集', items: topRatedTv, isLoading: loading.topRatedTv, error: errors.topRatedTv },
        { title: '今日播出', items: airingTodayTv, isLoading: loading.airingTodayTv, error: errors.airingTodayTv },
      ];

  // ── 所有请求失败：只显示错误提示，不渲染 Hero/Categories/Rows ──
  if (!isCategoryView && !hasAnyData && allFailed) {
    return (
      <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
        <div className="home-empty" role="alert">
          <AlertCircle size={32} className="home-empty-icon" />
          <p className="home-empty-text">{allFailed}</p>
        </div>
        <BackToTopButton />
      </div>
    );
  }

  return (
    <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
      {/*
        trending / hero 为空时 HeroBanner 仍渲染；loading 期间显示骨架而非"暂无推荐"误导文字。
      */}
      <HeroBanner
        items={heroItems}
        onItemClick={handleBannerItemClick}
        onContinuePlay={handleContinuePlay}
        historyMap={historyMap}
        loading={isCategoryView ? (categoryData?.heroLoading ?? true) : loading.trending}
      />
      <CategoryQuickAccess
        onCategorySelect={handleCategorySelect}
        activeCategory={isCategoryView ? (activeCategory as CategoryKey) : null}
      />
      <div className="home-rows">
        {rowDefs.map((row) => (
          <TMDBMovieRow
            key={row.title}
            title={row.title}
            items={row.items}
            isLoading={row.isLoading}
            error={row.error}
          />
        ))}
      </div>

      <BackToTopButton />
    </div>
  );
}

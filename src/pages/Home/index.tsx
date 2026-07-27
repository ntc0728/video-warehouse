/**
 * 首页 — HeroBanner + CategoryQuickAccess + 8 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 *
 * 7 客户端 · 3 主题感知
 */
import { useRef, useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
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
  const navigate = useCustomNavigate();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  useSpatialNavigation({ containerRef: pageRef, isTV });
  useScrollRestore('home', undefined, location.pathname === '/');

  // ── 首页内容类目（侧边栏驱动，不跳页） ──────────────────
  // activeCategory：源值，驱动「数据预取 / 文档标题 / 侧边栏高亮」等紧急更新（不希望有延迟）。
  // deferredCategory：降优先级镜像，仅用于「页面内容渲染」。
  //   切换类目时源值立即提交（侧边栏高亮秒切），而 Hero + 7 行（≈50 卡片）的重新渲染被放入
  //   后台 transition 非阻塞执行，避免阻塞主线程导致高亮与交互出现卡顿/延迟。
  const activeCategory = useHomeCategoryStore((s) => s.activeCategory);
  const loadCategory = useHomeCategoryStore((s) => s.loadCategory);
  const deferredCategory = useDeferredValue(activeCategory);
  const categoryData = useHomeCategoryStore((s) => s.data[deferredCategory]);
  const isCategoryView = deferredCategory !== 'home';

  // 进入类目视图时按需拉取数据（store 内带 10 分钟缓存）
  // 用源值 activeCategory，确保点击类目即刻开始请求，不被 deferred 拖慢。
  useEffect(() => {
    if (activeCategory !== 'home') loadCategory(activeCategory);
  }, [activeCategory, loadCategory]);

  // Keep-Alive 切回时检查缓存是否过期，过期则重新加载
  // 覆盖场景：切换浏览器 Tab 返回时（visibilitychange）
  useEffect(() => {
    if (activeCategory === 'home') return;
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
  }, [activeCategory, loadCategory]);

  // 文档标题随类目变化（home 用默认标题）
  useDocumentTitle(
    activeCategory !== 'home'
      ? CATEGORY_CONFIG[activeCategory as Exclude<HomeCategoryKey, 'home'>].label
      : undefined,
  );

  useHeaderContent({ immersive: true });

  // ── 类目切换过渡：让整页图片（行海报、快捷分类）参与淡入 ─────────
  // 注：类目切换不再对整页内容做 opacity 淡入（home-cat-fade）。
  // 此前该淡入会让所有 .tmdb-movierow 容器（卡片盒）一起从 opacity:0 淡入，
  // 表现为「容器整体闪烁」。容器盒保持常驻不透明，图片由 LazyImage 的
  // blur-up / 会话缓存命中做平滑过渡，类目切换不再有容器闪跳。

  // 从设置 store 获取 TMDB Access Token
  const tmdbAccessToken = useSettingsStore((s) => s.tmdbAccessToken);

  // 使用 useShallow 一次性选多个字段,避免逐字段订阅模板代码膨胀;
  // 同时保证只在所选字段引用变化时才重渲染,降低主线程压力。
  // 注:故意不订阅 fetchAllHomeData —— 拉取由下方「按需兜底」effect 负责,
  // 仅在无数据且不在加载中时触发,避免有缓存时重复跑 checkToken() + 8 个 TMDB 请求。
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
    navigate(buildBrowseUrl(cat, cfg.defaultGenreIds));
  }, [navigate]);

  // ── Banner 项点击 → 跳到详情页 ──────────────────────
  const handleBannerItemClick = useCallback((item: { id: string | number }) => {
    navigate(`/detail/${item.id}`, {
      state: { from: location.pathname + location.search },
    });
  }, [navigate, location.pathname, location.search]);

  // ── Banner 继续播放 → 直接跳到播放页 ──────────────────
  const handleContinuePlay = useCallback((item: { id: string | number }) => {
    navigate(`/play/${item.id}`, {
      state: { from: location.pathname + location.search },
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

  // 按需兜底拉取首页数据：处于 home 视图、且任一区块为空时触发。
  // 注意：不能用 hasAnyData（含 trending）作为门槛——SearchBox 会独立拉取 trending
  // 并使其先加载，若据此跳过则其余 7 个「行区块」永远拿不到数据（banner 在、行不在）。
  // fetchAllHomeData 内部用 shouldFetch 只拉空区块，因此重复触发是安全的；
  // 仅当任一区块正在加载时跳过，避免叠加请求。
  useEffect(() => {
    if (!hasToken || isCategoryView) return;
    const s = useTMDBStore.getState();
    const anyEmpty =
      s.trending.length === 0 || s.nowPlaying.length === 0 ||
      s.popularMovies.length === 0 || s.topRatedMovies.length === 0 ||
      s.upcomingMovies.length === 0 || s.popularTv.length === 0 ||
      s.topRatedTv.length === 0 || s.airingTodayTv.length === 0;
    if (!anyEmpty) return;
    const anyLoading =
      s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
      s.loading.topRatedMovies || s.loading.upcomingMovies ||
      s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv;
    if (anyLoading) return;
    void s.fetchAllHomeData();
  }, [hasToken, isCategoryView, trending, nowPlaying, popularMovies, topRatedMovies, upcomingMovies, popularTv, topRatedTv, airingTodayTv]);

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
      <div className="page-padding home-page page-transition-enter">
        <div className="home-token-required">
          <AlertCircle size={48} className="home-token-required-icon" />
          <p className="home-token-required-text">
            TMDB Access Token 未配置，请在设置中
            <button
              className="home-token-required-link"
              onClick={() => navigate('/settings?tab=video')}
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
  // home-skeleton-hero 刻意与 HeroBanner 同构：左侧主图 + 右侧缩略图列，
  // 保证加载期缩略图骨架与 banner 同时出现（修复「缩略图骨架不和 banner 一起出现」）。
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton">
      <div className="home-skeleton-hero">
        <div className="home-skeleton-hero__banner" />
        <div className="home-skeleton-hero__thumbs">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="home-skeleton-hero__thumb" />
          ))}
        </div>
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
    ? CATEGORY_CONFIG[deferredCategory as Exclude<HomeCategoryKey, 'home'>].rows.map((r, i) => ({
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
      <div ref={pageRef} className={`page-padding home-page page-transition-enter${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
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
        categoryId={isCategoryView ? String(deferredCategory) : 'home'}
        onItemClick={handleBannerItemClick}
        onContinuePlay={handleContinuePlay}
        historyMap={historyMap}
        loading={isCategoryView ? (categoryData?.heroLoading ?? true) : loading.trending}
      />
      {/*
        页面进入动画（page-transition-enter）只作用于「非 Hero 内容」包装层：
        HeroBanner 自身有 background crossfade 与缩略图揭示等动画，其缩略图/背景层是
        GPU 合成层；若祖先带 transform 动画会触发合成层重绘闪烁（"闪一下"）。
        让 HeroBanner 作为本包装层的兄弟节点、祖先不再有 transform 动画，即可消除闪烁，
        同时下方内容仍保有进入淡入上移动画；Keep-Alive 二次进入由 AppLayout 回放机制
        递归命中本层 .page-transition-enter 重放，HeroBanner 不受影响、保持静止。
      */}
      <div className="home-page__content page-transition-enter">
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
    </div>
  );
}

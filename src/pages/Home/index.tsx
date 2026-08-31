/**
 * 首页 — HeroBanner + CategoryQuickAccess + 7 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 */
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { AlertCircle } from 'lucide-react';
import { useTMDBStore, useSettingsStore, useUserStore } from '@/stores';
import { HOME_TTL_MS } from '@/stores/useTMDBStore';
import { BackToTopButton, AppLoading } from '@/components/common';
import TMDBMovieRow from '@/components/TMDBMovieRow';
import HeroBanner from '@/components/HeroBanner';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import CategoryQuickAccess from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG as BROWSE_CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import { buildContinueItems } from './continueItems';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useShallow } from 'zustand/react/shallow';
import { usePullToRefresh } from '@/components/ui/PullToRefresh';
import './Home.css';
import { Icon } from "@/components/ui/Icon";

// I1（2026-08-04）：首页兜底拉取的「失败区块会话级冷却」——任一区块持续失败时，
// 只要其它区块数据变化（如 SearchBox 拉回 trending）就会重跑兜底 effect 并重新拉取
// 全部空区块，导致失败区块在单次会话内被反复无意义重试（Token 失效/整网不可达时尤其明显）。
// 方案：模块级 Map 记录各区块「上次失败时间」，冷却期（10min）内该区块不再被自动拉取；
// 区块恢复有数据后清除冷却（手动重试入口不受影响）。
const HOME_BLOCKS = [
  'trending', 'nowPlaying', 'popularMovies', 'topRatedMovies',
  'upcomingMovies', 'popularTv', 'topRatedTv', 'airingTodayTv',
] as const;
const HOME_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
const homeRetryCooldown = new Map<string, number>();

export default function HomePage() {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  useScrollRestore('home');

  // 下拉刷新：拉取全部首页数据
  usePullToRefresh(() => {
    void useTMDBStore.getState().fetchAllHomeData();
  });

  // 浏览器 Tab 切回时检查首页缓存是否过期，过期则重新加载（覆盖「停留 60min」之外的切 Tab 场景）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const s = useTMDBStore.getState();
      if (s.homeFetchedAt <= 0) return; // 从未拉取：交给「按需兜底」effect
      if (Date.now() - s.homeFetchedAt <= HOME_TTL_MS) return;
      const anyLoading =
        s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
        s.loading.topRatedMovies || s.loading.upcomingMovies ||
        s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv;
      if (anyLoading) return;
      void s.fetchAllHomeData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useHeaderContent({ immersive: true });

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
  // I2：首页数据 TTL 过期信号（订阅 homeFetchedAt，每次拉取完成后变化；
  // 定时器 effect 用它在「停留 60min 后」触发兜底刷新）
  const homeFetchedAt = useTMDBStore((s) => s.homeFetchedAt);

  // 继续观看行所需数据（必须在所有提前 return 之前调用，避免 hook 数随渲染分支变化而漂移）
  const history = useUserStore((s) => s.history);
  const userDataLoading = useUserStore((s) => s._loading);
  const historyMap = useMemo(() => {
    const map = new Map<string, (typeof history)[0]>();
    for (const h of history) {
      if (h.progress <= 0) continue;
      const key = String(h.videoId);
      const prev = map.get(key);
      if (!prev || (h.updatedAt ?? 0) > (prev.updatedAt ?? 0)) map.set(key, h);
    }
    return map;
  }, [history]);
  const continueItems = useMemo(() => buildContinueItems(history), [history]);

  // 事件 handler（同样须在提前 return 之前，保持 hook 数恒定）
  const handleBannerItemClick = useCallback((item: { id: string | number }) => {
    navigate(`/detail/${item.id}`, { state: { from: location.pathname + location.search } });
  }, [navigate, location.pathname, location.search]);

  const handleContinuePlay = useCallback((item: { id: string | number }) => {
    navigate(`/play/${item.id}`, { state: { from: location.pathname + location.search } });
  }, [navigate, location.pathname, location.search]);

  const handleCategorySelect = useCallback((cat: CategoryKey) => {
    const cfg = BROWSE_CATEGORY_CONFIG[cat];
    // fromCategory 标记：Browse 据此清空残留搜索词并立即刷新。
    navigate(buildBrowseUrl(cat, cfg.defaultGenreIds), { state: { fromCategory: true } });
  }, [navigate]);

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
  // I1（2026-08-04）：追加「失败冷却」——刚失败的区块 10min 内不计入 anyEmpty，
  // 避免其它区块数据变化时把失败区块反复重拉（见模块顶部 HOME_RETRY_COOLDOWN_MS）。
  // I2（2026-08-06）：追加 TTL——数据全满但距上次拉取 > 60min 时也触发 fetchAllHomeData
  // （内部 shouldFetch 会对过期区块重新拉取；loading 仅空区块置位，不会闪骨架）。
  useEffect(() => {
    if (!hasToken) return;
    const s = useTMDBStore.getState();
    // 更新冷却表：区块有数据 = 恢复成功，清除冷却；有错误且无记录 = 写入冷却起始时间
    for (const k of HOME_BLOCKS) {
      if (s[k].length > 0) homeRetryCooldown.delete(k);
      else if (s.errors[k] && !homeRetryCooldown.has(k)) homeRetryCooldown.set(k, Date.now());
    }
    const inCooldown = (k: (typeof HOME_BLOCKS)[number]) => {
      const t = homeRetryCooldown.get(k);
      return t != null && Date.now() - t < HOME_RETRY_COOLDOWN_MS;
    };
    // 任一「空且不在冷却中」的区块需要拉取
    const anyEmpty = HOME_BLOCKS.some((k) => s[k].length === 0 && !inCooldown(k));
    // 数据全满但 TTL 过期（homeFetchedAt>0 表示已成功拉取过）
    const ttlExpired = s.homeFetchedAt > 0 && Date.now() - s.homeFetchedAt > HOME_TTL_MS;
    if (!anyEmpty && !ttlExpired) return;
    const anyLoading =
      s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
      s.loading.topRatedMovies || s.loading.upcomingMovies ||
      s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv;
    if (anyLoading) return;
    void s.fetchAllHomeData();
  }, [hasToken, trending, nowPlaying, popularMovies, topRatedMovies, upcomingMovies, popularTv, topRatedTv, airingTodayTv, homeFetchedAt]);

  // I2：TTL 过期定时检查——若用户停留在首页超过 60min，
  // 用定时器兜底触发过期刷新（visibilitychange 只在切 Tab 时生效）。
  // 依赖 s 由组件订阅的 ttlExpiredSig 驱动；使用 store 模块级定时器避免每次渲染重建。
  useEffect(() => {
    if (!hasToken) return;
    const check = () => {
      const s = useTMDBStore.getState();
      if (s.homeFetchedAt <= 0) return;
      if (Date.now() - s.homeFetchedAt <= HOME_TTL_MS) return;
      const anyLoading =
        s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
        s.loading.topRatedMovies || s.loading.upcomingMovies ||
        s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv;
      if (anyLoading) return;
      void s.fetchAllHomeData();
    };
    // 挂载时立即补查一次，不依赖下一轮定时器
    check();
    const timer = setInterval(check, 60 * 1000);
    return () => clearInterval(timer);
  }, [hasToken]);

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
  // 8.3C：若「刚经历过 Suspense chunk fallback」（LoadingFallback 记录的时间戳，
  // 1s 内有效），则跳过固定 500ms 整页 loading——fallback 已提供过 loading，
  // 再叠加一次整页 AppLoading 即「加载两次」。无 fallback 时保持原 500ms 保证
  // loading 出现（避免骨架一闪而过）。时间戳超 1s 视为过期（不误跳过），
  // 消费后即清除，不影响后续进入。
  const [pageLoading, setPageLoading] = useState(() => {
    // 方案 B（无 Keep-Alive）：页面重新挂载时若 store 已有缓存数据，直接渲染，
    // 不再走固定 500ms 整页 loading（否则每次切回首页都闪一次整页 loading）。
    const marked = window.__kinoSuspenseFallback;
    window.__kinoSuspenseFallback = 0;
    const recentlyFellBack = typeof marked === 'number' && marked > 0 && Date.now() - marked < 1000;
    if (recentlyFellBack) return false;
    return !hasAnyData;
  });

  useEffect(() => {
    const MIN_MS = 500;
    const timer = window.setTimeout(() => setPageLoading(false), MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // ── 进入过渡相位控制：骨架覆盖 → 淡出 → 完成 ──
  // 目的：缓存数据场景下，进入首页时用骨架覆盖层遮挡内容，避免内容瞬间硬现。
  // 相：show 200ms（骨架完整显示）→ fade 600ms（覆盖层淡出，同时内容/hero 以
  // 200ms 延迟同步淡入——交叉淡化，无空白窗口）→ done（覆盖层卸载，内容自由渲染）。
  // 冷加载路径（pageLoading=true）由上方 isInitialLoading 分支直接返回，本段不生效。
  const [enterPhase, setEnterPhase] = useState<'skeleton' | 'fading' | 'done'>(
    () => (hasAnyData ? 'done' : 'skeleton'),
  );
  useEffect(() => {
    // 方案 B 二次进入（已访问路由，AppLayout data-revisit）：初始即 done，
    // 跳过 800ms 骨架覆盖层，内容立即呈现；t1 因函数式守卫直接 no-op。
    const SHOW_MS = 200;
    const FADE_MS = 600;
    const t1 = window.setTimeout(
      () => setEnterPhase((p) => (p === 'done' ? p : 'fading')),
      SHOW_MS,
    );
    const t2 = window.setTimeout(() => setEnterPhase('done'), SHOW_MS + FADE_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  if (!hasToken) {
    return (
      <div className="page-padding home-page">
        <div className="home-page__content page-transition-enter">
        <div className="home-token-required">
          {/* 主提示：居中展示 */}
          <div className="home-token-required__main">
            <Icon icon={AlertCircle} size="3xl" className="home-token-required-icon" />
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
        {/* 免责声明：位于 token 提示区下方，靠页面底部
            （token 区 flex:1 撑满后本元素自然贴底） */}
        <p className="home-disclaimer">
          免责声明：本项目为开源学习项目，仅用于技术交流。影视资源与播放地址来自网络公开渠道（CMS 采集站 / IPTV 直播源），版权归原权利人所有；TMDB 数据版权归 TMDB 所有。请勿用于商业用途，下载后请在 24 小时内删除。
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

  // 首屏骨架（仅 home 初始加载/整页无数据时使用，与分类切换无关）
  // home-skeleton-hero 刻意与 HeroBanner 同构：左侧主图 + 右侧缩略图列，
  // 保证加载期缩略图骨架与 banner 同时出现（修复「缩略图骨架不和 banner 一起出现」）。
  const homeSkeletonBody = (
    <>
      <div className="hero-banner__card">
        <div className="home-skeleton-hero">
          <div className="home-skeleton-hero__banner">
            {/* 内容占位：镜像 hero-banner__text — 标题 / 评分·年份·类型 / 简介（桌面端） */}
            <div className="home-skeleton-hero__content">
              <div className="home-skeleton-hero__title" />
              <div className="home-skeleton-hero__meta">
                <span className="home-skeleton-hero__meta-item home-skeleton-hero__meta-item--short" />
                <span className="home-skeleton-hero__meta-item home-skeleton-hero__meta-item--short" />
                <span className="home-skeleton-hero__meta-item home-skeleton-hero__meta-item--xs" />
              </div>
              <div className="home-skeleton-hero__desc" />
              <div className="home-skeleton-hero__desc home-skeleton-hero__desc--short" />
            </div>
          </div>
          <div className="home-skeleton-hero__thumbs">
            {/* 渲染 4 个，第 4 个由 CSS 控制：默认隐藏（3 张），大屏媒体查询显示（4 张），
                与 HeroBanner 的 maxCount（isWide ? 4 : 3）对齐 */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="home-skeleton-hero__thumb thumbnail-skeleton-bg" />
            ))}
          </div>
        </div>
      </div>
      <div className="home-skeleton-rows">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="home-skeleton-row">
            <div className="home-skeleton-row-title" />
            <div className="home-skeleton-row-cards">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="home-skeleton-card">
                  <div className="home-skeleton-card-img">
                    {/* 四角标占位：镜像 VideoCard — 左上评分 / 右上收藏 / 左下年份 / 右下类型 */}
                    <span className="home-skeleton-card-badge home-skeleton-card-badge--tl" />
                    <span className="home-skeleton-card-badge home-skeleton-card-badge--tr" />
                    <span className="home-skeleton-card-badge home-skeleton-card-badge--bl" />
                    <span className="home-skeleton-card-badge home-skeleton-card-badge--br" />
                  </div>
                  <div className="home-skeleton-card-title" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton">{homeSkeletonBody}</div>
  );

  // 首屏骨架（仅 home 初始加载/整页无数据时使用）
  if (isInitialLoading) return homeSkeleton;

  // ── 所有请求失败：只显示错误提示，不渲染 Hero/Categories/Rows ──
  if (!hasAnyData && allFailed) {
    return (
      <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
        <div className="home-page__content page-transition-enter">
          <div className="home-empty" role="alert">
            <Icon icon={AlertCircle} size="2xl" className="home-empty-icon" />
            <p className="home-empty-text">{allFailed}</p>
          </div>
        </div>
        <BackToTopButton />
      </div>
    );
  }

  // ── 首页内容（HeroBanner + 分类快捷入口 + 继续观看 + 7 行横滚）──
  // 分类切换已移除：点击 CategoryQuickAccess 卡片直接跳 /browse，不再在首页内切类目。
  // 注：history / userDataLoading / historyMap / continueItems 及三个事件 handler 的
  // hook 已上移至组件顶部（所有提前 return 之前），此处仅复用，避免 hook 数随分支漂移。

  const homeRows = [
    { title: '正在热映', items: nowPlaying, isLoading: loading.nowPlaying, error: errors.nowPlaying },
    { title: '热门电影', items: popularMovies, isLoading: loading.popularMovies, error: errors.popularMovies },
    { title: '高分电影', items: topRatedMovies, isLoading: loading.topRatedMovies, error: errors.topRatedMovies },
    { title: '即将上映', items: upcomingMovies, isLoading: loading.upcomingMovies, error: errors.upcomingMovies },
    { title: '热门剧集', items: popularTv, isLoading: loading.popularTv, error: errors.popularTv },
    { title: '高分剧集', items: topRatedTv, isLoading: loading.topRatedTv, error: errors.topRatedTv },
    { title: '今日播出', items: airingTodayTv, isLoading: loading.airingTodayTv, error: errors.airingTodayTv },
  ];

  return (
    <>
      {/* 进入过渡覆盖层：缓存数据场景下，首页从其他页切回时显示骨架覆盖 → 淡出 → 内容。
          仅在 enterPhase !== 'done' 时渲染（skeleton/fading），done 后自动卸载。
          position: fixed 以覆盖整个视口，不受 home-page relative 约束。 */}
      {enterPhase !== 'done' && (
        <div className={`home-enter-skeleton${enterPhase === 'fading' ? ' home-enter-skeleton--fading' : ''}`}>
          <div className="page-padding home-page home-skeleton">{homeSkeletonBody}</div>
        </div>
      )}
      <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
        <HeroBanner
          items={trending}
          onItemClick={handleBannerItemClick}
          onContinuePlay={handleContinuePlay}
          historyMap={historyMap}
          loading={loading.trending}
          initialEnterDelay={enterPhase !== 'done' ? 200 : 0}
        />
        <div className="home-page__content page-transition-enter home-page__content--delayed-enter">
          <CategoryQuickAccess onCategorySelect={handleCategorySelect} />
          {(userDataLoading || continueItems.length > 0) && (
            <div className="home-continue-row">
              <TMDBMovieRow
                title="继续观看"
                items={[]}
                continueMode
                continueItems={continueItems}
                isLoading={userDataLoading}
                skipAnimations
              />
            </div>
          )}
          <div className="home-rows">
            {homeRows.map((row, i) => (
              <TMDBMovieRow
                key={i}
                title={row.title}
                items={row.items}
                isLoading={row.isLoading}
                error={row.error}
                scrollResetToken="home"
                crossfadeOnChange
              />
            ))}
          </div>
          <BackToTopButton />
        </div>
      </div>
    </>
  );
}

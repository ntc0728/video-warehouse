/**
 * 首页 — HeroBanner + CategoryQuickAccess + 7 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 */
import { useRef, useState, useEffect, useCallback, useMemo, useDeferredValue, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { AlertCircle } from 'lucide-react';
import { useTMDBStore, useSettingsStore, useUserStore } from '@/stores';
import { HOME_TTL_MS } from '@/stores/useTMDBStore';
import { useHomeCategoryStore } from '@/stores/useHomeCategoryStore';
import { BackToTopButton, AppLoading } from '@/components/common';
import TMDBMovieRow from '@/components/TMDBMovieRow';
import HeroBanner from '@/components/HeroBanner';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { ActiveRouteContext } from '@/hooks/routeTitleContext';
import CategoryQuickAccess from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG as BROWSE_CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { CATEGORY_CONFIG, type HomeCategoryKey } from './categoryConfig';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import { buildContinueItems } from './continueItems';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useDocumentTitle } from '@/hooks';
import { useShallow } from 'zustand/react/shallow';
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
  // Keep-Alive 激活路由 key：Home 被 display:none 挂起时（用户在其他页面）
  // 不等于 '/'，用于阻止隐藏期间的定时器在后台触发 TTL 整批刷新。
  const activeRouteKey = useContext(ActiveRouteContext);

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
  // 类目：检查 useHomeCategoryStore 10min TTL；首页（activeCategory==='home'）：检查
  // useTMDBStore 首页 8 区块 60min TTL（数据全满时静默刷新，避免长会话内数据陈旧）。
  useEffect(() => {
    const CACHE_TTL = 10 * 60 * 1000;
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeCategory === 'home') {
        const s = useTMDBStore.getState();
        if (s.homeFetchedAt <= 0) return; // 从未拉取：交给「按需兜底」effect
        if (Date.now() - s.homeFetchedAt <= HOME_TTL_MS) return;
        const anyLoading =
          s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
          s.loading.topRatedMovies || s.loading.upcomingMovies ||
          s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv;
        if (anyLoading) return;
        void s.fetchAllHomeData();
      } else {
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
  // I2：首页数据 TTL 过期信号（订阅 homeFetchedAt，每次拉取完成后变化；
  // 定时器 effect 用它在「停留 60min 后」触发兜底刷新）
  const homeFetchedAt = useTMDBStore((s) => s.homeFetchedAt);

  // 历史记录：用于 Banner 中显示"继续播放"
  // 内存态 history 不保证按 updatedAt 排序（新记录 append、更新原地修改），
  // 电影线路独立后同一 videoId 可能存在多条记录，必须按 updatedAt 取最新，
  // 避免数组顺序覆盖导致取到旧线路/旧集的记录。
  const history = useUserStore((s) => s.history);
  // 首次 IndexedDB 加载中标志：加载中且有历史播放记录时，继续观看行显示骨架；
  // 加载完成仍无记录则整行隐藏（由下方 continueItems.length > 0 条件控制）。
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

  // 「继续观看」横排数据：取自历史中「有进度且未看完（<90%）」的最新记录，按 updatedAt 倒序。
  // 与 HeroBanner 的 historyMap 共用一份数据源，但排除已看完项并补全卡片所需字段。
  const continueItems = useMemo(() => buildContinueItems(history), [history]);

  // ── 分类点击 → 跳到独立筛选页 ──────────────────────
  const handleCategorySelect = useCallback((cat: CategoryKey) => {
    const cfg = BROWSE_CATEGORY_CONFIG[cat];
    // fromCategory 标记：Browse（Keep-Alive 常驻）据此清空残留搜索词并立即刷新，
    // 否则二次进入时 query state 残留 → 顶部搜索框残留旧词 + 数据不再重新拉取
    navigate(buildBrowseUrl(cat, cfg.defaultGenreIds), { state: { fromCategory: true } });
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
  // I1（2026-08-04）：追加「失败冷却」——刚失败的区块 10min 内不计入 anyEmpty，
  // 避免其它区块数据变化时把失败区块反复重拉（见模块顶部 HOME_RETRY_COOLDOWN_MS）。
  // I2（2026-08-06）：追加 TTL——数据全满但距上次拉取 > 60min 时也触发 fetchAllHomeData
  // （内部 shouldFetch 会对过期区块重新拉取；loading 仅空区块置位，不会闪骨架）。
  useEffect(() => {
    if (!hasToken || isCategoryView) return;
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
  }, [hasToken, isCategoryView, trending, nowPlaying, popularMovies, topRatedMovies, upcomingMovies, popularTv, topRatedTv, airingTodayTv, homeFetchedAt]);

  // I2：TTL 过期定时检查——Keep-Alive 下 Home 常驻挂载，若用户停留在首页超过 60min，
  // 用定时器兜底触发过期刷新（visibilitychange 只在切 Tab 时生效）。
  // 依赖 s 由组件订阅的 ttlExpiredSig 驱动；使用 store 模块级定时器避免每次渲染重建。
  // Keep-Alive 挂起（display:none，activeRouteKey !== '/'）时跳过检查：避免离开首页后
  // 定时器在后台触发整批 TMDB 请求（纯浪费配额）；重新激活时 effect 重跑并立即补查一次。
  useEffect(() => {
    if (!hasToken || isCategoryView) return;
    const check = () => {
      if (activeRouteKey !== '/') return;
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
    // 激活/重新激活（activeRouteKey 变回 '/'）时立即补查一次，不依赖下一轮定时器
    check();
    const timer = setInterval(check, 60 * 1000);
    return () => clearInterval(timer);
  }, [hasToken, isCategoryView, activeRouteKey]);

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
    const marked = window.__kinoSuspenseFallback;
    window.__kinoSuspenseFallback = 0;
    const recentlyFellBack = typeof marked === 'number' && marked > 0 && Date.now() - marked < 1000;
    return !recentlyFellBack;
  });

  useEffect(() => {
    const MIN_MS = 500;
    const timer = window.setTimeout(() => setPageLoading(false), MIN_MS);
    return () => window.clearTimeout(timer);
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

  // 首屏骨架（home 初始加载 或 类目首次加载共用，结构一致）
  // home-skeleton-hero 刻意与 HeroBanner 同构：左侧主图 + 右侧缩略图列，
  // 保证加载期缩略图骨架与 banner 同时出现（修复「缩略图骨架不和 banner 一起出现」）。
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton">
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
          // 选中态高亮全端移除（点击分类立即跳转 browse，选中态停留无意义）
          activeCategory={null}
        />
        {!isCategoryView && (userDataLoading || continueItems.length > 0) && (
          <TMDBMovieRow
            title="继续观看"
            items={[]}
            continueMode
            continueItems={continueItems}
            isLoading={userDataLoading}
          />
        )}
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

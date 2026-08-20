/**
 * 首页 — HeroBanner + CategoryQuickAccess + 7 行横滚数据
 *
 * 所有筛选相关逻辑已迁出至 /browse 独立路由页：
 *   点击分类 → navigate('/browse?category=xxx&...')
 */
import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, useDeferredValue } from 'react';
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
import CategoryQuickAccess from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG as BROWSE_CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { CATEGORY_CONFIG, type HomeCategoryKey } from './categoryConfig';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import { buildContinueItems } from './continueItems';
import { preloadRowCovers } from './preloadRowCovers';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useScrollContainer } from '@/hooks/useScrollContext';
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
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  useScrollRestore('home');

  // ── 首页内容类目（侧边栏驱动，不跳页） ──────────────────
  // activeCategory：源值，驱动「数据预取 / 文档标题 / 侧边栏高亮」等紧急更新（不希望有延迟）。
  // deferredCategory：降优先级镜像，仅用于「页面内容渲染」。
  //   切换类目时源值立即提交（侧边栏高亮秒切），而 Hero + 7 行（≈50 卡片）的重新渲染被放入
  //   后台 transition 非阻塞执行，避免阻塞主线程导致高亮与交互出现卡顿/延迟。
  const activeCategory = useHomeCategoryStore((s) => s.activeCategory);
  const loadCategory = useHomeCategoryStore((s) => s.loadCategory);
  const deferredCategory = useDeferredValue(activeCategory);
  const isCategoryView = deferredCategory !== 'home';

  // 注：isMobile / isTV 已下沉至 CategoryView 子组件（back/front 各需独立实例）。

  // ── 分类切换：单树直接渲染目标内容 ──
  // 经历三版迭代（保留旧内容→整页骨架硬插→双层 crossfade）后确定：
  //   整页子树替换 / 双层重叠 DOM 必然导致「banner 缩小 / 收尾时整树重挂载二次闪」。
  // 现采用单树 —— 直接用 deferredCategory 渲染单一 CategoryView：
  //   • 切换即时（deferred 仅做非阻塞降级，非「等数据」），无旧内容停留、无整页骨架；
  //   • banner 由 HeroBanner 内部 stale 垫底 + 新层淡入交叉过渡（不硬切、不缩小）；
  //   • 卡片图由 LazyImage 命中缓存也走淡入（见 LazyImage，消除缓存命中硬现）。
  // 后台非阻塞预热首屏卡片封面（仅加速后续滚动/二次进入，不 gate 切换）。
  useEffect(() => {
    if (deferredCategory === 'home') return;
    const cat = useHomeCategoryStore.getState().data[deferredCategory];
    if (cat) {
      void preloadRowCovers(cat.rows, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, [deferredCategory]);

  // ── 类目切换滚动复位（内容切换优先，2026-08-20）──
  // 用户诉求：向下滚一点再切分类 → 滚动条要复位，且**内容切换发生在滚动复位之前**。
  // 旧实现（HomeSidebar rAF 立即 scrollTo + setActiveCategory 100ms 防抖）是「先复位、
  // 后切换」——滚动跳顶时 DOM 还是旧分类，体感割裂。
  // 现由 deferredCategory 驱动：deferredCategory 变化 → 内容先以新分类提交渲染 →
  // 本 effect（DOM commit 后、绘制前）才执行 scrollTo(0)——「内容先切、滚动后复位」，
  // 且同帧原子生效，无可见中间跳变。prevRef 守卫：初次挂载 / 跨路由恢复（useScrollRestore）
  // 时跳过，避免覆盖已恢复的滚动位置。
  const scrollContainerRef = useScrollContainer();
  const prevScrollCatRef = useRef(deferredCategory);
  useLayoutEffect(() => {
    if (prevScrollCatRef.current === deferredCategory) return;
    prevScrollCatRef.current = deferredCategory;
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'auto' });
  }, [deferredCategory, scrollContainerRef]);

  // 进入类目视图时按需拉取数据（store 内带 10 分钟缓存）
  // 用源值 activeCategory，确保点击类目即刻开始请求，不被 deferred 拖慢。
  useEffect(() => {
    if (activeCategory !== 'home') loadCategory(activeCategory);
  }, [activeCategory, loadCategory]);

  // 页面重新挂载 / 浏览器 Tab 切回时检查缓存是否过期，过期则重新加载
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

  // 历史记录 / 继续观看 / Banner 点击处理器已迁移至 CategoryView 子组件
  // （back/front 各需独立实例，且须避免 HomePage 条件渲染导致 hooks 调用顺序变化）。

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

  // I2：TTL 过期定时检查——若用户停留在首页超过 60min，
  // 用定时器兜底触发过期刷新（visibilitychange 只在切 Tab 时生效）。
  // 依赖 s 由组件订阅的 ttlExpiredSig 驱动；使用 store 模块级定时器避免每次渲染重建。
  useEffect(() => {
    if (!hasToken || isCategoryView) return;
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
  }, [hasToken, isCategoryView]);

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
  // 目的：缓存数据场景下避免 heroBgFadeIn 与骨架消失同时发生导致"大片从骨架变图片"的闪烁。
  // 相：show 200ms（骨架完整显示）→ fade 600ms（覆盖层淡出）→ done（内容自由渲染）。
  // 冷加载路径（pageLoading=true）由上方 isInitialLoading 分支直接返回，本段不生效。
  const [enterPhase, setEnterPhase] = useState<'skeleton' | 'fading' | 'done'>('skeleton');
  useEffect(() => {
    const SHOW_MS = 200;
    const FADE_MS = 600;
    const t1 = window.setTimeout(() => setEnterPhase('fading'), SHOW_MS);
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
    </>
  );
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton">{homeSkeletonBody}</div>
  );

  // 首屏骨架（仅 home 初始加载/整页无数据时使用，与分类切换无关）
  if (isInitialLoading && !isCategoryView) return homeSkeleton;

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
        <CategoryView catKey={deferredCategory} animateEnter enterPhase={enterPhase} />
      </div>
    </>
  );
}

// ── 单个类目视图（hero + content + rows）──
// 被 HomePage 在「稳定态」或「crossfade 双层」中复用，故必须自给自足（不依赖 HomePage 的
// props/闭包 hook），否则在 back/front 各渲染一份时会触发 hooks 调用顺序变化或闭包陈旧。
// 首次无缓存时：本组件内 HeroBanner（loading=true → 骨架占位，placeholder 延续）+
// TMDBMovieRow（isLoading=true → SkeletonCards）自然呈现骨架，数据到达后组件内原位填充，
// 配合 HeroBanner 的图淡入与 VideoCard 的 animate-card-enter 完成「骨架→图」平滑过渡，
// 不再由外层整页 homeSkeleton 硬插。
function CategoryView({ catKey, animateEnter, enterPhase }: { catKey: HomeCategoryKey; animateEnter: boolean; enterPhase: 'skeleton' | 'fading' | 'done' }) {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const isCat = catKey !== 'home';

  const catData = useHomeCategoryStore((s) => s.data[catKey]);
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
  // 「继续观看」横排数据：取自历史中「有进度且未看完（<90%）」的最新记录，按 updatedAt 倒序。
  const continueItems = useMemo(() => buildContinueItems(history), [history]);

  useHeaderContent({ immersive: true });

  const heroItems = isCat ? (catData?.hero ?? []) : trending;
  const heroLoading = isCat ? (catData?.heroLoading ?? true) : loading.trending;

  const rowDefs = isCat
    ? CATEGORY_CONFIG[catKey as Exclude<HomeCategoryKey, 'home'>].rows.map((r, i) => ({
        title: r.title,
        items: catData?.rows[i]?.items ?? [],
        isLoading: catData?.rows[i]?.loading ?? true,
        error: catData?.rows[i]?.error ?? null,
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

  return (
    <>
      <HeroBanner
        items={heroItems}
        onItemClick={handleBannerItemClick}
        onContinuePlay={handleContinuePlay}
        historyMap={historyMap}
        loading={heroLoading}
        initialEnterDelay={enterPhase !== 'done' ? 800 : 0}
      />
      <div className={`home-page__content${animateEnter ? ' page-transition-enter home-page__content--delayed-enter' : ' home-page__content--delayed-enter'}`}>
        <CategoryQuickAccess onCategorySelect={handleCategorySelect} activeCategory={null} />
        {!isCat && (userDataLoading || continueItems.length > 0) && (
          <TMDBMovieRow
            title="继续观看"
            items={[]}
            continueMode
            continueItems={continueItems}
            isLoading={userDataLoading}
            skipAnimations={enterPhase !== 'done'}
          />
        )}
        <div className="home-rows">
          {/* 行以槽位索引为 key：分类切换时 7 行实例存活（仅 title/items 更新），
              配合卡片索引 key，整条链路实例复用 → 无重挂载闪烁，封面走交叉淡入。 */}
          {rowDefs.map((row, i) => (
            <TMDBMovieRow
              key={i}
              title={row.title}
              items={row.items}
              isLoading={row.isLoading}
              error={row.error}
              scrollResetToken={isCat ? catKey : 'home'}
              crossfadeOnChange
            />
          ))}
        </div>

        <BackToTopButton />
      </div>
    </>
  );
}

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
import type { HomeBlockKey } from '@/stores/useTMDBStore';
import { BackToTopButton, AppLoading, LazyBlock } from '@/components/common';
import TMDBMovieRow from '@/components/TMDBMovieRow';
import HeroBanner from '@/components/HeroBanner';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import CategoryQuickAccess, { CategoryHeatRow } from '@/components/CategoryQuickAccess';
import type { CategoryKey } from '@/components/CategoryQuickAccess';
import { CATEGORY_CONFIG as BROWSE_CATEGORY_CONFIG } from '@/pages/Browse/constants';
import { buildBrowseUrl } from '@/pages/Browse/urlState';
import { buildContinueItems } from './continueItems';
import HomeTopStrip from './HomeTopStrip';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useIsWideDesktop } from '@/hooks/useIsWideDesktop';
import { useGridCols } from '@/hooks/useGridCols';
import { useHeroSideCols } from '@/hooks/useHeroSideCols';
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

// ── 视口懒加载（2026-09-16）─────────────────────────────────────────
// 首屏档：Hero 用的 trending + 第一排「正在热映」(nowPlaying) —— 进页面即取，保证首屏不闪骨架。
// 视口档：其余 6 排等滚动接近才取（见 <LazyBlock>），进入视口前连接口都不发。
const HOME_FIRST_SCREEN_BLOCKS = ['trending', 'nowPlaying'] as const satisfies readonly HomeBlockKey[];
/** 行区块懒加载起始下标（homeRows[0] = 正在热映，属首屏档） */
const HOME_LAZY_FROM_ROW = 1;

type TMDBHomeState = ReturnType<typeof useTMDBStore.getState>;

/** 首页任一区块是否在加载中（原多处重复表达式收敛为单一判定） */
function anyHomeLoading(s: TMDBHomeState): boolean {
  return (
    s.loading.trending || s.loading.nowPlaying || s.loading.popularMovies ||
    s.loading.topRatedMovies || s.loading.upcomingMovies ||
    s.loading.popularTv || s.loading.topRatedTv || s.loading.airingTodayTv
  );
}

export default function HomePage() {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  // >1280 桌面（非 TV）：分类快捷入口上移到 Hero 上方（与 HeroBili 启用条件一致）
  const isWide = useIsWideDesktop();

  useScrollRestore('home');

  // 下拉刷新：强制重新拉取全部首页数据
  // 必须传 force：否则 fetchAllHomeData 内部按「数据空 或 60min TTL 过期」判定，
  // 数据齐全时整批请求都不会发出，用户看到「刷新成功」却零请求（伪刷新）。
  // 返回 Promise 让下拉浮层等到真实结束。
  usePullToRefresh(
    async () => {
      await useTMDBStore.getState().fetchAllHomeData({ force: true });
      // 2026-09-16：fetchAllHomeData 把各区块失败写进 errors 后**正常 resolve**（不 reject），
      // 且 TMDBMovieRow 只在 items 为空时才渲染错误行（TMDBMovieRow/index.tsx:437-448）——
      // 于是「已有旧数据 + 刷新整批失败」时用户完全看不到失败（浮层照样回弹「刷新成功」）。
      // 这里把「8 个区块全部失败」（典型场景：断网 / Token 失效）翻译成 reject，交由浮层统一 toast。
      // 只判全失败：局部失败在区块为空时已有行内错误文案，重复提示反而噪音。
      const errs = useTMDBStore.getState().errors;
      const failedAll = HOME_BLOCKS.every((k) => !!errs[k]);
      if (failedAll) throw new Error(errs.trending ?? '首页数据刷新失败');
    },
    { toastOnError: '刷新失败，请检查网络后重试' },
  );

  // 浏览器 Tab 切回时检查首页缓存是否过期，过期则重新加载（覆盖「停留 60min」之外的切 Tab 场景）
  // 2026-09-16 视口懒加载：只对「已加载（有数据）」的区块做 TTL 刷新（ensureHomeBlock 内部
  // 按区块 TTL 判定），未滚入视口的区块保持空白、由 <LazyBlock> 触发 —— 否则整批刷新会把
  // 懒加载省下的请求立刻补回来。
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const s = useTMDBStore.getState();
      if (anyHomeLoading(s)) return;
      for (const k of HOME_BLOCKS) {
        if (s[k].length > 0) void s.ensureHomeBlock(k);
      }
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
  // 注：不再订阅 homeFetchedAt —— 视口懒加载后 TTL 判定下沉到 store 的 ensureHomeBlock
  //（区块级时间戳），页面侧的定时器/visibility 只需遍历「已加载」区块触发即可。

  // 继续观看行所需数据（必须在所有提前 return 之前调用，避免 hook 数随渲染分支变化而漂移）
  const history = useUserStore((s) => s.history);
  const userDataLoading = useUserStore((s) => s._loading);
  // 顶部过渡带用：收藏条数（选择器返回原始值，引用稳定）
  const collectionCount = useUserStore((s) => s.collections.length);
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

  // 骨架占位张数所需的列数（须在提前 return 之前调用，保持 hook 数恒定）：
  //  - 横滚行骨架每行张数 = ceil(列数 × 1.5)：「填满一屏」的列数 + 半屏溢出，
  //    镜像真实行「一屏整卡 + 可横向滚」的观感；容器 overflow: hidden 会裁掉多余部分。
  //  - HeroBili 右栏卡 = 列数 × 2 行（useHeroSideCols 已是该区列数的 JS 真源）。
  const skeletonRowCols = useGridCols('--row-cols', 7);
  const heroSideCols = useHeroSideCols();
  const skeletonCardsPerRow = Math.ceil(skeletonRowCols * 1.5);

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

  // 按需兜底拉取（**仅首屏档**）：trending / nowPlaying 为空时补齐，保证进页面必有 Hero + 第一排。
  // 注意：不能用 hasAnyData（含 trending）作为门槛——SearchBox 会独立拉取 trending 并使其先加载，
  // 若据此跳过则第一排永远拿不到数据（banner 在、行不在）。
  // I1（2026-08-04）：「失败冷却」——刚失败的区块 10min 内不再重拉，避免其它区块数据变化时
  // 把失败区块反复重试（见模块顶部 HOME_RETRY_COOLDOWN_MS）。
  // 2026-09-16 视口懒加载：**范围收窄到首屏档**。原来「任一区块为空就 fetchAllHomeData」会让
  // 尚未滚入视口的 6 排被立即整批拉取，懒加载收益归零；这些行改由 <LazyBlock> 进入视口时
  // 各自 ensureHomeBlock。TTL 刷新也不再走这里（见下方定时器 / visibility 处理）。
  useEffect(() => {
    if (!hasToken) return;
    const s = useTMDBStore.getState();
    // 更新冷却表：区块有数据 = 恢复成功，清除冷却；有错误且无记录 = 写入冷却起始时间
    for (const k of HOME_FIRST_SCREEN_BLOCKS) {
      if (s[k].length > 0) homeRetryCooldown.delete(k);
      else if (s.errors[k] && !homeRetryCooldown.has(k)) homeRetryCooldown.set(k, Date.now());
    }
    const inCooldown = (k: HomeBlockKey) => {
      const t = homeRetryCooldown.get(k);
      return t != null && Date.now() - t < HOME_RETRY_COOLDOWN_MS;
    };
    const need = HOME_FIRST_SCREEN_BLOCKS.filter((k) => s[k].length === 0 && !inCooldown(k));
    if (need.length === 0) return;
    if (s.loading.trending || s.loading.nowPlaying) return;
    for (const k of need) void s.ensureHomeBlock(k);
  }, [hasToken, trending, nowPlaying, errors.trending, errors.nowPlaying]);

  // I2：TTL 过期定时检查——若用户停留在首页超过 60min，
  // 用定时器兜底触发过期刷新（visibilitychange 只在切 Tab 时生效）。
  // 2026-09-16 视口懒加载：只遍历「已加载（有数据）」区块，TTL 判定在 ensureHomeBlock 内
  // 按区块时间戳进行；不再整批 fetchAllHomeData（那会把未进视口的懒加载区块一并请求掉）。
  useEffect(() => {
    if (!hasToken) return;
    const check = () => {
      const s = useTMDBStore.getState();
      if (anyHomeLoading(s)) return;
      for (const k of HOME_BLOCKS) {
        if (s[k].length > 0) void s.ensureHomeBlock(k);
      }
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

  // 视口懒加载 + TV 焦点预加载：记录当前获得焦点的内容行下标（null = 尚未聚焦任何行）。
  // TV 端用方向键导航，焦点可能直接跳到尚未加载的行 → 按「焦点行 ±1 行」预加载（见 renderHomeRows）。
  const [tvFocusRow, setTvFocusRow] = useState<number | null>(null);

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
  // 2026-09-11（用户请求 6「不同视口显示相应的 UI 骨架」）：骨架按视口分两套——
  //   · <1024 / TV：与 HeroBannerClassic 同构 —— 卡片内 16:9 单图 banner + 7 行卡片
  //     （缩略图列已删除，骨架不再有缩略图槽）。
  //   · ≥1024 非 TV：与真实大屏布局同构 —— 顶部过渡带 + 两栏（左「今日趋势」榜卡 +
  //     右 HeroBili「banner + 右卡网格 + 换一换」）+ 7 行卡片。
  // 大屏骨架**直接复用真实布局类名**（.home-two-col / .hero-bili / .cqa-trend /
  // .hero-side-card），几何全部由既有 token 派生，杜绝「骨架与真实两套几何漂移」。
  const homeSkeletonRows = (
    <div className="home-skeleton-rows">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="home-skeleton-row">
          <div className="home-skeleton-row-title" />
          <div className="home-skeleton-row-cards">
            {Array.from({ length: skeletonCardsPerRow }).map((_, j) => (
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
  );
  // banner 内容占位（标题 / 评分·年份·类型 / 简介），两条骨架分支共用
  const homeSkeletonHeroContent = (
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
  );
  const homeSkeletonBody = isWide ? (
    <>
      {/* 顶部过渡带骨架（镜像 HomeTopStrip） */}
      <div className="home-skeleton-topstrip">
        <span className="home-skeleton-topstrip__item" />
        <span className="home-skeleton-topstrip__item home-skeleton-topstrip__item--sm" />
        <span className="home-skeleton-topstrip__item home-skeleton-topstrip__item--sm" />
      </div>
      <div className="home-two-col">
        {/* 左栏：今日趋势榜卡（复用真实 .cqa-trend 卡壳，只换行内容为骨架条） */}
        <aside className="home-two-col__rail">
          <div className="cqa-trend">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="home-skeleton-trend__row">
                <span className="home-skeleton-trend__rank" />
                <span className="home-skeleton-trend__poster" />
                <span className="home-skeleton-trend__body">
                  <span className="home-skeleton-trend__t" />
                  <span className="home-skeleton-trend__m" />
                </span>
              </div>
            ))}
          </div>
        </aside>
        {/* 右列：HeroBili 骨架（banner 槽 + 右卡网格 + 换一换占位） */}
        <div className="home-two-col__main">
          <section className="hero-bili">
            <div className="hero-bili__grid">
              <div className="hero-bili__banner home-skeleton-bili__banner">
                {homeSkeletonHeroContent}
              </div>
              <div className="hero-bili__right">
                <div className="hero-bili__cards">
                  {/* 张数 = useHeroSideCols() × 2 行（≥1281 为 3 列 = 6 张；
                      1024–1280 为 2 列 = 4 张），与真实 HeroBili 右栏列数同源 */}
                  {Array.from({ length: heroSideCols * 2 }).map((_, i) => (
                    <div key={i} className="hero-side-card">
                      <span className="hero-side-card__cover hero-side-card__cover--skeleton thumbnail-skeleton-bg" />
                      <span className="hero-side-card__title hero-side-card__title--skeleton thumbnail-skeleton-bg" />
                    </div>
                  ))}
                </div>
                <span className="hero-bili__shuffle home-skeleton-bili__shuffle" />
              </div>
            </div>
          </section>
          {homeSkeletonRows}
        </div>
      </div>
    </>
  ) : (
    <>
      <div className="hero-banner__card">
        <div className="home-skeleton-hero">
          <div className="home-skeleton-hero__banner">
            {homeSkeletonHeroContent}
          </div>
        </div>
      </div>
      {homeSkeletonRows}
    </>
  );
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton skeleton-scope">{homeSkeletonBody}</div>
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
    { key: 'nowPlaying' as const, title: '正在热映', items: nowPlaying, isLoading: loading.nowPlaying, error: errors.nowPlaying },
    { key: 'popularMovies' as const, title: '热门电影', items: popularMovies, isLoading: loading.popularMovies, error: errors.popularMovies },
    { key: 'topRatedMovies' as const, title: '高分电影', items: topRatedMovies, isLoading: loading.topRatedMovies, error: errors.topRatedMovies },
    { key: 'upcomingMovies' as const, title: '即将上映', items: upcomingMovies, isLoading: loading.upcomingMovies, error: errors.upcomingMovies },
    { key: 'popularTv' as const, title: '热门剧集', items: popularTv, isLoading: loading.popularTv, error: errors.popularTv },
    { key: 'topRatedTv' as const, title: '高分剧集', items: topRatedTv, isLoading: loading.topRatedTv, error: errors.topRatedTv },
    { key: 'airingTodayTv' as const, title: '今日播出', items: airingTodayTv, isLoading: loading.airingTodayTv, error: errors.airingTodayTv },
  ];

  // ── 行区块渲染（大屏两栏 / 单栏两条分支共用）───────────────────────
  // 视口懒加载：首屏档（homeRows[0] = 正在热映）立即渲染；其余 6 排等 <LazyBlock> 进入视口
  // 才解锁 —— 未解锁时传「空 items + isLoading」，由 TMDBMovieRow 渲染**等高**的
  // SkeletonCards（骨架卡与真卡同一 class，高度一致），避免滚动恢复时高度塌陷错位。
  // TV 端例外：方向键焦点可能直接跳到未加载行（骨架不可聚焦 → 焦点丢失），
  // 故按「焦点行 ±1 行」预加载（2026-09-16 拍板）。
  const renderHomeRows = () => (
    <div className="home-rows">
      {homeRows.map((row, i) => (
        <LazyBlock
          key={row.key}
          enabled={i >= HOME_LAZY_FROM_ROW}
          preload={isTV && tvFocusRow !== null && Math.abs(i - tvFocusRow) <= 1}
          onFocusRow={() => setTvFocusRow(i)}
          onEnter={() => void useTMDBStore.getState().ensureHomeBlock(row.key)}
        >
          {(entered) => (
            <TMDBMovieRow
              title={row.title}
              items={entered ? row.items : []}
              isLoading={entered ? row.isLoading : hasToken}
              error={entered ? row.error : null}
              scrollResetToken="home"
              crossfadeOnChange
            />
          )}
        </LazyBlock>
      ))}
    </div>
  );

  return (
    <>
      {/* 进入过渡覆盖层：缓存数据场景下，首页从其他页切回时显示骨架覆盖 → 淡出 → 内容。
          仅在 enterPhase !== 'done' 时渲染（skeleton/fading），done 后自动卸载。
          position: fixed 以覆盖整个视口，不受 home-page relative 约束。 */}
      {enterPhase !== 'done' && (
        <div className={`home-enter-skeleton${enterPhase === 'fading' ? ' home-enter-skeleton--fading' : ''}`}>
          <div className="page-padding home-page home-skeleton skeleton-scope">{homeSkeletonBody}</div>
        </div>
      )}
      <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}`}>
        {isWide ? (
          /* ── 大屏两栏（2026-09-10 用户拍板「方案 C」）──────────────
             过渡带通栏横跨两栏；左栏 = 分类热度榜（sticky）；右列 = Hero + 内容行。
             ⚠️ HeroBanner 的祖先绝不能带 transform 动画（其缩略图/背景是 GPU 合成层，
             祖先 transform 会触发重绘闪烁，见 docs/agents/patterns.md「页面进入过渡统一约定」）。
             因此 `.home-page__content` 的进入动画只包内容行，Hero 与其平级放在 __main 内。 */
          <>
          <HomeTopStrip
            continueCount={continueItems.length}
            favoriteCount={collectionCount}
          />
          <div className="home-two-col">
            <aside className="home-two-col__rail">
              <CategoryHeatRow variant="rail" />
            </aside>
            <div className="home-two-col__main">
              <HeroBanner
                items={trending}
                onItemClick={handleBannerItemClick}
                onContinuePlay={handleContinuePlay}
                historyMap={historyMap}
                loading={loading.trending}
                initialEnterDelay={enterPhase !== 'done' ? 200 : 0}
              />
              <div className="home-page__content page-transition-enter home-page__content--delayed-enter">
                {/* 2026-09-06 调换：个人内容（继续观看）贴顶优先于探索型（分类热度榜），行业范式同向 */}
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
                {renderHomeRows()}
                <BackToTopButton />
              </div>
            </div>
          </div>
          </>
        ) : (
          <>
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
              {/* 2026-09-06 调换：个人内容（继续观看）贴顶优先于探索型（分类热度榜），行业范式同向 */}
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
              {renderHomeRows()}
              <BackToTopButton />
            </div>
          </>
        )}
      </div>
    </>
  );
}

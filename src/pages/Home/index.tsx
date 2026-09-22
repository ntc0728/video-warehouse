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
import { BackToTopButton, LazyBlock } from '@/components/common';
import TMDBMovieRow, { SkeletonCards } from '@/components/TMDBMovieRow';
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
  // 「继续观看」行存在条件（单真源，骨架与真实页共用）：骨架此前无条件预告该行，
  // 无观看历史的用户 DB 读完后真实页无此行 → 骨架→真实切换时整行消失、下方内容
  // 上移约一行高（2026-09-22 用户确认的同构缺口）。镜像同一条件后：有历史恒在；
  // 无历史在骨架期提前收行，切换时几何与真实页逐像素一致，零位移。
  const showContinueRow = userDataLoading || continueItems.length > 0;

  // HeroBili 右栏卡张数 = 列数 × 2 行（useHeroSideCols 已是该区列数的 JS 真源）。
  // 横滚行骨架不再自己算张数：2026-09-18 起骨架直接渲染真实 <TMDBMovieRow>，
  // 其内部 SkeletonCards 已按 --row-cols / --continue-cols 派生张数。
  const heroSideCols = useHeroSideCols();

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

  // ⚠️ 2026-09-22 用户报「banner 骨架异常超大纯黑块占满视口剩余高」的根因：
  //   hero 主体是 trending，旧条件只看 !hasAnyData——nowPlaying 先到就提前切主树，
  //   此时 trending 仍空 → HeroBanner 宽屏「空数据回落 Classic」渲染**全宽 16:9 纯黑块**
  //   （@1440 高 ≈742 / @1920 ≈967），trending 到达后切回 HeroBili（≈255）瞬间回缩。
  //   修正：trending 未落地前维持整屏骨架（hero 槽同构小尺寸），切主树时 HeroBanner
  //   必有数据；后台刷新（trending 已有数据重拉）不受影响。
  //
  // ⚠️ 2026-09-22 用户报「首页骨架显示之后会立即消失然后显示真实页面结构，闪烁」的根因：
  //   旧条件 (loading.trending || loading.nowPlaying) && ... 依赖 loading 标志，但 React
  //   首帧 useEffect 还没跑，loading.trending/nowPlaying 都是 false（store 初始态）→
  //   首帧 isInitialLoading=false 走主树空态（HeroBannerClassic「暂无推荐」）→ useEffect
  //   触发 fetch 后 loading=true 切骨架 → 数据到达切主树，造成「boot-splash 骨架 →
  //   主树空态（一帧）→ homeSkeleton → 主树真实」的闪烁。
  //   修正：不依赖 loading 标志，改为「trending 空 且 未失败」即骨架，首帧即进骨架分支，
  //   与 boot-splash 同构骨架无缝衔接。例外：有其他区块数据且首屏档不在加载（trending
  //   请求成功但返回空数组的极罕见情况）→ 主树，避免卡骨架。
  const anyLoading =
    loading.trending || loading.nowPlaying || loading.popularMovies ||
    loading.topRatedMovies || loading.upcomingMovies ||
    loading.popularTv || loading.topRatedTv || loading.airingTodayTv;
  const isInitialLoading =
    trending.length === 0 &&
    !errors.trending &&
    !(hasAnyData && !anyLoading);

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

  // ── 首页整页 plain loading 已删除（2026-09-22 用户反馈「plain 骨架覆盖」）────
  // 旧机制：首进无数据时固定显示 500ms AppLoading（纯文字+进度条）再进骨架，
  // 初衷是防「数据秒回时骨架一闪而过」；现启动骨架 #boot-splash（home 同构）→
  // homeSkeleton / enterPhase 骨架覆盖已无缝衔接，plain 插在中间反而把同构骨架
  // 拦腰打断。配套的 8.3C（Suspense fallback 时间戳跳过 500ms）一并退役。

  // ── 进入过渡相位控制：骨架覆盖 → 淡出 → 完成 ──
  // 目的：缓存数据场景下，进入首页时用骨架覆盖层遮挡内容，避免内容瞬间硬现。
  // 相：show 200ms（骨架完整显示）→ fade 600ms（覆盖层淡出，同时内容/hero 以
  // 200ms 延迟同步淡入——交叉淡化，无空白窗口）→ done（覆盖层卸载，内容自由渲染）。
  // ⚠️ 冷启动（先渲染过 isInitialLoading 整屏骨架）不适用本覆盖层：数据到达时内容位置
  //   已被骨架预告，再叠一层 = 标题/继续观看行渲染两遍、入场动画播两遍（用户 2026-09-22
  //   报「显示两次 → 抖动」根因）。coldSkeletonShownRef 命中时：不渲染覆盖层、
  //   hero 不再延迟淡入、根容器加 --from-skeleton 禁用层动画（见 Home.css）。
  const [enterPhase, setEnterPhase] = useState<'skeleton' | 'fading' | 'done'>(
    () => (hasAnyData ? 'done' : 'skeleton'),
  );
  // 冷启动是否渲染过整屏骨架（isInitialLoading 分支）——命中则禁用 enterPhase 覆盖层与层入场动画
  const coldSkeletonShownRef = useRef(false);
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

  // ── 首页内容行定义（顺序 = 真实渲染顺序）─────────────────────────────
  // 骨架与真实行**共用这一份定义**（2026-09-18）：骨架取 title 渲染真实的
  // <TMDBMovieRow isLoading>，真实分支取 items / isLoading / error。
  // 七行标题与顺序从此只有一处真源，不再出现「骨架写死 7 行、真实改了行数」的漂移。
  const homeRows = [
    { key: 'nowPlaying' as const, title: '正在热映', items: nowPlaying, isLoading: loading.nowPlaying, error: errors.nowPlaying },
    { key: 'popularMovies' as const, title: '热门电影', items: popularMovies, isLoading: loading.popularMovies, error: errors.popularMovies },
    { key: 'topRatedMovies' as const, title: '高分电影', items: topRatedMovies, isLoading: loading.topRatedMovies, error: errors.topRatedMovies },
    { key: 'upcomingMovies' as const, title: '即将上映', items: upcomingMovies, isLoading: loading.upcomingMovies, error: errors.upcomingMovies },
    { key: 'popularTv' as const, title: '热门剧集', items: popularTv, isLoading: loading.popularTv, error: errors.popularTv },
    { key: 'topRatedTv' as const, title: '高分剧集', items: topRatedTv, isLoading: loading.topRatedTv, error: errors.topRatedTv },
    { key: 'airingTodayTv' as const, title: '今日播出', items: airingTodayTv, isLoading: loading.airingTodayTv, error: errors.airingTodayTv },
  ];

  // 首屏骨架（仅 home 初始加载/整页无数据时使用，与分类切换无关）
  // 2026-09-11（用户请求 6「不同视口显示相应的 UI 骨架」）：骨架按视口分两套——
  //   · <1024 / TV：与 HeroBannerClassic 同构 —— 卡片内 16:9 单图 banner + 7 行卡片
  //     （缩略图列已删除，骨架不再有缩略图槽）。
  //   · ≥1024 非 TV：与真实大屏布局同构 —— 顶部过渡带 + 两栏（左「今日趋势」榜卡 +
  //     右 HeroBili「banner + 右卡网格 + 换一换」）+ 7 行卡片。
  //
  // ⚠️ 2026-09-18（用户「骨架必须与页面正常显示的元素结构一致」）—— 三条收敛：
  //  ① 7 行**直接渲染真实组件** <TMDBMovieRow isLoading>：卡片模块外壳（padding /
  //     border / radius / surface / shadow / margin-bottom）、标题行、横滚容器的
  //     gap + padding、卡片 flex 宽度公式全部由 TMDBMovieRow.css / Home.css 唯一决定。
  //     旧实现把这整套手抄成 .home-skeleton-row / -card 系列（Home.css 里甚至写着
  //     「缺这层外壳会矮 26.6px」这类补偿注释）—— 第二套几何真源，改了真实行就漂移。
  //  ② 左栏榜卡**直接渲染真实组件** <CategoryHeatRow variant="rail" />：trending 为空时
  //     它自身渲染 CategoryTrendSkeleton（真实 .cqa-heat-row--rail > .cqa-trend 结构）。
  //  ③ 补上「继续观看」行（此前骨架完全没有）：真实页在
  //     (userDataLoading || continueItems.length > 0) 时渲染，首屏必然存在，
  //     原骨架漏掉它 → 数据到达时凭空多出一整行。
  const homeSkeletonRows = (
    <div className="home-skeleton-rows">
      {homeRows.map((row) => (
        <TMDBMovieRow key={row.key} title={row.title} items={[]} isLoading skipAnimations />
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
  // 「继续观看」行骨架（2026-09-18 补）：真实结构 = .home-continue-row >
  // .tmdb-movierow--continue > header + wrapper > scroll > 横版骨架卡。
  // 不能直接复用 <TMDBMovieRow>：它在 continueMode 且列表为空时会 return null
  // （组件内 early return），而首屏正是「列表为空 + 正在读本地库」。故按同结构手搭外壳，
  // 卡片仍复用 TMDBMovieRow 导出的 SkeletonCards（几何唯一来源不变）。
  const homeSkeletonContinueRow = (
    <div className="home-continue-row">
      <div className="tmdb-movierow tmdb-movierow--continue">
        <div className="tmdb-movierow-header">
          <h2 className="tmdb-movierow-title">继续观看</h2>
        </div>
        <div className="tmdb-movierow-wrapper">
          <div className="tmdb-movierow-scroll">
            <SkeletonCards landscape />
          </div>
        </div>
      </div>
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
        {/* 左栏：今日趋势榜卡 —— 直接渲染真实组件（trending 为空时它自身渲染
            CategoryTrendSkeleton：真实 .cqa-heat-row--rail > .cqa-trend 结构，
            行数由该骨架按栏高推导），不再手搓 6 行假结构 */}
        <aside className="home-two-col__rail">
          <CategoryHeatRow variant="rail" />
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
          {showContinueRow && homeSkeletonContinueRow}
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
      {showContinueRow && homeSkeletonContinueRow}
      {homeSkeletonRows}
    </>
  );
  // 不加 skeleton-scope（150ms 延迟淡入）：冷启动路径下 boot-splash 同构骨架已经显示，
  // homeSkeleton 接替时应立即可见，否则 boot-splash 摘除后会有 150ms 空白窗口
  // （骨架刚露头就消失的闪烁）。enterPhase 覆盖层里的 homeSkeletonBody 仍保留
  // skeleton-scope（那是「缓存数据场景下从其他页切回」的覆盖层，150ms 延迟过滤快切换合理）。
  const homeSkeleton = (
    <div className="page-padding home-page home-skeleton">{homeSkeletonBody}</div>
  );

  // 首屏骨架（仅 home 初始加载/整页无数据时使用）
  if (isInitialLoading) {
    coldSkeletonShownRef.current = true;
    return homeSkeleton;
  }

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
  // homeRows 定义已上移到骨架之前（骨架与真实行共用一份标题真源）。

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
              /* 行卡逐个弹入与逐块到达叠加 = 首页行骨架「严重抖动」主因（2026-09-22
                 用户反馈）；首页已有整层 page-transition-enter 淡入，行级入场动画
                 冗余，恒 skip（分类切回等场景同样由层动画承担进入感）。 */
              skipAnimations
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
          仅在 enterPhase !== 'done' 且非冷启动骨架接替时渲染（冷启动已由整屏骨架
          预告位置，再叠层 = 双渲染双动画，2026-09-22 用户反馈）。
          position: fixed 以覆盖整个视口，不受 home-page relative 约束。 */}
      {enterPhase !== 'done' && !coldSkeletonShownRef.current && (
        <div className={`home-enter-skeleton${enterPhase === 'fading' ? ' home-enter-skeleton--fading' : ''}`}>
          <div className="page-padding home-page home-skeleton skeleton-scope">{homeSkeletonBody}</div>
        </div>
      )}
      <div ref={pageRef} className={`page-padding home-page${isMobile ? ' home-page--mobile' : ''}${isTV ? ' home-page--tv' : ''}${coldSkeletonShownRef.current ? ' home-page--from-skeleton' : ''}`}>
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
                initialEnterDelay={enterPhase !== 'done' && !coldSkeletonShownRef.current ? 200 : 0}
              />
              <div className="home-page__content page-transition-enter home-page__content--delayed-enter">
                {/* 2026-09-06 调换：个人内容（继续观看）贴顶优先于探索型（分类热度榜），行业范式同向 */}
                {showContinueRow && (
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
              initialEnterDelay={enterPhase !== 'done' && !coldSkeletonShownRef.current ? 200 : 0}
            />
            <div className="home-page__content page-transition-enter home-page__content--delayed-enter">
              <CategoryQuickAccess onCategorySelect={handleCategorySelect} />
              {/* 2026-09-06 调换：个人内容（继续观看）贴顶优先于探索型（分类热度榜），行业范式同向 */}
              {showContinueRow && (
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

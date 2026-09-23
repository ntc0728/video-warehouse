/**
 * 搜索中心 — 独立路由
 *
 * 双模式搜索：
 *  - 智能检索（TMDB searchMulti）
 *  - 直链搜索（CMS 源接口批量搜索）
 *
 * 数据流：URL ↔ useBrowseData（TMDB）/ useCMSSearch（CMS）
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import FilterBar, { type FilterBarValue, type FilterBarCategoryOption } from '@/components/FilterBar';
import { Empty, BackToTopButton } from '@/components/common';
import { toast } from '@/components/ui';
import { SourceStatusIndicator } from '@/components/SourceStatusIndicator';
import { SORT_OPTIONS } from '@/components/FilterBar/constants';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTMDBStore, useSettingsStore } from '@/stores';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getVideoSources } from '@/services/sourceService';
import type { VideoSourceConfig } from '@/types/source';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { useIsMobile, useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG, CATEGORY_LABELS, PENDING_FEEDBACK_DELAY_MS } from './constants';
import { useBrowseData, toStoreFilter, DISCOVER_CACHE_TTL_MS } from './useBrowseData';
import { getDefaultFilterValue } from './urlState';
import type { VideoType } from '@/types/video';
import { useCMSSearch } from './useCMSSearch';
import BrowseGrid from './BrowseGrid';
import BrowseSkeleton from './BrowseSkeleton';
import BrowsePagination from './BrowsePagination';
import { useCardCols, useLogicalPage } from './useLogicalPage';
import BrowseMobileBar from './BrowseMobileBar';
import './Browse.css';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

type SearchMode = 'smart' | 'cms';

export default function BrowsePage() {
  // 2026-09-08 用户拍板：新 UI（左栏筛选 + 右侧结果）只在 ≥1024 生效，
  // <1024 一律走移动端命令栏（BrowseMobileBar + 筛选弹窗）。
  // 组合判定：App 端 / 真实手机 UA / 视口 ≤767（useIsMobileLayout）+ 视口 ≤1023（useIsMobile）。
  // ⚠️ 必须分别求值再取或：写成 `useIsMobileLayout() || useIsMobile()` 会短路掉右侧
  //    hook，使 hook 调用数随渲染变化，违反 rules-of-hooks（ESLint 已拦）。
  const isMobileLayout = useIsMobileLayout();
  const isNarrowViewport = useIsMobile();
  const isPhone = isMobileLayout || isNarrowViewport;
  const isTV = useIsTV();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  /** POP 导航（刷新/直接访问/后退）：清空搜索词，避免 history.state 残留 */
  const isPop = navigationType === 'POP';
  const scrollContainerRef = useScrollContainer();
  const [searchMode, setSearchMode] = useState<SearchMode>('smart');

  useScrollRestore('browse');

  // ── 搜索词（优先从 location.state 读取，兜底兼容 ?q= 查询参数）──
  // createBrowserRouter 下 window.history.state 在刷新后被浏览器保留，
  // 导致 location.state.q 残留 → 顶部 SearchBox 显示上次的搜索词。
  // 仅在 PUSH 导航（从顶部 SearchBox 搜索进入）时读取搜索词；POP 时直接清空。
  const stateQ = (location.state as { q?: string } | null)?.q?.trim() ?? '';
  const urlQ = searchParams.get('q')?.trim() ?? '';
  // 从首页分类导航进入（Home CategoryQuickAccess → /browse?category=...）：
  // 顶部搜索框应清空（query state 常驻，若不处理会残留旧搜索词）
  const fromCategory = (location.state as { fromCategory?: boolean } | null)?.fromCategory === true;
  const [query, setQuery] = useState(() => {
    if (isPop) return '';
    return stateQ || urlQ || '';
  });

  // 从顶部导航搜索进入时，location.state 变化（组件可能已挂载），需主动同步搜索词
  useEffect(() => {
    // POP 导航（刷新/后退）不从 location.state / ?q= 恢复搜索词
    if (isPop) return;
    const q = stateQ || urlQ;
    if (q) {
      setQuery(q);
    }
  }, [stateQ, urlQ, isPop]);

  // ── 浏览器标签标题：挂载即写（无 Keep-Alive，页面卸载后标题由新页接管） ──
  useEffect(() => {
    document.title =
      searchMode === 'cms' && query ? `${query} - 搜索 - kinoTV` : '搜索 - kinoTV';
  }, [searchMode, query]);

  // ── TMDB 数据（智能检索）─────────────────────────
  // endRefresh = 取页收尾（逻辑分页层装载完成后关闭 loading 遮罩）。
  // 本 hook 不再自行取页：取页唯一出口 = 下方的 runGoto（见其注释）。
  const {
    filterValue,
    updateFilter,
    isRefreshing,
    refreshNow,
    endRefresh,
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading,
    error,
  } = useBrowseData();

  // 下拉刷新：智能检索强制重取第 1 页（force 绕过 store 缓存回显）；
  // 直链搜索重跑当前关键词；meta 记录当前搜索/分类参数
  usePullToRefresh(() => {
    if (searchMode === 'cms') {
      searchCMS(query);
    } else {
      hardRefresh();
    }
  }, {
    meta: () => {
      const q = (searchParams.get('q')?.trim()) || query.trim();
      const category = searchParams.get('category')?.trim();
      if (q) return `搜索: ${q}`;
      if (category) return `分类: ${category}`;
      return undefined;
    },
  });

  // ── CMS 数据（直链搜索）─────────────────────────
  const {
    results: cmsResults,
    loading: cmsLoading,
    error: cmsError,
    hasMore: cmsHasMore,
    totalSources,
    completedSources,
    failedSources,
    search: searchCMS,
    loadMore: loadMoreCMS,
    reset: resetCMS,
  } = useCMSSearch();

  // ── CMS 本地筛选（直链搜索面板，2026-09-07 用户拍板）────────────
  // CMS 返回值含 type(movie/tv/variety/anime)/year/region(vod_area)，
  // 支持纯前端过滤——不调 TMDB 接口、不写 URL（与智能检索筛选互不影响）。
  // CMS 无评分/热度字段 → 排序不可用（footer 隐藏）；纪录片/排行榜无对应
  // CMS 类型 → 面板类型行仅 5 档。
  const CMS_CATEGORY_OPTIONS = useMemo<FilterBarCategoryOption[]>(
    () => [
      { key: 'all', label: '全部', mediaType: 'all', genreIds: [] },
      { key: 'movie', label: '电影', mediaType: 'movie', genreIds: [] },
      { key: 'tv', label: '剧集', mediaType: 'tv', genreIds: [] },
      { key: 'variety', label: '综艺', mediaType: 'tv', genreIds: [] },
      { key: 'anime', label: '动漫', mediaType: 'tv', genreIds: [] },
    ],
    [],
  );

  const [cmsFilterValue, setCmsFilterValue] = useState<FilterBarValue>(() => getDefaultFilterValue());
  const handleCmsFilterChange = useCallback((next: FilterBarValue) => setCmsFilterValue(next), []);

  // vod_area 是自由文本（大陆/内地/中国大陆/香港…），REGION_OPTIONS 是 ISO 码 → 别名表匹配
  const CMS_REGION_ALIASES: Record<string, string[]> = useMemo(
    () => ({
      CN: ['大陆', '内地', '中国'],
      HK: ['香港'],
      TW: ['台湾'],
      US: ['美国'],
      KR: ['韩国'],
      JP: ['日本'],
      EU: ['欧洲', '法国', '德国', '意大利', '西班牙', '英国'], // CMS 常无 EU 概念，兜进欧洲系
      IN: ['印度'],
      TH: ['泰国'],
      DK: ['丹麦'],
      GB: ['英国'],
    }),
    [],
  );

  const filteredCmsResults = useMemo(() => {
    const f = cmsFilterValue;
    const noFilter =
      f.category === 'all' && f.region === null && f.year === null && !f.olderThan2015;
    if (noFilter) return cmsResults;
    return cmsResults.filter((v) => {
      if (f.category !== 'all') {
        const want: VideoType =
          f.category === 'movie' ? 'movie'
          : f.category === 'tv' ? 'tv'
          : f.category === 'variety' ? 'variety'
          : 'anime'; // documentary/top 不在 CMS 面板类型行内
        if (v.type !== want) return false;
      }
      if (f.region !== null) {
        if (!v.region) return false;
        if (f.region === 'OTHER') {
          if (Object.values(CMS_REGION_ALIASES).some((als) => als.some((a) => v.region!.includes(a)))) return false;
        } else {
          const aliases = CMS_REGION_ALIASES[f.region];
          if (!aliases || !aliases.some((a) => v.region!.includes(a))) return false;
        }
      }
      if (f.year !== null && v.year !== f.year) return false;
      if (f.olderThan2015 && (v.year === undefined || v.year >= 2015)) return false;
      return true;
    });
  }, [cmsResults, cmsFilterValue, CMS_REGION_ALIASES]);

  // ── 搜索触发 ────────────────────────────────────
  const lastCmsSearchedRef = useRef('');

  /**
   * **仅直链搜索（CMS）** 在此直接发起查询 —— CMS 走自己的并发搜索 + 滚动追加，
   * 不进逻辑分页层。
   *
   * ⚠️ 智能检索一律不在这里发请求：它的取页唯一出口是下方的 runGoto
   * （两条路径同时发请求 = 同一页被请求 2~3 次，即本次整改的重复请求根因）。
   */
  const triggerCmsSearch = useCallback((q: string) => {
    if (!q) return;
    // 搜索词未变化时不重复调用 CMS 查询接口（如切换"直链搜索"tab）
    if (lastCmsSearchedRef.current === q) return;
    lastCmsSearchedRef.current = q;
    searchCMS(q);
  }, [searchCMS]);

  /**
   * 直链搜索「重试」（错误态按钮）。
   * 必须绕过 triggerCmsSearch 的「同词不重发」短路：失败时关键词没变，
   * 走 triggerCmsSearch 会被 lastCmsSearchedRef 当帧挡回，用户点重试等于没点。
   */
  const retryCmsSearch = useCallback(() => {
    if (!query) return;
    lastCmsSearchedRef.current = query;
    searchCMS(query);
  }, [query, searchCMS]);

  // ── 搜索模式切换 ────────────────────────────────
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (mode === 'cms') {
      // 智能检索可能还有取页在飞：切走时收掉它的 loading 遮罩（CMS 有自己的 loading 态）
      endRefresh();
      // 切入直链搜索：本地筛选复位（不写 URL、不影响智能检索的 filterValue）
      setCmsFilterValue(getDefaultFilterValue());
      if (query) {
        triggerCmsSearch(query);
      } else {
        // 搜索词已清空时切到「直链搜索」：无关键词可搜，清空残留的 CMS 结果
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
    }
    // 切回智能检索：searchMode 变 → logicalContext 变 → 逻辑分页层自动重新取页
  }, [query, triggerCmsSearch, resetCMS, endRefresh]);

  // ── 筛选条件变更 ────────────────────────────────
  // 只写 URL。store.filterOptions 的对齐交给 useBrowseData 的 filterSig 防抖分支，
  // 取页交给逻辑分页层（runGoto）—— 这里不再同步 setFilter、也不再防抖触发搜索，
  // 否则会与逻辑分页层撞成同一页 2~3 次请求。
  const handleFilterChange = useCallback((next: FilterBarValue) => {
    updateFilter(next);
  }, [updateFilter]);

  // ── 注册顶部导航栏搜索回调 ──────────────────────
  const handlePageSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchMode === 'cms') {
      if (q) {
        triggerCmsSearch(q);
      } else {
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
      return;
    }
    // 智能检索：只写搜索词 —— query 变 → logicalContext 变 → 逻辑分页层取页。
    // 这里不再直发 store 请求（否则与逻辑分页层重复）。
  }, [searchMode, triggerCmsSearch, resetCMS]);

  // [2026-08-13] 惰性 bootstrap video 场景：浏览页需要 video-sources.json（CMS 采集站配置）。
  // 不再由 main.tsx 全局拉取，改为场景级幂等触发（bootstrapScene 每场景仅执行一次）。
  useEffect(() => {
    void useSourceManagerStore.getState().bootstrapScene('video');
  }, []);

  useEffect(() => {
    if (location.pathname !== '/browse') return;
    const store = usePageSearchStore.getState();
    // 分类导航进入时写入空搜索词（不写残留 query），保证顶部搜索框为空
    store.setPageSearch(fromCategory ? '' : query, handlePageSearch, '搜索影片、剧集…');
    return () => { store.clearPageSearch(); };
  }, [query, handlePageSearch, location.pathname, fromCategory]);

  // 从顶部导航搜索进入：用 location.state 或 ?q= 中的最新搜索词触发
  // 注意：必须读 stateQ/urlQ（同步变量）而非 query（异步 state）——
  // location.key 变化时 setQuery 尚未生效，query 仍是上一次的旧值。
  useEffect(() => {
    // POP 导航（刷新/后退）不触发搜索
    if (isPop) return;
    const q = stateQ || urlQ;
    if (!q) return;
    if (searchMode === 'cms') {
      searchCMS(q);
      lastCmsSearchedRef.current = q;
      return;
    }
    // 智能检索：搜索词与当前已生效的词相同 → logicalContext 不变、逻辑分页层不会自动
    // 重取，此时才需要显式强制刷新一次（「再搜一次同一个词」）。词变了则交给
    // logicalContext 变化驱动取页，避免两条路径同时发请求。
    if (q === query) hardRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, isPop]);

  // ── 分类导航进入：清空残留搜索词 + 立即刷新（跳过 filterSig 300ms debounce）──
  // useLayoutEffect 保证绘制前完成：清空 query 后顶部搜索框首帧即为空、
  // hardRefresh 同步置 loading 并在同一帧发起 force 取页，首帧即显示 loading 遮罩，
  // 不再出现「显示上一次数据 → 闪烁 → 才加载」。
  // handledRef 只消费「本次导航首次进入」：从 browse 进详情再返回时
  // location.state.fromCategory 随 history 恢复为 true，但不应再次触发刷新。
  const fromCategoryHandledRef = useRef(false);
  useLayoutEffect(() => {
    if (location.pathname !== '/browse') return;
    const fc = (location.state as { fromCategory?: boolean } | null)?.fromCategory === true;
    if (!fc || fromCategoryHandledRef.current) return;
    fromCategoryHandledRef.current = true;
    setQuery('');
    resetCMS();
    hardRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.pathname]);

  // ── 右上角总数钉定（2026-09-12 用户反馈「翻页/跳页后总数会变」）──
  // TMDB total_results 是逐页波动的估计值。同一「模式+关键词+筛选」上下文内，
  // 以第一次请求落地的非零总数为准；上下文变化（换词/换筛选/切模式）时重钉。
  // 只在请求落地后结算（isRefreshing/isLoading 中不钉），避免旧上下文的总数抢先钉入新 key。
  const totalKey = `${searchMode}:${query}:${JSON.stringify(searchMode === 'smart' ? filterValue : cmsFilterValue)}`;
  const [pinnedTotal, setPinnedTotal] = useState(0);
  useEffect(() => { setPinnedTotal(0); }, [totalKey]);
  useEffect(() => {
    if (searchMode !== 'smart') return;
    if (isRefreshing || isLoading) return;
    if (discoverPagination.totalResults > 0) {
      setPinnedTotal((p) => p || discoverPagination.totalResults);
    }
  }, [searchMode, isRefreshing, isLoading, discoverPagination.totalResults]);

  // ── 分页切换（2026-09-12 用户拍板：右栏由无限滚动改为分页切换）────────
  // 翻页语义 = 替换 + loading + 滚回顶部：
  //  - 数据侧两个 hook 都是「替换式」（TMDB 带 reset 重拉；CMS 并发拉 pg=n 后整体替换），
  //    不再是 loadMore 的追加语义，所以第 N 页只含第 N 页内容；
  //  - 滚动位置在此归零 —— 否则翻页后视口停在新页末尾几行，观感很怪。
  //    滚动容器是全局 .app-shell__scroll（useScrollContainer 提供 ref）。
  //  - TMDB 侧翻的是「逻辑页」（useLogicalPage，见下方组装层），不是 TMDB 原生页；
  //    handlePageChange 的声明位置在 runGoto 之后（deps 引用它）。

  // ── genres & countries 兜底拉取（精确选择器） ──────────
  const movieGenres = useTMDBStore(s => s.movieGenres);
  const tvGenres = useTMDBStore(s => s.tvGenres);
  const fetchGenresAndCountries = useTMDBStore(s => s.fetchGenresAndCountries);
  useEffect(() => {
    if (movieGenres.length === 0 && tvGenres.length === 0) {
      fetchGenresAndCountries();
    }
  }, [movieGenres.length, tvGenres.length, fetchGenresAndCountries]);

  // ── 分类级类型选项（类型行 7 档：全部/电影/剧集/综艺/动漫/纪录片/排行榜）──
  // 点击即切换 category 并注入该分类的 mediaType + 默认 genreIds（CATEGORY_CONFIG）
  const CATEGORY_OPTIONS = useMemo<FilterBarCategoryOption[]>(
    () => (Object.keys(CATEGORY_CONFIG) as (keyof typeof CATEGORY_CONFIG)[]).map((key) => ({
      key,
      label: key === 'all' ? '全部' : CATEGORY_LABELS[key],
      mediaType: CATEGORY_CONFIG[key].mediaType,
      genreIds: CATEGORY_CONFIG[key].defaultGenreIds,
    })),
    [],
  );

  // ── 当前分类下的可选类型 ────────────────────────
  const currentGenres = useMemo<TMDBGenre[]>(() => {    const cfg = CATEGORY_CONFIG[filterValue.category];
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
  const isCmsLoading = cmsLoading;

  // ── 逻辑分页组装层（2026-09-12 用户拍板）：每页恒定 cols×5 行、行行完整、
  //    总页数按每页条数折算。逻辑页 L 覆盖全局条目 [(L-1)P, LP)，按算术定位所需
  //    TMDB 合并页（至多 2 个请求 + offset 切片）；TMDB 硬顶 500 页 → 可达条目
  //    上限 = 500×合并页大小，一并钳进总页数。 ──
  const cardCols = useCardCols();
  const logicalContext = `smart:${query}:${JSON.stringify(filterValue)}`;
  // 在飞取页的上下文代际：渲染期同步更新，供 fetchTmdbPage 中途弃权——
  // 旧上下文的 fetchDiscover/search 若在换词后才落地写 store，会把
  // discoverResults 盖成旧/错数据（逻辑层 items 已按新上下文清空 → 空态被压住）。
  const liveCtxRef = useRef(logicalContext);
  liveCtxRef.current = logicalContext;
  // ⚠️ 本函数是全页**唯一**的 TMDB 取页出口（2026-09-14 收敛）：
  //    useBrowseData 侧已不再发任何 discover / top_rated / search 请求，
  //    所有「装载第 N 逻辑页 / 强制刷新第 1 页」的意图都经 useLogicalPage.goto 走到这里。
  // 取页两段等待（顺序敏感）：
  //  1. 等 filterSig 防抖把新筛选写入 store（filterOptions 与本组件 filterValue 对齐）——
  //     否则请求带旧筛选参数，拉回上一轮上下文的数据（用户看到的「切筛选后内容不对/空」）；
  //  2. 等 store 既有 discover 请求落地（防重置与在途请求互相覆盖）。
  //  3. 取页后校验落地页号（用户快速翻页会让 store seq 丢弃本页响应，
  //     discoverPagination.page ≠ t 即快照被覆盖 → 等对方落地后重试一次）。
  // 缓存回显：非 force 且 t=1 时，store 已有「当前筛选 + 未超 TTL」的结果 → 零请求复用
  //   （从详情页返回、切回刚看过的同一筛选时命中；下拉刷新/分类导航走 force 绕过）。
  const fetchTmdbPage = useCallback(async (t: number, force = false) => {
    const store = () => useTMDBStore.getState();
    const startCtx = logicalContext;
    const isStale = () => liveCtxRef.current !== startCtx;
    const wantFilter = JSON.stringify(toStoreFilter(filterValue));

    // 缓存回显只服务「浏览态」（discover/top，与 query 无关）：query 非空 = 搜索态，
    // 缓存里是上一轮的浏览/搜索快照，filter 相同也会命中 → 搜索结果被旧浏览结果顶替
    // （store.search 根本不触发）。故搜索态一律跳过缓存，强制走 store.search。
    if (!force && t === 1 && !query) {
      const s0 = store();
      if (
        s0.discoverResults.length > 0 &&
        s0.discoverFetchedFilter != null &&
        s0.discoverFetchedAt > 0 &&
        Date.now() - s0.discoverFetchedAt < DISCOVER_CACHE_TTL_MS &&
        JSON.stringify(s0.discoverFetchedFilter) === wantFilter
      ) {
        return s0.discoverResults;
      }
    }

    let guard = 0;
    while (
      JSON.stringify(store().filterOptions) !== wantFilter && guard < 40
    ) {
      if (isStale()) return [];
      await new Promise<void>((r) => setTimeout(r, 100));
      guard += 1;
    }
    while (store().loading.discover && guard < 100) {
      if (isStale()) return [];
      await new Promise<void>((r) => setTimeout(r, 100));
      guard += 1;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (isStale()) return [];
      // 直调 store（_discoverSeq 已保证仅最新请求可写结果）；上方等待循环读的也是 live state。
      const p = query
        ? store().search(query, t, { reset: true })
        : filterValue.category === 'top'
          ? store().fetchTopRated(t, { reset: true })
          : store().fetchDiscover(t, { reset: true });
      await p;
      if (isStale()) return [];
      const s = store();
      if (s.discoverPagination.page === t) return s.discoverResults;
      // 2026-09-14：store 的 catch 只写 errors.discover，**不 rethrow**、也不恢复
      // pagination（page 归 0）→ 这里显式识别失败态并抛出。否则会继续往下走
      // 「重试一次 → 仍失败 → return []」，goto 拿到空数组后 setItems([]) 清空旧页、
      // 还把 [] 写进页缓存 → 该页被永久记为空（切走再翻回来仍是空）。
      if (s.discoverLastStatus === 'error') {
        throw new Error(s.errors.discover ?? '加载失败');
      }
      await new Promise<void>((r) => setTimeout(r, 350));
      let g3 = 0;
      while (store().loading.discover && g3 < 100) {
        if (isStale()) return [];
        await new Promise<void>((r) => setTimeout(r, 100));
        g3 += 1;
      }
    }
    if (isStale()) return [];
    return store().discoverResults;
  }, [query, filterValue, logicalContext]);
  const logical = useLogicalPage({
    cols: cardCols,
    // 合并页大小随媒体类型：all = 电影 20 + 剧集 20 = 40；单类型/搜索 = 单路 20。
    // ⚠️ 偏移算术依赖此值与真实拉取条数一致，切分类后 M 变 20 时若仍按 40 定位会错位空页。
    mergedPageSize: query || filterValue.mediaType !== 'all' ? 20 : 40,
    contextKey: logicalContext,
    fetchPage: fetchTmdbPage,
    total: pinnedTotal || discoverPagination.totalResults,
    // 列数跨档的隐式重切由 hook 内部发起：它若抢占了在飞取页（对方返回 false 后
    // 放弃收尾），必须由这条回调接管 loading 收尾，否则 isRefreshing 永驻 →
    // 卡片永久变淡 + 分页器永久禁用。
    onCommit: endRefresh,
  });
  // 首次挂载 / 上下文变化（换词/换筛选/切分类）→ 装载第 1 页。
  // goto 走 ref 转发：total 钉定会使 goto 换身份，若直接进 deps 会多拉一次页 1；
  // 同时让 runGoto / hardRefresh 能稳定引用它。
  const logicalGotoRef = useRef(logical.goto);
  logicalGotoRef.current = logical.goto;

  /**
   * **取页唯一出口**（所有「装载 / 刷新逻辑页」的意图都走这里）：
   * - 收尾走 goto 的 onCommit：与 setItems 同一批更新里关 loading 遮罩，
   *   避免「内容已就位、遮罩还没关」的一帧空窗；
   * - 返回 false（本次被更晚的 goto 取代）→ 不收尾，交给接管者收尾，
   *   否则旧请求会把新请求的 loading 提前关掉；
   * - 抛错（网络层已由 store 兜成 error 态）→ 仍必须收尾，否则 loading 永驻。
   */
  // 失败提示节流时间戳：连点分页 / 反复点重试时避免 toast 刷屏
  const lastErrorToastRef = useRef(0);
  const runGoto = useCallback(async (page: number, opts?: { force?: boolean }) => {
    try {
      await logicalGotoRef.current(page, { force: opts?.force, onCommit: endRefresh });
    } catch {
      // goto 抛错 = 本次取页失败（store 已把原因写进 errors.discover），且它
      // 没提交任何状态 → 旧 items 原样保留、旧页缓存未被污染（2026-09-14 起）。
      // 必须收尾 loading（否则遮罩永驻），并给出显式提示：旧页还在时错误态
      // （Empty）不渲染（fixed 全屏空态会盖住网格），没有提示就只剩「点了没反应」。
      endRefresh();
      const now = Date.now();
      if (now - lastErrorToastRef.current > 1500) {
        lastErrorToastRef.current = now;
        toast.error('加载失败，请检查网络后重试');
      }
    }
  }, [endRefresh]);

  /** 强制刷新第 1 页（下拉刷新 / 从首页分类导航进入 / 重复提交同一搜索词） */
  const hardRefresh = useCallback(() => {
    refreshNow();
    void runGoto(1, { force: true });
  }, [refreshNow, runGoto]);

  useEffect(() => {
    // 直链搜索（CMS）不进逻辑分页层（它自带并发搜索 + 滚动追加），不在此取页
    if (searchMode !== 'smart') return;
    void runGoto(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logicalContext]);

  /** 分页器是否值得渲染（2026-09-14 用户拍板，取代旧条件 effectiveTotalPages>1
      || discoverResults.length>0）：智能检索且「逻辑层有内容 + 总页数 > 1」。
      - 数据不足一页（totalPages=1）不再渲染分页器；
      - 骨架/空态/错误态下 items 为空，也不渲染——Empty 为 fixed 全屏视口居中，
        与分页器同帧渲染必然叠字（慢网下旧分页条件用陈旧 totalPages 时正踩中）。
      直链搜索为滚动追加，恒不渲染。 */
  const showPagination =
    searchMode === 'smart' && logical.items.length > 0 && logical.totalPages > 1;

  // ── 直链搜索滚动追加（2026-09-12 用户拍板：CMS 不做分页）──
  // CMS 恢复 append 语义（useCMSSearch.loadMore，滚动触底自动拉下一页拼接）；
  // smart 模式走逻辑分页，hasMore 恒 false 让哨兵闲置。
  const { sentinelRef } = useInfiniteScroll({
    hasMore: searchMode === 'cms' && cmsHasMore,
    isLoading: cmsLoading,
    onLoadMore: () => { void loadMoreCMS(query); },
    scrollContainerRef,
    rootMargin: '200px',
  });

  /** 页码变更（仅智能检索数字分页；直链搜索已改滚动追加，不渲染分页器） */
  const handlePageChange = useCallback(
    (page: number) => {
      void runGoto(page);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [runGoto, scrollContainerRef],
  );

  // 结果区局部 loading：搜索中且无数据时（有数据时不覆盖网格）
  // 切换筛选/排序 tab 时，store 的 reset 会同步清空 discoverResults，
  // 于是 isLoading=true 且 smartHasData=false → 直接显示「搜索中…」loading（无需额外遮罩）
  // isRefreshing 纳入判定：filterSig 变更（切分类/筛选）到新数据就绪期间立即显示
  // loading 遮罩，避免「旧数据闪现 300ms」（fetch 完成后 150ms 内复位）。
  const smartHasData = discoverResults.length > 0;
  const cmsHasData = cmsResults.length > 0;
  const showResultsLoading = searchMode === 'smart'
    ? (logical.loading || isRefreshing || (isLoading && !smartHasData))
    : (isCmsLoading && !cmsHasData);

  // 骨架只在「无内容可显示」时渲染（2026-09-14 用户反馈慢网叠字）：
  // 翻页飞行中逻辑层 items 保留旧页原地展示（分页器禁用兜底），
  // 骨架若同时渲染会叠在旧网格之上（骨架为文档流块，非遮罩）。
  const showSkeleton = showResultsLoading &&
    (searchMode === 'smart' ? logical.items.length === 0 : true);

  // ── 慢取页反馈（2026-09-14 用户拍板 A′）────────────────────────────
  // 骨架只覆盖「无内容可显示」；反过来「有旧内容顶着」的取页（翻页 / 下拉刷新 /
  // 列数跨档 / 重复搜同一词）需要另一条反馈通道，否则旧图静止、全程零反馈，
  // 用户会以为点击没生效。
  // 但不能一置 loading 就反馈：内存页缓存与浏览器 HTTP 缓存命中时取页耗时
  // 可能只有几十毫秒，反馈只存在 1~2 帧 → 视觉抽搐（flash of loading state）。
  // 故压一个 400ms 阈值：阈值内视为瞬时完成、静默直接换图；超过才把旧内容变淡
  // （.browse-results-body--pending）。
  // CMS 分支 showSkeleton ≡ showResultsLoading → 本标志恒 false，
  // 直链搜索的滚动追加（append 语义，旧结果本就不该变淡）不受影响。
  const showLateFeedback = useDelayedFlag(
    showResultsLoading && !showSkeleton,
    PENDING_FEEDBACK_DELAY_MS,
  );

  // 空态与骨架/网格互斥（2026-09-14）：智能检索以逻辑层 items 为准——
  // items 非空（含慢网下保留的旧页）时不显示「暂无结果」，
  // 否则 fixed 全屏居中的空态会盖在内容与分页器上。
  // ⚠️ 不再 conjunct discoverResults：store 可能被旧上下文在飞请求盖写
  //  （与逻辑层不同拍），渲染真源是 logical.items；loading 由
  //  !showResultsLoading 在渲染处把关（骨架与空态互斥）。
  const isEmpty = searchMode === 'smart'
    ? logical.items.length === 0
    : (!isCmsLoading && filteredCmsResults.length === 0);
  const currentError = searchMode === 'smart' ? error : cmsError;

  // 逐源列表：供源状态弹层展示（与详情页源检测弹窗一致的逐源网格）
  const { videoSourceIds } = useSettingsStore();
  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>([]);
  useEffect(() => {
    let alive = true;
    getVideoSources().then((list) => {
      if (alive) setVideoSources(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  // 逐源统计：结果数（原始值，不受本地筛选影响）+ 失败标记
  // 供源状态 badge（demo 同款）展示；搜索中仍由 pill 显示进度
  const cmsSourceStats = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const v of cmsResults) {
      countMap.set(v.cmsSourceName, (countMap.get(v.cmsSourceName) ?? 0) + 1);
    }
    const ids = videoSourceIds && videoSourceIds.length > 0 ? videoSourceIds : [];
    return ids.map((id) => {
      const name = videoSources.find((s) => s.id === id)?.name ?? `源${id}`;
      return { name, count: countMap.get(name) ?? 0, failed: failedSources.includes(name) };
    });
  }, [videoSourceIds, videoSources, cmsResults, failedSources]);

  return (
    <div
      className={[
        'page-padding',
        'browse-page',
        isPhone ? 'browse-page--mobile' : '',
        isTV ? 'browse-page--tv' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* 移动端命令栏（方案②）：仅真实手机 web / App 端，含模式切换段 */}
      {isPhone && (
        <BrowseMobileBar
          searchMode={searchMode}
          onModeChange={handleModeChange}
          filterBarProps={{
            value: filterValue,
            onChange: handleFilterChange,
            categoryOptions: CATEGORY_OPTIONS,
            genres: currentGenres,
            excludedGenreIds,
            totalResults: discoverPagination.totalResults,
            categoryLabel: CATEGORY_LABELS[filterValue.category],
            hideFooter: true,
          }}
          allGenres={[...movieGenres, ...tvGenres]}
        />
      )}

      {/* Card 1：搜索区域（桌面端；移动端由命令栏接管） */}
      {!isPhone && (
        <div className="browse-card--search">
          {/* Tab 切换 — ≥1024 首行左列（胶囊宽度 = 左栏 --rail-w；右侧同行由结果区头部占用） */}
          <div className="browse-search-tabs">
            <div className="browse-search-tabs__pill">
              <button
                className={`browse-search-tab ${searchMode === 'smart' ? 'active' : ''}`}
                onClick={() => handleModeChange('smart')}
              >
                <Icon icon={Search} size="xs" />
                <span>智能检索</span>
              </button>
              <button
                className={`browse-search-tab ${searchMode === 'cms' ? 'active' : ''}`}
                onClick={() => handleModeChange('cms')}
              >
                <span>直链搜索</span>
              </button>
            </div>
          </div>
          {/* 智能检索模式：FilterBar（类型行已移至结果区头部，footer 移到 Card 2） */}
          {searchMode === 'smart' && (
            <FilterBar
              value={filterValue}
              onChange={handleFilterChange}
              genres={currentGenres}
              excludedGenreIds={excludedGenreIds}
              totalResults={discoverPagination.totalResults}
              categoryLabel={CATEGORY_LABELS[filterValue.category]}
              hideFooter
              hideType
              showGenreRowShell
            />
          )}
          {/* 直链搜索模式：FilterBar 本地筛选（纯前端过滤 CMS 结果，不调接口；
              无 genres → 分类行自动隐藏；CMS 无评分/热度 → footer 排序隐藏） */}
          {searchMode === 'cms' && (
            <FilterBar
              value={cmsFilterValue}
              onChange={handleCmsFilterChange}
              genres={[]}
              categoryOptions={CMS_CATEGORY_OPTIONS}
              hideFooter
            />
          )}
        </div>
      )}

      {/* Card 2：结果区域 */}
      <div className="browse-card--results">
        {/* 智能检索模式：类型（分类级 7 档）+ 排序 + 结果数（≥1024 对齐 demo reshead） */}
        {searchMode === 'smart' && (
          <div className="browse-sort-bar">
            <div className="browse-sort-bar__types" role="tablist" aria-label="类型">
              {CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`browse-sort-bar__type${filterValue.category === o.key ? ' browse-sort-bar__type--active' : ''}`}
                  onClick={() =>
                    handleFilterChange({
                      ...filterValue,
                      category: o.key,
                      mediaType: o.mediaType,
                      genreIds: o.genreIds,
                    })
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="browse-sort-bar__divider" aria-hidden="true" />
            <div className="browse-sort-bar__tabs">
              {SORT_OPTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`browse-sort-bar__tab${filterValue.sortIdx === i ? ' browse-sort-bar__tab--active' : ''}`}
                  onClick={() => handleFilterChange({ ...filterValue, sortIdx: i })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="browse-sort-bar__count" role="status">
              {/* 2026-09-12：新搜索落位前显示转圈而非「共 0 条」；翻页期间保持钉定总数不闪变 */}
              {showResultsLoading && !smartHasData ? (
                <>
                  搜索中…
                  <Icon icon={Loader2} size="xs" className="browse-count-spin" />
                </>
              ) : (
                <>
                  共 {(pinnedTotal || discoverPagination.totalResults).toLocaleString('zh-CN')} 条
                </>
              )}
            </span>
          </div>
        )}

        {/* 源状态行（仅直链搜索）：左侧结果数 + 右侧源状态。
            搜索中 = 折叠 pill（UI 不变）；搜索结束 = demo 同款逐源 badge 卡片行 */}
        {searchMode === 'cms' && (
          <div
            className={[
              'browse-source-status-row',
              completedSources >= totalSources ? 'browse-source-status-row--done' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="browse-results-count">
              结果数 <b>{filteredCmsResults.length}</b>
            </span>
            {/* 未搜索（totalSources=0）不渲染 badges，避免一排「源名 0」橙档空态 */}
            {totalSources > 0 && (
              <SourceStatusIndicator
                totalSources={totalSources}
                totalCompleted={completedSources}
                stats={cmsSourceStats}
              />
            )}
          </div>
        )}

        {/* 结果主体：loading / 空状态 / 网格 / 懒加载 */}
        <div
          className={[
            'browse-results-body',
            showLateFeedback ? 'browse-results-body--pending' : '',
          ].filter(Boolean).join(' ')}
        >
          {/* 结果区专属骨架：结构对齐真实「类型/排序行 + 卡片网格」，
              列数随 --card-cols 视口分档（不再用全站统一 AppLoading 菊花） */}
          {showSkeleton && (
            <BrowseSkeleton />
          )}

          {/* 加载失败 —— 与「搜不到」彻底分开（2026-09-14）：
              旧版两者共用「暂无结果」+ waiting 时钟图标，用户分不清「没有这个
              内容」与「没加载出来」；且没有恢复入口（此时 items 为空、分页器也
              不渲染），等于卡死在这一页。现补 error 语义 + 重试按钮。 */}
          {!showResultsLoading && currentError && (searchMode === 'smart'
            ? logical.items.length === 0
            : cmsResults.length === 0) && (
            <Empty
              status="error"
              title={searchMode === 'smart' ? '加载失败' : '搜索失败'}
              description={searchMode === 'smart'
                ? '网络或影视库暂时不可用，请稍后重试'
                : '数据源均未响应，请稍后重试'}
              onRetry={searchMode === 'smart' ? hardRefresh : retryCmsSearch}
              retryText="重试"
              isRetrying={searchMode === 'smart' ? showResultsLoading : cmsLoading}
            />
          )}

          {/* 空态 = 请求成功但没有内容（与上面的失败态语义互斥）。
              三档细分（2026-09-14）：源没返回 / 本地筛选筛空 / 还没输入搜索词
              —— 旧版三档共用「尝试换个关键词搜索」，浏览态（无词 + 筛选空）时
              提示去搜索属于误导，本地筛选筛空时又指错方向。 */}
          {!showResultsLoading && isEmpty && !currentError && (
            <Empty
              title={searchMode === 'cms' && !query ? '搜索影视内容' : '暂无结果'}
              description={
                searchMode === 'cms'
                  ? (query
                    ? (cmsResults.length > 0
                      ? '没有符合当前筛选的结果，试试放宽条件'
                      : '没有数据源返回该关键词的结果')
                    : '请输入关键词后开始搜索')
                  : (query
                    ? '试试更换关键词或筛选条件'
                    : '当前筛选条件下暂无内容')
              }
            />
          )}

          {/* 网格门禁 = !showSkeleton（2026-09-14 用户拍板 A′），不是 !showResultsLoading：
              取页飞行中若 items 仍有旧页，网格必须继续渲染顶住 —— 旧版用
              !showResultsLoading 时旧页被挡、骨架又因 items 非空不渲染，内容区
              只剩分页器裸露在顶部。骨架与网格判定同源（互斥且互补）即不会叠字。
              CMS 分支 showSkeleton ≡ showResultsLoading，行为与旧版一致。 */}
          {!showSkeleton && (searchMode === 'smart' ? (
            logical.items.length > 0 ? (
              <BrowseGrid items={logical.items} query={query} mode="smart" />
            ) : null
          ) : (
            filteredCmsResults.length > 0 ? (
              <BrowseGrid cmsItems={filteredCmsResults} query={query} mode="cms" />
            ) : null
          ))}

          {showPagination && (
            <BrowsePagination
              variant="numbered"
              page={logical.page}
              totalPages={logical.totalPages}
              canGoBack={logical.page > 1}
              hasNext={logical.page < logical.totalPages}
              disabled={showResultsLoading || isLoadingMore}
              onChange={handlePageChange}
            />
          )}

          {/* 直链搜索滚动追加哨兵（smart 分页模式下 hasMore 恒 false，不触发） */}
          <div ref={sentinelRef} aria-hidden="true" />

        </div>
      </div>

      <BackToTopButton />
    </div>
  );
}

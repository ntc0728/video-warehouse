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
import { SourceStatusIndicator } from '@/components/SourceStatusIndicator';
import { SORT_OPTIONS } from '@/components/FilterBar/constants';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useTMDBStore, useSettingsStore } from '@/stores';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import { getVideoSources } from '@/services/sourceService';
import type { VideoSourceConfig } from '@/types/source';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { useIsMobile, useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { TMDBGenre } from '@/types/tmdb';
import { CATEGORY_CONFIG, CATEGORY_LABELS } from './constants';
import { useBrowseData, toStoreFilter } from './useBrowseData';
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
  const isPhone = useIsMobileLayout() || useIsMobile();
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
  const {
    filterValue,
    updateFilter,
    isRefreshing,
    refreshNow,
    goToPage: goToPageTMDB,
    // hasMore 不再直接消费：逻辑分页层的 hasNext = 逻辑页 < ceil(钉定总数 / 每页条数)
    isLoadingMore,
    discoverResults,
    discoverPagination,
    isLoading,
    error,
  } = useBrowseData(query);

  // 下拉刷新：智能检索重跑当前筛选；直链搜索重跑当前关键词；meta 记录当前搜索/分类参数
  usePullToRefresh(() => {
    if (searchMode === 'cms') {
      searchCMS(query);
    } else {
      refreshNow();
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
    page: cmsPage,
    canGoBack: cmsCanGoBack,
    totalSources,
    completedSources,
    failedSources,
    search: searchCMS,
    goToPage: goToPageCMS,
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
  const lastSmartSearchedRef = useRef('');
  const filterSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSearch = useCallback((q: string, mode: SearchMode) => {
    if (!q) return;
    if (mode === 'cms') {
      // 搜索词未变化时不重复调用 CMS 查询接口（如切换"直链搜索"tab）
      if (lastCmsSearchedRef.current === q) return;
      lastCmsSearchedRef.current = q;
      searchCMS(q);
    } else {
      lastSmartSearchedRef.current = q;
      void useTMDBStore.getState().search(q, 1, { reset: true });
    }
  }, [searchCMS]);

  // ── 搜索模式切换 ────────────────────────────────
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (mode === 'cms') {
      // 切入直链搜索：本地筛选复位（不写 URL、不影响智能检索的 filterValue）
      setCmsFilterValue(getDefaultFilterValue());
      if (query) {
        triggerSearch(query, 'cms');
      } else {
        // 搜索词已清空时切到「直链搜索」：无关键词可搜，清空残留的 CMS 结果
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
    } else if (query) {
      triggerSearch(query, 'smart');
    }
  }, [query, triggerSearch, resetCMS]);

  // ── 筛选条件变更：保留搜索词，重新触发搜索 ──────────
  const handleFilterChange = useCallback((next: FilterBarValue) => {
    updateFilter(next);
    // 同步更新 store 的 filterOptions，确保搜索结果按新筛选条件过滤
    useTMDBStore.getState().setFilter(toStoreFilter(next));
    // 有搜索词时防抖触发搜索，快速切换筛选时避免请求抖动
    if (query) {
      if (filterSearchTimerRef.current) clearTimeout(filterSearchTimerRef.current);
      filterSearchTimerRef.current = setTimeout(() => {
        triggerSearch(query, searchMode);
      }, 300);
    }
  }, [query, updateFilter, triggerSearch, searchMode]);

  // ── 注册顶部导航栏搜索回调 ──────────────────────
  const handlePageSearch = useCallback((q: string) => {
    setQuery(q);
    if (q) {
      triggerSearch(q, searchMode);
    } else {
      if (searchMode === 'smart') {
        lastSmartSearchedRef.current = '';
        if (filterValue.category === 'top') {
          void useTMDBStore.getState().fetchTopRated(1, { reset: true });
        } else {
          void useTMDBStore.getState().fetchDiscover(1, { reset: true });
        }
      } else {
        lastCmsSearchedRef.current = '';
        resetCMS();
      }
    }
  }, [searchMode, triggerSearch, filterValue.category, resetCMS]);

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

  // 从顶部导航搜索进入：用 location.state 或 ?q= 中的最新搜索词触发搜索
  // 注意：必须读 stateQ/urlQ（同步变量）而非 query（异步 state）——
  // location.key 变化时 setQuery 尚未生效，query 仍是上一次的旧值。
  useEffect(() => {
    // POP 导航（刷新/后退）不触发搜索
    if (isPop) return;
    const q = stateQ || urlQ;
    if (q) {
      if (searchMode === 'smart') {
        void useTMDBStore.getState().search(q, 1, { reset: true });
        lastSmartSearchedRef.current = q;
      } else {
        searchCMS(q);
        lastCmsSearchedRef.current = q;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, isPop]);

  // ── 分类导航进入：清空残留搜索词 + 立即刷新（跳过 filterSig 300ms debounce）──
  // useLayoutEffect 保证绘制前完成：清空 query 后顶部搜索框首帧即为空、
  // refreshNow 同步清空 store 旧结果并置 loading，首帧即显示 loading 遮罩，
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
    lastSmartSearchedRef.current = '';
    resetCMS();
    refreshNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.pathname]);

  // ── TMDB 页数硬顶（2026-09-12 用户反馈「点最后一页显示空结果且分页组件消失」）──
  // TMDB discover/search 实际最多返回 500 页：total_pages 会报 2124 这类数字，
  // 但请求 >500 页一律返回空 results → 空态 + 分页器随之消失。统一钳制到 500。
  const effectiveTotalPages = Math.min(discoverPagination.totalPages, 500);

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
  //    handlePageChange 的声明位置在其之后（deps 引用 logicalGoto）。

  /** 分页器是否值得渲染：TMDB 有 totalPages 可判；CMS 总页数不可知，
      退化为「已翻过页」或「本页有内容（下一页可能还有）」。
      2026-09-12：结果为空（如钳制边界外的页）时也保留分页器，让用户能翻回去。 */
  const showPagination =
    searchMode === 'smart'
      ? effectiveTotalPages > 1 || discoverResults.length > 0
      : cmsPage > 1 || cmsHasMore;

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
  const isSmartLoading = isRefreshing || isLoading;
  const isCmsLoading = cmsLoading;

  // ── 逻辑分页组装层（2026-09-12 用户拍板）：每页恒定 cols×5 行、行行完整、
  //    总页数按每页条数折算。逻辑页 L 覆盖全局条目 [(L-1)P, LP)，按算术定位所需
  //    TMDB 合并页（至多 2 个请求 + offset 切片）；TMDB 硬顶 500 页 → 可达条目
  //    上限 = 500×合并页大小，一并钳进总页数。 ──
  const cardCols = useCardCols();
  const fetchTmdbPage = useCallback(async (t: number) => {
    // 先等 store 上既有 discover 请求落地（上下文切换会自带一次 page=1 拉取），
    // 否则 goToPage 会因 loading.discover 守卫静默 no-op，拿到的是别页数据
    let guard = 0;
    while (useTMDBStore.getState().loading.discover && guard < 100) {
      await new Promise<void>((r) => setTimeout(r, 100));
      guard += 1;
    }
    await goToPageTMDB(t, query || undefined);
    return useTMDBStore.getState().discoverResults;
  }, [goToPageTMDB, query]);
  const logicalContext = `smart:${query}:${JSON.stringify(filterValue)}`;
  const logical = useLogicalPage({
    cols: cardCols,
    mergedPageSize: query ? 20 : 40,
    contextKey: logicalContext,
    fetchPage: fetchTmdbPage,
    total: pinnedTotal || discoverPagination.totalResults,
  });
  // 首次挂载 / 上下文变化（换词/换筛选/切分类）→ 装载第 1 页。
  // goto 走 ref 转发：total 钉定会使 logicalGoto 换身份，若直接进 deps 会多拉一次页 1。
  const logicalGotoRef = useRef(logical.goto);
  logicalGotoRef.current = logical.goto;
  const logicalGoto = logical.goto;
  useEffect(() => {
    void logicalGotoRef.current(1);
  }, [logicalContext]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (searchMode === 'cms') {
        void goToPageCMS(query, page);
      } else {
        void logicalGoto(page);
      }
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchMode, query, goToPageCMS, logicalGoto, scrollContainerRef],
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

  const isEmpty = !(searchMode === 'smart' ? isSmartLoading : isCmsLoading) && (searchMode === 'smart' ? discoverResults.length === 0 : filteredCmsResults.length === 0);
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
                  <Icon icon={Loader2} size="xs" className="browse-count-spin" />
                  搜索中…
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
        <div className="browse-results-body">
          {/* 结果区专属骨架：结构对齐真实「类型/排序行 + 卡片网格」，
              列数随 --card-cols 视口分档（不再用全站统一 AppLoading 菊花） */}
          {showResultsLoading && (
            <BrowseSkeleton />
          )}

          {!showResultsLoading && currentError && (searchMode === 'smart' ? discoverResults.length === 0 : cmsResults.length === 0) && (
            <Empty title="暂无结果" description="尝试换个关键词搜索" />
          )}

          {!showResultsLoading && isEmpty && !currentError && (
            <Empty
              title="暂无结果"
              description={query ? '尝试换个关键词搜索' : '请输入关键词搜索'}
            />
          )}

          {!showResultsLoading && (searchMode === 'smart' ? (
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
              variant={searchMode === 'smart' ? 'numbered' : 'simple'}
              page={searchMode === 'smart' ? logical.page : cmsPage}
              totalPages={searchMode === 'smart' ? logical.totalPages : 0}
              canGoBack={searchMode === 'smart' ? logical.page > 1 : cmsCanGoBack}
              hasNext={searchMode === 'smart' ? logical.page < logical.totalPages : cmsHasMore}
              disabled={showResultsLoading || (searchMode === 'smart' ? isLoadingMore : cmsLoading)}
              onChange={handlePageChange}
            />
          )}

        </div>
      </div>

      <BackToTopButton />
    </div>
  );
}

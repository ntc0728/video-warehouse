/**
 * 视频详情页面 — ouonnki 设计风格
 *
 * Hero：全屏 backdrop + 双层渐变 + logo/标签/简介 + 毛玻璃按钮 + 桌面端右侧海报
 * 内容区：三 Tab（基础信息/播放列表/季信息）+ VideoCard 推荐行
 */
import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigationType } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useUserStore, useSettingsStore, useKeepAliveStore } from '@/stores';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { searchVideoFromMultipleSources, searchVideoSeasonsFromSingleSource, getVideoSources } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, fetchMovieImages, fetchTVImages, buildImageUrl } from '@/services/tmdbService';
import { useSmartBack } from '@/lib/navigation';
import type { Video } from '@/types/video';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBSeason, TMDBCastMember } from '@/types/tmdb';
import { AppLoading, BackToTopButton } from '@/components/common';
import { useDocumentTitle } from '@/hooks';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { VideoCard } from '@/components/VideoCard';
import StillsLightbox from '@/components/StillsLightbox/StillsLightbox';
import Modal from '@/components/ui/Modal';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import {
  Play, Heart, Star, Calendar, ArrowLeft,
  Info, ListVideo, Layers, AlertTriangle, WifiOff,
  RefreshCw, Server, ExternalLink,
} from 'lucide-react';
import './Detail.css';

// ── 常量 ──────────────────────────────────────────────

const CMS_DEBOUNCE_MS = 2000;

const typeLabels: Record<string, string> = {
  movie: '电影', tv: '剧集', variety: '综艺', anime: '动漫',
};

type DetailTab = 'info' | 'sources' | 'seasons';

interface DetailSourceResult {
  sourceIndex: number;
  sourceId: string;
  sourceName: string;
  video: Video | null;
  seasons: Video[];
  seasonNumbers: number[];
  isSeries: boolean;
  error?: string;
}

/** 去掉标题中的「第一季 / 第1季 / 第12季」等季号字眼，仅保留剧集原名 */
function stripSeasonLabel(name: string): string {
  return name.replace(/第[一二三四五六七八九十百零0-9]+季/g, '').trim();
}

// ── 映射 TMDB → VideoCard 兼容格式 ────────────────────

type TMDBResultItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

function toVideoItem(item: TMDBResultItem, mediaType: 'movie' | 'tv'): Video {
  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: mediaType === 'tv' ? item.name ?? '' : item.title ?? '',
    cover: buildImageUrl(item.poster_path, 'w342') || '',
    type: mediaType,
    year: item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.first_air_date
        ? new Date(item.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: item.overview,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================================
export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useCustomNavigate();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();
  const { isCollected, addCollection, removeCollection, getHistoryByVideo } = useUserStore();

  // ── 非沉浸式 Header（hero 不被导航栏覆盖） ──
  useHeaderContent();

  // ── 智能回退 ──────────────────────────────
  const handleBack = useSmartBack('/');

  // ── 滚动位置保存/恢复（由 useScrollRestore 接管，原内联 useEffect 已删除） ────
  // 传入 isActive：仅当本页确为当前可见路由（pathname 仍是 /detail/*）时才参与恢复，
  // 避免 Keep-Alive 隐藏态下的 detail 组件篡改共享容器滚动位置。
  useScrollRestore(`detail:${id}`, undefined, location.pathname.startsWith('/detail'));

  // 前进（PUSH/REPLACE）进入新的详情页时归顶；返回（POP）由 useScrollRestore 恢复，不覆盖。
  const scrollContainerRef = useScrollContainer();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === 'POP') return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
  }, [id, navigationType, scrollContainerRef]);

  // ── 状态 ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const visitedTabsRef = useRef(new Set<DetailTab>(['info']));

  const [tmdbLoading, setTmdbLoading] = useState(true);
  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');

  // 剧照
  const [stills, setStills] = useState<string[]>([]);
  const [stillsLoading, setStillsLoading] = useState(false);

  // 剧照灯箱
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 演员折叠（全视口统一：超过 2 行即折叠，展开按钮按实际溢出检测显示）
  const [castExpanded, setCastExpanded] = useState(false);
  const [castOverflow, setCastOverflow] = useState(false);
  const castRowRef = useRef<HTMLDivElement>(null);

  // CMS
  const [cmsResults, setCmsResults] = useState<DetailSourceResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsLoaded, setCmsLoaded] = useState(false);
  const [cmsError, setCmsError] = useState<string | null>(null);
  // 查询动画轮播的源名称（加载开始后填充真实 CMS 源名）
  const [querySourceNames, setQuerySourceNames] = useState<string[]>([]);
  const [queryMsgIndex, setQueryMsgIndex] = useState(0);
  const cmsLastFetchRef = useRef(0);
  const cmsAbortRef = useRef<AbortController | null>(null);

  // 播放列表「全部」弹框状态
  const [playModal, setPlayModal] = useState<{
    sourceIndex: number;
    sourceName: string;
    video: Video;
    seasons: Video[];
    seasonNumbers: number[];
    isSeries: boolean;
  } | null>(null);
  const [activeSeasonIndex, setActiveSeasonIndex] = useState(0);

  /** 是否有可播放线路（剧集：任一选集含线路；单集/电影：sources 非空） */
  const isPlayable = useCallback((v: Video | undefined) => {
    if (!v) return false;
    if (v.episodes && v.episodes.length > 0) {
      return v.episodes.some((ep) => ep.sources.length > 0);
    }
    return v.sources.length > 0;
  }, []);

  // 仅展示有匹配结果的源（不可用源不单独提示）
  const availableResults = useMemo(
    () => cmsResults.filter((r) => r.video),
    [cmsResults],
  );

  // 剧照网格：根据容器实际列数限制显示 2 行
  const stillsGridRef = useRef<HTMLDivElement | null>(null);
  const stillsRORef = useRef<ResizeObserver | null>(null);
  const stillsRafRef = useRef(0);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const measureStills = useCallback(() => {
    const container = stillsGridRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const tpl = getComputedStyle(container).gridTemplateColumns;
    if (w > 0 && tpl && tpl !== 'none' && tpl.trim() !== '') {
      // 容器可见且网格样式已生效：浏览器已解析出真实列数（最精确）
      setVisibleCount(tpl.split(' ').filter(Boolean).length * 2);
      return;
    }
    if (w === 0) {
      // 容器不可见（keep-alive 隐藏为 display:none 时 clientWidth=0）时无法测量，
      // 用视口宽度估算兜底，避免 visibleCount 永远停在 null 导致剧照全部平铺；
      // 页面显示后 ResizeObserver 会用上面的精确值纠正。
      const vw = window.innerWidth;
      if (vw <= 0) return;
      let actualCols: number;
      if (vw <= 767) {
        // 移动端 CSS 固定 2 列（@media (width <= 767px): repeat(2, 1fr)）
        actualCols = 2;
      } else {
        // CSS: minmax(clamp(8rem, 6rem + 8vw, 16rem), 1fr)
        const colMin = Math.min(256, Math.max(128, 96 + 0.08 * vw));
        const gap = 12; // 与 Detail.css --space-sm 对齐
        actualCols = Math.max(1, Math.floor((vw + gap) / (colMin + gap)));
      }
      setVisibleCount(actualCols * 2);
    }
    // 其余情况：容器可见（w>0）但网格样式尚未生效（gridTemplateColumns 仍为 none，
    // 常见于冷加载 CSS 晚于 JS 渲染）。此时不提交基于视口的估算值（会高估列数、
    // 导致截断行数偏多），交由挂载时的 requestAnimationFrame 重试，待 display:grid
    // 就绪后取到真实列数再提交，避免「未截断 / 截断过多」的闪烁。
  }, []);

  // 回调 ref：真实剧照网格挂载的那一次 commit（浏览器绘制前）同步测量。
  // 之所以不用 useLayoutEffect + 依赖数组：setStills 在 .then()、setStillsLoading(false)
  // 在 .finally()，分属不同微任务，React 可能拆成两次 flush，effect 的执行时机与
  // 「真实 grid（带 ref）替换骨架 div」的那次渲染极易错拍——一旦错过，visibleCount
  // 永远为 null，剧照全部平铺（“首次进入未按预期截断”的根因）。回调 ref 由 React
  // 在节点 attach/detach 时精确调用，天然与 DOM 就绪同步，无时序竞态。
  const setStillsGridRef = useCallback((node: HTMLDivElement | null) => {
    stillsRORef.current?.disconnect();
    stillsRORef.current = null;
    cancelAnimationFrame(stillsRafRef.current);
    stillsGridRef.current = node;
    if (!node) return;
    // commit 阶段、绘制前完成首次测量，消除「全部剧照先出现再塌陷」的闪烁
    measureStills();
    // CSS 可能晚于 JS 生效：连续若干帧重算，确保 display:grid 就绪后取到真实列数
    let tries = 0;
    const schedule = () => {
      if (tries++ >= 6) return;
      stillsRafRef.current = requestAnimationFrame(() => {
        measureStills();
        schedule();
      });
    };
    schedule();
    const ro = new ResizeObserver(measureStills);
    ro.observe(node);
    stillsRORef.current = ro;
  }, [measureStills]);

  // ── TMDB 加载 ────────────────────────────────
  // 用 useLayoutEffect：id 变化时在「绘制前」同步清空旧数据，避免 Keep-Alive 复用
  // 同一实例时，hero 先以「上一个 detail 的 tmdbDetail」绘制一帧（封面/名称闪旧内容）。
  useLayoutEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    setTmdbLoading(true); setTmdbError(null); setTmdbDetail(null); setBgLoaded(false);
    setCmsLoaded(false); setCmsResults([]); setCmsError(null);
    setActiveTab('info');

    (async () => {
      try {
        if (!id.startsWith('tmdb-')) { setTmdbError('暂仅支持 TMDB 影片'); return; }
        const parts = id.replace('tmdb-', '').split('-');
        const mt = parts[0] as 'movie' | 'tv';
        const tid = parseInt(parts.slice(1).join('-'), 10);
        setTmdbMediaType(mt);
        if (isNaN(tid)) { setTmdbError('无效的 TMDB ID'); return; }
        const detail = mt === 'tv'
          ? await fetchTVDetail(tid, { signal: ctrl.signal })
          : await fetchMovieDetail(tid, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setTmdbDetail(detail);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setTmdbError(err instanceof Error ? err.message : '加载失败');
      } finally { if (!ctrl.signal.aborted) setTmdbLoading(false); }
    })();

    return () => ctrl.abort();
  }, [id]);

  // ── CMS 按需加载 ─────────────────────────────
  const fetchCMSSources = useCallback(async () => {
    if (!id || !tmdbDetail) return;
    const now = Date.now();
    if (now - cmsLastFetchRef.current < CMS_DEBOUNCE_MS) return;
    cmsLastFetchRef.current = now;
    if (cmsAbortRef.current) cmsAbortRef.current.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    setCmsLoading(true); setCmsError(null); setCmsResults([]);

    const indices = videoSourceIndices && videoSourceIndices.length > 0
      ? videoSourceIndices
      : [videoSourceIndex];

    // 填充查询动画轮播用的真实源名称
    try {
      const allSources = await getVideoSources();
      const names = indices
        .map((i) => allSources[i]?.name)
        .filter((n): n is string => Boolean(n));
      setQuerySourceNames(names.length > 0 ? names : ['视频源']);
      setQueryMsgIndex(0);
    } catch {
      setQuerySourceNames(['视频源']);
    }

    const videoTitle = title || '';
    const videoYear = year;

    try {
      let results: DetailSourceResult[];
      if (tmdbMediaType === 'tv') {
        // 剧集：获取 CMS 查到的所有季（所有结果）
        const settled = await Promise.allSettled(
          indices.map(async (index) => {
            if (ctrl.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            const res = await searchVideoSeasonsFromSingleSource(index, videoTitle, videoYear, ctrl.signal);
            const entries = Array.from(res.seasons.entries()).sort((a, b) => a[0] - b[0]);
            let seasonVideos = entries.map(([, v]) => v);
            let seasonNums = entries.map(([n]) => n);
            // 降级：CMS 未按季拆分时，整剧作为单季
            if (seasonVideos.length === 0) {
              const single = await searchVideoFromMultipleSources([index], videoTitle, videoYear, ctrl.signal);
              const v0 = single[0]?.video;
              if (v0) { seasonVideos = [v0]; seasonNums = [1]; }
            }
            return {
              sourceIndex: res.sourceIndex,
              sourceId: res.sourceId,
              sourceName: res.sourceName,
              video: seasonVideos[0] ?? null,
              seasons: seasonVideos,
              seasonNumbers: seasonNums,
              isSeries: seasonVideos.length > 0,
              error: seasonVideos.length > 0 ? undefined : (res.error ?? '未找到匹配资源'),
            } as DetailSourceResult;
          }),
        );
        results = settled.map((r, i) => {
          if (r.status === 'fulfilled') return r.value;
          return {
            sourceIndex: indices[i], sourceId: '', sourceName: '未知',
            video: null, seasons: [], seasonNumbers: [], isSeries: false,
            error: r.reason instanceof Error ? r.reason.message : '请求失败',
          } as DetailSourceResult;
        });
      } else {
        // 电影：带年份限制搜索，取最佳匹配
        const rs = await searchVideoFromMultipleSources(indices, videoTitle, videoYear, ctrl.signal);
        results = rs.map((r) => ({ ...r, seasons: [], seasonNumbers: [], isSeries: false }) as DetailSourceResult);
      }
      if (ctrl.signal.aborted) return;

      setCmsResults(results);
      setCmsLoaded(true);
    } catch (err) {
      if (!ctrl.signal.aborted) setCmsError(err instanceof Error ? err.message : '获取播放源失败');
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tmdbDetail, videoSourceIndex, videoSourceIndices]);

  useEffect(() => {
    if (activeTab === 'sources' && !cmsLoaded && !cmsLoading) fetchCMSSources();
  }, [activeTab, cmsLoaded, cmsLoading, fetchCMSSources]);

  // 查询动画：加载期间逐条轮播源名称文案
  useEffect(() => {
    if (!cmsLoading) return;
    setQueryMsgIndex(0);
    const t = setInterval(() => setQueryMsgIndex((i) => i + 1), 1600);
    return () => clearInterval(t);
  }, [cmsLoading]);

  useEffect(() => () => cmsAbortRef.current?.abort(), []);

  // ── 剧照加载（专用 /images 接口，带 include_image_language 取全语言 backdrops） ─────────
  // 注意：detail 主请求带 language=zh-CN 时，append_to_response=images 会按语言过滤
  // backdrops（仅保留 zh/空语言），导致大量英文影视剧照被丢弃而“消失”。因此剧照
  // 必须走专用 /images 端点（已显式传 include_image_language: 'zh,en,null'），
  // 而非从 tmdbDetail.images 提取。
  useEffect(() => {
    if (!id || !id.startsWith('tmdb-')) return;
    const parts = id.replace('tmdb-', '').split('-');
    const mt = parts[0] as 'movie' | 'tv';
    const tid = parseInt(parts.slice(1).join('-'), 10);
    if (isNaN(tid)) return;

    const ctrl = new AbortController();
    setStillsLoading(true);
    const req = mt === 'tv'
      ? fetchTVImages(tid, { signal: ctrl.signal })
      : fetchMovieImages(tid, { signal: ctrl.signal });

    req
      .then((data) => {
        if (ctrl.signal.aborted) return;
        const urls = (data.backdrops || [])
          .map((b) => buildImageUrl(b.file_path, 'w1280'))
          .filter((u): u is string => Boolean(u));
        setStills(urls);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        // 剧照加载失败时静默降级，不阻塞概览页其余内容
        console.warn('[Detail] 剧照加载失败:', err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setStillsLoading(false);
      });

    return () => ctrl.abort();
  }, [id]);

  // ── 收藏 ──────────────────────────────────────
  const collected = id ? isCollected(id) : false;
  const handleCollect = useCallback(() => {
    if (!id) return;
    if (collected) removeCollection(id);
    else addCollection(id, { title, cover: posterUrl, type: tmdbMediaType, year, rating: voteAverage });
    // title/cover/... 是 useMemo 派生量，闭包跟随 tmdbDetail 渲染而更新；此处只在点击时读取，不在 effect 中使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, collected, addCollection, removeCollection, tmdbDetail]);

  // ── 播放 ──────────────────────────────────────
  // 进入 /play 前 pin 当前 detail，使其被 AppLayout 挂起缓存；从 /play 返回时瞬时恢复。
  // 其他进入 detail 的路径（首页/Browse/推荐/前进后退）不 pin，detail 重新挂载并重新加载。
  const handlePlay = () => {
    if (!id) return;
    useKeepAliveStore.getState().pinDetail(id);
    navigate(`/play/${id}`, { state: { from: `/detail/${id}` } });
  };
  const handlePlayFromBeginning = () => {
    if (!id) return;
    useKeepAliveStore.getState().pinDetail(id);
    navigate(`/play/${id}`, { state: { from: `/detail/${id}`, skipHistory: true } });
  };

  // ── 派生数据 ──────────────────────────────────
  const d = tmdbDetail;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  }

  // ── 动态页签标题 ──────────────────────────────
  // 守卫：仅当当前确实处于详情路由时才写入标题。
  // 详情页是 Keep-Alive 常驻挂载，离开（pathname 变为 '/' 等）后组件不卸载，
  // 若仍用旧 contentTitle 写 document.title 会覆盖新页面的标题，造成"返回首页后
  // 页签仍显示详情标题"的概率性残留。离开后传 null → 由当前路由标题接管。
  useDocumentTitle(location.pathname.startsWith('/detail') ? (title || null) : null);

  const isTV = d ? 'name' in d : false;
  const logoPath = d?.images?.logos?.find((l) => l.iso_639_1 === 'zh' || l.iso_639_1 === 'en')?.file_path;
  let year: number | undefined;
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  }
  const backdropUrl = d?.backdrop_path ? buildImageUrl(d.backdrop_path, 'w1280') || '' : '';
  const posterUrl = d?.poster_path ? buildImageUrl(d.poster_path, 'w342') || '' : '';
  const [bgLoaded, setBgLoaded] = useState(false);
  // 背景图加载超时：3 秒后强制显示内容，不阻塞用户交互
  const bgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bgLoaded) { if (bgTimeoutRef.current) clearTimeout(bgTimeoutRef.current); return; }
    bgTimeoutRef.current = setTimeout(() => setBgLoaded(true), 10000);
    return () => { if (bgTimeoutRef.current) clearTimeout(bgTimeoutRef.current); };
  }, [bgLoaded]);
  const overview = d?.overview || '';
  const voteAverage: number = d?.vote_average ?? 0;
  const voteCount: number = d?.vote_count ?? 0;
  const popularity: number = d?.popularity ?? 0;
  const runtime = isTV ? (d as TMDBTVShowDetail | undefined)?.episode_run_time?.[0] : (d as TMDBMovieDetail | undefined)?.runtime;
  const countries = d?.production_countries?.map((c) => c.name) || [];
  const companies = d?.production_companies?.slice(0, 3) || [];
  const cast: TMDBCastMember[] = d?.credits?.cast || [];

  // 演员行溢出检测：折叠态下 scrollHeight > clientHeight 即超过 2 行，显示展开按钮。
  // ResizeObserver 覆盖窗口缩放与 Keep-Alive 隐藏页（尺寸 0）显示后的纠正场景。
  useEffect(() => {
    const el = castRowRef.current;
    if (!el) return;
    const measure = () => setCastOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cast.length]);
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name;
  const genres = d?.genres || [];
  const status = d?.status || '';
  const originalLanguage = d?.original_language || '';
  const spokenLanguages = d?.spoken_languages?.map((l) => l.name || l.english_name) || [];
  const tvDetail = isTV ? (d as TMDBTVShowDetail) : undefined;
  const createdBy = tvDetail?.created_by?.map((c) => c.name) || [];
  const inProduction = tvDetail?.in_production;
  const lastAirDate = tvDetail?.last_air_date || '';
  const seasons: TMDBSeason[] = isTV ? ((d as TMDBTVShowDetail | undefined)?.seasons || []) : [];
  const totalSeasons = isTV ? ((d as TMDBTVShowDetail | undefined)?.number_of_seasons || 0) : 0;
  const totalEpisodes = isTV ? ((d as TMDBTVShowDetail | undefined)?.number_of_episodes || 0) : 0;
  const similarResults: TMDBResultItem[] = d?.similar?.results?.slice(0, 12) || [];
  const recommendedResults: TMDBResultItem[] = d?.recommendations?.results?.slice(0, 12) || [];
  const homepage = d?.homepage || '';

  // ── 观看历史与进度 ──────────────────────────────
  const historyRecord = id ? getHistoryByVideo(id) : undefined;
  const hasWatchingHistory = !!historyRecord && historyRecord.progress > 0;
  const watchProgressPercent = hasWatchingHistory && historyRecord.duration > 0
    ? Math.round((historyRecord.progress / historyRecord.duration) * 100)
    : 0;
  // 直接读取历史记录中从源头写入的季号：季号 + 选集标签 → 「第X季 第Y集」
  // 旧数据无 seasonNumber 时回退到 episodeLabel（第Y集），不会退化
  const lastEpisodeLabel = historyRecord?.seasonNumber && historyRecord?.episodeLabel
    ? `第${historyRecord.seasonNumber}季 ${historyRecord.episodeLabel}`
    : historyRecord?.episodeLabel;

  // 有限 Keep-Alive 下，detail 不做 navStore 状态恢复：
  // - pin 的 play→detail 路径组件不重挂载，state 自然保留；
  // - 其他路径 detail 重新挂载，应重新加载（而非恢复旧内容）。
  // 组件卸载（离开 detail）时解除 pin，使 detail 不再常驻。
  useEffect(() => {
    return () => {
      if (!id) return;
      useKeepAliveStore.getState().unpinDetail();
    };
  }, [id]);

  // ── Loading ──────────────────────────────────
  if (tmdbLoading) return <div className="page-padding detail-page detail-page--loading"><AppLoading /></div>;

  // ── Error ────────────────────────────────────
  if (tmdbError || !tmdbDetail) {
    return (
      <div className="page-padding detail-page page-transition-enter">
        <div className="detail-not-found">
          <AlertTriangle size={48} />
          <span>{tmdbError || '影片不存在'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-padding detail-page page-transition-enter" key={id}>
      {/* ══════════════════════════════════════════════
          HERO：全屏 backdrop + 双层渐变
          ══════════════════════════════════════════════ */}
      <section className={`detail-hero${bgLoaded ? '' : ' detail-hero--skeleton'}`}>
        {backdropUrl && (
          <img className="detail-hero-bg" src={backdropUrl} alt="" width={1920} height={1080} onLoad={() => setBgLoaded(true)} />
        )}
        {/* 双层渐变遮罩 */}
        <div className="detail-hero-gradient detail-hero-gradient-1" />
        <div className="detail-hero-gradient detail-hero-gradient-2" />

        {/* 返回按钮 */}
        <button className="detail-hero-back" onClick={handleBack} aria-label="返回">
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>

        {/* 官网链接 */}
        {homepage && (
          <a href={homepage} target="_blank" rel="noreferrer" className="detail-official-link">
            <ExternalLink size={16} />
            <span>官方页面</span>
          </a>
        )}

        {/* Hero 内容 */}
        <div className="detail-hero-content">
          <div className="detail-hero-left">
            {/* Logo 或标题 */}
            {logoPath ? (
              <img className="detail-hero-logo" src={buildImageUrl(logoPath, 'w342') || ''} alt={title} width={400} height={150} />
            ) : (
              <h1 className="detail-hero-title">{title}</h1>
            )}
            {/* 标语 */}
            {d?.tagline && <p className="detail-hero-tagline">{d.tagline}</p>}

            {/* Meta 行（对齐轮播图风格） */}
            <div className="detail-hero-meta">
              <span className="detail-hero-rating">★ {voteAverage > 0 ? voteAverage.toFixed(1) : ''}</span>
              {year && <span className="detail-hero-meta-item">{year}</span>}
              <span className="detail-hero-meta-item detail-hero-meta-item--type">
                {typeLabels[tmdbMediaType]}
              </span>
              {tmdbMediaType === 'tv' && totalSeasons > 0 && (
                <span className="detail-hero-meta-item">{totalSeasons} 季 / {totalEpisodes} 集</span>
              )}
              {runtime && <span className="detail-hero-meta-item">{runtime} 分钟</span>}
              {popularity > 0 && (
                <span className="detail-hero-meta-item">🔥 {popularity.toFixed(0)}</span>
              )}
            </div>

            {/* 简介 */}
            {overview && <p className="detail-hero-desc">{overview}</p>}

            {/* 操作按钮 */}
            <div className="detail-hero-actions">
              <button className="detail-btn detail-btn-play" onClick={handlePlay}>
                <Play size={18} fill="currentColor" />
                {hasWatchingHistory ? '继续播放' : '立即播放'}
              </button>
              {hasWatchingHistory && (
                <button className="detail-btn detail-btn-play-from-start" onClick={handlePlayFromBeginning}>
                  从头播放
                </button>
              )}
              <button className={`detail-btn detail-btn-collect ${collected ? 'active' : ''}`} onClick={handleCollect} aria-pressed={collected}>
                <Heart size={18} fill={collected ? 'var(--color-favorite-active)' : 'none'}
                  color={collected ? 'var(--color-favorite-active)' : 'currentColor'} />
                {collected ? '已收藏' : '加入收藏'}
              </button>
            </div>

            {/* 观看进度 */}
            {hasWatchingHistory && (
              <div className="detail-progress-row">
                <span className="detail-progress-label">
                  {lastEpisodeLabel && tmdbMediaType === 'tv'
                    ? `已播放：${lastEpisodeLabel}`
                    : '已播放'}
                </span>
                <span className="detail-progress-time">
                  {watchProgressPercent}% · {formatProgressTime(historyRecord.progress)} / {formatProgressTime(historyRecord.duration)}
                </span>
              </div>
            )}
          </div>

          {/* 桌面端右侧海报 */}
          {posterUrl && (
            <div className="detail-hero-poster">
              <img src={posterUrl} alt={title} width={300} height={450} />
              {hasWatchingHistory && (
                <div className="detail-hero-poster-progress">
                  <div
                    className="detail-hero-poster-progress-bar"
                    style={{ width: `${watchProgressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          Tab 导航（-mt-px 与 hero 重叠）
          ══════════════════════════════════════════════ */}
      <div className="detail-tabs-wrap">
        <div className="detail-tabs">
          {([
            { key: 'info' as DetailTab, icon: Info, label: '概览' },
            { key: 'sources' as DetailTab, icon: ListVideo, label: '播放列表' },
            ...(tmdbMediaType === 'tv' ? [{ key: 'seasons' as DetailTab, icon: Layers, label: '季信息' }] : []),
          ]).map((tab) => (
            <button
              key={tab.key}
              className={`tab-underline detail-tab ${activeTab === tab.key ? 'tab-underline--active detail-tab--active' : ''}`}
              onClick={() => {
                visitedTabsRef.current.add(tab.key);
                setActiveTab(tab.key);
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Tab 内容区
          ══════════════════════════════════════════════ */}
      <div className="detail-content">
        {/* 概览 */}
        {activeTab === 'info' && (
          <div className="detail-info">
            <h2 className="detail-section-title">基础信息</h2>
            {/* 类型标签 */}
            {genres.length > 0 && (
              <div className="detail-genres">
                {genres.map((g) => (
                  <span key={g.id} className="detail-genre-tag">{g.name}</span>
                ))}
              </div>
            )}
            <div className="detail-info-grid">
              {year && <div className="detail-info-card"><Calendar size={16} /><span>发行年份</span><strong>{year}</strong></div>}
              {status && <div className="detail-info-card"><Info size={16} /><span>状态</span><strong>{statusLabel(status)}</strong></div>}
              {runtime && <div className="detail-info-card"><ClockIcon size={16} /><span>时长</span><strong>{runtime} 分钟</strong></div>}
              {originalLanguage && <div className="detail-info-card"><GlobeIcon size={16} /><span>语言</span><strong>{originalLanguage.toUpperCase()}{spokenLanguages.length > 0 ? ` / ${spokenLanguages.slice(0, 3).join(' / ')}` : ''}</strong></div>}
              {voteAverage > 0 && (
                <div className="detail-info-card">
                  <Star size={16} />
                  <span>TMDB 评分</span>
                  <strong>{voteAverage.toFixed(1)} / 10{voteCount > 0 && <span className="detail-vote-count">（{formatVoteCount(voteCount)} 人评价）</span>}</strong>
                </div>
              )}
              {director && <div className="detail-info-card"><UsersIcon size={16} /><span>导演</span><strong>{director}</strong></div>}
              {isTV && createdBy.length > 0 && <div className="detail-info-card"><UsersIcon size={16} /><span>主创</span><strong>{createdBy.join(' / ')}</strong></div>}
              {countries.length > 0 && <div className="detail-info-card"><GlobeIcon size={16} /><span>国家</span><strong>{countries.join(' / ')}</strong></div>}
              {d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).budget > 0 && <div className="detail-info-card"><DollarIcon size={16} /><span>预算</span><strong>{formatCurrency((d as TMDBMovieDetail).budget)}</strong></div>}
              {d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).revenue > 0 && <div className="detail-info-card"><DollarIcon size={16} /><span>票房</span><strong>{formatCurrency((d as TMDBMovieDetail).revenue)}</strong></div>}
              {isTV && <div className="detail-info-card"><Layers size={16} /><span>季 / 集</span><strong>{totalSeasons} 季 / {totalEpisodes} 集</strong></div>}
              {isTV && inProduction !== undefined && <div className="detail-info-card"><RefreshCw size={16} /><span>制作中</span><strong>{inProduction ? '是' : '已完结'}</strong></div>}
              {isTV && lastAirDate && <div className="detail-info-card"><Calendar size={16} /><span>最后播出</span><strong>{lastAirDate}</strong></div>}
            </div>

            {/* 发行公司 — 独立一行 */}
            {companies.length > 0 && (
              <div className="detail-info-row">
                <FilmIcon size={16} />
                <span>发行</span>
                <strong className="detail-companies">
                  {companies.map((c) => (
                    <span key={c.id} className="detail-company">
                      {c.logo_path && <img src={buildImageUrl(c.logo_path, 'w92') || ''} alt={c.name} className="detail-company-logo" />}
                      {c.name}
                    </span>
                  ))}
                </strong>
              </div>
            )}

            {cast.length > 0 && (
              <>
                <h3 className="detail-section-subtitle">演员</h3>
                <div ref={castRowRef} className={`detail-cast-row${!castExpanded ? ' detail-cast-row--collapsed' : ''}`}>
                  {cast.map((c) => (
                    <a
                      key={c.id}
                      href={`/person/${c.id}`}
                      className="detail-cast-item"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/person/${c.id}`, { state: { from: `/detail/${id}` } });
                      }}
                    >
                      {c.profile_path ? (
                        <img src={buildImageUrl(c.profile_path, 'w185') || ''} alt={c.name} width={200} height={300} />
                      ) : (
                        <span className="detail-cast-avatar"><UsersIcon size={18} /></span>
                      )}
                      <span className="detail-cast-name">{c.name}</span>
                      <span className="detail-cast-role">{c.character}</span>
                    </a>
                  ))}
                </div>
                {(castOverflow || castExpanded) && (
                  <button className="detail-cast-toggle" onClick={() => setCastExpanded(!castExpanded)}>
                    {castExpanded ? '收起' : `展开全部 ${cast.length} 位演员`}
                  </button>
                )}
              </>
            )}

            {overview && (
              <>
                <h3 className="detail-section-subtitle">简介</h3>
                <p className="detail-overview-full">{overview}</p>
              </>
            )}

            {(stills.length > 0 || stillsLoading) && (
              <>
                <h3 className="detail-section-subtitle">剧照</h3>
                {stillsLoading ? (
                  <div className="detail-stills-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="detail-stills-skeleton" />
                    ))}
                  </div>
                ) : (
                   <div
                    ref={setStillsGridRef}
                    className={`detail-stills-grid${visibleCount != null ? ' detail-stills-grid--limited' : ''}`}
                  >
                    {stills.slice(0, visibleCount != null ? visibleCount : undefined).map((url, i) => {
                      const isLast = visibleCount != null && i === visibleCount - 1 && stills.length > visibleCount;
                      return (
                        <div
                          key={url}
                          className={`detail-stills-item${isLast ? ' detail-stills-item--more' : ''}`}
                          onClick={() => {
                            setLightboxIndex(i);
                            setLightboxOpen(true);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setLightboxIndex(i);
                              setLightboxOpen(true);
                            }
                          }}
                        >
                          <img
                            src={url}
                            alt={`剧照 ${i + 1}`}
                            loading="lazy"
                            width={1280}
                            height={720}
                          />
                          {isLast && (
                            <div className="detail-stills-more">
                              <span className="detail-stills-more__count">+{stills.length - (visibleCount as number)}</span>
                              <span className="detail-stills-more__text">查看更多</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 播放列表 */}
        {activeTab === 'sources' && (
          <div className="detail-sources">
            {cmsLoading ? (
              <div className="detail-sources-container">
                <div className="detail-sources-header">
                  <div className="detail-sources-header-left">
                    <h3>匹配结果</h3>
                    <span className="detail-sources-keyword">当前关键词："{title}"</span>
                  </div>
                </div>
                <div className="detail-sources-grid">
                  <div className="playlist-query" aria-busy="true" aria-label="正在匹配播放源">
                    <div className="playlist-query-spinner" aria-hidden="true" />
                    <p className="playlist-query-text">
                      {querySourceNames.length > 0
                        ? `正在查询${querySourceNames[queryMsgIndex % querySourceNames.length]}资源…`
                        : '正在匹配播放源…'}
                    </p>
                  </div>
                </div>
              </div>
            ) : cmsError ? (
              <div className="detail-state detail-state--error">
                <WifiOff size={32} /><p>{cmsError}</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><RefreshCw size={14} /> 重新获取</button>
              </div>
            ) : cmsResults.length > 0 ? (
              availableResults.length > 0 ? (
              <div className="detail-sources-container">
                <div className="detail-sources-header">
                  <div className="detail-sources-header-left">
                    <h3>匹配结果</h3>
                    <span className="detail-sources-keyword">当前关键词："{title}"</span>
                  </div>
                  <div className="detail-sources-toolbar">
                    <button className="retry-btn retry-btn--tab" onClick={fetchCMSSources}>
                      <RefreshCw size={14} /> 重新匹配
                    </button>
                  </div>
                </div>
                <div className="detail-sources-grid">
                  {availableResults.map((result) => {
                    const v = result.video!;
                    const playable = isPlayable(v);
                    const lineCount = v.sources.length;
                    const isSeries = result.isSeries;
                    const tvThumb = tmdbMediaType === 'tv' && !!posterUrl;
                    const groupTitle = tmdbMediaType === 'tv' ? stripSeasonLabel(v.title) : v.title;
                    const thumbYear = tvThumb ? year : v.year;
                    return (
                      <div key={result.sourceIndex} className="detail-source-group">
                        <div className="detail-source-group-header">
                          <span className="detail-source-name">{result.sourceName}</span>
                          <span className="detail-source-status detail-source-status--ok">可播放</span>
                        </div>
                        <div className="detail-source-group-body">
                          <div className="detail-source-thumb">
                            {tvThumb ? (
                              <img src={posterUrl} alt={title} />
                            ) : v.cover ? (
                              <img src={v.cover} alt={v.title} />
                            ) : (
                              <div className="detail-source-thumb-placeholder">
                                <Server size={20} />
                              </div>
                            )}
                            {thumbYear && (
                              <span className="detail-source-thumb-year">{thumbYear}</span>
                            )}
                          </div>
                          <div className="detail-source-info">
                            <div className="detail-source-title-row">
                              <span className="detail-source-title" title={groupTitle}>{groupTitle}</span>
                            </div>
                            <span className="detail-source-meta">
                              {isSeries
                                ? `共 ${result.seasons.length} 季`
                                : lineCount === 1
                                  ? (v.sources[0]?.name || '线路 1')
                                  : `${lineCount} 条线路`}
                            </span>
                          </div>
                          <div className="detail-source-actions">
                            {(isSeries || lineCount > 1) && (
                              <button
                                type="button"
                                className="detail-source-all-btn"
                                onClick={() => { setPlayModal({ sourceIndex: result.sourceIndex, sourceName: result.sourceName, video: v, seasons: result.seasons, seasonNumbers: result.seasonNumbers, isSeries: result.isSeries }); setActiveSeasonIndex(0); }}
                              >
                                <ListVideo size={12} /> 全部
                              </button>
                            )}
                            <button
                              className="detail-source-play-btn"
                              disabled={!playable}
                              onClick={() => { if (id) { useKeepAliveStore.getState().pinDetail(id); navigate(`/play/${id}`, { state: { from: `/detail/${id}`, sourceIndex: result.sourceIndex } }); } }}
                            >
                              <Play size={12} fill="currentColor" /> {playable ? '立即播放' : '无可用线路'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Modal
                  visible={!!playModal}
                  title={
                    playModal
                      ? (playModal.isSeries && playModal.seasons.length > 0
                          ? `${title} 第${playModal.seasonNumbers[Math.min(activeSeasonIndex, playModal.seasons.length - 1)] ?? Math.min(activeSeasonIndex, playModal.seasons.length - 1) + 1}季`
                          : (playModal.video?.title ?? '全部播放源'))
                      : '全部播放源'
                  }
                  onClose={() => setPlayModal(null)}
                  className="source-all-modal"
                >
                  {playModal && (() => {
                    const seasons = playModal.seasons;
                    const isSeries = playModal.isSeries && seasons.length > 0;
                    // 季 tab 按季号从小到大排列（显示顺序与数组索引分离，点击时再映射回原始索引）
                    const seasonOrder = isSeries
                      ? seasons.map((_, i) => i).sort((a, b) => (playModal.seasonNumbers[a] ?? a + 1) - (playModal.seasonNumbers[b] ?? b + 1))
                      : [];
                    const activeIdx = isSeries ? Math.min(activeSeasonIndex, seasons.length - 1) : 0;
                    const activeVideo = isSeries ? seasons[activeIdx] : playModal.video;
                    const sortedEps = activeVideo.episodes && activeVideo.episodes.length > 0
                      ? [...activeVideo.episodes].sort((a, b) => a.number - b.number)
                      : [];
                    const hasEps = sortedEps.length > 0;
                    return (
                      <div className="source-all-modal__body">
                        <div className="source-all-modal__head">
                          {activeVideo.cover ? (
                            <img className="source-all-modal__poster" src={activeVideo.cover} alt={activeVideo.title} />
                          ) : posterUrl ? (
                            <img className="source-all-modal__poster" src={posterUrl} alt={activeVideo.title} />
                          ) : (
                            <div className="source-all-modal__poster source-all-modal__poster--placeholder" />
                          )}
                          <div className="source-all-modal__meta">
                            <span className="source-all-modal__source">{playModal.sourceName}</span>
                            {!isSeries && (activeVideo.description || tmdbDetail?.overview) && (
                              <p className="source-all-modal__desc">{activeVideo.description || tmdbDetail?.overview}</p>
                            )}
                            {isSeries && (
                              <div className="source-all-modal__tabs">
                                {seasonOrder.map((origIdx) => (
                                  <button
                                    key={origIdx}
                                    type="button"
                                    className={`source-all-modal__tab${origIdx === activeIdx ? ' is-active' : ''}`}
                                    onClick={() => setActiveSeasonIndex(origIdx)}
                                  >
                                    {`第${playModal.seasonNumbers[origIdx] ?? origIdx + 1}季`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="source-all-modal__list">
                          <div className="source-all-modal__list-title">
                            {isSeries ? `选集（${sortedEps.length}）` : (hasEps ? `选集（${sortedEps.length}）` : `线路（${activeVideo.sources.length}）`)}
                          </div>
                          {isSeries && sortedEps.length === 0 ? (
                            <div className="source-all-modal__empty">该季暂无集数信息</div>
                          ) : hasEps ? (
                            sortedEps.map((ep) => (
                              <div key={ep.id} className="source-all-modal__row">
                                <div className="source-all-modal__row-info">
                                  <span className="source-all-modal__row-title">第 {ep.number} 集</span>
                                </div>
                                <button
                                  className="source-all-modal__play-btn"
                                  disabled={ep.sources.length === 0}
                                  onClick={() => {
                                    navigate(`/play/${id}`, {
                                      state: { from: `/detail/${id}`, sourceIndex: playModal.sourceIndex, seasonNumber: playModal.seasonNumbers[activeIdx], playUrl: ep.sources[0]?.url, playType: ep.sources[0]?.type },
                                    });
                                    setPlayModal(null);
                                  }}
                                >
                                  <Play size={12} fill="currentColor" /> 播放
                                </button>
                              </div>
                            ))
                          ) : (
                            activeVideo.sources.map((src, i) => (
                              <div key={src.url} className="source-all-modal__row">
                                <div className="source-all-modal__row-info">
                                  <span className="source-all-modal__row-title">{src.name || `线路 ${i + 1}`}</span>
                                  <span className="source-all-modal__row-sub">{src.type?.toUpperCase()}</span>
                                </div>
                                <button
                                  className="source-all-modal__play-btn"
                                  onClick={() => {
                                    navigate(`/play/${id}`, {
                                      state: { from: `/detail/${id}`, sourceIndex: playModal.sourceIndex, playUrl: src.url, playType: src.type },
                                    });
                                    setPlayModal(null);
                                  }}
                                >
                                  <Play size={12} fill="currentColor" /> 播放
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </Modal>
              </div>
              ) : (
                <div className="detail-sources-container">
                  <div className="detail-sources-header">
                    <div className="detail-sources-header-left">
                      <h3>匹配结果</h3>
                      <span className="detail-sources-keyword">当前关键词："{title}"</span>
                    </div>
                    <div className="detail-sources-toolbar">
                      <button className="retry-btn retry-btn--tab" onClick={fetchCMSSources}>
                        <RefreshCw size={14} /> 重新匹配
                      </button>
                    </div>
                  </div>
                  <div className="detail-sources-grid">
                    <div className="detail-sources-empty">
                      <Server size={32} />
                      <p>所有视频源均未找到匹配资源</p>
                      <span>请尝试更换关键词或稍后再试</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="detail-state">
                <Server size={32} /><p>暂无匹配的播放资源</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><RefreshCw size={14} /> 重新获取</button>
              </div>
            )}
          </div>
        )}

        {/* 季信息 */}
        {activeTab === 'seasons' && tmdbMediaType === 'tv' && (
          <div className="detail-seasons">
            {seasons.filter((s) => s.season_number > 0).map((s) => (
              <div key={s.id} className="detail-season-card">
                <div className="detail-season-poster">
                  {s.poster_path ? (
                    <img src={buildImageUrl(s.poster_path, 'w300') || ''} alt={s.name} width={300} height={450} />
                  ) : (
                    <span className="detail-cast-avatar"><Layers size={22} /></span>
                  )}
                </div>
                <div className="detail-season-info">
                  <h4 title={s.name}>{s.name}</h4>
                  <span>{s.episode_count} 集</span>
                  {s.air_date && <span>{s.air_date}</span>}
                  {s.overview && <p title={s.overview}>{s.overview}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          你可能还喜欢（VideoCard 横向推荐行）
          ══════════════════════════════════════════════ */}
      {similarResults.length > 0 && (
        <section className="detail-recommend">
          <h2 className="detail-recommend-title">相关推荐</h2>
          <div className="detail-recommend-row">
            {similarResults.map((item) => (
              <div key={item.id} className="detail-recommend-card">
                <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendedResults.length > 0 && (
        <section className="detail-recommend">
          <h2 className="detail-recommend-title">你可能还喜欢</h2>
          <div className="detail-recommend-row">
            {recommendedResults.map((item) => (
              <div key={item.id} className="detail-recommend-card">
                <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
              </div>
            ))}
          </div>
        </section>
      )}

      <BackToTopButton />

      <StillsLightbox
        urls={stills}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// ── 辅助函数 ──────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCurrency(value?: number): string {
  if (!value) return '-';
  return currencyFormatter.format(value);
}

const statusLabels: Record<string, string> = {
  Rumored: '传闻',
  Planned: '计划中',
  'In Production': '制作中',
  Post: '后期制作',
  Released: '已上映',
  Canceled: '已取消',
  Returning: '连载中',
  Ended: '已完结',
  Pilot: '试播集',
};

function statusLabel(status: string): string {
  return statusLabels[status] || status;
}

function formatVoteCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/** 格式化进度时间（秒 → mm:ss 或 hh:mm:ss） */
function formatProgressTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── 内联图标组件（避免过多 import） ──────────────

function ClockIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function UsersIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function GlobeIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
}
function FilmIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/></svg>;
}
function DollarIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}

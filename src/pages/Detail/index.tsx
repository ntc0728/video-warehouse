/**
 * 视频详情页面 — 方案 A · 海报对开（2026-10-10 拍板，Demo 见 changelogs/demos/detail-layout-2026-10-10）
 *
 * Hero：左列竖海报（返回钮叠左上）| 右列文本区（横板 backdrop 底纹 + kicker/标题/meta/简介折叠/CTA 钉底）
 * 资料区：tab 行居中置顶（概览 = 基础信息表 + 演员 + 剧照；播放列表 / 季信息同原逻辑）+ VideoCard 推荐行
 */
import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigationType, Link } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useUserStore, useSettingsStore } from '@/stores';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { searchVideoFromMultipleSources, searchVideoSeasonsFromSingleSource, getVideoSources, getEnabledVideoSourceIndices, checkSelectedVideoSources } from '@/services/videoService';
import type { SelectedSourceCheckResult } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, fetchMovieImages, fetchTVImages, buildImageUrl } from '@/services/tmdbService';
import { useSmartBack } from '@/lib/navigation';
import type { Video } from '@/types/video';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBSeason, TMDBCastMember } from '@/types/tmdb';
import { BackToTopButton } from '@/components/common';
import { useDocumentTitle, useInViewport } from '@/hooks';
import type { CSSProperties, ReactNode } from 'react';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { VideoCard } from '@/components/VideoCard';
import LazyImage from '@/components/LazyImage/LazyImage';
import StillsLightbox from '@/components/StillsLightbox/StillsLightbox';
import TokenRequired from '@/components/TokenRequired';
import PlaylistModal from './components/PlaylistModal';
import SourceDetectPill, { type SourceDetectStatus } from './components/SourceDetectPill';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import {
  Play, Heart, ArrowLeft,
  Info, ListVideo, Layers, AlertTriangle, WifiOff,
  RefreshCw, Server, ExternalLink,
} from 'lucide-react';
import './Detail.css';
import DetailSkeleton from './DetailSkeleton';
import { Icon, SIZE_VAR, type IconSize } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

// ── 常量 ──────────────────────────────────────────────

const CMS_DEBOUNCE_MS = 2000;


/**
 * 模块级 Detail 缓存（方案 B：无 Keep-Alive）
 *
 * detail → /play → detail 返回时组件重新挂载，TMDB detail + 剧照会重新请求。
 * 用模块级 Map 在「会话内」缓存成功结果（TTL 10min），返回时直接回显、零网络请求；
 * 过期或未命中则走正常加载。CMS 播放源结果不缓存——其语义依赖「当前启用的视频源」，
 * 且只在用户切到播放列表 tab 时按需加载（返回 detail 时 activeTab 重置为 info，不触发）。
 */
interface DetailCacheEntry {
  tmdbDetail: TMDBMovieDetail | TMDBTVShowDetail | null;
  tmdbError: string | null;
  tmdbMediaType: 'movie' | 'tv';
  stills: string[];
  fetchedAt: number;
}
const detailCache = new Map<string, DetailCacheEntry>();
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
/** 容量上限：detail 访问量有限，上限为防御性防无界增长（超出删最旧） */
const MAX_DETAIL_CACHE = 50;

function readDetailCache(id: string): DetailCacheEntry | null {
  const c = detailCache.get(id);
  if (!c) return null;
  if (Date.now() - c.fetchedAt > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(id);
    return null;
  }
  return c;
}

function writeDetailCache(id: string, patch: Partial<DetailCacheEntry>): void {
  const prev = detailCache.get(id);
  detailCache.set(id, {
    tmdbDetail: null,
    tmdbError: null,
    tmdbMediaType: 'movie',
    stills: [],
    ...prev,
    ...patch,
    fetchedAt: Date.now(),
  });
  // 防御性淘汰：超容量删最旧插入项
  if (detailCache.size > MAX_DETAIL_CACHE) {
    const oldestKey = detailCache.keys().next().value;
    if (oldestKey !== undefined) detailCache.delete(oldestKey);
  }
}

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
  const navigate = useCustomNavigate();
  // 是否已配置 TMDB Access Token（play/detail 的 tmdb- 数据依赖）
  const hasToken = useSettingsStore((s) => (s.tmdbAccessToken || '').trim().length > 0);
  const { isCollected, addCollection, removeCollection, getHistoryByVideo } = useUserStore();

  // ── 非沉浸式 Header（hero 不被导航栏覆盖） ──
  useHeaderContent();

  // ── 智能回退 ──────────────────────────────
  const handleBack = useSmartBack('/');

  const pageRef = useRef<HTMLDivElement>(null);

  // ── 滚动位置保存/恢复（useScrollRestore 接管；方案 B 下挂载即恢复） ────
  useScrollRestore(`detail:${id}`);

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
  // 下拉刷新：通过 nonce 触发主请求 + 剧照重新拉取（复用模块级缓存，刷新时绕过缓存回显）
  const [pullRefreshNonce, setPullRefreshNonce] = useState(0);
  usePullToRefresh(() => setPullRefreshNonce((n) => n + 1));
  const prevDetailIdRef = useRef<string | undefined>(undefined);

  const [tmdbLoading, setTmdbLoading] = useState(true);
  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');

  // 剧照
  const [stills, setStills] = useState<string[]>([]);
  const [stillsLoading, setStillsLoading] = useState(false);

  // 剧照区视口懒加载（2026-09-16）：剧照在页面下部（首屏之外），只有接近视口时才请求
  // /images 接口。哨兵节点常驻（与剧照区是否已渲染无关），命中后 once 断开、不再回退。
  const { ref: stillsSentinelRef, inView: stillsInView } = useInViewport<HTMLDivElement>({
    rootMargin: '300px',
    disabled: !id?.startsWith('tmdb-'),
  });

  // 剧照灯箱
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 演员折叠（全视口统一：超过 2 行即折叠，展开按钮按实际溢出检测显示）
  const [castExpanded, setCastExpanded] = useState(false);
  const [castOverflow, setCastOverflow] = useState(false);
  const castRowRef = useRef<HTMLDivElement>(null);
  // hero logo 加载失败：不显示 <img>，回退到标题 <h1>（2026-10-10 用户要求）。
  // 换片（id 变）时重置，避免上一片的失败态残留导致新 logo 不显示。
  const [logoFailed, setLogoFailed] = useState(false);
  // 发行公司 logo 加载失败集合：失败的公公司只隐图、保留公司名（2026-10-10 用户要求）。
  const [failedCompanyLogos, setFailedCompanyLogos] = useState<Set<number>>(() => new Set());
  useEffect(() => { setLogoFailed(false); setFailedCompanyLogos(new Set()); }, [id]);
  /** hero 文本区 ref：量其内容高反算海报列宽（--poster-w，见下方 effect 注释） */
  const heroInfoRef = useRef<HTMLDivElement>(null);

  // CMS
  const [cmsResults, setCmsResults] = useState<DetailSourceResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsLoaded, setCmsLoaded] = useState(false);
  const [cmsError, setCmsError] = useState<string | null>(null);

  // 源检测（V4 pill）：检测设置页选中的 CMS 源可用性
  const [srcDetect, setSrcDetect] = useState<{
    status: SourceDetectStatus;
    done: number;
    total: number;
    ok: number;
    fail: number;
    results: SelectedSourceCheckResult[];
  }>({ status: 'idle', done: 0, total: 0, ok: 0, fail: 0, results: [] });

  const runSourceDetection = useCallback(async () => {
    const indices = await getEnabledVideoSourceIndices();
    if (indices.length === 0) return;
    setSrcDetect({ status: 'running', done: 0, total: indices.length, ok: 0, fail: 0, results: [] });
    try {
      const res = await checkSelectedVideoSources(indices, (done, total) => {
        setSrcDetect((s) => ({ ...s, done, total }));
      });
      setSrcDetect((s) => ({
        ...s,
        status: 'done',
        done: res.total,
        total: res.total,
        ok: res.ok,
        fail: res.fail,
        results: res.results,
      }));
    } catch {
      setSrcDetect((s) => ({ ...s, status: 'idle' }));
    }
  }, []);
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
  const [, setActiveSeasonIndex] = useState(0);

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

  // running 胶囊轮播文本（2026-10-10 用户要求：移入胶囊、末尾不再重复「资源」）。
  // 源名如「豆瓣资源」已含「资源」，旧模板又追一个「资源」→ 「豆瓣资源资源」。
  const runningText = querySourceNames.length > 0
    ? `正在查询${querySourceNames[queryMsgIndex % querySourceNames.length]}…`
    : '正在匹配播放源…';

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
      // 容器尚未布局（首次渲染或尺寸未就绪时 clientWidth=0）无法测量，
      // 用视口宽度估算兜底，避免 visibleCount 永远停在 null 导致剧照全部平铺；
      // 布局完成后 ResizeObserver 会用精确值纠正。
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
  // 用 useLayoutEffect：id 变化时在「绘制前」同步清空旧数据，避免 hero 先以
  // 「上一个 detail 的 tmdbDetail」绘制一帧（封面/名称闪旧内容）。
  // 方案 B（无 Keep-Alive）：挂载时先查模块级缓存，命中（detail → /play → detail
  // 返回）直接回显，不重新请求；未命中走正常加载并写入缓存。
  useLayoutEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    setTmdbLoading(true); setTmdbError(null); setTmdbDetail(null); setBgLoaded(false);
    setCmsLoaded(false); setCmsResults([]); setCmsError(null);
    // 重置 CMS 去抖时间戳：否则「切 id / 下拉刷新」触发重新匹配时会撞上 2s 防抖被静默
    // 丢弃（fetchCMSSources 直接 return，既不置 cmsLoading 也不置 cmsLoaded）→ 页面
    // 永久停在「暂无匹配的播放资源」，只能手点「重新获取」。
    cmsLastFetchRef.current = 0;
    if (prevDetailIdRef.current !== id) { setActiveTab('info'); prevDetailIdRef.current = id; }
    // token 未配置：不发 TMDB 请求（整页已由 render 层 TokenRequired 拦截，此处防在飞请求）
    if (id.startsWith('tmdb-') && !hasToken) {
      setTmdbLoading(false);
      return () => ctrl.abort();
    }

    const cached = pullRefreshNonce === 0 && id.startsWith('tmdb-') ? readDetailCache(id) : null;
    if (cached?.tmdbDetail) {
      setTmdbMediaType(cached.tmdbMediaType);
      setTmdbDetail(cached.tmdbDetail);
      setTmdbError(cached.tmdbError ?? null);
      setTmdbLoading(false);
      return () => ctrl.abort();
    }

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
        writeDetailCache(id, { tmdbDetail: detail, tmdbError: null, tmdbMediaType: mt });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setTmdbError(err instanceof Error ? err.message : '加载失败');
      } finally { if (!ctrl.signal.aborted) setTmdbLoading(false); }
    })();

    return () => ctrl.abort();
  }, [id, pullRefreshNonce]);

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

    const indices = await getEnabledVideoSourceIndices();

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
      // 增量上屏（2026-10-10 用户要求）：每源一返回即 setCmsResults 追加，
      // 首条可用结果到达即停掉网格大转圈、显示数据，其余源陆续补上。
      const pushOne = (r: DetailSourceResult) => {
        if (ctrl.signal.aborted) return;
        setCmsResults((prev) => [...prev, r]);
      };
      if (tmdbMediaType === 'tv') {
        // 剧集：逐源并发查所有季，每源完成即上屏
        await Promise.allSettled(
          indices.map(async (index) => {
            let r: DetailSourceResult;
            try {
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
              r = {
                sourceIndex: res.sourceIndex,
                sourceId: res.sourceId,
                sourceName: res.sourceName,
                video: seasonVideos[0] ?? null,
                seasons: seasonVideos,
                seasonNumbers: seasonNums,
                isSeries: seasonVideos.length > 0,
                error: seasonVideos.length > 0 ? undefined : (res.error ?? '未找到匹配资源'),
              };
            } catch (e) {
              r = {
                sourceIndex: index, sourceId: '', sourceName: '未知',
                video: null, seasons: [], seasonNumbers: [], isSeries: false,
                error: e instanceof Error ? e.message : '请求失败',
              };
            }
            pushOne(r);
          }),
        );
      } else {
        // 电影：逐源并发（带年份限制），每源完成即上屏
        await Promise.allSettled(
          indices.map(async (index) => {
            let r: DetailSourceResult;
            try {
              if (ctrl.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
              const rs = await searchVideoFromMultipleSources([index], videoTitle, videoYear, ctrl.signal);
              const one = rs[0];
              r = one
                ? ({ ...one, seasons: [], seasonNumbers: [], isSeries: false } as DetailSourceResult)
                : {
                  sourceIndex: index, sourceId: '', sourceName: '未知',
                  video: null, seasons: [], seasonNumbers: [], isSeries: false, error: '未找到匹配资源',
                };
            } catch (e) {
              r = {
                sourceIndex: index, sourceId: '', sourceName: '未知',
                video: null, seasons: [], seasonNumbers: [], isSeries: false,
                error: e instanceof Error ? e.message : '请求失败',
              };
            }
            pushOne(r);
          }),
        );
      }
      if (ctrl.signal.aborted) return;
      setCmsLoaded(true);
    } catch (err) {
      // 每源已各自 catch，此处仅兜底整体异常（如 getEnabledVideoSourceIndices 失败）
      if (!ctrl.signal.aborted) setCmsError(err instanceof Error ? err.message : '获取播放源失败');
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tmdbDetail]);

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
    // 方案 B 缓存回显：detail → /play → detail 返回时直接恢复剧照，不重新请求；
    // 下拉刷新（nonce>0）时绕过缓存，强制重新拉取剧照。
    const cached = pullRefreshNonce === 0 ? readDetailCache(id) : null;
    if (cached?.stills?.length) {
      setStills(cached.stills);
      setStillsLoading(false);
      return;
    }
    // 视口懒加载：剧照区未接近视口前不发请求。两条放行通道：
    // ① stillsInView —— 滚动到剧照区附近（哨兵命中）；
    // ② pullRefreshNonce > 0 —— 用户显式下拉刷新，语义上必须重新拉（不受视口限制）。
    if (!stillsInView && pullRefreshNonce === 0) return;
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
        // 11.5：TMDB /images 的 backdrops 同一 file_path 可能有多条（不同语言/分辨率
        // 条目），直接用会渲染出重复剧照。按 URL 去重（Set），同时消除 React key 重复告警。
        const urls = Array.from(new Set(
          (data.backdrops || [])
            .map((b) => buildImageUrl(b.file_path, 'w1280'))
            .filter((u): u is string => Boolean(u)),
        ));
        setStills(urls);
        writeDetailCache(id, { stills: urls });
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
    // stillsInView 必须进 deps：哨兵命中后本 effect 需重跑才会真正发请求（懒加载的关键跳变）。
  }, [id, pullRefreshNonce, stillsInView]);

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
  // 方案 B（无 Keep-Alive）：detail 进入 /play 时组件卸载，返回时重新挂载，
  // 由模块级 detail 缓存（readDetailCache）回显 TMDB detail + 剧照，避免重新请求。
  // 2026-09-24 改 <Link>：支持右键/中键新开页签；state 供同标签导航，
  // fresh=1 query 供新开页签时 Player 兜底（state 在新页签会丢）。
  const playFrom = id ? `/detail/${id}` : '';

  // ── 派生数据 ──────────────────────────────────
  const d = tmdbDetail;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  }

  // ── 动态页签标题 ──────────────────────────────
  // 方案 B（无 Keep-Alive）：detail 只在 /detail 路由挂载，挂载即写标题；
  // 离开后组件卸载，标题由新页接管，无需「是否激活」守卫。
  useDocumentTitle(title || null);

  const isTV = d ? 'name' in d : false;
  const logoPath = d?.images?.logos?.find((l) => l.iso_639_1 === 'zh' || l.iso_639_1 === 'en')?.file_path;
  let year: number | undefined;
  let releaseDateStr = '';
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
    releaseDateStr = year ? dateStr : '';
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
    releaseDateStr = year ? dateStr : '';
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

  // 演员行折叠高度测量（2026-09-10 修复「第二行被裁一半」）：
  // 折叠高度不再硬编码 16rem —— 头像尺寸 --layout-cast-avatar 是流体值
  // （桌面 80→88px × --ui-scale），条目行高随视口变化，固定 16rem 在大屏档
  // 会把第二行裁掉一部分。这里用「首行条目实际高度 × 2 + grid 行间距」精确写入
  // --cast-collapsed-h（CSS 消费），再据此判断内容是否真的超过两行。
  // ResizeObserver 覆盖窗口缩放与布局尺寸变化的纠正场景。
  useEffect(() => {
    const el = castRowRef.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector<HTMLElement>('.detail-cast-item');
      if (!first) {
        setCastOverflow(false);
        return;
      }
      const rowGap = parseFloat(getComputedStyle(el).rowGap) || 0;
      const twoRowH = first.offsetHeight * 2 + rowGap;
      el.style.setProperty('--cast-collapsed-h', `${twoRowH}px`);
      setCastOverflow(el.scrollHeight > twoRowH + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cast.length]);

  // hero 两列等高且等比（2026-10-10 用户两轮反馈）：文本区为高度主（内容驱动），
  // RO 量出其高写 --poster-w = 高×2/3 到 .detail-hero，左列轨道宽随变量走 →
  // 海报盒永远 2:3、宽高同变零裁切（不是把盒机械拉高）。防振荡：取整 + 变化 >2px 才写。
  // 上限 330（非 300）：真机实测 1024 展开简介后 info 高≈473，若顶在 300 会破坏 2:3（aspect 0.63）；
  // 330 容下 h≤495 的展开态且宽屏折叠态（h≈450→w=300）不受影响。
  // 路径迟滞修复：视口宽度变化时先清变量——轨道回落视口公式，info 宽高随之重排，
  // RO 再触发 sync 从当前视口最优点重新收敛（否则双稳态下旧宽变量会残留）。
  useEffect(() => {
    const info = heroInfoRef.current;
    const hero = info?.closest('.detail-hero') as HTMLElement | null;
    if (!info || !hero) return;
    const sync = () => {
      const h = info.clientHeight;
      if (h <= 0) return;
      const w = Math.round(Math.min(330, Math.max(160, (h * 2) / 3)));
      const cur = parseInt(hero.style.getPropertyValue('--poster-w'), 10);
      if (!Number.isFinite(cur) || Math.abs(cur - w) > 2) {
        hero.style.setProperty('--poster-w', `${w}px`);
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(info);
    const onResize = () => hero.style.removeProperty('--poster-w');
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [d]);

  const genres = d?.genres || [];
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name;
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
  // 进度地图：供 PlaylistModal 显示每条线路/选集的观看进度
  const historyList = useUserStore((s) => s.history);
  const progressMap = useMemo(() => {
    const map: Record<string, { progress: number; duration: number; completed: boolean }> = {};
    if (!id) return map;
    for (const h of historyList) {
      if (h.videoId === id && h.episodeUrl) {
        map[h.episodeUrl] = {
          progress: h.progress,
          duration: h.duration,
          completed: h.duration > 0 && h.progress >= h.duration,
        };
      }
    }
    return map;
  }, [historyList, id]);
  // 直接读取历史记录中从源头写入的季号：季号 + 选集标签 → 「第X季 第Y集」
  // 旧数据无 seasonNumber 时回退到 episodeLabel（第Y集），不会退化
  const lastEpisodeLabel = historyRecord?.seasonNumber && historyRecord?.episodeLabel
    ? `第${historyRecord.seasonNumber}季 ${historyRecord.episodeLabel}`
    : historyRecord?.episodeLabel;

  // ── Loading ──────────────────────────────────
  // ── TMDB Access Token 未配置：整页提示（与首页一致，设置可点击跳转） ──
  // 仅 tmdb- 前缀 id 依赖 token；纯数字 CMS id 本就走「暂仅支持 TMDB 影片」，
  // 不在此拦截，避免误判场景。
  if (id?.startsWith('tmdb-') && !hasToken) {
    return (
      <div className="page-padding detail-page content-shell">
        <TokenRequired />
      </div>
    );
  }

  // 详情页专属骨架：≥1024 两栏（banner + 信息卡）/ 窄屏堆叠，随视口分档
  if (tmdbLoading) return <div className="page-padding detail-page detail-page--loading content-shell"><DetailSkeleton /></div>;

  // ── Error ────────────────────────────────────
  if (tmdbError || !tmdbDetail) {
    return (
      <div className="page-padding detail-page content-shell">
        <div className="detail-not-found">
          <Icon icon={AlertTriangle} size="3xl" />
          <span>{tmdbError || '影片不存在'}</span>
        </div>
      </div>
    );
  }

  /* ── C1 排列（≥1024，2026-09-10 用户拍板）─────────────────────────
     方案 A · 资料区（2026-10-10 拍板，替换旧 C1 右栏方案）：tab 行居中于资料区头部；
     概览面板 = 基础信息表 + 演员 + 剧照；播放列表 / 季信息沿用原逻辑。
     简介改在 hero 文本区 3 行折叠展开，不再单独成块。 */
  const factCells: { key: string; label: string; value: ReactNode; hi?: boolean }[] = [];
  if (voteAverage > 0) factCells.push({ key: 'rating', label: 'TMDB 评分', hi: true, value: <>{voteAverage.toFixed(1)} / 10{voteCount > 0 && <span className="detail-vote-count">（{formatVoteCount(voteCount)} 人评价）</span>}</> });
  if (releaseDateStr) factCells.push({ key: 'release', label: '发行时间', value: releaseDateStr });
  if (status) factCells.push({ key: 'status', label: '状态', value: statusLabel(status) });
  if ((runtime ?? 0) > 0) factCells.push({ key: 'runtime', label: '时长', value: `${runtime} 分钟` });
  if (originalLanguage) factCells.push({ key: 'lang', label: '语言', value: `${originalLanguage.toUpperCase()}${spokenLanguages.length > 0 ? ` / ${spokenLanguages.slice(0, 3).join(' / ')}` : ''}` });
  if (director) factCells.push({ key: 'director', label: '导演', value: director });
  // 主创（createdBy）移出普通格，改与下方「国家 / 发行」一致独占整行（2026-10-10 用户要求）。
  if (d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).budget > 0) factCells.push({ key: 'budget', label: '预算', value: formatCurrency((d as TMDBMovieDetail).budget) });
  if (d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).revenue > 0) factCells.push({ key: 'revenue', label: '票房', value: formatCurrency((d as TMDBMovieDetail).revenue) });
  if (isTV) factCells.push({ key: 'seasonEp', label: '季 / 集', value: `${totalSeasons} 季 / ${totalEpisodes} 集` });
  if (isTV && inProduction !== undefined) factCells.push({ key: 'inProd', label: '制作中', value: inProduction ? '是' : '已完结' });
  if (isTV && lastAirDate) factCells.push({ key: 'lastAir', label: '最后播出', value: lastAirDate });

  return (
    <div ref={pageRef} className="page-padding detail-page content-shell" key={id}>
      {/* ═════════════════════════════════════════
          HERO（方案 A · 海报对开，2026-10-10 拍板）：左列竖海报（返回钮叠左上）| 右列文本区（横板 backdrop 作底纹）
          ═════════════════════════════════════════ */}
      <section className={`detail-hero${bgLoaded ? '' : ' detail-hero--skeleton'}`}>
        {/* 左列：竖海报（移动端整列隐藏，由 backdrop 底纹承担视觉） */}
        <div className="detail-hero-poster">
          <button className="detail-hero-back" onClick={handleBack} aria-label="返回">
            <Icon icon={ArrowLeft} size="sm" />
            <span>返回</span>
          </button>
          {posterUrl && (
            <img
              src={posterUrl}
              alt={title}
              width={300}
              height={450}
              onError={(e) => {
                // 海报加载失败 → 统一中性灰占位（placeholder-gray.svg 纯色块，亮暗同款），
                // 与卡片失败态一致；直接换 src 避免破图闪烁。
                e.currentTarget.src = '/placeholder-gray.svg';
                e.currentTarget.onerror = null;
              }}
            />
          )}
          {hasWatchingHistory && (
            <div className="detail-hero-poster-progress">
              <div
                className="detail-hero-poster-progress-bar"
                style={{ width: `${watchProgressPercent}%` }}
              />
            </div>
          )}
        </div>
        {/* 右列：文本区（横板 backdrop 底纹 + 左侧渐变压色保可读） */}
        <div ref={heroInfoRef} className="detail-hero-info">
          {backdropUrl && (
            <img className="detail-hero-bg" src={backdropUrl} alt="" width={1920} height={1080} onLoad={() => setBgLoaded(true)} />
          )}
          <div className="detail-hero-veil" aria-hidden="true" />
          <div className="detail-hero-body">
            {/* 顶行：媒体类型 + 官网链接（文本区右上角） */}
            <div className="detail-hero-topline">
              <span className="detail-hero-kicker">{typeLabels[tmdbMediaType]}</span>
              {homepage && (
                <a href={homepage} target="_blank" rel="noreferrer" className="detail-official-link">
                  <Icon icon={ExternalLink} size="sm" />
                  <span>官方页面</span>
                </a>
              )}
            </div>
            {/* Logo 或标题：logo 存在且未加载失败时显图，否则回退标题 */}
            {logoPath && !logoFailed ? (
              <img className="detail-hero-logo" src={buildImageUrl(logoPath, 'w342') || ''} alt={title} width={400} height={150} onError={() => setLogoFailed(true)} />
            ) : (
              <h1 className="detail-hero-title">{title}</h1>
            )}
            {/* 标语 */}
            {d?.tagline && <p className="detail-hero-tagline">{d.tagline}</p>}
            {/* Meta 行（类型已由 kicker 承担，不重复渲染） */}
            <div className="detail-hero-meta">
              {voteAverage > 0 && <span className="detail-hero-rating">★ {voteAverage.toFixed(1)}</span>}
              {year && <span className="detail-hero-meta-item">{year}</span>}
              {tmdbMediaType === 'tv' && totalSeasons > 0 && (
                <span className="detail-hero-meta-item">{totalSeasons} 季 / {totalEpisodes} 集</span>
              )}
              {(runtime ?? 0) > 0 && <span className="detail-hero-meta-item">{runtime} 分钟</span>}
              {popularity > 0 && (
                <span className="detail-hero-meta-item">🔥 {popularity.toFixed(0)}</span>
              )}
            </div>
            {/* 简介：3 行折叠 + 展开（与资料表长字段同一交互语言） */}
            {overview && (
              <p className="detail-hero-desc">
                <CollapsibleValue lines={3} expandLabel="展开简介">{overview}</CollapsibleValue>
              </p>
            )}
            {/* CTA 与观看进度：钉文本区底部（margin-top:auto），与海报下沿齐平 */}
            <div className="detail-hero-cta-zone">
              <div className="detail-hero-actions">
                <Link
                  to={{ pathname: `/play/${id}`, search: '' }}
                  state={{ from: playFrom }}
                  className="detail-btn detail-btn-play"
                >
                  <Icon icon={Play} size="sm" fill="currentColor" />
                  {hasWatchingHistory ? '继续播放' : '立即播放'}
                </Link>
                {hasWatchingHistory && (
                  <Link
                    to={{ pathname: `/play/${id}`, search: '?fresh=1' }}
                    state={{ from: playFrom, skipHistory: true }}
                    className="detail-btn detail-btn-play-from-start"
                  >
                    从头播放
                  </Link>
                )}
                <button className={`detail-btn detail-btn-collect ${collected ? 'active' : ''}`} onClick={handleCollect} aria-pressed={collected}>
                  <Icon icon={Heart} size="sm" fill={collected ? 'var(--color-favorite-active)' : 'none'}
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
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════
          资料区（方案 A）：tab 行居中置顶；概览面板 = 基础信息表 + 演员 + 剧照
          ═════════════════════════════════════════ */}
      <section className="detail-facts">
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
                const firstPlaylist =
                  tab.key === 'sources' && !visitedTabsRef.current.has('sources');
                visitedTabsRef.current.add(tab.key);
                setActiveTab(tab.key);
                // 第一次进入详情页并点击播放列表 tab 时，自动触发源检测
                if (firstPlaylist) runSourceDetection();
              }}
            >
              <Icon icon={tab.icon} size="sm" />
              <span>{tab.label}</span>
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
            {/* 基础信息表：label 上 / 值下，一行最多 4 列（CSS 25% 封顶）；值超 4 行折叠展开 */}
            <h2 className="detail-section-title">基础信息</h2>
            {genres.length > 0 && (
              <div className="detail-genres">
                {genres.map((g) => (
                  <span key={g.id} className="detail-genre-tag">{g.name}</span>
                ))}
              </div>
            )}
            <div className="detail-facts-grid">
              {factCells.map((f) => (
                <div key={f.key} className={`detail-fact${f.hi ? ' detail-fact--hi' : ''}`}>
                  <span>{f.label}</span>
                  <b><CollapsibleValue lines={4}>{f.value}</CollapsibleValue></b>
                </div>
              ))}
              {/* 国家 / 发行：grid 内独占整行（grid-column 1/-1，行距与格同源由 gap 提供），
                  label 左·值右同行基线对齐，放不下自然换行（不折叠） */}
            {isTV && createdBy.length > 0 && (
              <div className="detail-fact detail-fact--full">
                <span>主创</span>
                <strong>{createdBy.join(' / ')}</strong>
              </div>
            )}
            {countries.length > 0 && (
              <div className="detail-fact detail-fact--full">
                <span>国家</span>
                <strong>{countries.join(' / ')}</strong>
              </div>
            )}
            {companies.length > 0 && (
              <div className="detail-fact detail-fact--full">
                <span>发行</span>
                <strong className="detail-companies">
                  {companies.map((c) => (
                    <span key={c.id} className="detail-company">
                      {c.logo_path && !failedCompanyLogos.has(c.id) && (
                        <img
                          src={buildImageUrl(c.logo_path, 'w92') || ''}
                          alt={c.name}
                          className="detail-company-logo"
                          onError={() => setFailedCompanyLogos((prev) => new Set(prev).add(c.id))}
                        />
                      )}
                      {c.name}
                    </span>
                  ))}
                </strong>
              </div>
            )}
            </div>

            {cast.length > 0 && (
              <>
                <h3 className="detail-section-subtitle">演员</h3>
                <div ref={castRowRef} className={`detail-cast-row${!castExpanded ? ' detail-cast-row--collapsed' : ''}`}>
                  {cast.map((c) => (
                    <Link
                      key={c.id}
                      to={{ pathname: `/person/${c.id}` }}
                      state={{ from: `/detail/${id}` }}
                      className="detail-cast-item"
                    >
                      {/* 演员头像：LazyImage 统一「加载中骨架 / 失败兜底 / 无图」三态，
                          失败与无 profile_path 都落同一 UsersIcon 占位（与 video card 封面效果一致）。 */}
                      <LazyImage
                        src={c.profile_path ? buildImageUrl(c.profile_path, 'w185') || '' : ''}
                        alt={c.name}
                        className="detail-cast-img"
                        fallback={<span className="detail-cast-avatar"><UsersIcon size="sm" /></span>}
                      />
                      <span className="detail-cast-name">{c.name}</span>
                      <span className="detail-cast-role">{c.character}</span>
                    </Link>
                  ))}
                </div>
                {(castOverflow || castExpanded) && (
                  <button className="detail-cast-toggle" onClick={() => setCastExpanded(!castExpanded)}>
                    {castExpanded ? '收起' : `展开全部 ${cast.length} 位演员`}
                  </button>
                )}
              </>
            )}

            {/* 简介已并入 hero 文本区（3 行折叠展开），不再单独成块 */}

            {/* 剧照懒加载哨兵（2026-09-16）：常驻零高节点，不参与布局。
                放在剧照区之前，元素接近视口（rootMargin 300px）时才触发 /images 请求；
                剧照区本身是条件渲染（stills.length>0 || stillsLoading），不能承担哨兵职责。 */}
            <div ref={stillsSentinelRef} aria-hidden="true" />

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
                          {/* 2026-09-14：裸 <img> → LazyImage（用户拍板「外面始终两行，别追加」）。
                              网格仍是固定 2 行窗口（visibleCount 逻辑不变），
                              只在「图片下载」这一层做滑动窗口：
                              LazyImage 用 IntersectionObserver 判定，只有进入视口的剧照才
                              真正挂载 <img> 并发请求；横向/纵向滚出视口的格子不发请求。
                              附带收益：加载期有骨架占位、失败有品牌兜底（原先是白块/裂图）。
                              原始 <img> 的 width/height=1280/720 由 .detail-stills-item 的
                              aspect-ratio: 16/9 + 容器 100% 尺寸等价承接，无 CLS 回退。 */}
                          <LazyImage
                            src={url}
                            alt={`剧照 ${i + 1}`}
                            className="detail-stills-img"
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
            {cmsLoading && availableResults.length === 0 ? (
              <div className="detail-sources-container">
                <div className="detail-sources-header">
                  <div className="detail-sources-header-left">
                    <h3>匹配结果</h3>
                    <span className="detail-sources-keyword">当前关键词："{title}"</span>
                  </div>
                  <div className="detail-sources-toolbar">
                    <SourceDetectPill
                      status={srcDetect.status}
                      done={srcDetect.done}
                      total={srcDetect.total}
                      ok={srcDetect.ok}
                      fail={srcDetect.fail}
                      results={srcDetect.results}
                      runningText={runningText}
                    />
                  </div>
                </div>
                <div className="detail-sources-grid">
                  {/* 大转圈仅「loading 且首条结果未到」时显示；文案已移入胶囊（req2），此处不再重复 */}
                  <div className="playlist-query" aria-busy="true" aria-label="正在匹配播放源">
                    <div className="playlist-query-spinner" aria-hidden="true" />
                  </div>
                </div>
              </div>
            ) : cmsError ? (
              <div className="detail-state detail-state--error">
                <Icon icon={WifiOff} size="2xl" /><p>{cmsError}</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><Icon icon={RefreshCw} size="xs" /> 重新获取</button>
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
                    <button
                      className="retry-btn retry-btn--tab"
                      onClick={() => {
                        fetchCMSSources();
                        // 点击「重新匹配」同时触发源检测（idle pill 转为 running→done）
                        runSourceDetection();
                      }}
                    >
                      <Icon icon={RefreshCw} size="xs" /> 重新匹配
                    </button>
                    <SourceDetectPill
                      status={srcDetect.status}
                      done={srcDetect.done}
                      total={srcDetect.total}
                      ok={srcDetect.ok}
                      fail={srcDetect.fail}
                      results={srcDetect.results}
                      runningText={runningText}
                    />
                  </div>
                </div>
                <div className="detail-sources-grid">
                  {availableResults.map((result) => {
                    const v = result.video!;
                    const playable = isPlayable(v);
                    const lineCount = v.sources.length;
                    // ⚠️ 取值兜底（2026-09-10 修复「有数据却显示 0 条线路」）：
                    // 部分 CMS 源的 vod_play_url 是按「集」拆分的，parsePlaySources 会把它们
                    // 放进 episodes 而 sources 留空（videoService.resolvePlaySources:322）。
                    // 原实现只读 sources.length → 这类源在播放列表里明明有数据
                    // （弹窗、「全部」按钮都能看到），meta 行却显示「0 条线路」。
                    const episodeCount = v.episodes?.length ?? 0;
                    const isSeries = result.isSeries;
                    const groupTitle = tmdbMediaType === 'tv' ? stripSeasonLabel(v.title) : v.title;
                    // 年份角标跟随 CMS（v.year），缺失时兜底 TMDB 年份（与海报「CMS 优先、TMDB 兜底」一致）
                    const thumbYear = v.year ?? year;
                    return (
                      <div key={result.sourceIndex} className="detail-source-group">
                        <div className="detail-source-group-header">
                          <span className="detail-source-name">{result.sourceName}</span>
                          <span className="detail-source-status detail-source-status--ok">可播放</span>
                        </div>
                        <div className="detail-source-group-body">
                          <div className="detail-source-thumb">
                            {/* 海报：CMS 原图优先，缺失或加载失败用 TMDB 兜底，两者都不可用显示占位 */}
                            <SourceThumb cmsCover={v.cover} tmdbCover={posterUrl} alt={groupTitle} />
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
                                : lineCount > 0
                                  ? (lineCount === 1
                                    ? (v.sources[0]?.name || '线路 1')
                                    : `${lineCount} 条线路`)
                                  : episodeCount > 0
                                    ? `${episodeCount} 集`
                                    : '暂无线路'}
                            </span>
                          </div>
                          <div className="detail-source-actions">
                            {(isSeries || lineCount > 1 || episodeCount > 1) && (
                              <button
                                type="button"
                                className="detail-source-all-btn"
                                onClick={() => { setPlayModal({ sourceIndex: result.sourceIndex, sourceName: result.sourceName, video: v, seasons: result.seasons, seasonNumbers: result.seasonNumbers, isSeries: result.isSeries }); setActiveSeasonIndex(0); }}
                              >
                                <Icon icon={ListVideo} size="xs" /> 全部
                              </button>
                            )}
                            {playable && id ? (
                              <Link
                                to={{ pathname: `/play/${id}`, search: `?src=${result.sourceIndex}` }}
                                state={{ from: `/detail/${id}`, sourceIndex: result.sourceIndex }}
                                className="detail-source-play-btn"
                              >
                                <Icon icon={Play} size="xs" fill="currentColor" /> 立即播放
                              </Link>
                            ) : (
                              <button
                                className="detail-source-play-btn"
                                disabled
                              >
                                <Icon icon={Play} size="xs" fill="currentColor" /> 无可用线路
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {playModal && (
                  <PlaylistModal
                    data={playModal}
                    videoId={id}
                    posterUrl={posterUrl}
                    historyRecord={historyRecord ?? null}
                    progressMap={progressMap}
                    onClose={() => setPlayModal(null)}
                    onPlayEpisode={(ep) => {
                      // 鼠标路径由选集格 <Link> 承担导航；此回调仍服务键盘（Enter 走 playItem）
                      // 与 state 兜底（同标签），query 由 Link href 携带供新开页签。
                      if (id) navigate(`/play/${id}`, {
                        state: {
                          from: `/detail/${id}`,
                          sourceIndex: playModal.sourceIndex,
                          seasonNumber: ep.seasonNumber,
                          // 2026-10-11：集号随 state 透传，Player URL 匹配落空时按（季,集号）兜底
                          episodeNumber: ep.episode.number,
                          playUrl: ep.episode.sources[0]?.url,
                        },
                      });
                      setPlayModal(null);
                    }}
                    onPlayLine={(_lineIndex, seasonNumber, playUrl) => {
                      // _lineIndex 是线路在 video.sources 中的下标；Player 的 state.sourceIndex
                      // 语义是 CMS 采集源索引，故取 playModal.sourceIndex，线路由 playUrl 精确匹配。
                      // playType 已从 state 移除（Player 不读取）。
                      if (id) navigate(`/play/${id}`, {
                        state: {
                          from: `/detail/${id}`,
                          sourceIndex: playModal.sourceIndex,
                          seasonNumber: seasonNumber ?? undefined,
                          playUrl,
                        },
                      });
                      setPlayModal(null);
                    }}
                  />
                )}
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
                        <Icon icon={RefreshCw} size="xs" /> 重新匹配
                      </button>
                    </div>
                  </div>
                  <div className="detail-sources-grid">
                    <div className="detail-sources-empty">
                      <Icon icon={Server} size="2xl" />
                      <p>所有视频源均未找到匹配资源</p>
                      <span>请尝试更换关键词或稍后再试</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="detail-state">
                <Icon icon={Server} size="2xl" /><p>暂无匹配的播放资源</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><Icon icon={RefreshCw} size="xs" /> 重新获取</button>
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
                  {/* 季海报：LazyImage 统一加载/失败/无图三态，失败与无图都落矩形占位（与 video card 封面一致）。 */}
                  <LazyImage
                    src={s.poster_path ? buildImageUrl(s.poster_path, 'w300') || '' : ''}
                    alt={s.name}
                    className="detail-season-poster-img"
                    fallback={(
                      <span className="detail-season-poster__ph"><Icon icon={Layers} size="md" /></span>
                    )}
                  />
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
      </section>

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

// ── 长字段折叠（方案 A，2026-10-10）：clamp N 行，仅真溢出才出「展开/收起」按钮 ──
// ⚠️ 两处实测坑（Demo 2026-10-10 验证）：① 不能用 scrollHeight 判溢出——Chromium 下
// -webkit-line-clamp 的 scrollHeight 可能等于 clientHeight（漏检）；② 测量克隆节点必须挂在
// 原父节点内——挂 document.body 会丢元素自身字号，自然高算大→假阳性。
function CollapsibleValue({ lines, expandLabel = '展开', children }: { lines: number; expandLabel?: string; children?: ReactNode }) {
  const txtRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = txtRef.current;
    if (!el || open) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;width:${rect.width}px;display:block;-webkit-line-clamp:unset`;
      const parent = el.parentNode;
      if (!parent) return;
      parent.appendChild(clone);
      const full = clone.getBoundingClientRect().height;
      parent.removeChild(clone);
      setOverflow(full > rect.height + 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);
  return (
    <span className="detail-collapse">
      <span
        ref={txtRef}
        className={`detail-collapse-txt${open ? ' detail-collapse-txt--open' : ''}`}
        style={{ '--collapse-lines': lines } as CSSProperties}
      >
        {children}
      </span>
      {overflow && (
        <button type="button" className="detail-collapse-btn" onClick={() => setOpen((o) => !o)}>
          {open ? '收起 ⌃' : `${expandLabel} ⌄`}
        </button>
      )}
    </span>
  );
}

// ── 播放源缩略图（CMS 原图优先，缺失/加载失败用 TMDB 兜底） ──

function SourceThumb({
  cmsCover,
  tmdbCover,
  alt,
}: {
  cmsCover?: string;
  tmdbCover?: string;
  alt?: string;
}) {
  // 三级降级：cms → tmdb → 占位（'none'）
  const [stage, setStage] = useState<'cms' | 'tmdb' | 'none'>('cms');
  const src = stage === 'cms' ? cmsCover : stage === 'tmdb' ? tmdbCover : undefined;
  if (!src) {
    return (
      <div className="detail-source-thumb-placeholder">
        <Icon icon={Server} size="md" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        if (stage === 'cms' && tmdbCover) setStage('tmdb');
        else if (stage === 'cms' || stage === 'tmdb') setStage('none');
      }}
    />
  );
}

// ── 内联图标组件（避免过多 import）──────────────
// （方案 A 资料表无图标后，ClockIcon/GlobeIcon/FilmIcon/DollarIcon 已删；
//  演员占位仍用 UsersIcon）

function UsersIcon({ size = 'sm' }: { size?: IconSize }) {
  return <svg style={{ width: SIZE_VAR[size], height: SIZE_VAR[size] }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

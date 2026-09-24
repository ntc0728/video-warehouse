/**
 * 人物详情页 — 演员/导演作品列表
 *
 * 展示人物基本信息 + 参演电影 + 参演剧集
 */
import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPersonDetail, fetchPersonMovieCredits, fetchPersonTVCredits, buildImageUrl } from '@/services/tmdbService';
import { useSmartBack } from '@/lib/navigation';
import type { TMDBPersonDetail, TMDBMovie, TMDBTVShow } from '@/types/tmdb';
import PersonSkeleton from './PersonSkeleton';
import { useDocumentTitle, useHasTmdbToken } from '@/hooks';
import TokenRequired from '@/components/TokenRequired';
import { useSettingsStore } from '@/stores';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { VideoCard } from '@/components/VideoCard';
import LazyImage from '@/components/LazyImage/LazyImage';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import './Person.css';
import { Icon } from "@/components/ui/Icon";
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

type Tab = 'movies' | 'tv';

function toVideo(item: TMDBMovie | TMDBTVShow, mediaType: 'movie' | 'tv') {
  const isTV = 'name' in item && !('title' in item);
  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: isTV ? (item as TMDBTVShow).name : (item as TMDBMovie).title,
    cover: buildImageUrl(item.poster_path, 'w342') || '',
    type: mediaType,
    year: (item as TMDBMovie).release_date
      ? new Date((item as TMDBMovie).release_date).getFullYear()
      : (item as TMDBTVShow).first_air_date
        ? new Date((item as TMDBTVShow).first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: item.overview,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 会话级人物数据缓存（2026-09-16）。
 *
 * 背景：原实现每次进入人物页都发 3 个 TMDB 请求（detail + movie credits + tv credits），
 * 「人物页 → 作品详情 → 返回」也要重打一遍，且返回时先闪一帧骨架。
 * 命中缓存后直接同步回显：零请求、零骨架。
 *
 * - TTL 30min：人物作品列表变化极慢，30min 内复用足够新。
 * - 上限 20 条，按 LRU 淘汰（`Map` 插入序天然可当 LRU 用：命中后 delete+set 移到末尾）。
 * - 仅内存态，不落 IndexedDB/localStorage：人物页属「看过即走」，没必要持久化。
 * - 下拉刷新（force）绕过缓存强制重拉，并回写缓存。
 */
const PERSON_CACHE_TTL_MS = 30 * 60 * 1000;
const PERSON_CACHE_MAX = 20;

interface PersonCacheEntry {
  person: TMDBPersonDetail;
  movies: TMDBMovie[];
  tvShows: TMDBTVShow[];
  fetchedAt: number;
}

const personCache = new Map<number, PersonCacheEntry>();

/** 读缓存（过期即删并返回 null；命中则 touch 到 LRU 末尾） */
function readPersonCache(personId: number): PersonCacheEntry | null {
  const hit = personCache.get(personId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > PERSON_CACHE_TTL_MS) {
    personCache.delete(personId);
    return null;
  }
  personCache.delete(personId);
  personCache.set(personId, hit);
  return hit;
}

function writePersonCache(personId: number, entry: Omit<PersonCacheEntry, 'fetchedAt'>) {
  personCache.delete(personId);
  personCache.set(personId, { ...entry, fetchedAt: Date.now() });
  while (personCache.size > PERSON_CACHE_MAX) {
    const oldest = personCache.keys().next().value;
    if (oldest === undefined) break;
    personCache.delete(oldest);
  }
}

/**
 * 年份倒序排序：电影用 release_date、剧集用 first_air_date；
 * 无年份的排最后，同年份按 popularity 降序兜底。
 *
 * 放模块作用域（不依赖组件状态）：一是避免与 `loadPerson` 的 useCallback 产生
 * 「定义顺序 / 依赖数组」纠缠，二是每次渲染不再重建函数。
 */
function sortByYearDesc(
  a: { release_date?: string; first_air_date?: string; popularity?: number },
  b: { release_date?: string; first_air_date?: string; popularity?: number },
): number {
  const yearOf = (x: { release_date?: string; first_air_date?: string }): number => {
    const d = x.release_date || x.first_air_date;
    if (!d) return NaN;
    const y = new Date(d).getFullYear();
    return Number.isFinite(y) ? y : NaN;
  };
  const ay = yearOf(a);
  const by = yearOf(b);
  const pa = a.popularity ?? 0;
  const pb = b.popularity ?? 0;
  if (Number.isNaN(ay) && Number.isNaN(by)) return pb - pa;
  if (Number.isNaN(ay)) return 1;
  if (Number.isNaN(by)) return -1;
  if (ay !== by) return by - ay;
  return pb - pa;
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const handleBack = useSmartBack();

  const pageRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<TMDBPersonDetail | null>(null);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [tvShows, setTVShows] = useState<TMDBTVShow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('movies');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  // ── 懒加载 ──
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollContainerRef = useScrollContainer();
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const moviesRef = useRef(movies);
  moviesRef.current = movies;
  const tvShowsRef = useRef(tvShows);
  tvShowsRef.current = tvShows;

  const currentList = useMemo(
    () => (activeTab === 'movies' ? movies : tvShows),
    [activeTab, movies, tvShows],
  );
  const displayedList = useMemo(
    () => currentList.slice(0, visibleCount),
    [currentList, visibleCount],
  );
  const hasMore = visibleCount < currentList.length;

  // 切换 tab 时同步重置可见数量（避免 useEffect 异步导致旧 hasMore 触发加载）
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const loadMoreRef = useRef<() => void>(() => {});
  const { sentinelRef, resetLoading } = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: () => loadMoreRef.current?.(),
    scrollContainerRef,
    canLoadMore: hasMore,
    rootMargin: '200px',
  });
  loadMoreRef.current = () => {
    const currentTab = activeTabRef.current;
    const list = currentTab === 'movies' ? moviesRef.current : tvShowsRef.current;
    setVisibleCount((v) => (v < list.length ? v + PAGE_SIZE : v));
    resetLoading();
  };

  useEffect(() => {
    if (bioRef.current) {
      const el = bioRef.current;
      const clamped = el.scrollHeight > el.clientHeight;
      setBioClamped(clamped);
      if (clamped) setBioExpanded(false);
    }
  }, [person?.biography]);

  // ── 人物数据加载（2026-09-16 重构：抽成可复用 callback + 缓存）──────
  // 抽出来的三个动机：
  //   1. 缓存命中时**不发请求**，直接同步回显（零骨架、零请求）；
  //   2. 下拉刷新可以拿到真 Promise（旧实现只 bump nonce，浮层立即判成功，
  //      失败对用户不可见，也不等真实结束）；
  //   3. 竞态守卫：快速切换人物时旧响应不得覆盖新数据（reqSeq + AbortController 双保险）。
  const personAbortRef = useRef<AbortController | null>(null);
  const personReqSeqRef = useRef(0);
  const hasToken = useHasTmdbToken();

  const loadPerson = useCallback(async (personId: number, opts?: { force?: boolean }): Promise<void> => {
    // token 未配置：不发 TMDB 请求（整页已由 render 层 TokenRequired 拦截）
    if (!useSettingsStore.getState().tmdbAccessToken?.trim()) return;
    const force = opts?.force === true;
    const reqId = ++personReqSeqRef.current;
    const isLatest = () => personReqSeqRef.current === reqId;

    if (!force) {
      const cached = readPersonCache(personId);
      if (cached) {
        // 命中：取消在飞的旧请求，直接回显（不置 loading，避免骨架闪现）
        personAbortRef.current?.abort();
        personAbortRef.current = null;
        setError(null);
        setLoading(false);
        setPerson(cached.person);
        setMovies(cached.movies);
        setTVShows(cached.tvShows);
        if (cached.movies.length === 0 && cached.tvShows.length > 0) handleTabChange('tv');
        return;
      }
    }

    personAbortRef.current?.abort();
    const ctrl = new AbortController();
    personAbortRef.current = ctrl;

    setError(null);
    // 首次加载（无缓存）才清空并显示骨架；force 刷新保留旧内容静默替换，避免整页闪骨架
    if (!force) { setPerson(null); setLoading(true); }

    try {
      const [detail, movieCredits, tvCredits] = await Promise.all([
        fetchPersonDetail(personId, { signal: ctrl.signal }),
        fetchPersonMovieCredits(personId, { signal: ctrl.signal }),
        fetchPersonTVCredits(personId, { signal: ctrl.signal }),
      ]);
      if (!isLatest() || ctrl.signal.aborted) return;
      // 去重（同一人物可能以 cast + guest 重复出现）+ 年份倒序
      const nextMovies = Array.from(new Map(movieCredits.cast.sort(sortByYearDesc).map(m => [m.id, m])).values());
      const nextTvShows = Array.from(new Map(tvCredits.cast.sort(sortByYearDesc).map(t => [t.id, t])).values());
      writePersonCache(personId, { person: detail, movies: nextMovies, tvShows: nextTvShows });
      setPerson(detail);
      setMovies(nextMovies);
      setTVShows(nextTvShows);
      // 如果没有电影但有剧集，默认切到剧集 tab
      if (movieCredits.cast.length === 0 && tvCredits.cast.length > 0) {
        handleTabChange('tv');
      }
    } catch (err) {
      if (!isLatest() || ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : '加载失败');
      // 失败必须向上抛：否则下拉刷新/手动重试的调用方拿不到「失败」信号，
      // 浮层照样回弹「刷新成功」（2026-09-16 刷新反馈闭环）
      throw err;
    } finally {
      if (isLatest() && !ctrl.signal.aborted) setLoading(false);
    }
  }, [handleTabChange]);

  // 下拉刷新：force 绕过缓存重拉；返回 Promise 让浮层等到真实结束并可感知失败
  usePullToRefresh(() => {
    const personId = id ? parseInt(id, 10) : NaN;
    if (isNaN(personId)) return Promise.resolve();
    return loadPerson(personId, { force: true });
  });

  // 用 useLayoutEffect：id 变化时在「绘制前」同步清空旧数据，避免 Keep-Alive 复用
  // 同一实例时人物 hero 先以「上一个人物」内容绘制一帧（头像/姓名闪旧内容）。
  useLayoutEffect(() => {
    if (!id) return;
    if (!hasToken) return;
    const personId = parseInt(id, 10);
    if (isNaN(personId)) { setError('无效的人物 ID'); setLoading(false); return; }

    // loadPerson 失败时会向上抛（让下拉刷新能感知），此处必须接住，否则成为未处理的
    // Promise rejection（页面本身已由 loadPerson 内部 setError 呈现错误态）。
    void loadPerson(personId).catch(() => { /* 错误态已在 loadPerson 内 setError */ });

    return () => personAbortRef.current?.abort();
  }, [id, loadPerson, hasToken]);

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(person?.name || null);

  // ── TMDB Access Token 未配置：整页提示 ──
  if (!hasToken) {
    return (
      <div className="page-padding person-page content-shell">
        <TokenRequired />
      </div>
    );
  }

  if (loading) return <div className="page-padding person-page person-page--loading"><PersonSkeleton /></div>;
  if (error || !person) {
    return (
      <div className="page-padding person-page">
        <div className="person-not-found">
          <Icon icon={AlertTriangle} size="3xl" />
          <span>{error || '人物不存在'}</span>
        </div>
      </div>
    );
  }

  const avatarUrl = person.profile_path ? buildImageUrl(person.profile_path, 'w185') || '' : '';

  const age = person.birthday
    ? person.deathday
      ? new Date(person.deathday).getFullYear() - new Date(person.birthday).getFullYear()
      : new Date().getFullYear() - new Date(person.birthday).getFullYear()
    : null;

  return (
    <div ref={pageRef} className="page-padding person-page">
      {/* Hero */}
      <section className={`person-hero${bioExpanded ? ' person-hero--expanded' : ''}`}>
        <div className="person-hero-gradient" />

        <button className="person-hero-back" onClick={handleBack} aria-label="返回">
          <Icon icon={ArrowLeft} size="sm" />
          <span>返回</span>
        </button>

        <div className="person-hero-content">
          {avatarUrl && (
            <div className="person-avatar">
              {/* 2026-09-14：裸 <img> → LazyImage。
                  头像是 hero 首屏元素（必然在视口内），懒加载收益为零，
                  换来的是原先缺失的两项能力：加载期骨架占位（原白块）、
                  失败时品牌兜底（原裂图 + alt 文本）。 */}
              <LazyImage
                src={avatarUrl}
                alt={person.name}
                className="person-avatar-img"
              />
            </div>
          )}
          <div className={`person-info${!person.biography ? ' person-info--no-bio' : ''}`}>
            <h1 className="person-name">{person.name}</h1>
            {person.also_known_as.length > 0 && (
              <p className="person-aka">又名：{person.also_known_as.slice(0, 3).join(' / ')}</p>
            )}
            <div className="person-meta">
              {person.birthday && <span>生日：{person.birthday}{person.deathday ? ` — ${person.deathday}` : age ? ` (${age} 岁)` : ''}</span>}
              {person.place_of_birth && <span>出生地：{person.place_of_birth}</span>}
            </div>
            {person.biography && (
              <div className={`person-bio-wrap${bioExpanded ? ' person-bio-wrap--expanded' : ''}`}>
                <p ref={bioRef} className="person-bio">{person.biography}</p>
                {(bioClamped || bioExpanded || hasExpanded) && (
                  <button className="person-bio-toggle" onClick={() => { setHasExpanded(true); setBioExpanded(!bioExpanded); }}>
                    {bioExpanded ? <><Icon icon={ChevronUp} size="xs" /> 收起</> : <><Icon icon={ChevronDown} size="xs" /> 展开</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tab 导航 + 作品列表（合并为一个卡片） */}
      <div className="person-grid-card">
        <div className="person-tabs">
          {movies.length > 0 && (
            <button className={`tab-underline person-tab ${activeTab === 'movies' ? 'tab-underline--active person-tab--active' : ''}`} onClick={() => handleTabChange('movies')}>
              <span>电影（{movies.length}）</span>
            </button>
          )}
          {tvShows.length > 0 && (
            <button className={`tab-underline person-tab ${activeTab === 'tv' ? 'tab-underline--active person-tab--active' : ''}`} onClick={() => handleTabChange('tv')}>
              <span>剧集（{tvShows.length}）</span>
            </button>
          )}
        </div>

        <div className="person-works">
          {displayedList.length > 0 && (
            <div className="person-work-grid">
              {displayedList.map((item) => {
                const isTV = 'name' in item && !('title' in item);
                const mediaType = isTV ? 'tv' : 'movie';
                return (
                  <div key={`${mediaType}-${item.id}`} className="person-work-card">
                    <VideoCard video={toVideo(item, mediaType)} rating={item.vote_average} />
                  </div>
                );
              })}
            </div>
          )}
          <div ref={sentinelRef} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

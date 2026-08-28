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
import { AppLoading } from '@/components/common';
import { useDocumentTitle } from '@/hooks';

import { useScrollContainer } from '@/hooks/useScrollContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { VideoCard } from '@/components/VideoCard';
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

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const handleBack = useSmartBack();

  const pageRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 下拉刷新：通过 nonce 重新触发人物详情/作品拉取
  const [pullRefreshNonce, setPullRefreshNonce] = useState(0);
  usePullToRefresh(() => setPullRefreshNonce((n) => n + 1));
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

  // 用 useLayoutEffect：id 变化时在「绘制前」同步清空旧数据，避免 Keep-Alive 复用
  // 同一实例时人物 hero 先以「上一个人物」内容绘制一帧（头像/姓名闪旧内容）。
  useLayoutEffect(() => {
    if (!id) return;
    const personId = parseInt(id, 10);
    if (isNaN(personId)) { setError('无效的人物 ID'); setLoading(false); return; }

    const ctrl = new AbortController();
    setLoading(true); setError(null); setPerson(null);

    (async () => {
      try {
        const [detail, movieCredits, tvCredits] = await Promise.all([
          fetchPersonDetail(personId, { signal: ctrl.signal }),
          fetchPersonMovieCredits(personId, { signal: ctrl.signal }),
          fetchPersonTVCredits(personId, { signal: ctrl.signal }),
        ]);
        if (ctrl.signal.aborted) return;
        setPerson(detail);
        setMovies(Array.from(new Map(movieCredits.cast.sort(sortByYearDesc).map(m => [m.id, m])).values()));
        setTVShows(Array.from(new Map(tvCredits.cast.sort(sortByYearDesc).map(t => [t.id, t])).values()));
        // 如果没有电影但有剧集，默认切到剧集 tab
        if (movieCredits.cast.length === 0 && tvCredits.cast.length > 0) {
          handleTabChange('tv');
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [id, pullRefreshNonce]);

  // 年份倒序排序：电影用 release_date、剧集用 first_air_date；
  // 无年份的排最后，同年份按 popularity 降序兜底。
  const sortByYearDesc = (
    a: { release_date?: string; first_air_date?: string; popularity?: number },
    b: { release_date?: string; first_air_date?: string; popularity?: number },
  ): number => {
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
  };

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(person?.name || null);

  if (loading) return <div className="page-padding person-page person-page--loading"><AppLoading /></div>;
  if (error || !person) {
    return (
      <div className="page-padding person-page page-transition-enter">
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
              <img src={avatarUrl} alt={person.name} />
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

/**
 * 人物详情页 — 演员/导演作品列表
 *
 * 展示人物基本信息 + 参演电影 + 参演剧集
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPersonDetail, fetchPersonMovieCredits, fetchPersonTVCredits, buildImageUrl } from '@/services/tmdbService';
import { useSmartBack } from '@/lib/navigation';
import type { TMDBPersonDetail, TMDBMovie, TMDBTVShow } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import { useDocumentTitle } from '@/hooks';
import { VideoCard } from '@/components/VideoCard';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import './Person.css';

type Tab = 'movies' | 'tv';

function toVideo(item: TMDBMovie | TMDBTVShow, mediaType: 'movie' | 'tv') {
  const isTV = 'name' in item && !('title' in item);
  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: isTV ? (item as TMDBTVShow).name : (item as TMDBMovie).title,
    cover: buildImageUrl(item.poster_path, 'w500') || '',
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<TMDBPersonDetail | null>(null);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [tvShows, setTVShows] = useState<TMDBTVShow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('movies');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bioRef.current) {
      const el = bioRef.current;
      const clamped = el.scrollHeight > el.clientHeight;
      setBioClamped(clamped);
      if (clamped) setBioExpanded(false);
    }
  }, [person?.biography]);

  useEffect(() => {
    if (!id) return;
    const personId = parseInt(id, 10);
    if (isNaN(personId)) { setError('无效的人物 ID'); setLoading(false); return; }

    const ctrl = new AbortController();
    setLoading(true); setError(null);

    (async () => {
      try {
        const [detail, movieCredits, tvCredits] = await Promise.all([
          fetchPersonDetail(personId, { signal: ctrl.signal }),
          fetchPersonMovieCredits(personId, { signal: ctrl.signal }),
          fetchPersonTVCredits(personId, { signal: ctrl.signal }),
        ]);
        if (ctrl.signal.aborted) return;
        setPerson(detail);
        // 按人气排序，取前 50
        setMovies(movieCredits.cast.sort((a, b) => b.popularity - a.popularity).slice(0, 50));
        setTVShows(tvCredits.cast.sort((a, b) => b.popularity - a.popularity).slice(0, 50));
        // 如果没有电影但有剧集，默认切到剧集 tab
        if (movieCredits.cast.length === 0 && tvCredits.cast.length > 0) {
          setActiveTab('tv');
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [id]);

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(person?.name || null);

  if (loading) return <div className="person-page"><AppLoading /></div>;
  if (error || !person) {
    return (
      <div className="person-page">
        <div className="person-not-found">
          <AlertTriangle size={48} />
          <span>{error || '人物不存在'}</span>
        </div>
      </div>
    );
  }

  const avatarUrl = person.profile_path ? buildImageUrl(person.profile_path, 'w500') || '' : '';

  const age = person.birthday
    ? person.deathday
      ? new Date(person.deathday).getFullYear() - new Date(person.birthday).getFullYear()
      : new Date().getFullYear() - new Date(person.birthday).getFullYear()
    : null;

  return (
    <div className="person-page">
      {/* Hero */}
      <section className="person-hero">
        <div className="person-hero-gradient" />

        <button className="person-hero-back" onClick={handleBack} aria-label="返回">
          <ArrowLeft size={18} />
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
                {(bioClamped || bioExpanded) && (
                  <button className="person-bio-toggle" onClick={() => setBioExpanded(!bioExpanded)}>
                    {bioExpanded ? <><ChevronUp size={14} /> 收起</> : <><ChevronDown size={14} /> 展开</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tab 导航 */}
      <div className="person-tabs">
        {movies.length > 0 && (
          <button className={`person-tab ${activeTab === 'movies' ? 'person-tab--active' : ''}`} onClick={() => setActiveTab('movies')}>
            电影（{movies.length}）
          </button>
        )}
        {tvShows.length > 0 && (
          <button className={`person-tab ${activeTab === 'tv' ? 'person-tab--active' : ''}`} onClick={() => setActiveTab('tv')}>
            剧集（{tvShows.length}）
          </button>
        )}
      </div>

      {/* 作品列表 */}
      <div className="person-works">
        {activeTab === 'movies' && movies.length > 0 && (
          <div className="person-work-grid">
            {movies.map((m) => (
              <div key={m.id} className="person-work-card">
                <VideoCard video={toVideo(m, 'movie')} rating={m.vote_average} />
              </div>
            ))}
          </div>
        )}
        {activeTab === 'tv' && tvShows.length > 0 && (
          <div className="person-work-grid">
            {tvShows.map((t) => (
              <div key={t.id} className="person-work-card">
                <VideoCard video={toVideo(t, 'tv')} rating={t.vote_average} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

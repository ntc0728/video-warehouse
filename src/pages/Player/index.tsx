/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { searchVideoFromMultipleSources } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, buildImageUrl } from '@/services/tmdbService';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { VideoCard } from '@/components/VideoCard';
import type { Video, VideoSource, Episode } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBCastMember } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import { useSmartBack } from '@/lib/navigation';
import {
  ArrowLeft, VideoOff, AlertTriangle, RefreshCw,
  ChevronDown, Play, Server, ListVideo, SkipForward, Timer, X,
} from 'lucide-react';
import './Player.css';

type TMDBResultItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

function toVideoItem(item: TMDBResultItem, mediaType: 'movie' | 'tv'): Video {
  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: mediaType === 'tv' ? item.name ?? '' : item.title ?? '',
    cover: buildImageUrl(item.poster_path, 'w500') || '',
    type: mediaType,
    year: item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.first_air_date
        ? new Date(item.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: '',
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const videoCache = new Map<string, Video>();

export default function PlayerPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const skipHistory = (location.state as Record<string, unknown>)?.skipHistory === true;

  const { videos, currentSourceIndex } = useVideoStore();
  const { setSource, setSources, reset: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress } = useUserStore();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [loadError, setLoadError] = useState<'api' | 'empty' | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [cmsResults, setCmsResults] = useState<VideoDetailResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const cmsAbortRef = useRef<AbortController | null>(null);

  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');
  const tmdbAbortRef = useRef<AbortController | null>(null);

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    cms: true,
    episodes: true,
  });

  const [skipIndicator, setSkipIndicator] = useState<'intro' | 'outro' | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayCancelRef = useRef(false);

  const EPISODE_PAGE_SIZE = 20;
  const [episodePage, setEpisodePage] = useState(0);
  const [localEpisodeId, setLocalEpisodeId] = useState<string | undefined>();

  useEffect(() => setLocalEpisodeId(episodeId), [episodeId]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const loadVideo = async () => {
      if (!id) return;

      setIsLoading(true);
      setLoadError(null);
      try {
        let foundVideo: Video | null = null;

        if (currentSourceIndex === videoSourceIndex) {
          foundVideo = videos.find((v) => v.id === id) || null;
        }

        if (!foundVideo) {
          foundVideo = videoCache.get(id) ?? null;
        }

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          if (!id.startsWith('tmdb-')) {
            const svc = await import('@/services/videoService');
            const detailVideo = await svc.fetchVideoDetail(videoSourceIndex, id);
            if (detailVideo) {
              foundVideo = detailVideo;
            }
          }
        }

        if (!foundVideo && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(videoSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
          videoCache.set(id, foundVideo);
          setVideo(foundVideo);

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          if (episodeId && foundVideo.episodes) {
            selectedEpisode = foundVideo.episodes.find((ep) => ep.id === episodeId) || null;
            if (selectedEpisode) {
              sources = selectedEpisode.sources;
            }
          }

          setSources(sources);

          if (sources.length > 0) {
            const defaultSource = sources.find((s) => s.isDefault) || sources[0];
            setCurrentSrc({ url: defaultSource.url, type: defaultSource.type });
            setSource(defaultSource.url, defaultSource.type);
          } else if (!id.startsWith('tmdb-')) {
            setLoadError('empty');
          }
        } else if (!id.startsWith('tmdb-')) {
          setLoadError('empty');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load video:', error);
        setLoadError('api');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadVideo();

    return () => {
      controller.abort();
      resetPlayer();
    };
    // zustand actions 引用稳定，不会导致重新执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId, videos, videoSourceIndex, currentSourceIndex]);

  useEffect(() => {
    if (!id || !id.startsWith('tmdb-')) return;
    tmdbAbortRef.current?.abort();
    const ctrl = new AbortController();
    tmdbAbortRef.current = ctrl;

    const loadTMDB = async () => {
      try {
        const parts = id.replace('tmdb-', '').split('-');
        const mt = parts[0] as 'movie' | 'tv';
        const tid = parseInt(parts.slice(1).join('-'), 10);
        setTmdbMediaType(mt);
        if (isNaN(tid)) return;
        const detail = mt === 'tv'
          ? await fetchTVDetail(tid, { signal: ctrl.signal })
          : await fetchMovieDetail(tid, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) setTmdbDetail(detail);
      } catch {
        // ignore
      }
    };

    loadTMDB();
    return () => ctrl.abort();
  }, [id]);

  const fetchCMSSources = useCallback(async () => {
    if (!id) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    setCmsLoading(true);
    setLoadError(null);

    const indices = videoSourceIndices && videoSourceIndices.length > 0
      ? videoSourceIndices
      : [videoSourceIndex];

    let videoTitle = '';
    let videoYear: number | undefined;
    if (tmdbDetail) {
      if ('name' in tmdbDetail) videoTitle = tmdbDetail.name || '';
      else if ('title' in tmdbDetail) videoTitle = tmdbDetail.title || '';
      if (tmdbMediaType === 'tv') {
        const dateStr = (tmdbDetail as TMDBTVShowDetail).first_air_date;
        videoYear = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
      } else {
        const dateStr = (tmdbDetail as TMDBMovieDetail).release_date;
        videoYear = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
      }
    } else if (video) {
      videoTitle = video.title || '';
      videoYear = video.year;
    }

    if (!videoTitle) {
      if (!ctrl.signal.aborted) setCmsLoading(false);
      return;
    }

    try {
      const results = await searchVideoFromMultipleSources(indices, videoTitle, videoYear);
      if (!ctrl.signal.aborted) {
        setCmsResults(results);
        const firstResult = results.find(r => r.video && (r.video.sources.length > 0 || r.video.episodes?.some(ep => ep.sources.length > 0)));
        if (firstResult?.video) {
          videoCache.set(id!, firstResult.video);
          setVideo(firstResult.video);
          const src = firstResult.video.sources.length > 0
            ? (firstResult.video.sources.find(s => s.isDefault) || firstResult.video.sources[0])
            : firstResult.video.episodes?.[0]?.sources.find(s => s.isDefault) || firstResult.video.episodes?.[0]?.sources[0];
          if (src) {
            setSources(firstResult.video.sources.length > 0 ? firstResult.video.sources : (firstResult.video.episodes?.[0]?.sources ?? []));
            setCurrentSrc({ url: src.url, type: src.type });
            setSource(src.url, src.type);
          } else if (!ctrl.signal.aborted) {
            setLoadError('empty');
          }
        } else if (!ctrl.signal.aborted) {
          setLoadError('empty');
        }
      }
    } catch {
      if (!ctrl.signal.aborted) setLoadError('api');
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
    // zustand actions 引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videoSourceIndex, videoSourceIndices, tmdbDetail, tmdbMediaType, video]);

  useEffect(() => {
    if (id?.startsWith('tmdb-') && tmdbDetail && !cmsLoading && cmsResults.length === 0) {
      fetchCMSSources();
    }
  }, [id, tmdbDetail, cmsLoading, cmsResults.length, fetchCMSSources]);

  useEffect(() => () => {
    cmsAbortRef.current?.abort();
    tmdbAbortRef.current?.abort();
  }, []);

  const handleProgress = useCallback((progress: number, duration: number) => {
    if (id) updateHistoryProgress(id, episodeId, progress, duration, video?.title, video?.cover);
  }, [id, episodeId, updateHistoryProgress, video?.title, video?.cover]);

  const handleSkipIntro = useCallback(() => {
    setSkipIndicator('intro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const handleSkipOutro = useCallback(() => {
    setSkipIndicator('outro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const nextEpisodeRef = useRef<string | null>(null);

  const startAutoPlayCountdown = useCallback((nextEpId: string) => {
    nextEpisodeRef.current = nextEpId;
    autoPlayCancelRef.current = false;
    setAutoPlayCountdown(3);
    
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
          if (!autoPlayCancelRef.current && nextEpisodeRef.current) {
            navigate(`/play/${id}/${nextEpisodeRef.current}`, {
              state: { from: `/detail/${id}` },
              viewTransition: true,
            });
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [id, navigate]);

  const cancelAutoPlay = useCallback(() => {
    autoPlayCancelRef.current = true;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
    nextEpisodeRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, []);

  const handleEnded = useCallback(() => {
    const loopMode = usePlayerStore.getState().loopMode;
    const autoPlayEnabled = useSettingsStore.getState().autoPlay;
    const activeEpId = localEpisodeId || episodeId;
    
    // 单集循环：seek 到 0 重新播放
    if (loopMode === 'single') {
      const videoEl = document.querySelector('video');
      if (videoEl) {
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
      }
      return;
    }
    
    // 自动连播关闭时，不跳转到下一集
    if (!autoPlayEnabled && loopMode === 'none') {
      return;
    }
    
    if (video?.type === 'tv' && video.episodes && activeEpId) {
      const currentIndex = video.episodes.findIndex((ep) => ep.id === activeEpId);
      
      // 列表循环：最后一集回到第一集
      if (loopMode === 'list') {
        const nextIndex = (currentIndex + 1) % video.episodes.length;
        const nextEpisode = video.episodes[nextIndex];
        startAutoPlayCountdown(nextEpisode.id);
        return;
      }
      
      // 默认模式：最后一集不跳转
      if (currentIndex < video.episodes.length - 1) {
        const nextEpisode = video.episodes[currentIndex + 1];
        startAutoPlayCountdown(nextEpisode.id);
      }
    }
  }, [video, localEpisodeId, episodeId, startAutoPlayCountdown]);

  const handleBack = useSmartBack(id ? `/detail/${id}` : undefined);

  const togglePanel = (key: string) => {
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlayEpisode = (ep: Episode) => {
    navigate(`/play/${id}/${ep.id}`, { state: { from: `/detail/${id}` }, viewTransition: true });
  };

  const handlePlayCMSSource = (result: VideoDetailResult) => {
    if (result.video) {
      videoCache.set(id!, result.video);
      setVideo(result.video);

      const activeEpId = localEpisodeId || episodeId;
      if (activeEpId && result.video.episodes?.length) {
        const currentEp = episodes.find(ep => ep.id === activeEpId);
        let matchedEp = result.video.episodes.find(ep => ep.id === activeEpId);
        if (!matchedEp && currentEp) {
          matchedEp = result.video.episodes.find(ep => ep.title === currentEp.title);
        }
        if (!matchedEp && currentEp) {
          matchedEp = result.video.episodes[Math.min(currentEp.number - 1, result.video.episodes.length - 1)];
        }
        if (matchedEp?.sources.length) {
          setLocalEpisodeId(matchedEp.id);
          const src = matchedEp.sources.find(s => s.isDefault) || matchedEp.sources[0];
          setCurrentSrc({ url: src.url, type: src.type });
          setSource(src.url, src.type);
          return;
        }
      }

      if (result.video.sources.length > 0) {
        const src = result.video.sources.find(s => s.isDefault) || result.video.sources[0];
        setCurrentSrc({ url: src.url, type: src.type });
        setSource(src.url, src.type);
      } else if (result.video.episodes?.length) {
        setLocalEpisodeId(result.video.episodes[0].id);
        const firstEp = result.video.episodes[0];
        if (firstEp.sources.length > 0) {
          const src = firstEp.sources.find(s => s.isDefault) || firstEp.sources[0];
          setCurrentSrc({ url: src.url, type: src.type });
          setSource(src.url, src.type);
        } else {
          setCurrentSrc(null);
        }
      } else {
        setCurrentSrc(null);
      }
    }
  };

  const episodes = video?.episodes
    ? [...video.episodes].sort((a, b) => a.number - b.number)
    : [];

  const d = tmdbDetail;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  }
  const isTV = d ? 'name' in d : false;
  let year: number | undefined;
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  }
  const voteAverage: number = d?.vote_average ?? 0;
  const runtime = isTV ? (d as TMDBTVShowDetail | undefined)?.episode_run_time?.[0] : (d as TMDBMovieDetail | undefined)?.runtime;
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name;
  const cast: TMDBCastMember[] = d?.credits?.cast?.slice(0, 8) || [];
  const posterUrl = d?.poster_path ? buildImageUrl(d.poster_path, 'w342') || '' : '';
  const overview = d?.overview || '';
  const similarResults = d?.similar?.results?.slice(0, 12) || [];
  const recommendedResults = d?.recommendations?.results?.slice(0, 12) || [];

  const isTMDB = id?.startsWith('tmdb-');
  const tmdbLoading = isTMDB && !tmdbDetail;
  const cmsSearching = isTMDB && !loadError && !video && cmsLoading;

  if (isLoading || tmdbLoading || cmsSearching) {
    return (
      <div className="player-page">
        <div className="player-container">
          <div className="player-loading-wrap">
            <AppLoading tip="加载中…" showTip />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="player-page">
        <div className="player-empty-state">
          <div className="player-empty-content">
            {loadError === 'api' ? (
              <>
                <AlertTriangle />
                <p className="player-empty-title">某些接口请求失败</p>
                <p className="player-empty-sub">请稍后重试</p>
              </>
            ) : (
              <>
                <VideoOff />
                <p className="player-empty-title">找不到匹配播放源</p>
                <p className="player-empty-sub">没有匹配到可播放资源，请返回详情页重新匹配</p>
              </>
            )}
            <button className="player-empty-back" onClick={handleBack}>
              <ArrowLeft size={14} />
              <span>返回</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSrc && !cmsLoading) {
    return (
      <div className="player-page">
        <div className="player-empty-state">
          <div className="player-empty-content">
            <VideoOff />
            <p className="player-empty-title">找不到匹配播放源</p>
            <p className="player-empty-sub">没有匹配到可播放资源，请返回详情页重新匹配</p>
            <button className="player-empty-back" onClick={handleBack}>
              <ArrowLeft size={14} />
              <span>返回</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSrc) return null;

  return (
    <div className="player-page">
      <div className="player-main">
        <div className="player-video-area">
          <UniversalPlayer
            key={`video-player-${id}-${episodeId || ''}`}
            mode="video"
            platform="desktop"
            url={currentSrc.url}
            type={currentSrc.type}
            title={video.title}
            videoId={video.id}
            episodeId={episodeId}
            skipHistory={skipHistory}
            onProgress={handleProgress}
            onEnded={handleEnded}
            onBack={handleBack}
            onRefresh={fetchCMSSources}
            onSkipIntro={handleSkipIntro}
            onSkipOutro={handleSkipOutro}
          />

          {/* Skip indicator */}
          {skipIndicator && (
            <div className="player-skip-indicator">
              <SkipForward size={18} />
              <span>{skipIndicator === 'intro' ? '已跳过片头' : '已跳过片尾'}</span>
            </div>
          )}

          {/* Auto-play countdown overlay */}
          {autoPlayCountdown !== null && (
            <div className="player-autoplay-overlay">
              <div className="player-autoplay-card">
                <Timer size={20} className="player-autoplay-icon" />
                <span className="player-autoplay-text">
                  {autoPlayCountdown} 秒后播放下一集
                </span>
                <button className="player-autoplay-cancel" onClick={cancelAutoPlay}>
                  <X size={14} />
                  <span>取消</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="player-sidebar">
          <div className="player-panel">
            <button className="player-panel-header" onClick={() => togglePanel('cms')}>
              <span className="player-panel-icon"><Server size={16} /></span>
              <span className="player-panel-title">CMS源</span>
              <span className={`player-panel-arrow ${expandedPanels.cms ? 'expanded' : ''}`}>
                <ChevronDown size={16} />
              </span>
            </button>
            <div className={`player-panel-body${expandedPanels.cms ? '' : ' collapsed'}`}>
              {cmsLoading ? (
                <div className="player-panel-loading"><RefreshCw size={18} className="spinning" /><span>加载中…</span></div>
              ) : cmsResults.length > 0 ? (
                <div className="player-cms-list">
                  {cmsResults.map((result) => (
                    <button
                      key={result.sourceIndex}
                        className={`player-cms-item ${result.video ? '' : 'disabled'} ${currentSrc && result.video && (result.video.sources?.some(s => s.url === currentSrc.url) || result.video.episodes?.some(ep => ep.sources.some(s => s.url === currentSrc.url))) ? 'active' : ''}`}
                      onClick={() => result.video && handlePlayCMSSource(result)}
                      disabled={!result.video}
                    >
                      <span className="player-cms-name">{result.sourceName}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="player-panel-empty">暂无数据源</div>
              )}
              <button className="player-panel-refresh" onClick={fetchCMSSources} disabled={cmsLoading}>
                <RefreshCw size={12} className={cmsLoading ? 'spinning' : ''} /> 刷新源
              </button>
            </div>
          </div>

          <div className="player-panel">
            <button className="player-panel-header" onClick={() => togglePanel('episodes')}>
              <span className="player-panel-icon"><ListVideo size={16} /></span>
              <span className="player-panel-title">选集</span>
              <span className={`player-panel-arrow ${expandedPanels.episodes ? 'expanded' : ''}`}>
                <ChevronDown size={16} />
              </span>
            </button>
            <div className={`player-panel-body${expandedPanels.episodes ? '' : ' collapsed'}`}>
                {cmsLoading ? (
                  <div className="player-panel-loading"><RefreshCw size={18} className="spinning" /><span>加载中…</span></div>
                ) : episodes.length > 0 ? (
                  <>
                    <div className="player-episode-grid">
                      {episodes.slice(episodePage * EPISODE_PAGE_SIZE, (episodePage + 1) * EPISODE_PAGE_SIZE).map((ep) => (
                        <button
                          key={ep.id}
                          className={`player-episode-btn ${ep.id === (localEpisodeId || episodeId) ? 'active' : ''}`}
                          onClick={() => handlePlayEpisode(ep)}
                        >
                          {ep.title}
                        </button>
                      ))}
                    </div>
                    {episodes.length > EPISODE_PAGE_SIZE && (
                      <div className="player-episode-pagination">
                        <button
                          className="player-episode-page-btn"
                          disabled={episodePage === 0}
                          onClick={() => setEpisodePage(p => p - 1)}
                        >
                          上一页
                        </button>
                        <span className="player-episode-page-info">
                          {episodePage + 1} / {Math.ceil(episodes.length / EPISODE_PAGE_SIZE)}
                        </span>
                        <button
                          className="player-episode-page-btn"
                          disabled={(episodePage + 1) * EPISODE_PAGE_SIZE >= episodes.length}
                          onClick={() => setEpisodePage(p => p + 1)}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </>
                ) : video.sources.length > 0 ? (
                  <div className="player-source-list">
                    {video.sources.map((src) => (
                      <button
                        key={src.id}
                        className={`player-source-item ${src.url === currentSrc.url ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentSrc({ url: src.url, type: src.type });
                          setSource(src.url, src.type);
                        }}
                      >
                        <Play size={12} fill="currentColor" />
                        <span>{src.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="player-panel-empty">暂无选集</div>
                )}
              </div>
          </div>
        </div>
      </div>

      {d && (
        <div className="player-detail-section">
          <div className="player-detail-content">
            <div className="player-detail-info">
              <div className="player-detail-info-header">
                <h3 className="player-detail-title">{title}</h3>
                <div className="player-detail-meta">
                  {voteAverage > 0 && <span>★ {voteAverage.toFixed(1)}</span>}
                  {year && <span>{year}</span>}
                  {runtime && <span>{runtime}分钟</span>}
                  {director && <span>导演: {director}</span>}
                </div>
                {cast.length > 0 && (
                  <div className="player-detail-cast">
                    <span className="player-detail-cast-label">演员:</span>
                    {cast.map((c) => c.name).join(' / ')}
                  </div>
                )}
              </div>
              <div className="player-detail-info-body">
                {posterUrl && (
                  <div className="player-detail-poster">
                    <img src={posterUrl} alt={title} />
                  </div>
                )}
                {overview && <p className="player-detail-overview">{overview}</p>}
              </div>
            </div>

            {similarResults.length > 0 && (
              <section className="player-recommend">
                <h4 className="player-recommend-title">相关推荐</h4>
                <div className="player-recommend-row">
                  {similarResults.map((item) => (
                    <div key={item.id} className="player-recommend-card">
                      <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {recommendedResults.length > 0 && (
              <section className="player-recommend">
                <h4 className="player-recommend-title">你可能还喜欢</h4>
                <div className="player-recommend-row">
                  {recommendedResults.map((item) => (
                    <div key={item.id} className="player-recommend-card">
                      <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

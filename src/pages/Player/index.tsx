/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { searchVideoFromMultipleSources } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, buildImageUrl } from '@/services/tmdbService';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import type { Video, VideoSource, Episode } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBCastMember } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import { useSmartBack } from '@/lib/navigation';
import {
  ArrowLeft, VideoOff, AlertTriangle, RefreshCw,
  ChevronDown, ChevronRight, Play, Server, ListVideo,
} from 'lucide-react';
import './Player.css';

const MAX_RETRIES = 2;

export default function PlayerPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId?: string }>();
  const navigate = useNavigate();

  const { videos, currentSourceIndex } = useVideoStore();
  const { setSource, setSources, reset: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress } = useUserStore();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
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

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          if (!id.startsWith('tmdb-')) {
            const { default: svc } = await import('@/services/videoService');
            const detailVideo = await svc.fetchVideoDetail(videoSourceIndex, id);
            if (detailVideo) {
              foundVideo = detailVideo;
            }
          }
        }

        if (!foundVideo && !id.startsWith('tmdb-')) {
          const { default: svc } = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(videoSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
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
    }

    if (!videoTitle) {
      if (!ctrl.signal.aborted) setCmsLoading(false);
      return;
    }

    try {
      const results = await searchVideoFromMultipleSources(indices, videoTitle, videoYear);
      if (!ctrl.signal.aborted) {
        setCmsResults(results);
        const firstResult = results.find(r => r.video);
        if (firstResult?.video) {
          setVideo(firstResult.video);
          setSources(firstResult.video.sources);
          if (firstResult.video.sources.length > 0) {
            const src = firstResult.video.sources.find(s => s.isDefault) || firstResult.video.sources[0];
            setCurrentSrc({ url: src.url, type: src.type });
            setSource(src.url, src.type);
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
  }, [id, videoSourceIndex, videoSourceIndices, tmdbDetail, tmdbMediaType]);

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
    if (id) updateHistoryProgress(id, episodeId, progress, duration);
  }, [id, episodeId, updateHistoryProgress]);

  const handleEnded = useCallback(() => {
    if (video?.type === 'tv' && video.episodes && episodeId) {
      const currentIndex = video.episodes.findIndex((ep) => ep.id === episodeId);
      if (currentIndex < video.episodes.length - 1) {
        const nextEpisode = video.episodes[currentIndex + 1];
        navigate(`/play/${id}/${nextEpisode.id}`, { state: { from: `/detail/${id}` } });
      }
    }
  }, [video, episodeId, id, navigate]);

  const handleBack = useSmartBack(id ? `/detail/${id}` : undefined);

  const handleError = useCallback(() => setHasError(true), []);

  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      setHasError(false);
    }
  }, [retryCount]);

  const togglePanel = (key: string) => {
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlayEpisode = (ep: Episode) => {
    navigate(`/play/${id}/${ep.id}`, { state: { from: `/detail/${id}` } });
  };

  const handlePlayCMSSource = (result: VideoDetailResult) => {
    if (result.video?.sources?.length) {
      const src = result.video.sources[0];
      setCurrentSrc({ url: src.url, type: src.type });
      setSource(src.url, src.type);
      setVideo(result.video);
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

  if (loadError || !video || !currentSrc) {
    return (
      <div className="player-page">
        <div className="player-container">
          <div className="player-empty-state">
            <button className="player-empty-back btn-press" onClick={handleBack}>
              <ArrowLeft />
            </button>
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-page">
      <div className="player-main">
        <div className="player-video-area">
          <UniversalPlayer
            key={`video-player-${retryCount}`}
            mode="video"
            platform="desktop"
            url={currentSrc.url}
            type={currentSrc.type}
            title={video.title}
            videoId={video.id}
            episodeId={episodeId}
            onProgress={handleProgress}
            onEnded={handleEnded}
            onError={handleError}
          />
          {hasError && (
            <div className="player-error-overlay">
              <div className="player-error-content">
                <div className="error-icon-wrap">
                  <AlertTriangle />
                </div>
                <p className="player-error-message">播放失败，请检查网络连接</p>
                {retryCount < MAX_RETRIES ? (
                  <button className="player-retry-btn" onClick={handleRetry}>
                    <RefreshCw /> 重试 ({retryCount + 1}/{MAX_RETRIES})
                  </button>
                ) : (
                  <div className="player-error-actions">
                    <p className="player-error-hint">已达到最大重试次数</p>
                    <button className="player-retry-btn secondary" onClick={handleBack}>
                      <ArrowLeft /> 返回
                    </button>
                  </div>
                )}
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
            {expandedPanels.cms && (
              <div className="player-panel-body">
                {cmsLoading ? (
                  <div className="player-panel-loading"><AppLoading tip="加载中…" showTip={false} /></div>
                ) : cmsResults.length > 0 ? (
                  <div className="player-cms-list">
                    {cmsResults.map((result) => (
                      <button
                        key={result.sourceIndex}
                        className={`player-cms-item ${result.video ? '' : 'disabled'}`}
                        onClick={() => result.video && handlePlayCMSSource(result)}
                        disabled={!result.video}
                      >
                        <span className="player-cms-name">{result.sourceName}</span>
                        {result.error && <span className="player-cms-error">{result.error}</span>}
                        {result.video && <ChevronRight size={14} />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="player-panel-empty">暂无数据源</div>
                )}
                <button className="player-panel-refresh" onClick={fetchCMSSources}>
                  <RefreshCw size={12} /> 刷新源
                </button>
              </div>
            )}
          </div>

          <div className="player-panel">
            <button className="player-panel-header" onClick={() => togglePanel('episodes')}>
              <span className="player-panel-icon"><ListVideo size={16} /></span>
              <span className="player-panel-title">选集</span>
              <span className={`player-panel-arrow ${expandedPanels.episodes ? 'expanded' : ''}`}>
                <ChevronDown size={16} />
              </span>
            </button>
            {expandedPanels.episodes && (
              <div className="player-panel-body">
                {episodes.length > 0 ? (
                  <div className="player-episode-grid">
                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        className={`player-episode-btn ${ep.id === episodeId ? 'active' : ''}`}
                        onClick={() => handlePlayEpisode(ep)}
                      >
                        {ep.title}
                      </button>
                    ))}
                  </div>
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
            )}
          </div>
        </div>
      </div>

      {d && (
        <div className="player-detail-section">
          <div className="player-detail-content">
            <div className="player-detail-info">
              <h3 className="player-detail-title">{title}</h3>
              <div className="player-detail-meta">
                {voteAverage > 0 && <span>★ {voteAverage.toFixed(1)}</span>}
                {year && <span>{year}</span>}
                {runtime && <span>{runtime}分钟</span>}
                {director && <span>导演: {director}</span>}
              </div>
              {overview && <p className="player-detail-overview">{overview}</p>}
              {cast.length > 0 && (
                <div className="player-detail-cast">
                  <span className="player-detail-cast-label">演员:</span>
                  {cast.map((c) => c.name).join(' / ')}
                </div>
              )}
            </div>

            {similarResults.length > 0 && (
              <div className="player-detail-section-block">
                <h4 className="player-detail-section-title">相关推荐</h4>
                <div className="player-detail-grid">
                  {similarResults.map((item) => (
                    <div key={item.id} className="player-detail-card" onClick={() => navigate(`/detail/tmdb-${tmdbMediaType}-${item.id}`)}>
                      <div className="player-detail-card-cover">
                        {item.poster_path ? (
                          <img src={buildImageUrl(item.poster_path, 'w200') || ''} alt={item.title || item.name} />
                        ) : (
                          <div className="player-detail-card-placeholder"><Server size={20} /></div>
                        )}
                      </div>
                      <div className="player-detail-card-info">
                        <span className="player-detail-card-title">{item.title || item.name}</span>
                        {item.release_date && <span className="player-detail-card-year">{item.release_date.slice(0, 4)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendedResults.length > 0 && (
              <div className="player-detail-section-block">
                <h4 className="player-detail-section-title">你可能还喜欢</h4>
                <div className="player-detail-grid">
                  {recommendedResults.map((item) => (
                    <div key={item.id} className="player-detail-card" onClick={() => navigate(`/detail/tmdb-${tmdbMediaType}-${item.id}`)}>
                      <div className="player-detail-card-cover">
                        {item.poster_path ? (
                          <img src={buildImageUrl(item.poster_path, 'w200') || ''} alt={item.title || item.name} />
                        ) : (
                          <div className="player-detail-card-placeholder"><Server size={20} /></div>
                        )}
                      </div>
                      <div className="player-detail-card-info">
                        <span className="player-detail-card-title">{item.title || item.name}</span>
                        {item.release_date && <span className="player-detail-card-year">{item.release_date.slice(0, 4)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

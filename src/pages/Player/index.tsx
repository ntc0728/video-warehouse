/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { getHistory } from '@/services/database';
import type { HistoryRecord } from '@/types/store';
import { useSmartBack } from '@/lib/navigation';
import { isNativePlatform } from '@/lib/platform';
import {
  ArrowLeft, VideoOff, AlertTriangle,
  SkipForward, Timer, X,
} from 'lucide-react';
import { PlayerCMSPanel } from './PlayerCMSPanel';
import { PlayerEpisodesPanel } from './PlayerEpisodesPanel';
import { PlayerSidebar } from './PlayerSidebar';
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

  const isCompact = useMemo(() => isNativePlatform(), []);

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [loadError, setLoadError] = useState<'api' | 'empty' | null>(null);
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

  const [localEpisodeId, setLocalEpisodeId] = useState<string | undefined>();

  // ── ref 绑定（渲染阶段同步，消除闭包陈旧问题）────────────────
  const abortRef = useRef<AbortController | null>(null);
  const currentSourceNameRef = useRef<string | undefined>(undefined);
  const currentSrcRef = useRef(currentSrc);
  currentSrcRef.current = currentSrc;
  const videoRef = useRef(video);
  videoRef.current = video;
  const backdropRef = useRef<string | undefined>(undefined);
  backdropRef.current = tmdbDetail?.backdrop_path
    ? buildImageUrl(tmdbDetail.backdrop_path, 'w780') || undefined
    : undefined;
  const localEpisodeIdRef = useRef(localEpisodeId);
  localEpisodeIdRef.current = localEpisodeId;
  // CMS 源配置名称（如 "量子资源"），不同于播放线路名（如 "ikm3u8"）
  const cmsSourceNameRef = useRef<string | undefined>(undefined);
  // 渲染阶段通过 source URL 在 video 数据中精确匹配源名称
  if (currentSrc && video) {
    const url = currentSrc.url;
    const match = video.sources.find(s => s.url === url)
      ?? video.episodes?.flatMap(e => e.sources).find(s => s.url === url);
    if (match?.name) currentSourceNameRef.current = match.name;
  }

  useEffect(() => setLocalEpisodeId(episodeId), [episodeId]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const loadVideo = async () => {
      if (!id) return;

      setIsLoading(true);
      setLoadError(null);

      // 提前读取历史记录：cmsSourceName 用于恢复 CMS 源，episodeId 用于恢复集数
      let activeSourceIndex = videoSourceIndex;
      let historyRecord: HistoryRecord | undefined;
      try {
        const history = await getHistory();
        historyRecord = history.find(h => h.videoId === id);
        if (historyRecord?.cmsSourceName) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          const matchedIdx = allSrc.findIndex(s => s.name === historyRecord!.cmsSourceName);
          if (matchedIdx >= 0) activeSourceIndex = matchedIdx;
        }
      } catch { /* history read failed, use default */ }

      try {
        let foundVideo: Video | null = null;

        if (currentSourceIndex === activeSourceIndex) {
          foundVideo = videos.find((v) => v.id === id) || null;
        }

        if (!foundVideo) {
          foundVideo = videoCache.get(id) ?? null;
        }

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          if (!id.startsWith('tmdb-')) {
            const svc = await import('@/services/videoService');
            const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
            if (detailVideo) {
              foundVideo = detailVideo;
            }
          }
        }

        if (!foundVideo && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
          videoCache.set(id, foundVideo);
          setVideo(foundVideo);

          // 恢复上次的 CMS 源名称
          if (historyRecord?.cmsSourceName) {
            cmsSourceNameRef.current = historyRecord.cmsSourceName;
          }

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          if (foundVideo.episodes && foundVideo.episodes.length > 0) {
            if (episodeId) {
              selectedEpisode = foundVideo.episodes.find((ep) => ep.id === episodeId) || null;
            } else {
              // 从历史记录恢复上次播放的选集
              if (historyRecord?.episodeId) {
                selectedEpisode = foundVideo.episodes.find(
                  (ep) => ep.id === historyRecord.episodeId
                ) || null;
              }
              // 无历史记录则默认播放第一集
              if (!selectedEpisode) {
                selectedEpisode = [...foundVideo.episodes].sort((a, b) => a.number - b.number)[0] || null;
              }
            }
            if (selectedEpisode) {
              sources = selectedEpisode.sources;
              setLocalEpisodeId(selectedEpisode.id);
            }
          }

          setSources(sources);

          if (sources.length > 0) {
            // 从历史记录恢复上次使用的源
            let matchedSource = sources[0];
            if (historyRecord?.sourceName) {
              const found = sources.find(s => s.name === historyRecord.sourceName);
              if (found) matchedSource = found;
            }
            const defaultSource = sources.find(s => s.isDefault) || matchedSource;
            setCurrentSrc({ url: defaultSource.url, type: defaultSource.type });
            setSource(defaultSource.url, defaultSource.type);
            currentSourceNameRef.current = defaultSource.name;
            // CMS 源名称优先从历史记录恢复
            if (!cmsSourceNameRef.current) {
              const { getVideoSources } = await import('@/services/sourceService');
              const allSources = await getVideoSources();
              cmsSourceNameRef.current = allSources[activeSourceIndex]?.name;
            }
          } else if (!id.startsWith('tmdb-')) {
            setLoadError('empty');
          }
        } else if (!id.startsWith('tmdb-')) {
          setLoadError('empty');
        }
        // 无本地数据时，从历史记录恢复 CMS 源名称
        if (!foundVideo && historyRecord?.cmsSourceName) {
          cmsSourceNameRef.current = historyRecord.cmsSourceName;
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
        // 从历史记录恢复上次的 CMS 源
        let preferredSourceName = cmsSourceNameRef.current;
        if (!preferredSourceName) {
          try {
            const history = await getHistory();
            preferredSourceName = history.find(h => h.videoId === id)?.cmsSourceName;
          } catch { /* ignore */ }
        }
        const validResults = results.filter(r => r.video && (r.video.sources.length > 0 || r.video.episodes?.some(ep => ep.sources.length > 0)));
        const firstResult = preferredSourceName
          ? (validResults.find(r => r.sourceName === preferredSourceName) || validResults[0])
          : validResults[0];
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
            currentSourceNameRef.current = src.name;
            cmsSourceNameRef.current = firstResult.sourceName;
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
    if (id) {
      const v = videoRef.current;
      // URL 有 episodeId 时用 URL，否则用 loadVideo 自动选中的 localEpisodeId
      const activeEpId = episodeId || localEpisodeIdRef.current;
      const currentEp = v?.episodes?.length ? v.episodes.find((e) => e.id === activeEpId) : undefined;
      // 剧集 → "第X集"，电影 → vod_play_url 解析出的名称（如 "正片"）
      const epLabel = currentEp ? `第${currentEp.number}集` : (!v?.episodes?.length && currentSourceNameRef.current ? currentSourceNameRef.current : undefined);
      updateHistoryProgress(id, activeEpId, progress, duration, v?.title, v?.cover, backdropRef.current, currentSourceNameRef.current, cmsSourceNameRef.current, epLabel);
    }
  }, [id, episodeId, updateHistoryProgress]);

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

  // 卸载时清理
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
      cmsSourceNameRef.current = result.sourceName;
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
          currentSourceNameRef.current = src.name;
          return;
        }
      }

      if (result.video.sources.length > 0) {
        const src = result.video.sources.find(s => s.isDefault) || result.video.sources[0];
        setCurrentSrc({ url: src.url, type: src.type });
        setSource(src.url, src.type);
        currentSourceNameRef.current = src.name;
      } else if (result.video.episodes?.length) {
        setLocalEpisodeId(result.video.episodes[0].id);
        const firstEp = result.video.episodes[0];
        if (firstEp.sources.length > 0) {
          const src = firstEp.sources.find(s => s.isDefault) || firstEp.sources[0];
          setCurrentSrc({ url: src.url, type: src.type });
          setSource(src.url, src.type);
          currentSourceNameRef.current = src.name;
        } else {
          setCurrentSrc(null);
          currentSourceNameRef.current = undefined;
        }
      } else {
        setCurrentSrc(null);
        currentSourceNameRef.current = undefined;
      }
    }
  };

  const handlePlaySource = useCallback((src: VideoSource) => {
    setCurrentSrc({ url: src.url, type: src.type });
    setSource(src.url, src.type);
    currentSourceNameRef.current = src.name;
  }, [setSource]);

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
        <div className="player-page__container">
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

        <PlayerSidebar compact={isCompact}>
          <PlayerCMSPanel
            cmsResults={cmsResults}
            cmsLoading={cmsLoading}
            currentSrc={currentSrc}
            onRefresh={fetchCMSSources}
            onPlaySource={handlePlayCMSSource}
            expanded={expandedPanels.cms}
            onToggle={() => togglePanel('cms')}
            compact={isCompact}
          />
          <PlayerEpisodesPanel
            episodes={episodes}
            sources={video.sources}
            currentSrc={currentSrc}
            activeEpisodeId={localEpisodeId || episodeId}
            onPlayEpisode={handlePlayEpisode}
            onPlaySource={handlePlaySource}
            expanded={expandedPanels.episodes}
            onToggle={() => togglePanel('episodes')}
            compact={isCompact}
          />
        </PlayerSidebar>
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
                    <img src={posterUrl} alt={title} width={300} height={450} />
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
                    <div key={`sim-${item.id}`} className="player-recommend-card">
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
                    <div key={`rec-${item.id}`} className="player-recommend-card">
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

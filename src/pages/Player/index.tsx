/**
 * 视频播放页面
 * 加载视频详情和播放源，支持选集切换、播放进度记忆、
 * 电视剧自动播放下一集和 AI 字幕功能
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { fetchVideoDetail } from '@/services/videoService';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import type { Video, VideoSource, Episode } from '@/types/video';
import { AppLoading } from '@/components/common';
import { useSmartBack } from '@/lib/navigation';
import { ArrowLeft, ListVideo, VideoOff, AlertTriangle, RefreshCw } from 'lucide-react';
import './Player.css';

const MAX_RETRIES = 3;

export default function PlayerPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId?: string }>();
  const navigate = useNavigate();

  const { videos, currentSourceIndex } = useVideoStore();
  const { setSource, setSources, reset: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress } = useUserStore();
  const { videoSourceIndex } = useSettingsStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  /** 加载视频详情并初始化播放源，优先使用选集的播放源 */
  useEffect(() => {
    const loadVideo = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        let foundVideo: Video | null = null;

        if (currentSourceIndex === videoSourceIndex) {
          foundVideo = videos.find((v) => v.id === id) || null;
        }

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          const detailVideo = await fetchVideoDetail(videoSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (!foundVideo) {
          const detailVideo = await fetchVideoDetail(videoSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (foundVideo) {
          setVideo(foundVideo);

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          /** 如果指定了集数，使用该集的播放源 */
          if (episodeId && foundVideo.episodes) {
            selectedEpisode = foundVideo.episodes.find((ep) => ep.id === episodeId) || null;
            if (selectedEpisode) {
              sources = selectedEpisode.sources;
            }
          }

          setCurrentEpisode(selectedEpisode);
          setSources(sources);

          if (sources.length > 0) {
            const defaultSource = sources.find((s) => s.isDefault) || sources[0];
            setCurrentSrc({ url: defaultSource.url, type: defaultSource.type });
            setSource(defaultSource.url, defaultSource.type);
          }
        }
      } catch (error) {
        console.error('Failed to load video:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();

    /** 离开播放页时重置播放器状态 */
    return () => {
      resetPlayer();
    };
    // store actions (resetPlayer/setSource/setSources) 来自 zustand，引用稳定；引入依赖会触发清理逻辑提前执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId, videos, videoSourceIndex, currentSourceIndex]);

  /** 实时更新播放进度到历史记录 */
  const handleProgress = useCallback((progress: number, duration: number) => {
    if (id) {
      updateHistoryProgress(id, episodeId, progress, duration);
    }
  }, [id, episodeId, updateHistoryProgress]);

  /** 电视剧播放结束后自动跳转下一集（带 from 来源，避免回退地狱） */
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

  const handleError = useCallback((_error: Error) => {
    setHasError(true);
  }, []);

  /** 重试播放，通过更新 key 重新创建播放器实例 */
  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      setHasError(false);
    }
  }, [retryCount]);

  if (isLoading) {
    return <AppLoading fullScreen />;
  }

  if (!video || !currentSrc) {
    return (
      <div className="player-page">
        <div className="player-not-found">
          <button
            className="back-btn btn-press"
            onClick={handleBack}
          >
            <ArrowLeft />
          </button>
          <VideoOff />
          <span>视频不存在</span>
        </div>
      </div>
    );
  }

  const displayTitle = currentEpisode
    ? `${video.title} - ${currentEpisode.title}`
    : video.title;

  return (
    <div className="player-page">
      <div className="player-header">
        <button className="back-btn on-dark btn-press" onClick={handleBack}>
          <ArrowLeft />
        </button>
        <span className="player-header-title">{displayTitle}</span>
      </div>

      <div className="player-container">
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

      {video.episodes && video.episodes.length > 0 && (
        <div className="player-episodes">
          <h3 className="player-episodes-title">
            <ListVideo /> 选集
          </h3>
          <div className="episode-grid">
            {video.episodes.map((ep) => (
              <button
                key={ep.id}
                className={`episode-btn ${ep.id === episodeId ? 'active' : ''}`}
                onClick={() => navigate(`/play/${id}/${ep.id}`, { state: { from: `/detail/${id}` } })}
              >
                {ep.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

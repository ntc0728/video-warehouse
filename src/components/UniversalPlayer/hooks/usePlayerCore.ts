import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { createAdapter } from '../adapters/adapterRegistry';
import type { IPlayerAdapter } from '../adapters/PlayerAdapter';
import type { DecoderMode, PlayerLevel } from '@/types/player';
import type { SourceType } from '@/types/video';
import type { AudioTrack } from '../adapters/PlayerAdapter';
import { getHistory } from '@/services/database';

interface UsePlayerCoreOptions {
  url: string;
  type: SourceType;
  videoId?: string;
  episodeId?: string;
  skipHistory?: boolean;
  decoderMode: DecoderMode;
  retryCount?: number;
  onProgress?: (progress: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error) => void;
  onSkipIntro?: () => void;
  onSkipOutro?: () => void;
}

export function usePlayerCore(options: UsePlayerCoreOptions) {
  const {
    url, type, videoId, episodeId, skipHistory = false, decoderMode, retryCount,
    onProgress, onEnded, onPlay, onPause, onError, onSkipIntro, onSkipOutro,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adapterRef = useRef<IPlayerAdapter | null>(null);

  const volume = usePlayerStore(s => s.volume);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  const setCurrentLevel = usePlayerStore(s => s.setCurrentLevel);
  const setLevels = usePlayerStore(s => s.setLevels);

  const initAdapter = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.destroy();
      adapterRef.current = null;
    }

    if (!videoRef.current) return;
    if (!type || !url) return;

    const adapter = createAdapter(type, url, {
      decoderMode,
      startLevel: usePlayerStore.getState().currentLevel,
      onError,
    });

    adapter.attach(videoRef.current);
    adapterRef.current = adapter;

    if (type === 'm3u8') {
      const checkLevels = setInterval(() => {
        const levels = adapter.getLevels();
        if (levels.length > 0) {
          setLevels(levels);
          clearInterval(checkLevels);
        }
      }, 200);

      setTimeout(() => clearInterval(checkLevels), 10000);
    }
  }, [url, type, decoderMode, onError, setLevels]);

  const loadProgress = useCallback(async () => {
    if (!videoId || !videoRef.current || skipHistory) return;
    try {
      const history = await getHistory();
      const videoHistory = history.find(
        (h) => h.videoId === videoId && h.episodeId === episodeId
      );
      if (videoHistory && videoHistory.progress > 0 && videoRef.current.duration) {
        videoRef.current.currentTime = Math.min(videoHistory.progress, videoRef.current.duration - 1);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [videoId, episodeId, skipHistory]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    initAdapter();

    video.volume = volume;
    video.playbackRate = playbackRate;
    video.disablePictureInPicture = false;

    // 一次性获取最新 store actions，避免 effect 频繁重建
    const getStore = usePlayerStore.getState;
    const handlePlay = () => { getStore().setPlaying(true); onPlay?.(); };
    const handlePause = () => { getStore().setPlaying(false); onPause?.(); };
    const handleTimeUpdate = () => {
      const ct = video.currentTime;
      const dur = video.duration;
      if (dur > 0) {
        const s = getStore();
        
        // 跳过片头：如果启用且当前时间在片头范围内，跳转到片头结束位置
        const settings = useSettingsStore.getState();
        if (settings.skipIntro && ct < settings.skipIntroDuration && ct < settings.skipIntroDuration - 1) {
          video.currentTime = settings.skipIntroDuration;
          onSkipIntro?.();
          return;
        }
        
        // 跳过片尾：如果启用且当前时间接近视频结尾，触发结束
        if (settings.skipOutro && ct > dur - settings.skipOutroDuration && ct < dur - 1) {
          video.pause();
          onSkipOutro?.();
          onEnded?.();
          return;
        }
        
        s.setProgress(ct);
        s.setDuration(dur);
        onProgress?.(ct, dur);
      }
    };
    const handleEnded = () => { getStore().setPlaying(false); onEnded?.(); };
    const handleVolumeChange = () => { getStore().setVolume(video.volume); };
    const handleRateChange = () => { getStore().setPlaybackRate(video.playbackRate); };
    const handleEnterPiP = () => { getStore().setIsPiP(true); };
    const handleLeavePiP = () => { getStore().setIsPiP(false); };
    const handleLoadedMetadata = () => { loadProgress(); };
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        getStore().setBufferedProgress(bufferedEnd);
      }
    };

    const handleNativeError = () => {
      const mediaError = video.error;
      if (!mediaError) return;
      let msg: string;
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          msg = '播放被中止';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          msg = '网络错误，无法加载视频';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          msg = '视频解码失败';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg = '频道源不可用';
          break;
        default:
          msg = `播放错误 (${mediaError.code})`;
      }
      onError?.(new Error(msg));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleNativeError);
    video.addEventListener('progress', handleProgress);

    const bandwidthTimer = setInterval(() => {
      let bps = adapterRef.current?.getBandwidthEstimate() ?? 0;
      if (!Number.isFinite(bps) || bps < 0) bps = 0;

      if (bps === 0) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          if (performance.getEntriesByType) {
            const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            const recentEntries = entries.filter(
              (e) =>
                e.name.includes(url) ||
                (e.initiatorType === 'xmlhttprequest' && (e.name.includes('m3u8') || e.name.includes('ts')))
            );
            if (recentEntries.length > 0) {
              const lastEntry = recentEntries[recentEntries.length - 1];
              if (lastEntry.transferSize > 0 && lastEntry.duration > 0) {
                bps = (lastEntry.transferSize * 8) / (lastEntry.duration / 1000);
              }
            }
          }
        }
      }

      getStore().setBandwidthEstimate(bps);
    }, 1000);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleNativeError);
      video.removeEventListener('progress', handleProgress);

      clearInterval(bandwidthTimer);

      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
    // 内部用 usePlayerStore.getState() 读取最新 actions 与 props 闭包，避免 effect 频繁重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, type, decoderMode, retryCount]);

  const play = useCallback(async () => {
    try {
      await videoRef.current?.play();
    } catch {
      onError?.(new Error('播放被浏览器拦截，请点击屏幕重试'));
    }
  }, [onError]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      videoRef.current.play().catch(() => {
        onError?.(new Error('播放被浏览器拦截，请点击屏幕重试'));
      });
    } else {
      videoRef.current?.pause();
    }
  }, [onError]);

  const seek = useCallback((time: number) => {
    if (videoRef.current && !videoRef.current.error) videoRef.current.currentTime = time;
  }, []);

  const setVideoVolume = useCallback((vol: number) => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, vol));
  }, []);

  const setVideoPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  const togglePiP = useCallback(async () => {
    try {
      const video = videoRef.current;
      if (!video) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        if (video.readyState === 0) {
          await new Promise<void>((resolve) => {
            const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve(); };
            video.addEventListener('loadedmetadata', onLoaded);
          });
        }
        video.disablePictureInPicture = false;
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
  }, []);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const switchLevel = useCallback((level: number) => {
    if (adapterRef.current) {
      adapterRef.current.setCurrentLevel(level);
      setCurrentLevel(level);
    }
  }, [setCurrentLevel]);

  const getLevels = useCallback((): PlayerLevel[] => {
    return adapterRef.current?.getLevels() ?? [];
  }, []);

  const getAudioTracks = useCallback((): AudioTrack[] => {
    return adapterRef.current?.getAudioTracks() ?? [];
  }, []);

  const setCurrentAudioTrack = useCallback((trackId: number) => {
    adapterRef.current?.setCurrentAudioTrack(trackId);
  }, []);

  const getCurrentAudioTrack = useCallback((): number => {
    return adapterRef.current?.getCurrentAudioTrack() ?? -1;
  }, []);

  return {
    videoRef: setVideoRef,
    play,
    pause,
    togglePlay,
    seek,
    setVolume: setVideoVolume,
    setPlaybackRate: setVideoPlaybackRate,
    togglePiP,
    switchLevel,
    getLevels,
    getAudioTracks,
    setCurrentAudioTrack,
    getCurrentAudioTrack,
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    getIsPlaying: () => !videoRef.current?.paused,
    isLive: () => adapterRef.current?.isLive() ?? false,
    getLiveLatency: () => adapterRef.current?.getLiveLatency() ?? 0,
    getSeekableStart: () => adapterRef.current?.getSeekableStart() ?? 0,
    getSeekableEnd: () => adapterRef.current?.getSeekableEnd() ?? 0,
  };
}

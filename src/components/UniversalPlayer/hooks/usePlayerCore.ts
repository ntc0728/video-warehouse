import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/stores';
import { createAdapter } from '../adapters/adapterRegistry';
import type { IPlayerAdapter } from '../adapters/PlayerAdapter';
import type { DecoderMode, PlayerLevel } from '@/types/player';
import type { SourceType } from '@/types/video';
import { getHistory } from '@/services/database';

interface UsePlayerCoreOptions {
  url: string;
  type: SourceType;
  videoId?: string;
  episodeId?: string;
  decoderMode: DecoderMode;
  onProgress?: (progress: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error) => void;
}

export function usePlayerCore(options: UsePlayerCoreOptions) {
  const {
    url, type, videoId, episodeId, decoderMode,
    onProgress, onEnded, onPlay, onPause, onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adapterRef = useRef<IPlayerAdapter | null>(null);
  const progressSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    volume, playbackRate, setCurrentLevel, setLevels,
  } = usePlayerStore();

  const initAdapter = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.destroy();
      adapterRef.current = null;
    }

    if (!videoRef.current) return;

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
    if (!videoId || !videoRef.current) return;
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
  }, [videoId, episodeId]);

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
        s.setProgress(ct);
        s.setDuration(dur);
        onProgress?.(ct, dur);
      }
    };
    const handleEnded = () => { getStore().setPlaying(false); onEnded?.(); };
    const handleError = () => { onError?.(new Error('Video playback error')); };
    const handleVolumeChange = () => { getStore().setVolume(video.volume); };
    const handleRateChange = () => { getStore().setPlaybackRate(video.playbackRate); };
    const handleEnterPiP = () => { getStore().setIsPiP(true); };
    const handleLeavePiP = () => { getStore().setIsPiP(false); };
    const handleLoadedMetadata = () => { loadProgress(); };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    video.play().catch(() => {});

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

    // 在 effect 主体内捕获当前 progressSaveRef 快照，cleanup 时不再读取 ref
    const progressSaveSnapshot = progressSaveRef.current;

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);

      clearInterval(bandwidthTimer);

      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
      if (progressSaveSnapshot) {
        clearInterval(progressSaveSnapshot);
      }
    };
    // 内部用 usePlayerStore.getState() 读取最新 actions 与 props 闭包，避免 effect 频繁重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, type, decoderMode]);

  const play = useCallback(async () => {
    await videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current?.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
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
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    getIsPlaying: () => !videoRef.current?.paused,
  };
}

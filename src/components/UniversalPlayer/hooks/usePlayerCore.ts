import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { createAdapter } from '../adapters/adapterRegistry';
import { toast } from '@/components/ui';
import type { IPlayerAdapter } from '../adapters/PlayerAdapter';
import type { BasePlayerAdapter } from '../adapters/PlayerAdapter';
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
  const userPausedRef = useRef(false);

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
      // 匹配优先级：精确匹配 videoId+episodeId → videoId 且 episodeId 为空 → 仅 videoId 取最新
      const videoHistory = history.find(
        (h) => h.videoId === videoId && h.episodeId === episodeId
      ) || history.find(
        (h) => h.videoId === videoId && !h.episodeId && !episodeId
      ) || history.find(
        (h) => h.videoId === videoId
      );
      const video = videoRef.current;
      if (videoHistory && videoHistory.progress > 0 && video.duration && isFinite(video.duration)) {
        video.currentTime = Math.min(videoHistory.progress, video.duration - 1);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [videoId, episodeId, skipHistory]);

  const prevTypeRef = useRef<SourceType | null>(null);
  const pendingHotSwitchRef = useRef(false);

  // useLayoutEffect 在 useEffect cleanup 之前执行，提前标记热切换
  useLayoutEffect(() => {
    if (adapterRef.current && prevTypeRef.current === type && url && type) {
      pendingHotSwitchRef.current = true;
    }
  }, [url, type]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!type || !url) return;

    // 切换视频源时先暂停当前播放，避免声音残留
    if (!video.paused) {
      video.pause();
    }

    // 切换视频源时重置进度，避免显示上一集的时间
    const store = usePlayerStore.getState();
    store.setProgress(0);
    store.setDuration(0);
    store.setBufferedProgress(0);
    store.setPlayerLoading(true);
    store.setReadyToPlay(false);

    // 复用已有适配器热切换源（避免 destroy+recreate 导致的黑屏闪烁）
    if (adapterRef.current && prevTypeRef.current === type) {
      adapterRef.current.switchSource(url, { decoderMode, onError });
    } else {
      initAdapter();
    }
    prevTypeRef.current = type;

    video.volume = volume;
    video.playbackRate = playbackRate;
    video.disablePictureInPicture = false;

    // 监听 canplay 事件，加载完成时标记 readyToPlay
    const handleCanPlay = () => {
      usePlayerStore.getState().setPlayerLoading(false);
      usePlayerStore.getState().setReadyToPlay(true);
    };
    video.addEventListener('canplay', handleCanPlay);

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
    const handleLoadedMetadata = () => {
      const dur = video.duration;
      if (dur > 0 && isFinite(dur)) {
        getStore().setDuration(dur);
      }
      loadProgress();
    };

    // 解码字节增量上报状态：用于 estimator 的"解码字节"数据源
    // webkitVideoDecodedByteCount 在 Chrome/Safari/Edge/Android WebView 支持；
    // Firefox 不支持（恒为 undefined），estimator 内部降级到 PerformanceObserver。
    let lastDecodedBytes = 0;
    let lastDecodedAt = Date.now();

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        getStore().setBufferedProgress(bufferedEnd);
      }

      // 上报解码字节增量给 estimator（不依赖 bitrate，避免循环论证）
      const v = video as HTMLVideoElement & { webkitVideoDecodedByteCount?: number };
      const decoded = v.webkitVideoDecodedByteCount ?? 0;
      const adapter = adapterRef.current as BasePlayerAdapter | null;
      if (adapter && decoded > lastDecodedBytes) {
        const deltaBytes = decoded - lastDecodedBytes;
        const now = Date.now();
        const dtSec = (now - lastDecodedAt) / 1000;
        if (dtSec > 0 && deltaBytes > 0) {
          adapter.getEstimator().recordBufferedDelta(deltaBytes, dtSec);
        }
        lastDecodedBytes = decoded;
        lastDecodedAt = now;
      }
    };

    const handleNativeError = () => {
      const mediaError = video.error;
      if (!mediaError) return;
      // MEDIA_ERR_ABORTED (code 1) is user-initiated (pause/seek/switch episode) — not a playback failure
      if (mediaError.code === MediaError.MEDIA_ERR_ABORTED) return;
      let msg: string;
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          msg = '网络错误，无法加载视频';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          msg = '视频解码失败，可能仅播放音频';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg = '源不可用';
          break;
        default:
          msg = `播放错误 (${mediaError.code})`;
      }
      // If video is already playing (e.g. audio works), show non-blocking toast instead of error overlay
      if (!video.paused) {
        toast.show({ content: msg, duration: 5000 });
        return;
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

    // 每秒读取 adapter 估算值写入 store；adapter 内部已聚合 hls.js/PO/解码字节三路数据源
    const bandwidthTimer = setInterval(() => {
      const bps = adapterRef.current?.getBandwidthEstimate() ?? 0;
      getStore().setBandwidthEstimate(Number.isFinite(bps) && bps > 0 ? bps : 0);
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
      video.removeEventListener('canplay', handleCanPlay);

      clearInterval(bandwidthTimer);

      // 热切换时跳过销毁（useLayoutEffect 已在 cleanup 之前标记）
      if (pendingHotSwitchRef.current) {
        pendingHotSwitchRef.current = false;
        return;
      }

      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
    // 内部用 usePlayerStore.getState() 读取最新 actions 与 props 闭包，避免 effect 频繁重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, type, decoderMode, retryCount]);

  const play = useCallback(async () => {
    userPausedRef.current = false;
    try {
      const adapter = adapterRef.current;
      if (adapter) {
        await adapter.play();
      } else {
        await videoRef.current?.play();
      }
    } catch {
      toast.show({ content: '播放被浏览器拦截，请点击屏幕重试', duration: 3000 });
    }
  }, []);

  const pause = useCallback(() => {
    userPausedRef.current = true;
    const adapter = adapterRef.current;
    if (adapter) {
      adapter.pause();
    } else {
      videoRef.current?.pause();
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      userPausedRef.current = false;
      const adapter = adapterRef.current;
      if (adapter) {
        adapter.play().catch(() => {
          toast.show({ content: '播放被浏览器拦截，请点击屏幕重试', duration: 3000 });
        });
      } else {
        video.play().catch(() => {
          toast.show({ content: '播放被浏览器拦截，请点击屏幕重试', duration: 3000 });
        });
      }
    } else {
      userPausedRef.current = true;
      const adapter = adapterRef.current;
      if (adapter) {
        adapter.pause();
      } else {
        video.pause();
      }
    }
  }, []);

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

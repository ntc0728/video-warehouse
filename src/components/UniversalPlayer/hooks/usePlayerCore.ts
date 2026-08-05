import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/stores';
import { createAdapter } from '../adapters/adapterRegistry';
import { toast } from '@/components/ui';
import type { IPlayerAdapter } from '../adapters/PlayerAdapter';
import type { BasePlayerAdapter } from '../adapters/PlayerAdapter';
import type { DecoderMode, PlayerLevel } from '@/types/player';
import type { SourceType } from '@/types/video';
import type { AudioTrack } from '../adapters/PlayerAdapter';
import { useSkipLogic } from './useSkipLogic';
import { useProgressRestore } from './useProgressRestore';

/**
 * 播放器核心 Hook
 *
 * 管理播放器的核心功能：
 * - 视频源适配器的创建和销毁
 * - 播放/暂停/音量/倍速控制
 * - 播放进度上报
 * - 片头/片尾跳过
 * - 播放进度恢复
 * - 清晰度切换
 *
 * @param url - 视频源 URL
 * @param type - 视频源类型（m3u8/mp4/mpd 等）
 * @param videoId - TMDB 视频 ID
 * @param vodId - CMS 源的 vod_id
 * @param episodeUrl - 当前播放集的 URL（用于历史记录匹配）
 * @param cmsSourceId - CMS 源配置 ID（用于历史记录匹配）
 * @param skipHistory - 是否跳过历史记录恢复
 * @param autoPlay - 是否自动播放
 * @param decoderMode - 解码模式（硬件/软件）
 * @param retryCount - 重试次数（用于错误恢复）
 */
interface UsePlayerCoreOptions {
  /** 视频源 URL */
  url: string;
  /** 视频源类型（m3u8/mp4/mpd 等） */
  type: SourceType;
  /** TMDB 视频 ID */
  videoId?: string;
  /** CMS 源的 vod_id */
  vodId?: string;
  /** 当前播放集的 URL（用于历史记录匹配） */
  episodeUrl?: string;
  /** CMS 源配置 ID（用于历史记录匹配） */
  cmsSourceId?: string;
  /** 当前集标签（如 "第3集"），供进度恢复按「内容身份」匹配 */
  episodeLabel?: string;
  /** 当前季号（剧集播放时有值），供进度恢复按「内容身份」匹配 */
  seasonNumber?: number;
  /** 是否跳过历史记录恢复（用于"从头播放"场景） */
  skipHistory?: boolean;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 解码模式（硬件/软件） */
  decoderMode: DecoderMode;
  /** 重试次数（用于错误恢复） */
  retryCount?: number;
  /** 播放进度回调（ currentTime, duration ） */
  onProgress?: (progress: number, duration: number) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
  /** 开始播放回调 */
  onPlay?: () => void;
  /** 暂停播放回调 */
  onPause?: () => void;
  /** 播放错误回调 */
  onError?: (error: Error) => void;
  /** 跳过片头回调 */
  onSkipIntro?: () => void;
  /** 跳过片尾回调 */
  onSkipOutro?: () => void;
}

/**
 * 播放器核心 Hook
 * 管理视频播放器的核心功能：适配器、控制、进度、跳过、恢复
 */
export function usePlayerCore(options: UsePlayerCoreOptions) {
  const {
    url, type, videoId, vodId, episodeUrl, episodeLabel, seasonNumber, skipHistory = false, autoPlay = false, decoderMode, retryCount,
    onProgress, onEnded, onPlay, onPause, onError, onSkipIntro, onSkipOutro,
  } = options;

  /** video 元素的 ref */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** 播放器适配器的 ref（HLS/DASH/Native） */
  const adapterRef = useRef<IPlayerAdapter | null>(null);
  /** 切换播放/暂停的防抖定时器 */
  const togglePlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 当前音量（从 Zustand store 获取） */
  const volume = usePlayerStore(s => s.volume);
  /** 当前播放倍速（从 Zustand store 获取） */
  const playbackRate = usePlayerStore(s => s.playbackRate);
  /** 设置当前清晰度级别 */
  const setCurrentLevel = usePlayerStore(s => s.setCurrentLevel);
  /** 设置清晰度级别列表 */
  const setLevels = usePlayerStore(s => s.setLevels);

  /** 片头/片尾跳过逻辑 */
  const { checkSkipIntro, checkSkipOutro, reset: resetSkip } = useSkipLogic({ onSkipIntro, onSkipOutro, onEnded });
  /** 播放进度恢复逻辑 */
  const { loadProgress } = useProgressRestore({ videoId, vodId, episodeUrl, episodeLabel, seasonNumber, skipHistory });

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

    // 重置跳过标记
    resetSkip();

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
      // 热切换后重置清晰度为自动选择
      usePlayerStore.getState().setCurrentLevel(-1);
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
      if (autoPlay) {
        // IPTV 直播等场景：接口加载成功后直接播放，无需点击中间播放按钮
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // 自动播放被浏览器拦截（多因带声音且无用户手势），静音兜底重试一次，避免黑屏与播放按钮
            video.muted = true;
            const p2 = video.play();
            if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
          });
        }
      } else {
        usePlayerStore.getState().setPlaying(false);
      }
    };
    video.addEventListener('canplay', handleCanPlay);

    // 一次性获取最新 store actions，避免 effect 频繁重建
    const getStore = usePlayerStore.getState;
    const handlePlay = () => { getStore().setPlaying(true); onPlay?.(); };
    const handlePlaying = () => { getStore().setPlaying(true); };
    const handlePause = () => { getStore().setPlaying(false); onPause?.(); };
    const handleTimeUpdate = () => {
      const ct = video.currentTime;
      const dur = video.duration;
      if (dur > 0) {
        const s = getStore();

        // 跳过片头/片尾
        if (checkSkipIntro(video)) return;
        if (checkSkipOutro(video)) return;

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
      loadProgress(videoRef);
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
        toast.show({ content: msg, type: 'error' });
        return;
      }
      onError?.(new Error(msg));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlaying);
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
      video.removeEventListener('playing', handlePlaying);
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

  /**
   * episodeUrl 变化时重新恢复进度
   *
   * 场景：首次加载时 currentSrc 初始为 null，episodeUrl 也为 null，
   * 当 loadVideo 设置 currentSrc 后，episodeUrl 才有值。
   * 此 effect 监听 episodeUrl 变化，确保在 video 元素就绪后恢复进度。
   *
   * 条件：episodeUrl 有值 + video 元素存在 + 元数据已加载（readyState >= 1）
   */
  useEffect(() => {
    if (episodeUrl && videoRef.current && videoRef.current.readyState >= 1) {
      loadProgress(videoRef);
    }
  }, [episodeUrl, loadProgress]);

  const play = useCallback(async () => {
    try {
      const adapter = adapterRef.current;
      if (adapter) {
        await adapter.play();
      } else {
        await videoRef.current?.play();
      }
    } catch {
      toast.show({ content: '播放被浏览器拦截，请点击屏幕重试', type: 'warning' });
    }
  }, []);

  const pause = useCallback(() => {
    const adapter = adapterRef.current;
    if (adapter) {
      adapter.pause();
    } else {
      videoRef.current?.pause();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (togglePlayTimerRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      pause();
    }
    togglePlayTimerRef.current = setTimeout(() => {
      togglePlayTimerRef.current = null;
    }, 200);
  }, [play, pause]);

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

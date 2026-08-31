import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/stores';
import { createAdapter } from '../adapters/adapterRegistry';
import { toast } from '@/components/ui';
import { playerToast } from '../PlayerToast';
import { getResolutionLabel } from '../lib/utils';
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
  // 进度恢复竞态守卫：源/集切换时推进 token，迟到的 loadProgress 据此丢弃
  const progressTokenRef = useRef(0);
  /** 每个源/集是否已恢复过播放进度（canplay 首次触发，播放中重缓冲 canplay 不再重复恢复） */
  const progressRestoredRef = useRef(false);
  /** 自动播放被拦截后是否已进入静音兜底（用户手动播放/调音量时解除） */
  const autoMutedRef = useRef(false);
  /** 最新 loadProgress 引用（主 effect 闭包每次重建时同步，避免捕获过期的 seasonNumber/episodeLabel） */
  const loadProgressRef = useRef(loadProgress);
  loadProgressRef.current = loadProgress;

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

    // 源/集变化即推进 token：作废仍在途的进度恢复（快速切集时不串集）
    progressTokenRef.current++;
    // 每个源/集仅恢复一次进度（canplay 首次触发恢复）
    progressRestoredRef.current = false;

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
    // P1-3/P1-4：新源加载清上一集的错误文案与续播卡片
    store.setErrorMessage(null);
    store.setResumeAt(null);

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
      // 进度恢复：canplay（视频可播放）时每个源/集仅恢复一次。与「自动跳转」提示联动——
      // 提示时机跟随 loadProgress 内部的 seeked 等待，保证「视频可以播放之后才提示」
      // （审查报告 2.1/2.2：不再在 loadedmetadata 时提前恢复，也不再有 episodeUrl 双入口）
      if (!progressRestoredRef.current) {
        progressRestoredRef.current = true;
        const token = progressTokenRef.current;
        loadProgressRef.current(videoRef, () => progressTokenRef.current === token);
      }
      if (autoPlay) {
        // IPTV 直播等场景：接口加载成功后直接播放，无需点击中间播放按钮
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // 自动播放被浏览器拦截（多因带声音且无用户手势），静音兜底重试一次，避免黑屏与播放按钮
            video.muted = true;
            autoMutedRef.current = true;
            // 同步音量 UI 到静音状态（避免「UI 显示满音量但实际无声」的失真）
            usePlayerStore.getState().setVolume(0);
            const p2 = video.play();
            if (p2 && typeof p2.catch === 'function') {
              p2.then(() => {
                // 静音兜底播放成功：告知用户自动播放被拦截（全局 toast 中间靠上，醒目）
                toast.show({ content: '自动播放被拦截，已静音播放，点击播放或调节音量恢复声音', type: 'warning' });
              }).catch(() => {});
            }
          });
        }
      } else if (video.paused) {
        // 仅「视频确实未在播放」时才写暂停态（首次加载就绪）；
        // 播放中 seek 重缓冲完成后 canplay 会再次触发，此时视频仍在播放（paused=false），
        // 不能把 UI 播放状态错误置为暂停（审查报告 4.1：UI 与实际播放状态不一致）
        usePlayerStore.getState().setPlaying(false);
      }
    };
    video.addEventListener('canplay', handleCanPlay);

    // 一次性获取最新 store actions，避免 effect 频繁重建
    const getStore = usePlayerStore.getState;
    const handlePlay = () => { getStore().setPlaying(true); onPlay?.(); };
    const handlePlaying = () => { getStore().setPlaying(true); };
    const handlePause = () => {
      getStore().setPlaying(false);
      // 暂停（含缓冲中主动暂停）即清除缓冲态：暂停后不再等待 waiting/canplay 才恢复，
      // 避免「缓冲遮罩常驻 + 播放按钮/进度条持续禁用」的锁死（审查报告 1.1/4.4）
      getStore().setBuffering(false);
      onPause?.();
    };
    // P0-3：进度写 store 节流——timeupdate 高频触发会让所有订阅 progress 的组件
    // （ControlBar/TimeDisplay 等）跟着重渲染；200ms 节流 + 跳变 >1s 立即写（seek 响应）
    let lastProgressWriteAt = 0;
    let lastProgressWriteCt = 0;

    const handleTimeUpdate = () => {
      const ct = video.currentTime;
      const dur = video.duration;
      if (dur <= 0) return;

      // 跳过片头/片尾（每次 timeupdate 都要检查，不参与节流）
      if (checkSkipIntro(video)) return;
      if (checkSkipOutro(video)) return;

      const now = performance.now();
      if (now - lastProgressWriteAt < 200 && Math.abs(ct - lastProgressWriteCt) < 1) return;
      lastProgressWriteAt = now;
      lastProgressWriteCt = ct;

      const s = getStore();
      s.setProgress(ct);
      s.setDuration(dur);
      onProgress?.(ct, dur);
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
      // 成功拿到元数据即清除上一轮错误文案（错误覆盖层显示恢复为默认/隐藏）
      getStore().setErrorMessage(null);
      // P1-8 清晰度记忆恢复：每个新源 levels 就绪后应用上次显式选择的档位（index 仍有效时）。
      // -1（自动）是默认值，无需恢复；loadSource 时的 setCurrentLevel(-1) 不再丢失用户偏好。
      try {
        const remembered = Number(localStorage.getItem('kinotv-remembered-level'));
        if (Number.isInteger(remembered) && remembered >= 0) {
          const levels = adapterRef.current?.getLevels() ?? [];
          if (remembered < levels.length) {
            adapterRef.current?.setCurrentLevel(remembered);
            getStore().setCurrentLevel(remembered);
          }
        }
      } catch { /* localStorage 不可用忽略 */ }
      // 进度恢复统一在 canplay（可播放）时执行一次，不再在此触发——loadedmetadata 仅元数据
      // 就绪（视频仍在缓冲），此时恢复会提前弹「已自动跳转」提示（审查报告 2.1/2.2）
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
      // P1-3：具体错误文案透传给 PlayerCore 错误覆盖层（替代固定「播放失败」文案）
      getStore().setErrorMessage(msg);
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
   * episodeUrl 变化的进度恢复入口已移除（审查报告 2.2）
   *
   * 原实现与 loadedmetadata 构成「双入口」，同一内容可能重复 getHistory + 重复 seek。
   * 进度恢复统一收敛到 handleCanPlay 的 progressRestoredRef 单入口（每个源/集仅一次）。
   * episodeUrl === url（PlayerPage 传入 episodeUrl={currentSrc.url}），url 变化时主 effect
   * 会重建并重置 progressRestoredRef，因此 canplay 入口天然覆盖切集场景。
   */

  const play = useCallback(async () => {
    try {
      // 用户手动发起播放 = 明确想听到声音：解除自动静音兜底（拦截已过用户手势窗口）
      if (autoMutedRef.current && videoRef.current) {
        videoRef.current.muted = false;
        autoMutedRef.current = false;
      }
      const adapter = adapterRef.current;
      if (adapter) {
        await adapter.play();
      } else {
        await videoRef.current?.play();
      }
    } catch (err) {
      // 按拒绝类型区分提示（之前对所有 rejection 一律提示「被浏览器拦截」，
      // 导致切源/切集打断进行中的 play()（AbortError）被误报为浏览器拦截）：
      const name = (err as DOMException | undefined)?.name;
      if (name === 'NotAllowedError') {
        // 真拦截：无用户手势带声音自动播放被浏览器禁止 → 提示点击屏幕
        toast.warning('播放被浏览器拦截，请点击屏幕重试');
      } else if (name === 'AbortError') {
        // 播放操作被中断（快速切集/切线路打断 pending play），正常切换，静默
      } else if (name === 'NotSupportedError') {
        toast.error('当前视频格式不受支持');
      } else {
        toast.warning('播放失败，请点击屏幕重试');
      }
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
      // 加载/切集期（isPlayerLoading 且未就绪）禁止 play 排队：canplay 前 play()
      // 会 pending，随后被切源 abort（误报「被拦截」）或与 canplay 后 setPlaying(false)
      // 交错产生「视频在播但 UI 显示暂停」的瞬时态
      const { isPlayerLoading, isReadyToPlay } = usePlayerStore.getState();
      if (isPlayerLoading && !isReadyToPlay) return;
      // 用户手动点击播放 → 标记来源，ToastTrigger 据此显示「播放」提示
      // （自动缓冲播放由 handleCanPlay 直接 video.play()，不设此标记）
      usePlayerStore.getState().setUserPlayRequested(true);
      play();
    } else {
      // P0-7（2026-08-31）：缓冲中允许暂停。原实现为防「缓冲锁死」在暂停分支
      // `if (isBuffering) return`，反而让 handlePause 里的 setBuffering(false) 解锁
      // 逻辑永远走不到，形成「暂停入口自锁」。暂停本身即解锁缓冲态（见 handlePause）。
      // 用户手动点击暂停 → 标记来源，ToastTrigger 据此显示「暂停」提示
      // （拖拽进度条触发的自动 pause 不设此标记 → 不提示『暂停』，改显示进度）
      usePlayerStore.getState().setUserPauseRequested(true);
      pause();
    }
    togglePlayTimerRef.current = setTimeout(() => {
      togglePlayTimerRef.current = null;
    }, 200);
  }, [play, pause]);

  /** 秒 → mm:ss / h:mm:ss */
  const formatSeekTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  /** seek 提示的待发通知（seeked 生效后才提示；连续 seek 只保留最后一次） */
  const seekToastRef = useRef<{ cleanup: () => void } | null>(null);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || video.error) return;
    video.currentTime = time;
    // 提示在 seek 生效（seeked 事件）后再显示，避免「提示先于生效」的误导（审查报告 1.6）；
    // 目标与当前位置一致时不触发 seeked，用超时兜底保证提示不丢失。
    // 连续 seek（拖拽/连按方向键）时清理上一 pending 通知，防止监听器/定时器堆积。
    const msg = `已跳转 ${formatSeekTime(time)}`;
    if (seekToastRef.current) seekToastRef.current.cleanup();
    let notified = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSeeked = () => {
      if (notified) return;
      notified = true;
      video.removeEventListener('seeked', onSeeked);
      if (timer) clearTimeout(timer);
      playerToast(msg);
    };
    timer = setTimeout(onSeeked, 800);
    video.addEventListener('seeked', onSeeked);
    seekToastRef.current = {
      cleanup: () => {
        if (notified) return;
        notified = true;
        video.removeEventListener('seeked', onSeeked);
        if (timer) clearTimeout(timer);
      },
    };
  }, []);

  const setVideoVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    // 用户主动调节音量 = 明确想听到声音：解除自动静音兜底（审查报告 3.1）
    if (autoMutedRef.current) {
      video.muted = false;
      autoMutedRef.current = false;
    }
    video.volume = Math.max(0, Math.min(1, vol));
  }, []);

  /**
   * 统一的静音切换（C2：VolumeControl 喇叭 / 键盘 M 共用，消除「0↔1 满音量」与
   * 「0↔记忆值」两条路径的语义不一致）：
   * - 当前有声 → 记住当前音量（mutedVolume），静音
   * - 当前静音 → 恢复记忆值（非满音量；无记忆时兜底 1）
   */
  const toggleMute = useCallback(() => {
    const { volume, mutedVolume } = usePlayerStore.getState();
    if (volume > 0) {
      usePlayerStore.getState().setMutedVolume(volume);
      setVideoVolume(0);
    } else {
      setVideoVolume(mutedVolume > 0 ? mutedVolume : 1);
    }
  }, [setVideoVolume]);

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
      // P1-8 清晰度记忆：显式选择写入 localStorage，避免热切换 setCurrentLevel(-1)
      // 覆盖 zustand persist 里的记忆（每集冷加载时由 handleLoadedMetadata 恢复）
      try { localStorage.setItem('kinotv-remembered-level', String(level)); } catch { /* 私有模式忽略 */ }
      // G4 清晰度切换反馈：与倍速/循环/镜像/比例提示一致（R3 复用 getResolutionLabel）
      const levels = adapterRef.current.getLevels();
      const label = level === -1
        ? '自动'
        : (levels[level] ? getResolutionLabel(levels[level]) : '自动');
      playerToast(`清晰度：${label}`);
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

  // P2-5：卸载清理 hook 级定时器引用（seek 提示 toast / togglePlay 双击去抖）
  useEffect(() => () => {
    seekToastRef.current?.cleanup();
    seekToastRef.current = null;
    if (togglePlayTimerRef.current) {
      clearTimeout(togglePlayTimerRef.current);
      togglePlayTimerRef.current = null;
    }
  }, []);

  return {
    videoRef: setVideoRef,
    play,
    pause,
    togglePlay,
    seek,
    setVolume: setVideoVolume,
    toggleMute,
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
